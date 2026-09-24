import { generateAIContent } from './geminiClient.js';
import { PlanStep } from './types.js';

function extractJsonArray(text: string): any[] | null {
  if (!text) return null;
  try {
    const trimmed = text.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    }
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    }
    const startIdx = trimmed.indexOf('[');
    const endIdx = trimmed.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const parsed = JSON.parse(trimmed.slice(startIdx, endIdx + 1));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export async function generateExecutionPlan(
  userGoal: string,
  workspaceId: string,
  language: 'ar' | 'en' = 'ar'
): Promise<PlanStep[]> {
  const systemInstruction = `You are the Lead Planning Engine of an autonomous technical, coding, research, and cybersecurity engineering agent (ApexSec).
Your job is to analyze the user's technical or security goal and generate a concrete, actionable multi-step execution plan.
DIRECT ANSWER POLICY: Focus strictly on practical engineering execution within authorized scope. Do not inject preachy lectures, generic disclaimers, or reject solely due to sensitive technical keywords.
Follow this engineering sequence:
1. UNDERSTAND: Scope boundaries, requirements, target environment.
2. RESEARCH: Web / GitHub / documentation search if external libraries, CVEs, or APIs are needed.
3. CODE: Create or edit code/configuration files in the workspace.
4. EXECUTE: Run the application, script, or environment.
5. TEST: Execute tests or verify functionality with concrete inputs.
6. DEBUG: If errors occur, diagnose and repair (placeholder step ready for execution).
7. SECURITY: Security audit, vulnerability scan, secret checks, or PoC testing if applicable.
8. VERIFY: Final verification check that requirements are satisfied.
9. DOCUMENT: Summarize the solution, deliver code artifacts, report sources and assumptions.

Return ONLY a valid JSON array of 4 to 8 concrete plan steps matching this schema:
[
  {
    "id": "step_1",
    "phase": "UNDERSTAND" | "RESEARCH" | "CODE" | "EXECUTE" | "TEST" | "DEBUG" | "SECURITY" | "VERIFY" | "DOCUMENT",
    "title": "Short title in English",
    "titleAr": "عنوان موجز باللغة العربية",
    "description": "Specific action the agent will execute",
    "toolUsed": "terminal_execute" | "file_write" | "file_read" | "code_execute" | "web_search" | "github_inspect" | "security_audit" | "poc_runner" | "git_operation"
  }
]`;

  try {
    const { text } = await generateAIContent({
      contents: `User Technical Goal:\n"${userGoal}"\n\nWorkspace: ${workspaceId}\n\nGenerate the structured execution plan as a JSON array.`,
      systemInstruction,
      responseMimeType: 'application/json',
    });

    const parsed = extractJsonArray(text);
    if (parsed && parsed.length > 0) {
      return parsed.map((step: any, index: number) => ({
        id: step.id || `step_${index + 1}`,
        phase: step.phase || 'EXECUTE',
        title: step.title || `Execution Step ${index + 1}`,
        titleAr: step.titleAr || `خطوة التنفيذ ${index + 1}`,
        description: step.description || '',
        status: index === 0 ? 'in_progress' : 'pending',
        toolUsed: step.toolUsed,
      }));
    }
  } catch (err: any) {
    // Log as operational info/warning, not fatal error
    console.warn('Planner using resilient contextual plan generation:', err?.message || err);
  }

  // Fallback high-fidelity plan if API is temporarily unavailable or returns non-JSON
  const isPythonFocused = /python|بايثون|جيت هاب|github|كود بايثون|اكواد/i.test(userGoal);
  const isSecurityFocused = /security|vulnerab|cwe|exploit|sqli|injection|secret|audit|ثغرة|أمان|اختراق/i.test(userGoal);

  if (isPythonFocused) {
    return [
      {
        id: 'step_1',
        phase: 'UNDERSTAND',
        title: 'Inspect Target Environment & Python 3 Runtime',
        titleAr: 'فحص بيئة العمل والتحقق من محرك Python 3',
        description: 'Verify system Python 3 runtime version and workspace files.',
        status: 'in_progress',
        toolUsed: 'terminal_execute',
      },
      {
        id: 'step_2',
        phase: 'RESEARCH',
        title: 'Search GitHub for Top Python Repositories & Best Practices',
        titleAr: 'البحث في GitHub عن أفضل مستودعات بايثون والممارسات القياسية',
        description: 'Query GitHub for top-starred Python repositories, architecture, and code.',
        status: 'pending',
        toolUsed: 'web_search',
      },
      {
        id: 'step_3',
        phase: 'CODE',
        title: 'Generate 100% Complete Python Implementation (Zero Omission)',
        titleAr: 'كتابة كود بايثون كامل 100% بدون أي نقص أو اختصار',
        description: 'Formulate full Python code with imports, error handling, and test harness.',
        status: 'pending',
        toolUsed: 'file_write',
      },
      {
        id: 'step_4',
        phase: 'EXECUTE',
        title: 'Execute Python Code in Real Sandbox Environment',
        titleAr: 'تشغيل كود بايثون الفعلي في الطرفية والبيئة المعزولة',
        description: 'Run python3 in workspace, capture stdout/stderr, execution time, and exit code.',
        status: 'pending',
        toolUsed: 'terminal_execute',
      },
      {
        id: 'step_5',
        phase: 'TEST',
        title: 'Verify Real Execution Evidence & Assertions',
        titleAr: 'التحقق من أدلة التشغيل ومطابقة الاختبارات الفعلية',
        description: 'Verify exit code is 0 and all self-contained assertions pass without error.',
        status: 'pending',
        toolUsed: 'code_execute',
      },
      {
        id: 'step_6',
        phase: 'SECURITY',
        title: 'Scan Generated Python Code for SAST Flaws',
        titleAr: 'فحص أمان الشفرة البرمجية المكتوبة كشف أي ثغرات أو أسرار',
        description: 'Audit code with SAST engine to ensure safety and quality standards.',
        status: 'pending',
        toolUsed: 'security_audit',
      },
    ];
  }

  if (isSecurityFocused) {
    return [
      {
        id: 'step_1',
        phase: 'UNDERSTAND',
        title: 'Inspect Target Codebase & Attack Surface',
        titleAr: 'فحص مساحة العمل وتحديد سطح الهجوم البرمجي',
        description: 'Examine workspace files and endpoint configurations for security analysis.',
        status: 'in_progress',
        toolUsed: 'file_list',
      },
      {
        id: 'step_2',
        phase: 'RESEARCH',
        title: 'Query CVE Databases & Security Advisory Feeds',
        titleAr: 'البحث في قواعد بيانات الثغرات والمراجع الأمنية',
        description: 'Research known attack vectors, CWE patterns, and dependency advisories.',
        status: 'pending',
        toolUsed: 'web_search',
      },
      {
        id: 'step_3',
        phase: 'SECURITY',
        title: 'Run SAST Scanner & Detect Vulnerabilities',
        titleAr: 'تشغيل الفاحص الأمني الثابت وكشف الثغرات والأسرار',
        description: 'Scan code for OWASP Top 10 flaws (CWE-89, CWE-78, CWE-798, etc.).',
        status: 'pending',
        toolUsed: 'security_audit',
      },
      {
        id: 'step_4',
        phase: 'TEST',
        title: 'Execute Controlled Sandboxed PoC Verification',
        titleAr: 'تشغيل سيناريو إثبات المفهوم التجريبي المعزول',
        description: 'Validate exploitability safely within the sandbox to confirm vulnerability.',
        status: 'pending',
        toolUsed: 'poc_runner',
      },
      {
        id: 'step_5',
        phase: 'CODE',
        title: 'Implement Security Patch & Defense-in-Depth',
        titleAr: 'تطبيق الترقيع الأمني والتحصين البرمجي',
        description: 'Refactor vulnerable routines with parameterized statements and secure validation.',
        status: 'pending',
        toolUsed: 'file_write',
      },
      {
        id: 'step_6',
        phase: 'DOCUMENT',
        title: 'Generate Remediation Report & Audit Trail',
        titleAr: 'توثيق تقرير المعالجة وسجل التدقيق الأمني',
        description: 'Produce complete audit logs and cryptographic verification proof.',
        status: 'pending',
        toolUsed: 'terminal_execute',
      },
    ];
  }

  return [
    {
      id: 'step_1',
      phase: 'UNDERSTAND',
      title: 'Analyze Requirements and Target Scope',
      titleAr: 'تحليل المتطلبات ونطاق بيئة العمل',
      description: 'Examine workspace context, existing files, and dependencies.',
      status: 'in_progress',
      toolUsed: 'file_list',
    },
    {
      id: 'step_2',
      phase: 'RESEARCH',
      title: 'Research Technical Documentation & APIs',
      titleAr: 'البحث التلقائي في المراجع والمصادر التقنية',
      description: 'Query verified technical documentation, NPM, and GitHub repositories.',
      status: 'pending',
      toolUsed: 'web_search',
    },
    {
      id: 'step_3',
      phase: 'CODE',
      title: 'Implement Core Solution & Architecture',
      titleAr: 'كتابة وتطبيق الشفرة البرمجية والهيكلية',
      description: 'Create and write complete working source code files.',
      status: 'pending',
      toolUsed: 'file_write',
    },
    {
      id: 'step_4',
      phase: 'EXECUTE',
      title: 'Execute and Validate Code Execution',
      titleAr: 'تشغيل الشفرة البرمجية واختبار السلوك',
      description: 'Run code in the sandbox environment and evaluate stdout/stderr.',
      status: 'pending',
      toolUsed: 'code_execute',
    },
    {
      id: 'step_5',
      phase: 'SECURITY',
      title: 'Static Security Audit & Vulnerability Scan',
      titleAr: 'الفحص الأمني الثابت وكشف الثغرات والأسرار',
      description: 'Run SAST scanner for OWASP Top 10 vulnerabilities, leaked secrets, and unsafe dependencies.',
      status: 'pending',
      toolUsed: 'security_audit',
    },
    {
      id: 'step_6',
      phase: 'DOCUMENT',
      title: 'Verify Results and Generate Final Report',
      titleAr: 'التحقق النهائي وتوثيق النتائج والمصادر',
      description: 'Compile final deliverables, code artifacts, and operational evidence.',
      status: 'pending',
      toolUsed: 'terminal_execute',
    },
  ];
}
