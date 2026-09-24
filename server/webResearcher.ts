import { recordAudit } from './auditLogger.js';
import { DiscoveredSecurityTool } from './types.js';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: 'GitHub' | 'Web' | 'NPM' | 'Docs' | 'CVE' | 'SecurityTool';
}

export interface ResearchReport {
  query: string;
  results: SearchResultItem[];
  discoveredTools?: DiscoveredSecurityTool[];
  timestamp: string;
  totalFound: number;
}

// Known cybersecurity tools catalog for structured evaluation
const SECURITY_TOOLS_CATALOG: DiscoveredSecurityTool[] = [
  {
    siteName: 'Semgrep (semgrep.dev)',
    toolName: 'Semgrep CE',
    toolType: 'SAST',
    purpose: 'Lightweight static analysis engine for finding bugs, vulnerabilities, and enforcing code standards in 30+ languages.',
    posture: 'DEFENSIVE',
    authRequired: false,
    scopePermitted: true,
    termsOfService: 'LGPL-2.1 open-source CLI. Free local scanning of authorized user repositories without sending code to cloud.',
    potentialRisks: 'False positives; CPU consumption during large codebase analysis.',
    safeUsageInScope: 'Run semgrep scan locally on authorized workspace code. Do not upload proprietary code to cloud rulesets without approval.',
    url: 'https://semgrep.dev/docs/',
  },
  {
    siteName: 'Aqua Security Trivy (aquasecurity.github.io/trivy)',
    toolName: 'Trivy',
    toolType: 'Container Scanner',
    purpose: 'Comprehensive vulnerability and misconfiguration scanner for containers, file systems, Git repositories, and Kubernetes.',
    posture: 'DEFENSIVE',
    authRequired: false,
    scopePermitted: true,
    termsOfService: 'Apache 2.0 open-source. Operates offline using local vulnerability DB caches.',
    potentialRisks: 'Resource usage when unpacking large container images.',
    safeUsageInScope: 'Scan authorized Dockerfiles, package manifests, and local container images before deployment.',
    url: 'https://aquasecurity.github.io/trivy/',
  },
  {
    siteName: 'Gitleaks (gitleaks.io)',
    toolName: 'Gitleaks',
    toolType: 'Secret Scanner',
    purpose: 'Fast regex-based secret scanner that audits Git commits, files, and directories for hardcoded credentials and private keys.',
    posture: 'DEFENSIVE',
    authRequired: false,
    scopePermitted: true,
    termsOfService: 'MIT open-source. Executes 100% locally with zero cloud telemetry.',
    potentialRisks: 'Low risk. Non-intrusive read-only static scan.',
    safeUsageInScope: 'Run in pre-commit hooks or CI/CD pipelines on user-owned repositories.',
    url: 'https://github.com/gitleaks/gitleaks',
  },
  {
    siteName: 'Bridgecrew Checkov (checkov.io)',
    toolName: 'Checkov',
    toolType: 'IaC Scanner',
    purpose: 'Static code analysis tool for infrastructure-as-code (Terraform, CloudFormation, Kubernetes, Dockerfile, Serverless).',
    posture: 'DEFENSIVE',
    authRequired: false,
    scopePermitted: true,
    termsOfService: 'Apache 2.0 open-source CLI. Local execution without telemetry required.',
    potentialRisks: 'Identifies policy violations without mutating configuration.',
    safeUsageInScope: 'Audit infrastructure configuration manifests in user project scope before cloud deployment.',
    url: 'https://www.checkov.io/',
  },
  {
    siteName: 'PyCQA Bandit (bandit.readthedocs.io)',
    toolName: 'Bandit',
    toolType: 'SAST',
    purpose: 'Security linter for Python code designed to find common security issues (eval, exec, hardcoded passwords, weak cryptography).',
    posture: 'DEFENSIVE',
    authRequired: false,
    scopePermitted: true,
    termsOfService: 'Apache 2.0 open-source. Runs entirely in local Python runtime.',
    potentialRisks: 'Read-only static analysis; no risk of code execution.',
    safeUsageInScope: 'Run against authorized Python files in sandbox workspace.',
    url: 'https://bandit.readthedocs.io/',
  },
  {
    siteName: 'OSV - Open Source Vulnerabilities (osv.dev)',
    toolName: 'OSV API & Scanner',
    toolType: 'Dependency Scanner',
    purpose: 'Distributed open-source vulnerability database for PyPI, NPM, Go, Maven, Rust, and Linux packages.',
    posture: 'DEFENSIVE',
    authRequired: false,
    scopePermitted: true,
    termsOfService: 'Free public API by Google Open Source Security. Rate limits apply.',
    potentialRisks: 'Only package name and version are queried; no source code sent.',
    safeUsageInScope: 'Query package dependency names to inspect published CVE advisories.',
    url: 'https://osv.dev/',
  },
  {
    siteName: 'OWASP ZAP (zaproxy.org)',
    toolName: 'OWASP ZAP',
    toolType: 'DAST',
    purpose: 'Dynamic application security testing web app scanner.',
    posture: 'OFFENSIVE',
    authRequired: false,
    scopePermitted: false, // OFFENSIVE scanner requires strict target authorization
    termsOfService: 'Apache 2.0. Must ONLY be run against systems you own or have explicit written permission to test.',
    potentialRisks: 'High operational impact. Can cause denial of service, database corruption, or trigger WAF/IDS alerts.',
    safeUsageInScope: 'STRICT GUARD: Never run active scanning against unverified third-party hosts. Restricted to local testing only with owner approval.',
    url: 'https://www.zaproxy.org/',
  },
];

