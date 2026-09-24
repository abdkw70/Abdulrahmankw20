import { OwnerPolicy, RiskLevel } from './types.js';

export interface ScopeValidationResult {
  valid: boolean;
  scopeType: 'REPOSITORY' | 'PATH' | 'DOMAIN' | 'COMMAND';
  target: string;
  reason?: string;
  reasonAr?: string;
  riskLevel: RiskLevel;
}

export function validateScope(
  policy: OwnerPolicy,
  scopeType: 'REPOSITORY' | 'PATH' | 'DOMAIN' | 'COMMAND',
  target: string
): ScopeValidationResult {
  if (!target) {
    return {
      valid: false,
      scopeType,
      target,
      reason: 'Empty target provided for scope validation.',
      reasonAr: 'تم تقديم هدف فارغ للتحقق من النطاق.',
      riskLevel: 'HIGH',
    };
  }

  // 1. REPOSITORY SCOPE VALIDATION
  if (scopeType === 'REPOSITORY') {
    const cleanRepo = target.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').toLowerCase().trim();
    const authorized = policy.authorizedScopes.repositories.map((r) => r.toLowerCase().trim());
    
    // In unrestricted or medium mode, if user explicitly authorized '*' or specific repos
    const isWildcard = authorized.includes('*') || authorized.length === 0;
    const isExplicitlyAllowed = authorized.includes(cleanRepo);

    if (policy.operatingMode === 'cautious' && !isExplicitlyAllowed && !isWildcard) {
      return {
        valid: false,
        scopeType,
        target: cleanRepo,
        reason: `Repository "${cleanRepo}" is outside the authorized owner scope for Cautious mode.`,
        reasonAr: `المستودع "${cleanRepo}" يقع خارج النطاق المصرح به من المالك في وضع بحذر.`,
        riskLevel: 'HIGH',
      };
    }

    return {
      valid: true,
      scopeType,
      target: cleanRepo,
      riskLevel: 'LOW',
    };
  }

  // 2. PATH SCOPE VALIDATION (Prevent Path Traversal)
  if (scopeType === 'PATH') {
    const normalized = target.replace(/\\/g, '/');
    if (normalized.includes('../') || normalized.startsWith('/') || normalized.includes('..')) {
      return {
        valid: false,
        scopeType,
        target,
        reason: 'Path traversal or absolute system path access is strictly forbidden.',
        reasonAr: 'محاولة الخروج من المجلد المصرح به (Path Traversal) محظورة تماماً.',
        riskLevel: 'CRITICAL',
      };
    }

    return {
      valid: true,
      scopeType,
      target,
      riskLevel: 'LOW',
    };
  }

  // 3. DOMAIN / URL SCOPE VALIDATION
  if (scopeType === 'DOMAIN') {
    try {
      const url = target.startsWith('http') ? new URL(target) : new URL(`https://${target}`);
      const hostname = url.hostname.toLowerCase();

      // Inherent private network protection (SSRF prevention)
      if (
        hostname === '169.254.169.254' || // Cloud metadata
        hostname === 'metadata.google.internal' ||
        hostname.endsWith('.internal')
      ) {
        return {
          valid: false,
          scopeType,
          target: hostname,
          reason: 'Access to internal cloud metadata service is strictly blocked.',
          reasonAr: 'الوصول إلى خدمات البيانات الوصفية السحابية الداخلية محظور أمنياً.',
          riskLevel: 'CRITICAL',
        };
      }

      const allowedDomains = policy.network.allowedDomains.map((d) => d.toLowerCase().trim());
      const isWildcardAllowed = allowedDomains.includes('*');
      const isDomainAllowed =
        isWildcardAllowed ||
        allowedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));

      if (!isDomainAllowed) {
        return {
          valid: false,
          scopeType,
          target: hostname,
          reason: `Domain "${hostname}" is outside the authorized domains list.`,
          reasonAr: `النطاق "${hostname}" غير مدرج في قائمة النطاقات المصرح بها.`,
          riskLevel: 'HIGH',
        };
      }

      return {
        valid: true,
        scopeType,
        target: hostname,
        riskLevel: 'LOW',
      };
    } catch {
      return {
        valid: false,
        scopeType,
        target,
        reason: `Invalid URL/domain format: "${target}".`,
        reasonAr: `صيغة الرابط أو النطاق غير صالحة: "${target}".`,
        riskLevel: 'MEDIUM',
      };
    }
  }

  // 4. COMMAND SCOPE VALIDATION
  if (scopeType === 'COMMAND') {
    for (const disallowed of policy.terminal.disallowedCommands) {
      if (target.includes(disallowed)) {
        return {
          valid: false,
          scopeType,
          target,
          reason: `Command contains forbidden destructive instruction: "${disallowed}".`,
          reasonAr: `الأمر يحتوي على تعليمة تخريبية محظورة: "${disallowed}".`,
          riskLevel: 'CRITICAL',
        };
      }
    }

    return {
      valid: true,
      scopeType,
      target,
      riskLevel: 'LOW',
    };
  }

  return {
    valid: true,
    scopeType,
    target,
    riskLevel: 'LOW',
  };
}

export function validateScopeAndSafety(
  tool: string,
  params: any,
  policy: OwnerPolicy,
  workspaceId = 'default-workspace'
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  // Check for offensive / aggressive attack tools without explicit pentest authorization
  if (tool === 'terminal_execute') {
    const cmd = String(params?.command || '').toLowerCase();
    const offensiveToolRegex = /\b(nmap|sqlmap|hydra|aircrack|nikto|metasploit|msfconsole|gobuster|dirbuster)\b/;
    if (offensiveToolRegex.test(cmd)) {
      violations.push(`Offensive tool execution or penetration testing detected in command ("${cmd}"). Disallowed outside authorized scope.`);
    }

    const commandScope = validateScope(policy, 'COMMAND', String(params?.command || ''));
    if (!commandScope.valid && commandScope.reason) {
      violations.push(commandScope.reason);
    }
  }

  if (tool === 'file_write' || tool === 'file_read' || tool === 'file_delete') {
    const path = String(params?.path || params?.filePath || '');
    if (path) {
      const pathScope = validateScope(policy, 'PATH', path);
      if (!pathScope.valid && pathScope.reason) {
        violations.push(pathScope.reason);
      }
    }
  }

  if (tool === 'tls_header_audit' || tool === 'network_outbound') {
    const url = String(params?.url || params?.target || '');
    if (url) {
      const domainScope = validateScope(policy, 'DOMAIN', url);
      if (!domainScope.valid && domainScope.reason) {
        violations.push(domainScope.reason);
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
