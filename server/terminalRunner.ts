import { spawn, ChildProcess } from 'node:child_process';
import { getWorkspaceRoot, resolveSafePath } from './workspaceManager.js';
import { recordAudit } from './auditLogger.js';
import { getOwnerPolicy } from './ownerPolicy.js';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  command: string;
}

const runningTasks = new Map<string, ChildProcess>();

export function killRunningTask(taskId: string): boolean {
  const child = runningTasks.get(taskId);
  if (child && !child.killed) {
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL');
    }, 1000);
    runningTasks.delete(taskId);
    return true;
  }
  return false;
}

export function killAllRunningTasks(): number {
  let count = 0;
  for (const [id, child] of runningTasks.entries()) {
    try {
      if (!child.killed) {
        child.kill('SIGKILL');
        count++;
      }
    } catch {
      // ignore
    }
  }
  runningTasks.clear();
  return count;
}

export async function executeCommand(
  workspaceId: string,
  command: string,
  subDir = '',
  taskId = `task_${Date.now()}`
): Promise<CommandResult> {
  const startTime = Date.now();
  const root = getWorkspaceRoot(workspaceId);
  const cwd = subDir ? resolveSafePath(workspaceId, subDir) : root;
  const policy = getOwnerPolicy();
  const timeoutMs = (policy.terminal.timeoutSeconds || 30) * 1000;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Sanitize environment variables so child processes cannot inspect host secrets
    const sanitizedEnv: Record<string, string | undefined> = { ...process.env };
    delete sanitizedEnv.GEMINI_API_KEY;
    delete sanitizedEnv.GITHUB_PRIVATE_KEY;
    delete sanitizedEnv.GITHUB_CLIENT_SECRET;
    delete sanitizedEnv.GITHUB_APP_SECRET;

    // Execute via bash / sh
    const child = spawn(command, {
      cwd,
      shell: true,
      env: {
        ...sanitizedEnv,
        PATH: process.env.PATH,
        APEXSEC_WORKSPACE: root,
        TMPDIR: root,
      },
    });

    runningTasks.set(taskId, child);

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.length > 50000) {
        stdout = stdout.slice(0, 50000) + '\n...[Output truncated: exceeded 50KB limit]...';
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      if (stderr.length > 50000) {
        stderr = stderr.slice(0, 50000) + '\n...[Error output truncated]...';
      }
    });

    child.on('close', async (code) => {
      clearTimeout(timer);
      runningTasks.delete(taskId);
      const durationMs = Date.now() - startTime;

      await recordAudit({
        workspaceId,
        tool: 'terminal_execute',
        action: `Executed: ${command.slice(0, 100)}`,
        params: { command, cwd: pathShortener(cwd), taskId },
        resultSummary: `Exit ${code ?? -1} (${durationMs}ms) - ${stdout.slice(0, 120).replace(/\n/g, ' ')}`,
        success: code === 0,
        riskLevel: command.includes('rm') || command.includes('chmod') ? 'HIGH' : 'MEDIUM',
        executionTimeMs: durationMs,
      });

      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
        durationMs,
        timedOut,
        command,
      });
    });

    child.on('error', async (err) => {
      clearTimeout(timer);
      runningTasks.delete(taskId);
      const durationMs = Date.now() - startTime;

      await recordAudit({
        workspaceId,
        tool: 'terminal_execute',
        action: `Failed: ${command}`,
        params: { command, error: err.message },
        resultSummary: `Spawn Error: ${err.message}`,
        success: false,
        riskLevel: 'HIGH',
        executionTimeMs: durationMs,
      });

      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
        durationMs,
        timedOut: false,
        command,
      });
    });
  });
}

function pathShortener(p: string): string {
  return p.split('/').slice(-2).join('/');
}
