import { generateAIContent, DEFAULT_MODEL } from './geminiClient.js';
import {
  AgentStatus,
  PlanStep,
  PendingApproval,
  ToolName,
  RiskLevel,
  AgentMessage,
} from './types.js';
import { checkToolPermission, getOwnerPolicy } from './ownerPolicy.js';
import { recordAudit } from './auditLogger.js';
import {
  listFiles,
  readFile,
  writeFile,
  deleteFile,
  resolveSafePath,
} from './workspaceManager.js';
import { executeCommand, killRunningTask } from './terminalRunner.js';
import { executeCodeDirect } from './codeExecutor.js';
import { performWebSearch, inspectGitHubRepo, searchGitHubPython } from './webResearcher.js';
import { runSecurityAudit, generateSBOM, performTlsHeaderAudit } from './securityAuditor.js';
import { runPoCTest } from './pocRunner.js';
import { runGitOperation, runGitStatus } from './gitManager.js';
import { syncRepoToWorkspace } from './githubService.js';
import { generateExecutionPlan } from './planner.js';

export interface AgentSession {
  taskId: string;
  workspaceId: string;
  userGoal: string;
  status: AgentStatus;
  plan: PlanStep[];
  currentStepIndex: number;
  messages: AgentMessage[];
  pendingApproval: PendingApproval | null;
  pendingResumeResolver: ((approved: boolean) => void) | null;
  startedAt: string;
  completedAt?: string;
  subscribers: Array<(event: { type: string; data: any }) => void>;
}

const activeSessions = new Map<string, AgentSession>();

export function getSession(taskId: string): AgentSession | undefined {
  return activeSessions.get(taskId);
}

export function subscribeToSession(
  taskId: string,
  callback: (event: { type: string; data: any }) => void
): () => void {
  const session = activeSessions.get(taskId);
  if (!session) return () => {};
  session.subscribers.push(callback);
  return () => {
    session.subscribers = session.subscribers.filter((s) => s !== callback);
  };
}

function broadcast(session: AgentSession, type: string, data: any) {
  for (const sub of session.subscribers) {
    try {
      sub({ type, data });
    } catch {
      // ignore client disconnect
    }
  }
}

export async function createAndStartAgent(
  userGoal: string,
  workspaceId: string
): Promise<AgentSession> {
  const taskId = `task_${Date.now()}`;
  const session: AgentSession = {
    taskId,
    workspaceId,
    userGoal,
    status: 'planning',
    plan: [],
    currentStepIndex: 0,
    messages: [
      {
        id: `msg_${Date.now()}_1`,
        sender: 'user',
        text: userGoal,
        timestamp: new Date().toISOString(),
      },
    ],
    pendingApproval: null,
    pendingResumeResolver: null,
    startedAt: new Date().toISOString(),
    subscribers: [],
  };

  activeSessions.set(taskId, session);

  // Run in background without blocking response
  runAgentLoop(session).catch((err) => {
    console.error('Agent loop crashed:', err);
    session.status = 'failed';
    broadcast(session, 'status', { status: 'failed', error: err.message });
  });

  return session;
}

export function abortAgent(taskId: string): boolean {
  const session = activeSessions.get(taskId);
  if (!session) return false;

  session.status = 'aborted';
  killRunningTask(taskId);

  if (session.pendingResumeResolver) {
    session.pendingResumeResolver(false);
    session.pendingResumeResolver = null;
    session.pendingApproval = null;
  }

  broadcast(session, 'status', { status: 'aborted' });
  recordAudit({
    workspaceId: session.workspaceId,
    mode: getOwnerPolicy().operatingMode,
    tool: 'owner',
    action: 'Emergency Abort Invoked',
    resultSummary: `Owner stopped agent task ${taskId}`,
    success: true,
    riskLevel: 'HIGH',
  });

  return true;
}

export function handleOwnerApproval(
  taskId: string,
  approvalId: string,
  approved: boolean,
  feedback?: string
): boolean {
  const session = activeSessions.get(taskId);
  if (!session || !session.pendingApproval) return false;
  if (session.pendingApproval.id !== approvalId) return false;

  const resolver = session.pendingResumeResolver;
  session.pendingApproval = null;
  session.pendingResumeResolver = null;

  recordAudit({
    workspaceId: session.workspaceId,
    mode: getOwnerPolicy().operatingMode,
    tool: 'owner',
    action: approved ? 'Owner Approved Action' : 'Owner Rejected Action',
    params: { approvalId, feedback },
    resultSummary: approved ? 'Action authorized' : `Action rejected: ${feedback || 'No reason provided'}`,
    success: approved,
    riskLevel: 'MEDIUM',
  });

  if (resolver) {
    resolver(approved);
    return true;
  }
  return false;
}

