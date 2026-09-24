import fs from 'node:fs/promises';
import path from 'node:path';
import { recordAudit } from './auditLogger.js';
import { executeCommand } from './terminalRunner.js';
import { getWorkspaceRoot } from './workspaceManager.js';

const DATA_DIR = path.resolve(process.cwd(), 'agent_data');
const GITHUB_CONFIG_FILE = path.join(DATA_DIR, 'github_config.json');

export interface GitHubAccountConfig {
  connected: boolean;
  username?: string;
  avatarUrl?: string;
  token?: string; // Stored securely on backend only
  tokenType?: 'pat' | 'app' | 'oauth';
  connectedAt?: string;
  scopes?: string[];
}

let githubConfig: GitHubAccountConfig = { connected: false };

export async function initGitHubService(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const content = await fs.readFile(GITHUB_CONFIG_FILE, 'utf-8');
    githubConfig = JSON.parse(content);
  } catch {
    githubConfig = { connected: false };
    await fs.writeFile(GITHUB_CONFIG_FILE, JSON.stringify(githubConfig, null, 2), 'utf-8');
  }
}

export function getGitHubPublicStatus(): Omit<GitHubAccountConfig, 'token'> & { hasToken: boolean } {
  return {
    connected: githubConfig.connected,
    username: githubConfig.username,
    avatarUrl: githubConfig.avatarUrl,
    tokenType: githubConfig.tokenType,
    connectedAt: githubConfig.connectedAt,
    scopes: githubConfig.scopes,
    hasToken: Boolean(githubConfig.token),
  };
}

export async function connectGitHubAccount(token: string, tokenType: 'pat' | 'app' | 'oauth' = 'pat'): Promise<{
  success: boolean;
  user?: any;
  error?: string;
}> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'ApexSec-Agent/1.0',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errBody.message || `GitHub Authentication Failed: HTTP ${res.status}`,
      };
    }

    const userData: any = await res.json();
    const scopesHeader = res.headers.get('x-oauth-scopes') || '';
    const scopes = scopesHeader ? scopesHeader.split(',').map((s) => s.trim()) : ['repo', 'read:org'];

    githubConfig = {
      connected: true,
      username: userData.login,
      avatarUrl: userData.avatar_url,
      token,
      tokenType,
      connectedAt: new Date().toISOString(),
      scopes,
    };

    await fs.writeFile(GITHUB_CONFIG_FILE, JSON.stringify(githubConfig, null, 2), 'utf-8');

    await recordAudit({
      workspaceId: 'system',
      user: userData.login,
      tool: 'github_service',
      action: `Connected GitHub account: ${userData.login}`,
      resultSummary: `GitHub account connected. Scopes: ${scopes.join(', ')}`,
      success: true,
      riskLevel: 'LOW',
    });

    return {
      success: true,
      user: {
        login: userData.login,
        name: userData.name,
        avatar_url: userData.avatar_url,
        public_repos: userData.public_repos,
        total_private_repos: userData.total_private_repos,
        scopes,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
    };
  }
}

export async function disconnectGitHubAccount(): Promise<boolean> {
  githubConfig = { connected: false };
  try {
    await fs.writeFile(GITHUB_CONFIG_FILE, JSON.stringify(githubConfig, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function getAuthHeaders() {
  const headers: Record<string, string> = {
    'User-Agent': 'ApexSec-Agent/1.0',
    Accept: 'application/vnd.github.v3+json',
  };
  if (githubConfig.token) {
    headers['Authorization'] = `Bearer ${githubConfig.token}`;
  }
  return headers;
}

export async function listUserRepositories(): Promise<{
  success: boolean;
  repositories: any[];
  error?: string;
}> {
  if (!githubConfig.connected || !githubConfig.token) {
    return {
      success: false,
      repositories: [],
      error: 'GitHub account is not connected. Please connect your GitHub account in Settings -> Integrations.',
    };
  }

  try {
    const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const err: any = await res.json().catch(() => ({}));
      return { success: false, repositories: [], error: err.message || `HTTP ${res.status}` };
    }

    const repos: any = await res.json();
    const mapped = (repos || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      owner: r.owner?.login,
      isPrivate: r.private,
      htmlUrl: r.html_url,
      cloneUrl: r.clone_url,
      description: r.description,
      defaultBranch: r.default_branch,
      stars: r.stargazers_count,
      forks: r.forks_count,
      language: r.language,
      openIssues: r.open_issues_count,
      updatedAt: r.updated_at,
    }));

    return {
      success: true,
      repositories: mapped,
    };
  } catch (err: any) {
    return { success: false, repositories: [], error: err.message };
  }
}

export async function getRepoBranches(owner: string, repo: string) {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return { success: false, branches: [] };
    const branches = await res.json();
    return {
      success: true,
      branches: (branches || []).map((b: any) => ({
        name: b.name,
        commitSha: b.commit?.sha,
        protected: b.protected,
      })),
    };
  } catch (err: any) {
    return { success: false, branches: [], error: err.message };
  }
}

export async function getRepoCommits(owner: string, repo: string, branch?: string) {
  try {
    const url = branch
      ? `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=15`
      : `https://api.github.com/repos/${owner}/${repo}/commits?per_page=15`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) return { success: false, commits: [] };
    const data: any = await res.json();
    return {
      success: true,
      commits: (data || []).map((c: any) => ({
        sha: c.sha?.substring(0, 7),
        fullSha: c.sha,
        message: c.commit?.message?.split('\n')[0],
        author: c.commit?.author?.name || c.author?.login,
        date: c.commit?.author?.date,
      })),
    };
  } catch (err: any) {
    return { success: false, commits: [], error: err.message };
  }
}

