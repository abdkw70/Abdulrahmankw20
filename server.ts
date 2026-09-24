import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Server modules
import { initOwnerPolicy, getOwnerPolicy, updateOwnerPolicy, switchOperatingMode } from './server/ownerPolicy.js';
import { initAuditLogger, getAuditLogs, clearAuditLogs } from './server/auditLogger.js';
import {
  initSecurityAlertManager,
  getActiveAlerts,
  requestAlertBypass,
  revokeAlertBypass,
} from './server/securityAlertManager.js';
import {
  initGitHubService,
  getGitHubPublicStatus,
  connectGitHubAccount,
  disconnectGitHubAccount,
  listUserRepositories,
  getRepoBranches,
  getRepoCommits,
  getRepoPullRequests,
  createPullRequest,
  getRepoSecurityAlerts,
  syncRepoToWorkspace,
  getGitHubOAuthUrl,
  handleGitHubOAuthCallback,
} from './server/githubService.js';
import {
  initWorkspaces,
  listWorkspaces,
  createWorkspace,
  listFiles,
  readFile,
  writeFile,
  deleteFile,
} from './server/workspaceManager.js';
import { executeCommand, killRunningTask, killAllRunningTasks } from './server/terminalRunner.js';
import { executeCodeDirect } from './server/codeExecutor.js';
import {
  performWebSearch,
  inspectGitHubRepo,
  searchGitHubPython,
  inspectExternalTransmission,
} from './server/webResearcher.js';
import { processPythonStudioRequest } from './server/pythonStudio.js';
import { runSecurityAudit, generateSBOM, performTlsHeaderAudit } from './server/securityAuditor.js';
import { runPoCTest } from './server/pocRunner.js';
import { runGitStatus, runGitOperation } from './server/gitManager.js';
import {
  createAndStartAgent,
  getSession,
  subscribeToSession,
  abortAgent,
  handleOwnerApproval,
} from './server/agentEngine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));

  // Initialize data stores & services
  await initOwnerPolicy();
  await initAuditLogger();
  await initSecurityAlertManager();
  await initGitHubService();
  await initWorkspaces();

  // --- REST API ROUTES ---

  // Health
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'online',
      app: 'ApexSec Autonomous Agent Studio',
      mode: getOwnerPolicy().operatingMode,
      timestamp: new Date().toISOString(),
    });
  });

  // Workspaces
  app.get('/api/workspaces', async (req, res) => {
    try {
      const workspaces = await listWorkspaces();
      res.json({ workspaces });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/workspaces', async (req, res) => {
    try {
      const { workspaceId } = req.body;
      const created = await createWorkspace(workspaceId || 'workspace');
      res.json({ workspace: created });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Filesystem
  app.get('/api/fs/list', async (req, res) => {
    try {
      const workspaceId = String(req.query.workspaceId || 'default-workspace');
      const subPath = String(req.query.subPath || '');
      const items = await listFiles(workspaceId, subPath);
      res.json({ items });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/fs/read', async (req, res) => {
    try {
      const workspaceId = String(req.query.workspaceId || 'default-workspace');
      const filePath = String(req.query.path || '');
      const content = await readFile(workspaceId, filePath);
      res.json({ content, path: filePath });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.post('/api/fs/write', async (req, res) => {
    try {
      const { workspaceId, path: filePath, content } = req.body;
      const result = await writeFile(workspaceId || 'default-workspace', filePath, content);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/fs/delete', async (req, res) => {
    try {
      const { workspaceId, path: filePath } = req.body;
      const result = await deleteFile(workspaceId || 'default-workspace', filePath);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Terminal
  app.post('/api/terminal/run', async (req, res) => {
    try {
      const { workspaceId, command, subDir } = req.body;
      const result = await executeCommand(workspaceId || 'default-workspace', command, subDir);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/terminal/kill', (req, res) => {
    const { taskId } = req.body;
    if (taskId) {
      const killed = killRunningTask(taskId);
      res.json({ killed });
    } else {
      const count = killAllRunningTasks();
      res.json({ killedAllCount: count });
    }
  });

  // Code Executor
  app.post('/api/code/run', async (req, res) => {
    try {
      const { workspaceId, language, code } = req.body;
      const result = await executeCodeDirect({
        workspaceId: workspaceId || 'default-workspace',
        language: language || 'javascript',
        code,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Security Lab & SAST
  app.get('/api/security/audit', async (req, res) => {
    try {
      const workspaceId = String(req.query.workspaceId || 'default-workspace');
      const report = await runSecurityAudit(workspaceId);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/security/sbom', async (req, res) => {
    try {
      const workspaceId = String(req.query.workspaceId || 'default-workspace');
      const sbom = await generateSBOM(workspaceId);
      res.json(sbom);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/security/tls-header', async (req, res) => {
    try {
      const { url, workspaceId } = req.body;
      if (!url) return res.status(400).json({ error: 'url is required' });
      const report = await performTlsHeaderAudit(url, workspaceId || 'default-workspace');
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/security/poc', async (req, res) => {
    try {
      const { workspaceId, plan } = req.body;
      const result = await runPoCTest(workspaceId || 'default-workspace', plan);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Security Alert Manager APIs
  app.get('/api/security/alerts', (req, res) => {
    res.json({ alerts: getActiveAlerts() });
  });

  app.post('/api/security/alerts/bypass', async (req, res) => {
    try {
      const { alertId, user, reason, workspaceId } = req.body;
      if (!alertId) return res.status(400).json({ error: 'alertId is required' });
      const decision = await requestAlertBypass(
        alertId,
        user || 'Owner',
        reason || 'Reviewed by owner',
        getOwnerPolicy(),
        workspaceId || 'default-workspace'
      );
      res.json(decision);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/security/alerts/revoke', async (req, res) => {
    try {
      const { alertId, user, workspaceId } = req.body;
      const revoked = await revokeAlertBypass(alertId, user || 'Owner', workspaceId || 'default-workspace');
      res.json({ success: revoked });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Web & Multi-Source Researcher
  app.get('/api/research/search', async (req, res) => {
    try {
      const query = String(req.query.query || '');
      const workspaceId = String(req.query.workspaceId || 'default-workspace');
      const report = await performWebSearch(query, workspaceId);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/research/github', async (req, res) => {
    try {
      const repo = String(req.query.repo || '');
      const workspaceId = String(req.query.workspaceId || 'default-workspace');
      const result = await inspectGitHubRepo(repo, workspaceId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/research/github-python', async (req, res) => {
    try {
      const query = String(req.query.query || 'python tools');
      const workspaceId = String(req.query.workspaceId || 'default-workspace');
      const result = await searchGitHubPython(query, workspaceId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/research/inspect-outbound', (req, res) => {
    try {
      const { serviceName, payload } = req.body;
      const inspection = inspectExternalTransmission(serviceName || 'external', payload);
      res.json(inspection);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Direct Interactive Python & Technical Q&A Studio
  app.post('/api/python/studio', async (req, res) => {
    try {
      const { prompt, workspaceId, autoExecute, targetFilename } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'prompt is required' });
      }
      const result = await processPythonStudioRequest(
        prompt,
        workspaceId || 'default-workspace',
        { autoExecute: autoExecute !== false, targetFilename }
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/agent/chat', async (req, res) => {
    try {
      const { message, workspaceId, autoExecute } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'message is required' });
      }
      const result = await processPythonStudioRequest(
        message,
        workspaceId || 'default-workspace',
        { autoExecute: autoExecute !== false }
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Git Local
  app.get('/api/git/status', async (req, res) => {
    try {
      const workspaceId = String(req.query.workspaceId || 'default-workspace');
      const status = await runGitStatus(workspaceId);
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/git/op', async (req, res) => {
    try {
      const { workspaceId, operation, args } = req.body;
      const result = await runGitOperation(workspaceId || 'default-workspace', operation, args);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Real GitHub Integration APIs
  app.get('/api/github/status', (req, res) => {
    res.json(getGitHubPublicStatus());
  });

  app.post('/api/github/connect', async (req, res) => {
    try {
      const { token, tokenType } = req.body;
      if (!token) return res.status(400).json({ error: 'Token is required' });
      const result = await connectGitHubAccount(token, tokenType || 'pat');
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/github/oauth/url', (req, res) => {
    const redirectUri = req.query.redirectUri ? String(req.query.redirectUri) : undefined;
    res.json(getGitHubOAuthUrl(redirectUri));
  });

  app.post('/api/github/oauth/callback', async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: 'OAuth authorization code is required' });
      const result = await handleGitHubOAuthCallback(code);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/github/disconnect', async (req, res) => {
    const success = await disconnectGitHubAccount();
    res.json({ success });
  });

  app.get('/api/github/repos', async (req, res) => {
    const result = await listUserRepositories();
    res.json(result);
  });

  app.get('/api/github/branches', async (req, res) => {
    const owner = String(req.query.owner || '');
    const repo = String(req.query.repo || '');
    if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });
    const result = await getRepoBranches(owner, repo);
    res.json(result);
  });

  app.get('/api/github/commits', async (req, res) => {
    const owner = String(req.query.owner || '');
    const repo = String(req.query.repo || '');
    const branch = req.query.branch ? String(req.query.branch) : undefined;
    if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });
    const result = await getRepoCommits(owner, repo, branch);
    res.json(result);
  });

  app.get('/api/github/pulls', async (req, res) => {
    const owner = String(req.query.owner || '');
    const repo = String(req.query.repo || '');
    if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });
    const result = await getRepoPullRequests(owner, repo);
    res.json(result);
  });

  app.post('/api/github/pulls', async (req, res) => {
    try {
      const { owner, repo, title, head, base, body } = req.body;
      if (!owner || !repo || !title || !head || !base) {
        return res.status(400).json({ error: 'owner, repo, title, head, base are required' });
      }
      const result = await createPullRequest(owner, repo, title, head, base, body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/github/alerts', async (req, res) => {
    const owner = String(req.query.owner || '');
    const repo = String(req.query.repo || '');
    if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });
    const result = await getRepoSecurityAlerts(owner, repo);
    res.json(result);
  });

  app.post('/api/github/sync', async (req, res) => {
    try {
      const { owner, repo, workspaceId } = req.body;
      if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });
      const result = await syncRepoToWorkspace(owner, repo, workspaceId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Owner Policy & Governance
  app.get('/api/policy', (req, res) => {
    res.json(getOwnerPolicy());
  });

  app.post('/api/policy', async (req, res) => {
    try {
      const updated = await updateOwnerPolicy(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3-Mode Operating Switcher
  app.post('/api/policy/mode', async (req, res) => {
    try {
      const { mode } = req.body;
      if (!mode) return res.status(400).json({ error: 'mode is required' });
      const result = await switchOperatingMode(mode);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Audit Logs
  app.get('/api/audit-logs', (req, res) => {
    const limit = Number(req.query.limit) || 100;
    const filter = req.query.filter ? String(req.query.filter) : undefined;
    const filterMode = req.query.mode ? String(req.query.mode) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    res.json({ logs: getAuditLogs(limit, filter, filterMode, search) });
  });

  app.delete('/api/audit-logs', async (req, res) => {
    await clearAuditLogs();
    res.json({ success: true });
  });

  // Autonomous Agent Controller
  app.post('/api/agent/start', async (req, res) => {
    try {
      const { userGoal, workspaceId } = req.body;
      if (!userGoal) {
        return res.status(400).json({ error: 'userGoal is required' });
      }
      const session = await createAndStartAgent(userGoal, workspaceId || 'default-workspace');
      res.json({
        taskId: session.taskId,
        status: session.status,
        startedAt: session.startedAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // SSE Stream for Agent Progress
  app.get('/api/agent/stream/:taskId', (req, res) => {
    const { taskId } = req.params;
    const session = getSession(taskId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Initial snapshot
    res.write(
      `data: ${JSON.stringify({
        type: 'init',
        data: {
          taskId: session.taskId,
          status: session.status,
          plan: session.plan,
          messages: session.messages,
          pendingApproval: session.pendingApproval,
        },
      })}\n\n`
    );

    const unsubscribe = subscribeToSession(taskId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    req.on('close', () => {
      unsubscribe();
    });
  });

  // Emergency Abort
  app.post('/api/agent/abort', (req, res) => {
    const { taskId } = req.body;
    const aborted = abortAgent(taskId);
    res.json({ aborted });
  });

  // Owner Approval / Rejection
  app.post('/api/agent/approve', (req, res) => {
    const { taskId, approvalId, approved, feedback } = req.body;
    const result = handleOwnerApproval(taskId, approvalId, Boolean(approved), feedback);
    res.json({ success: result });
  });

  // --- VITE MIDDLEWARE / STATIC ASSETS ---
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const isHttps = process.env.APP_URL?.startsWith('https') || false;
    const clientPort = isHttps ? 443 : PORT;

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: {
          server,
          clientPort,
        },
        hmr: {
          server,
          clientPort,
        },
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[ApexSec] Autonomous Agent Studio running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal Server Boot Error:', err);
  process.exit(1);
});
