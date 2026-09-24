import fs from 'node:fs/promises';
import path from 'node:path';
import { VulnerabilityFinding, SecurityAuditReport, RiskLevel, SecurityAlert } from './types.js';
import { getWorkspaceRoot } from './workspaceManager.js';
import { recordAudit } from './auditLogger.js';
import { addSecurityAlert } from './securityAlertManager.js';

interface SecurityRule {
  cwe: string;
  title: string;
  severity: RiskLevel;
  pattern: RegExp;
  description: string;
  descriptionAr: string;
  impact: string;
  remediation: string;
  remediationAr: string;
}

const SECURITY_RULES: SecurityRule[] = [
  {
    cwe: 'CWE-89',
    title: 'SQL Injection via Direct Concatenation',
    severity: 'CRITICAL',
    pattern: /\b(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b[^;]*?['"`]\s*\+\s*[a-zA-Z0-9_.]+|\b(?:query|execute|all|run)\s*\(\s*['"`][^;]*?\$\{/i,
    description: 'User input is concatenated directly into SQL query string without parameterized queries or prepared statements.',
    descriptionAr: 'يتم دمج مدخلات المستخدم مباشرة داخل استعلام SQL دون استخدام الاستعلامات المجهزة (Parameterized Queries).',
    impact: 'Attackers can bypass authentication, extract sensitive database records, or modify/drop tables.',
    remediation: 'Use parameterized queries (e.g., db.query("SELECT * FROM users WHERE name = ?", [username])).',
    remediationAr: 'استخدم الاستعلامات المجهزة والمعاملات الآمنة بدل دمج النصوص يدويًا.',
  },
  {
    cwe: 'CWE-78',
    title: 'OS Command Injection',
    severity: 'CRITICAL',
    pattern: /\b(?:exec|execSync|spawnSync)\s*\(\s*['"`].*?(\+|\$\{).*?\b|\bos\.system\s*\(/,
    description: 'Dynamic user input passed directly into shell execution function, allowing arbitrary host command execution.',
    descriptionAr: 'تمرير مدخلات المستخدم مباشرة إلى دوال تنفيذ أوامر النظام (Shell) مما يتيح تشغيل أوامر خبيثة.',
    impact: 'Full remote host compromise, arbitrary command execution, reverse shells.',
    remediation: 'Avoid shell execution. If necessary, use spawn with fixed arguments array and sanitize/whitelist input.',
    remediationAr: 'تجنب استدعاء Shell مباشرة، واستخدم مصفوفة المعاملات الثابتة مع التحقق الصارم من المدخلات.',
  },
  {
    cwe: 'CWE-798',
    title: 'Hardcoded Secret / Credential',
    severity: 'HIGH',
    pattern: /(?:(?:password|passwd|secret|jwt_?secret|api_?key|access_?token|auth_?token|private_?key|aws_access_key_id)\s*[:=]\s*["'][a-zA-Z0-9_\-.~!@#$%^&*]{8,}["'])|(?:AKIA[0-9A-Z]{16})|(?:ghp_[a-zA-Z0-9]{36})|(?:-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/i,
    description: 'Hardcoded secret token, private key, or password detected in source code.',
    descriptionAr: 'تم اكتشاف مفتاح تشفير خاص، أو رمز سري، أو كلمة مرور مكتوبة بشكل صريح داخل الشفرة المصدرية.',
    impact: 'Credential leakage leading to unauthorized account takeover or API abuse.',
    remediation: 'Move secrets to environment variables (process.env.SECRET) and use secret vaults.',
    remediationAr: 'انقل المفاتيح والكلمات السرية إلى متغيرات البيئة واستخدم مدراء الأسرار الآمنين.',
  },
  {
    cwe: 'CWE-22',
    title: 'Path Traversal / Arbitrary File Read',
    severity: 'HIGH',
    pattern: /\b(?:readFileSync|readFile|createReadStream)\s*\(\s*(?:req\.|params\.|query\.|body\.)/i,
    description: 'Unsanitized user-controlled file path passed directly to filesystem read calls.',
    descriptionAr: 'تمرير مسار ملف يحدده المستخدم مباشرة إلى دوال قراءة نظام الملفات دون تحقق أو تطهير.',
    impact: 'Access to unauthorized system files like /etc/passwd, configuration files, or source code.',
    remediation: 'Resolve paths against a strict base directory and verify that resolvedPath.startsWith(baseDir).',
    remediationAr: 'استخدم مسارًا أساسيًا معزولًا وتحقق من أن المسار النهائي لا يخرج عن المجلد المسموح به.',
  },
  {
    cwe: 'CWE-79',
    title: 'Cross-Site Scripting (XSS)',
    severity: 'MEDIUM',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{|\.innerHTML\s*=\s*(?:req\.|params\.|query\.|user)/i,
    description: 'Untrusted user data rendered directly into DOM without HTML escaping or sanitization.',
    descriptionAr: 'عرض بيانات المستخدم غير الموثوقة مباشرة داخل كود HTML دون تنقية أو تشفير مسبق.',
    impact: 'Session hijacking, malicious redirects, credential phishing in user browsers.',
    remediation: 'Use textContent, safe React JSX interpolation, or DOMPurify before rendering HTML.',
    remediationAr: 'استخدم textContent أو التضمين الآمن في React أو مكتبة DOMPurify.',
  },
  {
    cwe: 'CWE-918',
    title: 'Server-Side Request Forgery (SSRF)',
    severity: 'HIGH',
    pattern: /\b(?:fetch|axios\.get|axios\.post|http\.get)\s*\(\s*(?:req\.body\.|req\.query\.|userUrl|targetUrl)/i,
    description: 'Server initiates HTTP requests directly based on unvalidated user input.',
    descriptionAr: 'الخادم يقوم بإنشاء طلبات HTTP خارجية مباشرة بناءً على روابط غير موثوقة من المستخدم (SSRF).',
    impact: 'Internal network scanning, access to cloud metadata services (169.254.169.254), intranet compromise.',
    remediation: 'Validate destination URLs against strict whitelist of public domains and block internal IPs.',
    remediationAr: 'تحقق من الروابط ضد قائمة بيضاء صريحة واحظر الوصول لعناوين IP الداخلية والبيانات الوصفية.',
  },
  {
    cwe: 'CWE-502',
    title: 'Insecure Deserialization',
    severity: 'HIGH',
    pattern: /\b(?:pickle\.loads|yaml\.load\s*\([^,)]+\)|unserialize\s*\(|node-serialize)/i,
    description: 'Deserialization of untrusted data leading to arbitrary code execution.',
    descriptionAr: 'إلغاء تسلسل بيانات غير موثوقة (Insecure Deserialization) مما قد يؤدي لتشغيل أكواد عشوائية.',
    impact: 'Remote Code Execution (RCE) and memory corruption.',
    remediation: 'Use safe formats like JSON, or safe loaders like yaml.safe_load.',
    remediationAr: 'استخدم تنسيق JSON أو دوال التحميل الآمنة مثل yaml.safe_load.',
  },
  {
    cwe: 'CWE-327',
    title: 'Broken / Weak Cryptographic Algorithm',
    severity: 'MEDIUM',
    pattern: /createHash\s*\(\s*['"](?:md5|sha1)['"]\)|crypto\.MD5/i,
    description: 'Use of MD5 or SHA-1 for hashing, which are vulnerable to collision attacks.',
    descriptionAr: 'استخدام خوارزمية تشفير ضعيفة (MD5 أو SHA1) معرضة لهجمات التصادم (Collision Attacks).',
    impact: 'Weak integrity checks and vulnerable password verification.',
    remediation: 'Upgrade to SHA-256 / SHA-3 for hashing and Argon2 / bcrypt / scrypt for password hashing.',
    remediationAr: 'قم بالترقية إلى SHA-256 للتجزئة وArgon2 أو bcrypt لتشفير كلمات المرور.',
  },
  {
    cwe: 'CWE-942',
    title: 'Overly Permissive CORS Policy',
    severity: 'LOW',
    pattern: /Access-Control-Allow-Origin['"]?\s*,\s*['"]\*['"]/i,
    description: 'Wildcard Access-Control-Allow-Origin header allows any third-party website to make cross-origin requests.',
    descriptionAr: 'سياسة CORS متساهلة بشكل مفرط (Allow-Origin: *) تسمح لأي موقع خارجي بتقديم طلبات غير مصرح بها.',
    impact: 'Unauthorized cross-origin data exposure if authenticated cookies or intranet data are exposed.',
    remediation: 'Restrict allowed origins to trusted domains or validate the Origin request header.',
    remediationAr: 'حدد النطاقات المسموح بها بدقة ولا تستخدم النجمة (*) في البيئات الحساسة.',
  },
];

export async function runSecurityAudit(workspaceId: string): Promise<SecurityAuditReport> {
  const root = getWorkspaceRoot(workspaceId);
  const findings: VulnerabilityFinding[] = [];
  const containerChecks: any[] = [];
  const dependencyChecks: any[] = [];
  let filesScanned = 0;

  async function scanDirectory(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const baseName = path.basename(entry.name).toLowerCase();
          if (
            ['.js', '.ts', '.jsx', '.tsx', '.py', '.json', '.env', '.sh', '.html', '.yml', '.yaml'].includes(ext) ||
            baseName === 'dockerfile' ||
            baseName.startsWith('dockerfile')
          ) {
            filesScanned++;
            await scanFile(fullPath);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  async function scanFile(filePath: string) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const relPath = path.relative(root, filePath).replace(/\\/g, '/');
      const baseName = path.basename(filePath).toLowerCase();

      // 1. SAST Rules matching
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const rule of SECURITY_RULES) {
          if (rule.pattern.test(line)) {
            const vulnId = `vuln_${findings.length + 1}_${Date.now()}`;
            findings.push({
              id: vulnId,
              cwe: rule.cwe,
              title: rule.title,
              severity: rule.severity,
              file: relPath,
              line: i + 1,
              snippet: line.trim().slice(0, 140),
              description: rule.description,
              descriptionAr: rule.descriptionAr,
              impact: rule.impact,
              remediation: rule.remediation,
              remediationAr: rule.remediationAr,
            });

            // Register CRITICAL and HIGH severity findings directly to SecurityAlertManager
            if (rule.severity === 'CRITICAL' || rule.severity === 'HIGH') {
              await addSecurityAlert({
                severity: rule.severity,
                type: rule.cwe === 'CWE-798' ? 'secret_leak' : 'vulnerability',
                title: `${rule.title} (${relPath}:${i + 1})`,
                titleAr: `${rule.title} في ${relPath}:${i + 1}`,
                description: rule.description,
                descriptionAr: rule.descriptionAr,
                resource: `${relPath}:${i + 1}`,
                evidence: line.trim().slice(0, 100),
                suggestedFix: rule.remediation,
              });
            }
          }
        }
      }

      // 2. Container Scanner (Dockerfile analysis)
      if (baseName === 'dockerfile' || baseName.startsWith('dockerfile')) {
        let hasUserDirective = false;
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i].trim();
          if (l.startsWith('USER ') && !l.includes('root')) {
            hasUserDirective = true;
          }
          if (/FROM\s+[\w\-./]+:latest/i.test(l)) {
            containerChecks.push({
              issue: 'Unpinned Docker Base Image (:latest tag)',
              line: i + 1,
              recommendation: 'Pin base image to specific digest or immutable version tag.',
            });
          }
          if (/\b(?:curl|wget)\b.*\|\s*(?:ba)?sh\b/i.test(l)) {
            containerChecks.push({
              issue: 'Insecure Pipe to Shell in Docker build',
              line: i + 1,
              recommendation: 'Download binaries, verify checksum/GPG signature before executing.',
            });
          }
        }
        if (!hasUserDirective) {
          containerChecks.push({
            issue: 'Container runs as Root User (Missing USER directive)',
            line: 1,
            recommendation: 'Add a non-privileged user and switch with "USER <username>".',
          });
        }
      }

      // 3. Dependency Scanner (package.json / requirements.txt)
      if (baseName === 'package.json') {
        try {
          const pkg = JSON.parse(content);
          const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
          const knownVulnerabilities: Record<string, string> = {
            'lodash.template': 'CVE-2021-23337: Command Injection in lodash',
            'serialize-javascript': 'CVE-2020-7660: Remote Code Execution',
            'minimist': 'CVE-2020-7598: Prototype Pollution',
            'jsonwebtoken': 'CWE-347: Improper Verification of Cryptographic Signature',
          };
          for (const [dep, note] of Object.entries(knownVulnerabilities)) {
            if (allDeps[dep]) {
              dependencyChecks.push({ dep, version: allDeps[dep], note });
              findings.push({
                id: `dep_${dep}_${Date.now()}`,
                cwe: 'CWE-1395',
                title: `Vulnerable Dependency: ${dep}`,
                severity: 'HIGH',
                file: relPath,
                line: 1,
                snippet: `"${dep}": "${allDeps[dep]}"`,
                description: `Package contains known security advisory: ${note}`,
                descriptionAr: `تحتوي المكتبة على تنبيه أمني معروف: ${note}`,
                impact: 'Supply chain compromise / dependency exploitation.',
                remediation: `Update ${dep} to the latest secure patched release.`,
                remediationAr: `قم بتحديث حزمة ${dep} إلى أحدث إصدار آمن فورًا.`,
              });
            }
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  await scanDirectory(root);

  const summary = {
    critical: findings.filter((f) => f.severity === 'CRITICAL').length,
    high: findings.filter((f) => f.severity === 'HIGH').length,
    medium: findings.filter((f) => f.severity === 'MEDIUM').length,
    low: findings.filter((f) => f.severity === 'LOW').length,
    total: findings.length,
  };

  // Calculate Security Posture Score (100 - penalties)
  const penalty = summary.critical * 25 + summary.high * 15 + summary.medium * 8 + summary.low * 2;
  const securityScore = Math.max(0, 100 - penalty);

  const report: SecurityAuditReport = {
    timestamp: new Date().toISOString(),
    workspaceId,
    filesScanned,
    findings,
    summary,
    securityScore,
    containerChecks,
    dependencyChecks,
  };

  await recordAudit({
    workspaceId,
    tool: 'security_audit',
    action: `Scanned ${filesScanned} files for security vulnerabilities & secrets`,
    params: { filesScanned },
    resultSummary: `Found ${findings.length} findings (Score: ${securityScore}/100)`,
    success: true,
    riskLevel: findings.length > 0 ? 'HIGH' : 'LOW',
  });

  return report;
}

/**
 * Generate Software Bill of Materials (SBOM) in JSON
 */
export async function generateSBOM(workspaceId: string) {
  const root = getWorkspaceRoot(workspaceId);
  const components: any[] = [];

  try {
    const pkgPath = path.join(root, 'package.json');
    const pkgContent = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);

    for (const [name, version] of Object.entries(pkg.dependencies || {})) {
      components.push({
        type: 'library',
        name,
        version: String(version).replace(/[\^~]/, ''),
        purl: `pkg:npm/${name}@${String(version).replace(/[\^~]/, '')}`,
        scope: 'runtime',
      });
    }

    for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
      components.push({
        type: 'library',
        name,
        version: String(version).replace(/[\^~]/, ''),
        purl: `pkg:npm/${name}@${String(version).replace(/[\^~]/, '')}`,
        scope: 'development',
      });
    }
  } catch {
    // fallback if no package.json
  }

  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${Date.now()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: 'ApexSec', name: 'SBOM Generator', version: '2.4' }],
      component: {
        type: 'application',
        name: workspaceId,
        version: '1.0.0',
      },
    },
    components,
  };

  return sbom;
}

/**
 * Safe passive TLS & Security Header defensive audit on authorized URLs
 */
export async function performTlsHeaderAudit(targetUrl: string, workspaceId = 'default-workspace') {
  try {
    const url = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'ApexSec-SecurityAudit/1.0' },
    });

    const headers = Object.fromEntries(res.headers.entries());
    const checks = [
      {
        header: 'strict-transport-security',
        present: Boolean(headers['strict-transport-security']),
        severity: 'HIGH',
        recommendation: 'Enable HSTS with max-age=31536000; includeSubDomains; preload',
      },
      {
        header: 'content-security-policy',
        present: Boolean(headers['content-security-policy']),
        severity: 'HIGH',
        recommendation: 'Deploy Content-Security-Policy (CSP) to mitigate XSS and data exfiltration.',
      },
      {
        header: 'x-frame-options',
        present: Boolean(headers['x-frame-options']),
        severity: 'MEDIUM',
        recommendation: 'Set X-Frame-Options to DENY or SAMEORIGIN to prevent Clickjacking.',
      },
      {
        header: 'x-content-type-options',
        present: Boolean(headers['x-content-type-options']),
        severity: 'LOW',
        recommendation: 'Set X-Content-Type-Options: nosniff to prevent MIME type sniffing.',
      },
    ];

    await recordAudit({
      workspaceId,
      tool: 'tls_header_audit',
      action: `Passive Header Audit: ${url}`,
      targetWebsite: url,
      resultSummary: `Checked ${checks.length} security headers for ${url}`,
      success: true,
      riskLevel: 'LOW',
    });

    return {
      url,
      status: res.status,
      headers,
      checks,
    };
  } catch (err: any) {
    return {
      url: targetUrl,
      error: err.message,
    };
  }
}