export async function getRepoPullRequests(owner: string, repo: string) {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=10`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return { success: false, pulls: [] };
    const data: any = await res.json();
    return {
      success: true,
      pulls: (data || []).map((p: any) => ({
        id: p.id,
        number: p.number,
        title: p.title,
        state: p.state,
        htmlUrl: p.html_url,
        user: p.user?.login,
        createdAt: p.created_at,
        headBranch: p.head?.ref,
        baseBranch: p.base?.ref,
      })),
    };
  } catch (err: any) {
    return { success: false, pulls: [], error: err.message };
  }
}

export async function createPullRequest(owner: string, repo: string, title: string, head: string, base: string, body?: string) {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, head, base, body: body || 'Automated PR by ApexSec Autonomous Engineering Agent' }),
    });

    const data: any = await res.json();
    if (!res.ok) {
      return { success: false, error: data.message || `HTTP ${res.status}` };
    }

    return {
      success: true,
      pr: {
        number: data.number,
        title: data.title,
        htmlUrl: data.html_url,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getRepoSecurityAlerts(owner: string, repo: string) {
  const alerts: any = {
    dependabot: [],
    codeScanning: [],
    secretScanning: [],
  };

  try {
    // 1. Dependabot
    const depRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/dependabot/alerts?state=open`, {
      headers: getAuthHeaders(),
    });
    if (depRes.ok) {
      const data: any = await depRes.json();
      alerts.dependabot = (data || []).slice(0, 10).map((a: any) => ({
        number: a.number,
        package: a.security_advisory?.package?.name,
        severity: a.security_advisory?.severity?.toUpperCase(),
        summary: a.security_advisory?.summary,
        cve: a.security_advisory?.cve_id,
        htmlUrl: a.html_url,
      }));
    }
  } catch {
    // continue
  }

  try {
    // 2. Secret Scanning
    const secRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/secret-scanning/alerts?state=open`, {
      headers: getAuthHeaders(),
    });
    if (secRes.ok) {
      const data: any = await secRes.json();
      alerts.secretScanning = (data || []).slice(0, 10).map((a: any) => ({
        number: a.number,
        secretType: a.secret_type_display_name || a.secret_type,
        htmlUrl: a.html_url,
        createdAt: a.created_at,
      }));
    }
  } catch {
    // continue
  }

  return {
    success: true,
    alerts,
  };
}

/**
 * Clones or pulls a GitHub repository into an isolated sandbox workspace
 */
export async function syncRepoToWorkspace(owner: string, repo: string, targetWorkspaceId?: string): Promise<{
  success: boolean;
  workspaceId: string;
  path: string;
  error?: string;
}> {
  const wsId = targetWorkspaceId || `gh_${owner}_${repo}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const wsRoot = getWorkspaceRoot(wsId);

  try {
    await fs.mkdir(wsRoot, { recursive: true });

    let cloneUrl = `https://github.com/${owner}/${repo}.git`;
    if (githubConfig.token) {
      cloneUrl = `https://x-access-token:${githubConfig.token}@github.com/${owner}/${repo}.git`;
    }

    // Check if .git already exists in workspace
    let isCloned = false;
    try {
      await fs.stat(path.join(wsRoot, '.git'));
      isCloned = true;
    } catch {
      isCloned = false;
    }

    if (isCloned) {
      // Pull latest
      const pullRes = await executeCommand(wsId, 'git pull --rebase');
      if (pullRes.exitCode !== 0) {
        return { success: false, workspaceId: wsId, path: wsRoot, error: pullRes.stderr || 'Git pull failed' };
      }
    } else {
      // Clone fresh
      const cloneRes = await executeCommand(wsId, `git clone ${cloneUrl} .`);
      if (cloneRes.exitCode !== 0) {
        return { success: false, workspaceId: wsId, path: wsRoot, error: cloneRes.stderr || 'Git clone failed' };
      }
    }

    await recordAudit({
      workspaceId: wsId,
      repository: `${owner}/${repo}`,
      tool: 'github_service',
      action: `Synchronized repository ${owner}/${repo} to workspace ${wsId}`,
      resultSummary: `Repo ${owner}/${repo} synced to sandbox workspace ${wsId}`,
      success: true,
      riskLevel: 'LOW',
    });

    return {
      success: true,
      workspaceId: wsId,
      path: wsRoot,
    };
  } catch (err: any) {
    return {
      success: false,
      workspaceId: wsId,
      path: wsRoot,
      error: err.message,
    };
  }
}

export function getGitHubOAuthUrl(redirectUri?: string): { url: string; configured: boolean } {
  const clientId = process.env.GITHUB_CLIENT_ID || '';
  if (!clientId) {
    return {
      url: '',
      configured: false,
    };
  }
  const scope = 'repo,read:org,user:email';
  const state = `gh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const redirect = redirectUri ? `&redirect_uri=${encodeURIComponent(redirectUri)}` : '';
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}&state=${state}${redirect}`;
  return { url, configured: true };
}

export async function handleGitHubOAuthCallback(code: string): Promise<{ success: boolean; error?: string }> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'GitHub OAuth Client ID or Client Secret is not configured in backend environment variables.',
    };
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData: any = await tokenRes.json();
    if (!tokenData.access_token) {
      return {
        success: false,
        error: tokenData.error_description || tokenData.error || 'Failed to obtain access token from GitHub.',
      };
    }

    const connectRes = await connectGitHubAccount(tokenData.access_token, 'oauth');
    return {
      success: connectRes.success,
      error: connectRes.error,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
    };
  }
}
