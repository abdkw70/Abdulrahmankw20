import fs from 'node:fs/promises';
import path from 'node:path';
import { recordAudit } from './auditLogger.js';

const WORKSPACES_ROOT = path.resolve(process.cwd(), 'agent_workspaces');

export interface WorkspaceItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  updatedAt: string;
}

export function sanitizeWorkspaceId(workspaceId: string): string {
  return workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'default-workspace';
}

export function getWorkspaceRoot(workspaceId: string): string {
  const cleanId = sanitizeWorkspaceId(workspaceId);
  return path.join(WORKSPACES_ROOT, cleanId);
}

export function resolveSafePath(workspaceId: string, relativePath: string): string {
  const root = path.resolve(getWorkspaceRoot(workspaceId));
  const resolved = path.resolve(root, relativePath);
  
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`Security Violation: Path traversal attempt detected: "${relativePath}"`);
  }
  return resolved;
}

export async function initWorkspaces(): Promise<void> {
  await fs.mkdir(WORKSPACES_ROOT, { recursive: true });
  
  // Seed default workspace
  const defaultDir = getWorkspaceRoot('default-workspace');
  await fs.mkdir(defaultDir, { recursive: true });

  const sampleReadme = path.join(defaultDir, 'README.md');
  try {
    await fs.access(sampleReadme);
  } catch {
    await fs.writeFile(
      sampleReadme,
      `# ApexSec Active Engineering Workspace\n\nThis is your private sandbox environment managed by your Personal AI Technical & Cybersecurity Agent.\n\n- Real Filesystem execution\n- Shell commands & Terminal integration\n- Automated security audits & PoC lab\n- Full owner permission governance\n`,
      'utf-8'
    );
  }

  // Seed security lab workspace
  const labDir = getWorkspaceRoot('security-lab');
  await fs.mkdir(labDir, { recursive: true });
  const vulnerableApi = path.join(labDir, 'vulnerable_api.js');
  try {
    await fs.access(vulnerableApi);
  } catch {
    await fs.writeFile(
      vulnerableApi,
      `// VULNERABLE LAB SERVICE (For Security Auditing & CTF Verification)
const express = require('express');
const { exec } = require('child_process');
const sqlite3 = require('sqlite3');
const app = express();

const db = new sqlite3.Database(':memory:');
const JWT_SECRET = "super_secret_hardcoded_jwt_key_12345"; // CWE-798

app.get('/api/users', (req, res) => {
  const username = req.query.name;
  // CWE-89: SQL Injection via direct string concatenation
  const query = "SELECT * FROM users WHERE name = '" + username + "'";
  db.all(query, (err, rows) => {
    res.json(rows);
  });
});

app.get('/api/ping', (req, res) => {
  const host = req.query.host;
  // CWE-78: OS Command Injection
  exec("ping -c 1 " + host, (err, stdout) => {
    res.send(stdout);
  });
});

app.get('/api/file', (req, res) => {
  const file = req.query.path;
  // CWE-22: Path Traversal
  const content = require('fs').readFileSync(file);
  res.send(content);
});
`,
      'utf-8'
    );
  }
}

export async function listWorkspaces(): Promise<string[]> {
  try {
    await fs.mkdir(WORKSPACES_ROOT, { recursive: true });
    const entries = await fs.readdir(WORKSPACES_ROOT, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return ['default-workspace'];
  }
}

export async function createWorkspace(workspaceId: string): Promise<string> {
  const cleanId = sanitizeWorkspaceId(workspaceId);
  const dir = getWorkspaceRoot(cleanId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'README.md'),
    `# Workspace: ${cleanId}\nCreated on ${new Date().toISOString()}\n`,
    'utf-8'
  );
  return cleanId;
}

export async function listFiles(workspaceId: string, subPath = ''): Promise<WorkspaceItem[]> {
  const targetDir = resolveSafePath(workspaceId, subPath);
  await fs.mkdir(targetDir, { recursive: true });

  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  const root = getWorkspaceRoot(workspaceId);

  const items: WorkspaceItem[] = [];
  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.name);
    try {
      const stats = await fs.stat(fullPath);
      const relative = path.relative(root, fullPath).replace(/\\/g, '/');
      items.push({
        name: entry.name,
        path: relative,
        isDirectory: entry.isDirectory(),
        size: stats.size,
        updatedAt: stats.mtime.toISOString(),
      });
    } catch {
      // Ignore unreadable entries
    }
  }

  // Sort directories first, then alphabetical
  return items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function readFile(workspaceId: string, relativePath: string): Promise<string> {
  const target = resolveSafePath(workspaceId, relativePath);
  return await fs.readFile(target, 'utf-8');
}

export async function writeFile(
  workspaceId: string,
  relativePath: string,
  content: string
): Promise<{ success: boolean; size: number; path: string }> {
  const target = resolveSafePath(workspaceId, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf-8');
  const stats = await fs.stat(target);

  await recordAudit({
    workspaceId,
    tool: 'file_write',
    action: `Wrote file ${relativePath}`,
    params: { path: relativePath, size: stats.size },
    resultSummary: `Saved ${stats.size} bytes to ${relativePath}`,
    success: true,
    riskLevel: 'LOW',
  });

  return { success: true, size: stats.size, path: relativePath };
}

export async function deleteFile(
  workspaceId: string,
  relativePath: string
): Promise<{ success: boolean; deleted: boolean }> {
  const target = resolveSafePath(workspaceId, relativePath);
  const stats = await fs.stat(target);
  if (stats.isDirectory()) {
    await fs.rm(target, { recursive: true, force: true });
  } else {
    await fs.unlink(target);
  }

  await recordAudit({
    workspaceId,
    tool: 'file_delete',
    action: `Deleted ${relativePath}`,
    params: { path: relativePath },
    resultSummary: `Removed ${relativePath}`,
    success: true,
    riskLevel: 'MEDIUM',
  });

  return { success: true, deleted: true };
}
