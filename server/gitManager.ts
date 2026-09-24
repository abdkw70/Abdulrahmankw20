import { executeCommand } from './terminalRunner.js';
import { recordAudit } from './auditLogger.js';

export interface GitStatusResult {
  branch: string;
  isRepo: boolean;
  clean: boolean;
  modified: string[];
  untracked: string[];
  raw: string;
}

export async function runGitStatus(workspaceId: string): Promise<GitStatusResult> {
  const result = await executeCommand(workspaceId, 'git status -s -b');
  if (result.exitCode !== 0) {
    return {
      branch: 'none',
      isRepo: false,
      clean: true,
      modified: [],
      untracked: [],
      raw: result.stderr || 'Not a git repository',
    };
  }

  const lines = result.stdout.split('\n');
  const branchLine = lines[0] || '';
  const branchMatch = branchLine.match(/^##\s+([\w\d/_-]+)/);
  const branch = branchMatch ? branchMatch[1] : 'unknown';

  const modified: string[] = [];
  const untracked: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('??')) {
      untracked.push(line.slice(3));
    } else {
      modified.push(line);
    }
  }

  return {
    branch,
    isRepo: true,
    clean: modified.length === 0 && untracked.length === 0,
    modified,
    untracked,
    raw: result.stdout,
  };
}

export async function runGitOperation(
  workspaceId: string,
  operation: 'init' | 'log' | 'diff' | 'commit' | 'branch',
  args = ''
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  let command = `git ${operation}`;
  if (args) {
    // Sanitize basic shell injection from args
    const cleanArgs = args.replace(/[;&|`$]/g, '');
    command = `git ${operation} ${cleanArgs}`;
  }

  const result = await executeCommand(workspaceId, command);

  await recordAudit({
    workspaceId,
    tool: 'git_operation',
    action: `git ${operation}`,
    params: { operation, args },
    resultSummary: `Exit ${result.exitCode}: ${result.stdout.slice(0, 100)}`,
    success: result.exitCode === 0,
    riskLevel: operation === 'commit' ? 'MEDIUM' : 'LOW',
    executionTimeMs: result.durationMs,
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    success: result.exitCode === 0,
  };
}