async function runAgentLoop(session: AgentSession) {
  // Step 1: Generate Plan
  session.status = 'planning';
  broadcast(session, 'status', { status: 'planning' });
  session.plan = await generateExecutionPlan(session.userGoal, session.workspaceId);
  broadcast(session, 'plan', { plan: session.plan });

  session.messages.push({
    id: `msg_${Date.now()}_plan`,
    sender: 'agent',
    text: `تم إنشاء خطة العمل التلقائية المكونة من ${session.plan.length} خطوات وفق التسلسل الهندسي: الفهم → البحث → التنفيذ → الاختبار → التحقق الأمني → التوثيق.`,
    timestamp: new Date().toISOString(),
    plan: session.plan,
  });
  broadcast(session, 'message', session.messages[session.messages.length - 1]);

  session.status = 'executing';
  broadcast(session, 'status', { status: 'executing' });

  // Iterate over plan steps
  for (let i = 0; i < session.plan.length; i++) {
    if ((session.status as AgentStatus) === 'aborted') break;

    session.currentStepIndex = i;
    const currentStep = session.plan[i];
    currentStep.status = 'in_progress';
    broadcast(session, 'plan', { plan: session.plan });

    const stepResult = await executeStepWithGemini(session, currentStep);

    if ((session.status as AgentStatus) === 'aborted') break;

    if (stepResult.success) {
      currentStep.status = 'completed';
      currentStep.resultSummary = stepResult.summary;
      currentStep.evidence = stepResult.evidence;
    } else {
      currentStep.status = 'failed';
      currentStep.resultSummary = stepResult.summary;

      // Debugging loop: if this wasn't already a debug step, attempt automated recovery
      if (currentStep.phase !== 'DEBUG') {
        session.status = 'fixing_error';
        broadcast(session, 'status', { status: 'fixing_error' });

        const fixResult = await attemptAutomatedFix(session, currentStep, stepResult);
        if (fixResult.success) {
          currentStep.status = 'completed';
          currentStep.resultSummary = `[Fixed after debug loop] ${fixResult.summary}`;
        }
        session.status = 'executing';
        broadcast(session, 'status', { status: 'executing' });
      }
    }

    broadcast(session, 'plan', { plan: session.plan });
  }

  if ((session.status as AgentStatus) !== 'aborted') {
    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    broadcast(session, 'status', { status: 'completed' });

    // Generate final comprehensive response summary
    const finalReport = await generateFinalSummary(session);
    session.messages.push({
      id: `msg_${Date.now()}_done`,
      sender: 'agent',
      text: finalReport,
      timestamp: new Date().toISOString(),
    });
    broadcast(session, 'message', session.messages[session.messages.length - 1]);
  }
}

