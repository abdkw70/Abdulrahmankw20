import fs from 'node:fs/promises';
import path from 'node:path';
import {
  OwnerPolicy,
  OperatingMode,
  AutonomyLevel,
  ToolName,
  RiskLevel,
  PendingApproval,
} from './types.js';
import { validateScope, ScopeValidationResult } from './scopeValidator.js';
import { recordAudit } from './auditLogger.js';

const DATA_DIR = path.resolve(process.cwd(), 'agent_data');
const POLICY_FILE = path.join(DATA_DIR, 'owner_policy.json');

export const DEFAULT_OWNER_POLICY: OwnerPolicy = {
  operatingMode: 'unrestricted',
  autonomyLevel: 'unrestricted',
  allowNonCriticalAlertBypassAfterReview: true,
  authorizedScopes: {
    repositories: ['*'],
    domains: [
      '*',
      'github.com',
      'api.github.com',
      'registry.npmjs.org',
      'pypi.org',
      'en.wikipedia.org',
      'duckduckgo.com',
      'cve.org',
      'nvd.nist.gov',
      'owasp.org',
    ],
    paths: ['*'],
  },
  terminal: {
    enabled: true,
    requireApproval: false,
    disallowedCommands: [
      'rm -rf /',
      'mkfs',
      ':(){ :|:& };:',
      'dd if=/dev/zero',
      '> /dev/sda',
      'chmod -R 777 /',
    ],
    timeoutSeconds: 30,
  },
  filesystem: {
    writeEnabled: true,
    deleteEnabled: true,
    requireApprovalForDelete: false,
    requireApprovalForOverwrite: false,
  },
  network: {
    enabled: true,
    requireApprovalForOutbound: false,
    allowedDomains: ['*'],
  },
  codeExecution: {
    enabled: true,
    requireApproval: false,
    timeoutSeconds: 30,
    maxOutputLength: 20000,
  },
  securityLab: {
    enabled: true,
    allowPocExecution: true,
    isolatedLabOnly: true,
  },
  git: {
    enabled: true,
    requireApprovalForPushOrCommit: false,
  },
};

let cachedPolicy: OwnerPolicy = { ...DEFAULT_OWNER_POLICY };

function normalizeMode(modeOrAutonomy: string | undefined): OperatingMode {
  if (modeOrAutonomy === 'cautious' || modeOrAutonomy === 'strict') {
    return 'cautious';
  }
  if (modeOrAutonomy === 'medium' || modeOrAutonomy === 'semi_supervised') {
    return 'medium';
  }
  return 'unrestricted';
}

export async function initOwnerPolicy(): Promise<OwnerPolicy> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const content = await fs.readFile(POLICY_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    const mode = normalizeMode(parsed.operatingMode || parsed.autonomyLevel);
    cachedPolicy = {
      ...DEFAULT_OWNER_POLICY,
      ...parsed,
      operatingMode: mode,
      autonomyLevel: mode,
    };
  } catch {
    cachedPolicy = { ...DEFAULT_OWNER_POLICY };
    await fs.writeFile(POLICY_FILE, JSON.stringify(cachedPolicy, null, 2), 'utf-8');
  }
  return cachedPolicy;
}

export function getOwnerPolicy(): OwnerPolicy {
  return cachedPolicy;
}

export interface ModeSwitchSummary {
  previousMode: OperatingMode;
  newMode: OperatingMode;
  direction: 'LESS_RESTRICTIVE' | 'MORE_RESTRICTIVE' | 'SAME';
  changedPermissions: string[];
  changedPermissionsAr: string[];
  requiresReconfirmationForSensitiveTasks: boolean;
}