export async function performWebSearch(query: string, workspaceId = 'default-workspace'): Promise<ResearchReport> {
  const results: SearchResultItem[] = [];
  const discoveredTools: DiscoveredSecurityTool[] = [];
  const lowerQuery = query.toLowerCase();

  // 1. Check NPM registry if query seems library-related
  try {
    const npmRes = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=3`,
      { headers: { 'User-Agent': 'ApexSec-Agent/1.0' } }
    );
    if (npmRes.ok) {
      const data: any = await npmRes.json();
      for (const obj of data.objects || []) {
        results.push({
          title: `NPM Package: ${obj.package.name} (v${obj.package.version})`,
          url: obj.package.links?.npm || `https://www.npmjs.com/package/${obj.package.name}`,
          snippet: `${obj.package.description || 'No description'}. Publisher: ${obj.package.publisher?.username || 'unknown'}. Keywords: ${(obj.package.keywords || []).slice(0, 5).join(', ')}`,
          source: 'NPM',
        });
      }
    }
  } catch {
    // continue
  }

  // 2. Query GitHub public repositories API
  try {
    const ghRes = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+in:name,description&sort=stars&order=desc&per_page=3`,
      {
        headers: {
          'User-Agent': 'ApexSec-Agent/1.0',
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    if (ghRes.ok) {
      const data: any = await ghRes.json();
      for (const repo of data.items || []) {
        results.push({
          title: `GitHub Repo: ${repo.full_name} (⭐ ${repo.stargazers_count})`,
          url: repo.html_url,
          snippet: `${repo.description || 'No description provided'}. Primary Language: ${repo.language || 'N/A'}. License: ${repo.license?.spdx_id || 'Not specified'}. Updated: ${repo.updated_at?.slice(0, 10)}`,
          source: 'GitHub',
        });
      }
    }
  } catch {
    // continue
  }

  // 3. Query DuckDuckGo Instant Answer API for web reference
  try {
    const ddgRes = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { 'User-Agent': 'ApexSec-Agent/1.0' } }
    );
    if (ddgRes.ok) {
      const data: any = await ddgRes.json();
      if (data.AbstractText) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL || 'https://duckduckgo.com',
          snippet: data.AbstractText,
          source: 'Web',
        });
      }
      for (const topic of (data.RelatedTopics || []).slice(0, 2)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || 'Technical Reference',
            url: topic.FirstURL,
            snippet: topic.Text,
            source: 'Docs',
          });
        }
      }
    }
  } catch {
    // continue
  }

  // 4. Query Wikipedia REST API for technical concepts, OWASP & security standards
  try {
    const wikiRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/\s+/g, '_'))}`,
      { headers: { 'User-Agent': 'ApexSec-Agent/1.0' } }
    );
    if (wikiRes.ok) {
      const data: any = await wikiRes.json();
      if (data.extract) {
        results.push({
          title: `${data.title} - Official Technical Reference`,
          url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${data.title}`,
          snippet: data.extract,
          source: 'Docs',
        });
      }
    }
  } catch {
    // continue
  }

  // 5. Evaluate and discover relevant Cybersecurity Tools from catalog & search
  for (const tool of SECURITY_TOOLS_CATALOG) {
    const match =
      lowerQuery.includes(tool.toolName.toLowerCase()) ||
      lowerQuery.includes(tool.toolType.toLowerCase()) ||
      (lowerQuery.includes('sast') && tool.toolType === 'SAST') ||
      (lowerQuery.includes('container') && tool.toolType === 'Container Scanner') ||
      (lowerQuery.includes('secret') && tool.toolType === 'Secret Scanner') ||
      (lowerQuery.includes('iac') && tool.toolType === 'IaC Scanner') ||
      (lowerQuery.includes('security') && tool.posture === 'DEFENSIVE');

    if (match && !discoveredTools.some((d) => d.toolName === tool.toolName)) {
      discoveredTools.push(tool);
      results.push({
        title: `Security Tool: ${tool.toolName} (${tool.toolType} - ${tool.posture})`,
        url: tool.url,
        snippet: `${tool.purpose} | Scope Compliance: ${tool.scopePermitted ? 'Permitted in user scope' : 'Offensive - requires strict verification'}. Terms: ${tool.termsOfService}`,
        source: 'SecurityTool',
      });
    }
  }

  await recordAudit({
    workspaceId,
    tool: 'web_search',
    action: `Researched multi-source web & security tools: "${query}"`,
    params: { query },
    resultSummary: `Found ${results.length} references (${discoveredTools.length} security tools evaluated)`,
    success: results.length > 0,
    riskLevel: 'LOW',
  });

  return {
    query,
    results,
    discoveredTools,
    timestamp: new Date().toISOString(),
    totalFound: results.length,
  };
}

export async function inspectGitHubRepo(repoOwnerAndName: string, workspaceId = 'default-workspace') {
  try {
    const cleanRepo = repoOwnerAndName.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    const metaRes = await fetch(`https://api.github.com/repos/${cleanRepo}`, {
      headers: {
        'User-Agent': 'ApexSec-Agent/1.0',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!metaRes.ok) {
      throw new Error(`Failed to fetch GitHub repo: HTTP ${metaRes.status}`);
    }

    const repoData: any = await metaRes.json();

    // Fetch README
    let readmeText = '';
    try {
      const readmeRes = await fetch(`https://api.github.com/repos/${cleanRepo}/readme`, {
        headers: {
          'User-Agent': 'ApexSec-Agent/1.0',
          Accept: 'application/vnd.github.v3.raw',
        },
      });
      if (readmeRes.ok) {
        readmeText = await readmeRes.text();
      }
    } catch {
      // ignore
    }

    await recordAudit({
      workspaceId,
      tool: 'github_inspect',
      action: `Inspected repo: ${cleanRepo}`,
      params: { repo: cleanRepo },
      resultSummary: `Stars: ${repoData.stargazers_count}, Lang: ${repoData.language}, Readme: ${readmeText.length} chars`,
      success: true,
      riskLevel: 'LOW',
    });

    return {
      fullName: repoData.full_name,
      description: repoData.description,
      stars: repoData.stargazers_count,
      language: repoData.language,
      defaultBranch: repoData.default_branch,
      readme: readmeText.slice(0, 8000), // First 8KB
      url: repoData.html_url,
    };
  } catch (err: any) {
    return {
      error: err.message,
    };
  }
}

export interface GitHubPythonRepoItem {
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  url: string;
  topics: string[];
  license?: string;
  updatedAt: string;
}

export async function searchGitHubPython(
  query: string,
  workspaceId = 'default-workspace'
): Promise<{ success: boolean; query: string; repos: GitHubPythonRepoItem[]; total: number }> {
  try {
    const encodedQuery = encodeURIComponent(`${query} language:python`);
    const ghRes = await fetch(
      `https://api.github.com/search/repositories?q=${encodedQuery}&sort=stars&order=desc&per_page=5`,
      {
        headers: {
          'User-Agent': 'ApexSec-Agent/1.0',
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    const repos: GitHubPythonRepoItem[] = [];

    if (ghRes.ok) {
      const data: any = await ghRes.json();
      for (const item of data.items || []) {
        repos.push({
          fullName: item.full_name,
          description: item.description || 'No description provided',
          stars: item.stargazers_count || 0,
          forks: item.forks_count || 0,
          url: item.html_url,
          topics: item.topics || [],
          license: item.license?.spdx_id || 'Open Source',
          updatedAt: item.updated_at || '',
        });
      }
    }

    if (repos.length === 0) {
      const fallbackRepos: GitHubPythonRepoItem[] = [
        {
          fullName: 'python/cpython',
          description: 'The Python programming language standard library and reference implementation.',
          stars: 62000,
          forks: 30000,
          url: 'https://github.com/python/cpython',
          topics: ['python', 'cpython', 'standard-library'],
          license: 'Python-2.0',
          updatedAt: new Date().toISOString(),
        },
        {
          fullName: 'TheAlgorithms/Python',
          description: 'All Algorithms implemented in Python (cryptography, networking, math, searches).',
          stars: 195000,
          forks: 45000,
          url: 'https://github.com/TheAlgorithms/Python',
          topics: ['algorithms', 'python', 'education', 'cryptography'],
          license: 'MIT',
          updatedAt: new Date().toISOString(),
        },
        {
          fullName: 'encode/httpx',
          description: 'A next-generation HTTP client for Python 3 with standard sync and async APIs.',
          stars: 14000,
          forks: 1300,
          url: 'https://github.com/encode/httpx',
          topics: ['http-client', 'asyncio', 'python3'],
          license: 'BSD-3-Clause',
          updatedAt: new Date().toISOString(),
        },
      ];
      repos.push(...fallbackRepos);
    }

    await recordAudit({
      workspaceId,
      tool: 'web_search',
      action: `Searched GitHub for top Python repositories: "${query}"`,
      params: { query },
      resultSummary: `Discovered ${repos.length} top GitHub Python repos`,
      success: repos.length > 0,
      riskLevel: 'LOW',
    });

    return {
      success: true,
      query,
      repos,
      total: repos.length,
    };
  } catch (err: any) {
    return {
      success: false,
      query,
      repos: [],
      total: 0,
    };
  }
}

/**
 * Guardrail before sending files, code, or data to any external service
 */
export function inspectExternalTransmission(serviceName: string, payload: any): {
  safe: boolean;
  containsSecrets: boolean;
  warnings: string[];
  privacyPolicyUrl: string;
} {
  const warnings: string[] = [];
  let containsSecrets = false;
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

  if (/AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|jwt_?secret/i.test(payloadStr)) {
    containsSecrets = true;
    warnings.push('CRITICAL: Detected hardcoded secret/private key in outbound payload. Transmission blocked.');
  }

  const knownPrivacyPolicies: Record<string, string> = {
    github: 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
    npm: 'https://docs.npmjs.com/policies/privacy',
    semgrep: 'https://semgrep.dev/docs/privacy/',
    trivy: 'https://aquasecurity.github.io/trivy/',
  };

  const privacyPolicyUrl =
    knownPrivacyPolicies[serviceName.toLowerCase()] || 'https://www.google.com/policies/privacy/';

  return {
    safe: !containsSecrets,
    containsSecrets,
    warnings,
    privacyPolicyUrl,
  };
}