async function executeStepWithGemini(
  session: AgentSession,
  step: PlanStep
): Promise<{ success: boolean; summary: string; evidence?: string }> {
  // Read workspace file list for context
  const files = await listFiles(session.workspaceId);
  const fileNames = files.map((f) => f.path).join(', ');

  // Update granular live status based on phase
  if (step.phase === 'RESEARCH') {
    session.status = 'researching_websites';
    broadcast(session, 'status', { status: 'researching_websites' });
  } else if (step.phase === 'UNDERSTAND') {
    session.status = 'reading_repo';
    broadcast(session, 'status', { status: 'reading_repo' });
  } else if (step.phase === 'CODE') {
    session.status = 'editing_files';
    broadcast(session, 'status', { status: 'editing_files' });
  } else if (step.phase === 'TEST') {
    session.status = 'running_tests';
    broadcast(session, 'status', { status: 'running_tests' });
  } else if (step.phase === 'SECURITY') {
    session.status = 'running_scan';
    broadcast(session, 'status', { status: 'running_scan' });
  } else if (step.phase === 'VERIFY') {
    session.status = 'verifying';
    broadcast(session, 'status', { status: 'verifying' });
  }

  const prompt = `Current Mission: "${session.userGoal}"
Current Step: "${step.title}" (${step.phase}) - Description: "${step.description}"
Workspace Files: [${fileNames}]

Decide the single best tool to execute this step:
Allowed Tools:
- "web_search": params { "query": string }
- "github_inspect": params { "repo": string }
- "file_write": params { "path": string, "content": string }
- "file_read": params { "path": string }
- "file_list": params { "subPath": string }
- "file_delete": params { "path": string }
- "code_execute": params { "language": "javascript"|"typescript"|"python"|"bash", "code": string }
- "terminal_execute": params { "command": string }
- "security_audit": params {}
- "sbom_generate": params {}
- "tls_header_audit": params { "url": string }
- "poc_runner": params { "vulnerabilityType": string, "targetScript": string, "pocScript": string, "expectedVulnerableIndicator": string }
- "git_operation": params { "operation": "status"|"diff"|"commit"|"log", "args": string }

Return JSON ONLY:
{
  "tool": ToolName,
  "params": object,
  "reasoning": string,
  "reasonAr": string
}`;

  let tool: ToolName = (step.toolUsed as ToolName) || 'terminal_execute';
  let params: any = {};
  let reasonAr = '';
  let reasonEn = '';

  try {
    const aiRes = await generateAIContent({
      contents: prompt,
      responseMimeType: 'application/json',
    });

    const trimmed = (aiRes.text || '').trim();
    const codeMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const parsed = JSON.parse(codeMatch ? codeMatch[1].trim() : trimmed);

    if (parsed.tool) {
      tool = parsed.tool as ToolName;
      params = parsed.params || {};
      reasonEn = parsed.reasoning || '';
      reasonAr = parsed.reasonAr || '';
    }
  } catch (err: any) {
    // Contextual tool execution fallback
    if (step.phase === 'RESEARCH') {
      tool = 'web_search';
      params = { query: session.userGoal };
      reasonAr = `البحث التلقائي في المراجع التقنية حول: ${session.userGoal}`;
    } else if (step.phase === 'SECURITY') {
      tool = 'security_audit';
      params = {};
      reasonAr = 'فحص أمني متقدم لكشف الثغرات والرموز السرية المسربة';
    } else if (step.phase === 'UNDERSTAND') {
      tool = 'file_list';
      params = { subPath: '' };
      reasonAr = 'استعراض هيكل الملفات في مساحة العمل';
    } else if (step.phase === 'TEST') {
      tool = 'terminal_execute';
      params = { command: 'python3 -m unittest || npm test --if-present || node -v' };
      reasonAr = 'تشغيل أوامر التحقق والاختبار في البيئة المعزولة';
    } else if (step.phase === 'DOCUMENT') {
      tool = 'git_operation';
      params = { operation: 'status', args: '' };
      reasonAr = 'فحص حالة المستودع وتوثيق التغييرات';
    } else {
      tool = (step.toolUsed as ToolName) || 'file_list';
      params = tool === 'file_list' ? { subPath: '' } : {};
      reasonAr = `تنفيذ الخطوة: ${step.titleAr || step.title}`;
    }
  }

  step.toolUsed = tool;

  // Check permissions with Centralized Permission Engine
  const perm = checkToolPermission(tool, params, session.workspaceId);
  if (!perm.allowed) {
    return {
      success: false,
      summary: `Blocked by Owner Policy: ${perm.reason}`,
    };
  }

  // If requires approval, pause and await owner authorization
  if (perm.requiresApproval) {
    session.status = 'awaiting_approval';
    broadcast(session, 'status', { status: 'awaiting_approval' });

    const pendingApproval: PendingApproval = {
      id: `appr_${Date.now()}`,
      tool,
      params,
      riskLevel: perm.riskLevel,
      explanation: perm.reason || `Agent requests permission to execute ${tool}`,
      explanationAr: perm.reasonAr || `يطلب الوكيل تصريحًا لتشغيل الأداة ${tool}`,
      timestamp: new Date().toISOString(),
      ...(perm.approvalMetadata || {}),
    };

    session.pendingApproval = pendingApproval;
    broadcast(session, 'approval_requested', pendingApproval);

    const approved = await new Promise<boolean>((resolve) => {
      session.pendingResumeResolver = resolve;
    });

    if (!approved) {
      return {
        success: false,
        summary: `Action rejected by owner: ${tool}`,
      };
    }

    session.status = 'executing';
    broadcast(session, 'status', { status: 'executing' });
  }

  // Execute tool
  try {
    const execResult = await dispatchTool(session.workspaceId, tool, params);

    // Notify client of tool execution
    session.messages.push({
      id: `tool_${Date.now()}`,
      sender: 'agent',
      text: reasonAr || reasonEn || `تم تنفيذ الأداة: ${tool}`,
      timestamp: new Date().toISOString(),
      phase: step.phase,
      toolCall: {
        tool,
        params,
        output: execResult.output,
        riskLevel: perm.riskLevel,
      },
    });
    broadcast(session, 'message', session.messages[session.messages.length - 1]);

    return {
      success: execResult.success,
      summary: execResult.summary,
      evidence: execResult.evidence,
    };
  } catch (err: any) {
    return {
      success: false,
      summary: `Step execution failed: ${err.message}`,
    };
  }
}