export async function switchOperatingMode(newModeInput: OperatingMode): Promise<{ policy: OwnerPolicy; summary: ModeSwitchSummary }> {
  const previousMode = cachedPolicy.operatingMode;
  const newMode = normalizeMode(newModeInput);

  let direction: 'LESS_RESTRICTIVE' | 'MORE_RESTRICTIVE' | 'SAME' = 'SAME';
  const modeWeights: Record<OperatingMode, number> = {
    cautious: 1,
    medium: 2,
    unrestricted: 3,
  };

  if (modeWeights[newMode] > modeWeights[previousMode]) {
    direction = 'LESS_RESTRICTIVE';
  } else if (modeWeights[newMode] < modeWeights[previousMode]) {
    direction = 'MORE_RESTRICTIVE';
  }

  const changedPermissions: string[] = [];
  const changedPermissionsAr: string[] = [];

  if (newMode === 'unrestricted') {
    changedPermissions.push(
      'Routine multi-step tasks execute automatically without prompting.',
      'All owner-granted tools (Terminal, Files, Code, Git, Web Research) run autonomously within authorized workspace.',
      'Automated planner, tool router, and self-repair verification loop activated.',
      'No prompt required for low/medium risk commands and test executions.'
    );
    changedPermissionsAr.push(
      'تنفيذ المهام المتعددة الروتينية تلقائياً دون طلب تأكيد لكل خطوة.',
      'استخدام كافة الأدوات الممنوحة (الطرفية، الملفات، الأكواد، Git، البحث) باستقلالية ضمن البيئة المصرح بها.',
      'تفعيل حلقة التخطيط والتوجيه الذاتي والتصحيح وإعادة الاختبار التلقائي عند الأخطاء.',
      'عدم طلب موافقة على الأوامر والاختبارات الروتينية المنخفضة والمتوسطة.'
    );

    cachedPolicy.terminal.requireApproval = false;
    cachedPolicy.filesystem.requireApprovalForDelete = false;
    cachedPolicy.filesystem.requireApprovalForOverwrite = false;
    cachedPolicy.network.requireApprovalForOutbound = false;
    cachedPolicy.codeExecution.requireApproval = false;
    cachedPolicy.git.requireApprovalForPushOrCommit = false;
  } else if (newMode === 'medium') {
    changedPermissions.push(
      'Automatic web research, code analysis, and workspace file editing allowed.',
      'Low-risk commands and tests run automatically.',
      'Defensive security scans (SAST, Dependency, Secret) run automatically.',
      'High-impact actions (Push, Merge, Delete, External scans) require owner approval.'
    );
    changedPermissionsAr.push(
      'السماح بالبحث التلقائي في الإنترنت، وقراءة وتحليل الشفرات، وتعديل ملفات مساحة العمل.',
      'تشغيل الاختبارات والأوامر منخفضة المخاطر تلقائياً.',
      'تشغيل الفحوصات الدفاعية غير المؤثرة (SAST، فحص التبعيات، كشف الأسرار) تلقائياً.',
      'طلب موافقة المالك قبل العمليات المؤثرة مثل Push أو Merge أو حذف ملفات مهمة أو فحص خارجي.'
    );

    cachedPolicy.terminal.requireApproval = true;
    cachedPolicy.filesystem.requireApprovalForDelete = true;
    cachedPolicy.filesystem.requireApprovalForOverwrite = false;
    cachedPolicy.network.requireApprovalForOutbound = false;
    cachedPolicy.codeExecution.requireApproval = false;
    cachedPolicy.git.requireApprovalForPushOrCommit = true;
  } else {
    // Cautious (بحذر)
    changedPermissions.push(
      'Strict manual authorization required for any impactful command or sensitive file modification.',
      'No Push, Merge, Delete, or Deploy without explicit owner approval.',
      'External tool calls and network requests require explicit user confirmation with full disclosure.',
      'Critical security alerts can NEVER be bypassed automatically.',
      'Non-critical alert bypass allowed only after explicit review.'
    );
    changedPermissionsAr.push(
      'مراجعة صارمة وموافقة صريحة مطلوبة قبل أي أمر مؤثر أو تعديل على ملفات حساسة.',
      'منع Push أو Merge أو الحذف أو النشر بدون موافقة صريحة مسبقة.',
      'طلب موافقة صريحة قبل أي فحص خارجي أو طلب شبكة مع إظهار تفاصيل العملية كاملة.',
      'منع تجاوز الإخطارات الأمنية الحرجة تماماً.',
      'السماح بتجاوز الإخطارات غير الحرجة فقط بعد المراجعة اليدوية وتسجيلها في سجل التدقيق.'
    );

    cachedPolicy.terminal.requireApproval = true;
    cachedPolicy.filesystem.requireApprovalForDelete = true;
    cachedPolicy.filesystem.requireApprovalForOverwrite = true;
    cachedPolicy.network.requireApprovalForOutbound = true;
    cachedPolicy.codeExecution.requireApproval = true;
    cachedPolicy.git.requireApprovalForPushOrCommit = true;
  }

  cachedPolicy.operatingMode = newMode;
  cachedPolicy.autonomyLevel = newMode;

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(POLICY_FILE, JSON.stringify(cachedPolicy, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist owner policy mode:', err);
  }

  // Audit mode change
  await recordAudit({
    workspaceId: 'system',
    user: 'Owner',
    mode: newMode,
    tool: 'owner',
    action: `Switched Operating Mode from "${previousMode}" to "${newMode}"`,
    resultSummary: `Operating mode set to ${newMode}. Direction: ${direction}`,
    success: true,
    riskLevel: 'LOW',
  });

  const summary: ModeSwitchSummary = {
    previousMode,
    newMode,
    direction,
    changedPermissions,
    changedPermissionsAr,
    requiresReconfirmationForSensitiveTasks: direction === 'MORE_RESTRICTIVE',
  };

  return { policy: cachedPolicy, summary };
}

export async function updateOwnerPolicy(newPolicy: Partial<OwnerPolicy>): Promise<OwnerPolicy> {
  const mode = newPolicy.operatingMode || (newPolicy.autonomyLevel ? normalizeMode(newPolicy.autonomyLevel) : cachedPolicy.operatingMode);

  cachedPolicy = {
    ...cachedPolicy,
    ...newPolicy,
    operatingMode: mode,
    autonomyLevel: mode,
    authorizedScopes: {
      ...cachedPolicy.authorizedScopes,
      ...(newPolicy.authorizedScopes || {}),
    },
    terminal: { ...cachedPolicy.terminal, ...(newPolicy.terminal || {}) },
    filesystem: { ...cachedPolicy.filesystem, ...(newPolicy.filesystem || {}) },
    network: { ...cachedPolicy.network, ...(newPolicy.network || {}) },
    codeExecution: { ...cachedPolicy.codeExecution, ...(newPolicy.codeExecution || {}) },
    securityLab: { ...cachedPolicy.securityLab, ...(newPolicy.securityLab || {}) },
    git: { ...cachedPolicy.git, ...(newPolicy.git || {}) },
  };

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(POLICY_FILE, JSON.stringify(cachedPolicy, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist owner policy:', err);
  }

  return cachedPolicy;
}

export interface PermissionCheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  requireApproval?: boolean; // alias for compatibility
  reason?: string;
  reasonAr?: string;
  riskLevel: RiskLevel;
  approvalMetadata?: Partial<PendingApproval>;
}

/**
 * CENTRALIZED PERMISSION ENGINE
 * Pipeline: Mode -> Policy Engine -> Scope Validator -> Security Alert Manager -> Tool Router -> Tool -> Audit Log
 */
export function checkToolPermission(tool: ToolName, params: any, workspaceId = 'default-workspace'): PermissionCheckResult {
  const res = checkToolPermissionCore(tool, params, workspaceId);
  res.requireApproval = res.requiresApproval;
  return res;
}

function checkToolPermissionCore(tool: ToolName, params: any, workspaceId = 'default-workspace'): PermissionCheckResult {
  const policy = getOwnerPolicy();
  const mode = policy.operatingMode;

  // 1. Inherent Blacklist & Disallowed Command Filter: NEVER allowed regardless of mode
  if (tool === 'terminal_execute') {
    if (!policy.terminal.enabled) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: 'Terminal execution is disabled in Owner Policy.',
        reasonAr: 'تشغيل أوامر الطرفية معطل في إعدادات المالك.',
        riskLevel: 'HIGH',
      };
    }

    const cmd = String(params?.command || '');
    const cmdScope = validateScope(policy, 'COMMAND', cmd);
    if (!cmdScope.valid) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: cmdScope.reason,
        reasonAr: cmdScope.reasonAr,
        riskLevel: cmdScope.riskLevel,
      };
    }
  }

  // 2. Scope Validation for Filesystem
  if (tool === 'file_write' || tool === 'file_read' || tool === 'file_delete') {
    const filePath = String(params?.path || params?.filePath || '');
    if (filePath) {
      const pathScope = validateScope(policy, 'PATH', filePath);
      if (!pathScope.valid) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: pathScope.reason,
          reasonAr: pathScope.reasonAr,
          riskLevel: pathScope.riskLevel,
        };
      }
    }
  }

  // 3. Scope Validation for Network
  if (tool === 'web_search' || tool === 'github_inspect' || tool === 'tls_header_audit') {
    const targetDomain = String(params?.domain || params?.url || params?.repo || '');
    if (targetDomain && tool === 'tls_header_audit') {
      const domainScope = validateScope(policy, 'DOMAIN', targetDomain);
      if (!domainScope.valid) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: domainScope.reason,
          reasonAr: domainScope.reasonAr,
          riskLevel: domainScope.riskLevel,
        };
      }
    }
  }

  // 4. MODE EVALUATION
  // --- MODE: CAUTIOUS ("بحذر") ---
  if (mode === 'cautious') {
    // In cautious mode:
    // Safe read-only actions (read files, list files, SAST read-only audit) are allowed without block
    if (tool === 'file_read' || tool === 'file_list' || tool === 'security_audit' || tool === 'dependency_scan' || tool === 'sbom_generate') {
      return {
        allowed: true,
        requiresApproval: false,
        riskLevel: 'LOW',
      };
    }

    // Web search is permitted for discovering documentation and tools, but NO external outbound connection or tool execution without review
    if (tool === 'web_search' || tool === 'github_inspect') {
      return {
        allowed: true,
        requiresApproval: false, // Read-only query
        riskLevel: 'LOW',
      };
    }

    // All active state-modifying actions (Write, Delete, Execute command, Code Run, Git Push, External test) require explicit approval with 11 disclosure fields!
    const cmd = String(params?.command || '');
    const targetPath = String(params?.path || params?.filePath || '');

    return {
      allowed: true,
      requiresApproval: true,
      reason: `Cautious Mode ("بحذر"): Requires explicit owner authorization before executing "${tool}".`,
      reasonAr: `وضع بحذر: يتطلب موافقة صريحة من المالك قبل تنفيذ "${tool}".`,
      riskLevel: tool === 'file_delete' || tool === 'poc_runner' ? 'HIGH' : 'MEDIUM',
      approvalMetadata: {
        operation: tool,
        targetWebsiteOrRepo: params?.repo || workspaceId,
        scanScope: workspaceId,
        affectedFiles: targetPath ? [targetPath] : undefined,
        commandToRun: cmd || (params?.code ? `Execute snippet in Sandbox` : undefined),
        expectedNetworkRequests: tool === 'tls_header_audit' ? [params?.url] : undefined,
        reason: params?.reason || `Execute ${tool} under Cautious Mode governance`,
        expectedImpact: tool === 'file_delete' ? 'Permanent file removal' : 'System state modification',
        potentialRisks: tool === 'terminal_execute' ? 'Host shell command execution' : 'Workspace alteration',
        requiredPermissions: [tool],
      },
    };
  }

  // --- MODE: MEDIUM RESTRICTIONS ("قيود متوسطة") ---
  if (mode === 'medium') {
    switch (tool) {
      case 'terminal_execute': {
        const cmd = String(params?.command || '');
        const isHighImpact = /rm\s+-rf|chmod|chown|kill|pkill|curl.*\|.*sh|wget.*\|.*sh|docker\s+run|npm\s+publish/i.test(cmd);
        const requiresApproval = policy.terminal.requireApproval || isHighImpact;

        return {
          allowed: true,
          requiresApproval,
          reason: requiresApproval ? `High-impact terminal command requires owner sign-off: "${cmd.slice(0, 50)}"` : undefined,
          reasonAr: requiresApproval ? `أمر طرفية عالي التأثير يتطلب موافقة المالك: "${cmd.slice(0, 50)}"` : undefined,
          riskLevel: isHighImpact ? 'HIGH' : 'MEDIUM',
          approvalMetadata: requiresApproval
            ? {
                operation: 'terminal_execute',
                commandToRun: cmd,
                reason: 'Execute high-impact command',
                expectedImpact: 'Alters sandbox system state',
                potentialRisks: 'Potentially disruptive process or configuration modification',
                requiredPermissions: ['terminal_execute'],
              }
            : undefined,
        };
      }

      case 'file_delete': {
        return {
          allowed: policy.filesystem.deleteEnabled,
          requiresApproval: true,
          reason: 'File deletion requires owner confirmation under Medium Restrictions.',
          reasonAr: 'حذف الملفات يتطلب موافقة المالك في وضع القيود المتوسطة.',
          riskLevel: 'HIGH',
          approvalMetadata: {
            operation: 'file_delete',
            affectedFiles: [params?.path || params?.filePath],
            reason: 'Permanent file removal',
            expectedImpact: 'File is deleted permanently',
            potentialRisks: 'Irreversible data loss',
            requiredPermissions: ['file_delete'],
          },
        };
      }

      case 'file_write': {
        if (!policy.filesystem.writeEnabled) {
          return {
            allowed: false,
            requiresApproval: false,
            reason: 'Filesystem write is disabled in Owner Policy.',
            reasonAr: 'الكتابة على نظام الملفات معطلة في إعدادات المالك.',
            riskLevel: 'MEDIUM',
          };
        }
        return {
          allowed: true,
          requiresApproval: Boolean(policy.filesystem.requireApprovalForOverwrite && params?.overwrite),
          riskLevel: 'LOW',
        };
      }

      case 'git_operation': {
        const isPushOrMerge = params?.operation === 'push' || params?.operation === 'merge' || params?.operation === 'commit';
        return {
          allowed: policy.git.enabled,
          requiresApproval: isPushOrMerge && policy.git.requireApprovalForPushOrCommit,
          reason: isPushOrMerge ? 'Pushing or merging git commits requires owner sign-off.' : undefined,
          reasonAr: isPushOrMerge ? 'إرسال أو دمج commits يتطلب موافقة المالك.' : undefined,
          riskLevel: isPushOrMerge ? 'MEDIUM' : 'LOW',
        };
      }

      case 'poc_runner': {
        return {
          allowed: policy.securityLab.enabled && policy.securityLab.allowPocExecution,
          requiresApproval: true,
          reason: 'Security PoC exploit execution requires owner approval.',
          reasonAr: 'تشغيل سكريبت PoC لاختبار الثغرات يتطلب موافقة المالك.',
          riskLevel: 'HIGH',
        };
      }

      default:
        return {
          allowed: true,
          requiresApproval: false,
          riskLevel: 'LOW',
        };
    }
  }

  // --- MODE: UNRESTRICTED ("بدون قيود") ---
  // In unrestricted mode: all owner-granted tools execute autonomously within authorized scope
  switch (tool) {
    case 'terminal_execute': {
      return {
        allowed: policy.terminal.enabled,
        requiresApproval: false,
        riskLevel: 'MEDIUM',
      };
    }

    case 'file_delete': {
      return {
        allowed: policy.filesystem.deleteEnabled,
        requiresApproval: false,
        riskLevel: 'MEDIUM',
      };
    }

    case 'file_write': {
      return {
        allowed: policy.filesystem.writeEnabled,
        requiresApproval: false,
        riskLevel: 'LOW',
      };
    }

    case 'poc_runner': {
      return {
        allowed: policy.securityLab.enabled && policy.securityLab.allowPocExecution,
        requiresApproval: false,
        riskLevel: 'HIGH',
      };
    }

    case 'git_operation': {
      return {
        allowed: policy.git.enabled,
        requiresApproval: false,
        riskLevel: 'LOW',
      };
    }

    default:
      return {
        allowed: true,
        requiresApproval: false,
        riskLevel: 'LOW',
      };
  }
}
