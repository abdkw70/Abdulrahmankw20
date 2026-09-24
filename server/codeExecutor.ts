import fs from 'node:fs/promises';
import path from 'node:path';
import { executeCommand, CommandResult } from './terminalRunner.js';
import { getWorkspaceRoot } from './workspaceManager.js';
import { recordAudit } from './auditLogger.js';

export interface CodeRunOptions {
  language: 'javascript' | 'typescript' | 'python' | 'bash';
  code: string;
  workspaceId: string;
}

export async function executeCodeDirect(options: CodeRunOptions): Promise<CommandResult> {
  const { language, code, workspaceId } = options;
  const root = getWorkspaceRoot(workspaceId);
  const tempId = `snippet_${Date.now()}`;

  let ext = 'js';
  let runner = 'node';

  if (language === 'typescript') {
    ext = 'ts';
    runner = 'npx tsx';
  } else if (language === 'python') {
    ext = 'py';
    runner = 'python3';
  } else if (language === 'bash') {
    ext = 'sh';
    runner = 'bash';
  }

  const tempFile = path.join(root, `${tempId}.${ext}`);

  try {
    await fs.writeFile(tempFile, code, 'utf-8');

    const result = await executeCommand(workspaceId, `${runner} ${tempId}.${ext}`);

    await recordAudit({
      workspaceId,
      tool: 'code_execute',
      action: `Ran ${language} code block (${code.length} chars)`,
      params: { language, snippetPreview: code.slice(0, 100) },
      resultSummary: `Exit ${result.exitCode} (${result.durationMs}ms)`,
      success: result.exitCode === 0,
      riskLevel: 'MEDIUM',
      executionTimeMs: result.durationMs,
    });

    return result;
  } finally {
    try {
      await fs.unlink(tempFile);
    } catch {
      // ignore
    }
  }
}