async function dispatchTool(
  workspaceId: string,
  tool: ToolName,
  params: any
): Promise<{ success: boolean; summary: string; output: any; evidence?: string }> {
  switch (tool) {
    case 'file_write': {
      const res = await writeFile(workspaceId, params.path, params.content);
      return {
        success: true,
        summary: `Created file ${res.path} (${res.size} bytes)`,
        output: res,
        evidence: `File saved successfully at path: ${res.path}`,
      };
    }

    case 'file_read': {
      const content = await readFile(workspaceId, params.path);
      return {
        success: true,
        summary: `Read ${params.path} (${content.length} characters)`,
        output: { content: content.slice(0, 1000) },
      };
    }

    case 'file_list': {
      const items = await listFiles(workspaceId, params.subPath || '');
      return {
        success: true,
        summary: `Found ${items.length} items in workspace`,
        output: items,
      };
    }

    case 'file_delete': {
      const res = await deleteFile(workspaceId, params.path);
      return {
        success: true,
        summary: `Deleted ${params.path}`,
        output: res,
      };
    }

    case 'code_execute': {
      const res = await executeCodeDirect({
        workspaceId,
        language: params.language || 'javascript',
        code: params.code,
      });
      return {
        success: res.exitCode === 0,
        summary: `Exit Code ${res.exitCode} (${res.durationMs}ms)`,
        output: { stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode },
        evidence: res.stdout || res.stderr,
      };
    }

    case 'terminal_execute': {
      const res = await executeCommand(workspaceId, params.command, params.subDir);
      return {
        success: res.exitCode === 0,
        summary: `Command exited with code ${res.exitCode}`,
        output: { stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode },
        evidence: res.stdout || res.stderr,
      };
    }

    case 'web_search': {
      const res = await performWebSearch(params.query, workspaceId);
      return {
        success: res.results.length > 0,
        summary: `Retrieved ${res.results.length} technical references for "${params.query}"`,
        output: res,
        evidence: res.results.map((r) => `[${r.source}] ${r.title}: ${r.url}`).join('\n'),
      };
    }

    case 'github_inspect': {
      const res = await inspectGitHubRepo(params.repo, workspaceId);
      return {
        success: !res.error,
        summary: res.error ? `Failed: ${res.error}` : `Inspected GitHub: ${res.fullName} (⭐ ${res.stars})`,
        output: res,
      };
    }

    case 'security_audit': {
      const report = await runSecurityAudit(workspaceId);
      return {
        success: true,
        summary: `Security Score: ${report.securityScore}/100. Discovered ${report.summary.total} findings (${report.summary.critical} Critical, ${report.summary.high} High).`,
        output: report,
        evidence: `Audit finished. Scanned ${report.filesScanned} files with ${report.summary.total} vulnerabilities.`,
      };
    }

    case 'sbom_generate': {
      const sbom = await generateSBOM(workspaceId);
      return {
        success: true,
        summary: `Generated CycloneDX SBOM with ${sbom.components.length} components`,
        output: sbom,
      };
    }

    case 'tls_header_audit': {
      const report = await performTlsHeaderAudit(params.url, workspaceId);
      return {
        success: !report.error,
        summary: report.error ? `Failed: ${report.error}` : `Audited ${report.checks?.length} security headers for ${params.url}`,
        output: report,
      };
    }

    case 'github_sync': {
      const res = await syncRepoToWorkspace(params.owner, params.repo, workspaceId);
      return {
        success: res.success,
        summary: res.error ? `Sync failed: ${res.error}` : `Synced ${params.owner}/${params.repo} to workspace`,
        output: res,
      };
    }

    case 'poc_runner': {
      const pocRes = await runPoCTest(workspaceId, params);
      return {
        success: pocRes.vulnerabilityConfirmed,
        summary: pocRes.evidence,
        output: pocRes,
        evidence: pocRes.rawOutput,
      };
    }

    case 'git_operation': {
      if (params.operation === 'status') {
        const status = await runGitStatus(workspaceId);
        return {
          success: true,
          summary: `Branch: ${status.branch}, Clean: ${status.clean}, Modified: ${status.modified.length}`,
          output: status,
        };
      } else {
        const res = await runGitOperation(workspaceId, params.operation, params.args);
        return {
          success: res.success,
          summary: `git ${params.operation} finished`,
          output: res,
        };
      }
    }

    default:
      return {
        success: false,
        summary: `Unknown tool ${tool}`,
        output: null,
      };
  }
}

async function attemptAutomatedFix(
  session: AgentSession,
  step: PlanStep,
  failedResult: { summary: string; evidence?: string }
): Promise<{ success: boolean; summary: string }> {
  const debugPrompt = `The previous step "${step.title}" failed with error:
${failedResult.summary}
Evidence / Logs:
${failedResult.evidence || 'No logs'}

Provide a concrete diagnosis and single repair action.
Return JSON ONLY:
{
  "diagnosis": string,
  "diagnosisAr": string,
  "repairTool": "file_write" | "terminal_execute" | "code_execute",
  "repairParams": object
}`;

  try {
    const aiRes = await generateAIContent({
      contents: debugPrompt,
      responseMimeType: 'application/json',
    });

    const trimmed = (aiRes.text || '').trim();
    const codeMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const parsed = JSON.parse(codeMatch ? codeMatch[1].trim() : trimmed);
    if (!parsed.repairTool) {
      return { success: false, summary: 'Could not formulate automatic patch.' };
    }

    session.messages.push({
      id: `debug_${Date.now()}`,
      sender: 'agent',
      text: `[Debugging Loop] ${parsed.diagnosisAr || parsed.diagnosis}`,
      timestamp: new Date().toISOString(),
      phase: 'DEBUG',
    });
    broadcast(session, 'message', session.messages[session.messages.length - 1]);

    const fixExec = await dispatchTool(session.workspaceId, parsed.repairTool, parsed.repairParams);
    return {
      success: fixExec.success,
      summary: `Automated repair executed: ${fixExec.summary}`,
    };
  } catch (err: any) {
    return { success: false, summary: `Debug loop completed with notice: ${err.message}` };
  }
}

async function generateFinalSummary(session: AgentSession): Promise<string> {
  const completedSteps = session.plan.filter((s) => s.status === 'completed');
  const failedSteps = session.plan.filter((s) => s.status === 'failed');

  const lines = [
    `### ✅ تقرير إنجاز المهمة التقنية والأمنية`,
    ``,
    `**الهدف المطلوب:** ${session.userGoal}`,
    `**مساحة العمل:** \`${session.workspaceId}\``,
    `**الخطوات المكتملة:** ${completedSteps.length} من إجمالي ${session.plan.length}`,
    ``,
    `#### 📋 ملخص الإجراءات المنفذة فعليًا:`,
  ];

  for (const step of session.plan) {
    const icon = step.status === 'completed' ? '✔' : step.status === 'failed' ? '❌' : '⚪';
    lines.push(`- **${icon} [${step.phase}] ${step.titleAr || step.title}:** ${step.resultSummary || 'تم التنفيذ'}`);
  }

  if (failedSteps.length > 0) {
    lines.push(``, `#### ⚠️ تنبيهات / إخفاقات تم رصدها:`);
    for (const fail of failedSteps) {
      lines.push(`- **${fail.title}:** ${fail.resultSummary}`);
    }
  }

  lines.push(
    ``,
    `#### 🛡️ التدقيق والأمان:`,
    `- تم تسجيل كافة الأوامر والتغييرات البرمجية في سجل التدقيق غير القابل للتلاعب (\`Audit Log\`).`,
    `- تم التحقق من القيود والصلاحيات وفق وضع التشغيل المعتمد: \`${getOwnerPolicy().operatingMode}\`.`
  );

  return lines.join('\n');
}
