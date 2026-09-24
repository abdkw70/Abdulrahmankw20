import fs from 'node:fs/promises';
import path from 'node:path';
import { AuditLogEntry, ToolName, RiskLevel, OperatingMode } from './types.js';

const DATA_DIR = path.resolve(process.cwd(), 'agent_data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit_log.json');

let logCache: AuditLogEntry[] = [];

export async function initAuditLogger(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const content = await fs.readFile(AUDIT_FILE, 'utf-8');
    logCache = JSON.parse(content);
  } catch {
    logCache = [];
    await fs.writeFile(AUDIT_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

export async function recordAudit(entry: {
  workspaceId: string;
  user?: string;
  mode?: OperatingMode;
  repository?: string;
  branch?: string;
  targetWebsite?: string;
  authorizedScope?: string;
  tool: ToolName | 'system' | 'owner' | 'security_scanner' | 'github_service';
  action: string;
  command?: string;
  filesChanged?: string[];
  networkRequest?: {
    url: string;
    method: string;
    host: string;
  };
  dataSent?: {
    destination: string;
    summary: string;
    sizeBytes?: number;
  };
  securityAlert?: string;
  alertOverride?: {
    alertId: string;
    reason: string;
    user: string;
  };
  approval?: {
    required: boolean;
    granted: boolean;
    user?: string;
  };
  params?: any;
  resultSummary: string;
  result?: string;
  error?: string;
  commitSha?: string;
  success: boolean;
  riskLevel: RiskLevel;
  diff?: string;
  executionTimeMs?: number;
}): Promise<AuditLogEntry> {
  const record: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    user: entry.user || 'Owner',
    mode: entry.mode || 'unrestricted',
    ...entry,
  };

  logCache.unshift(record); // newest first

  // Cap in-memory and on-disk log at 1000 items
  if (logCache.length > 1000) {
    logCache = logCache.slice(0, 1000);
  }

  try {
    await fs.writeFile(AUDIT_FILE, JSON.stringify(logCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist audit log:', err);
  }

  return record;
}

export function getAuditLogs(limit = 100, filterTool?: string, filterMode?: string, search?: string): AuditLogEntry[] {
  let logs = logCache;
  if (filterTool) {
    logs = logs.filter((l) => l.tool === filterTool);
  }
  if (filterMode) {
    logs = logs.filter((l) => l.mode === filterMode);
  }
  if (search) {
    const s = search.toLowerCase();
    logs = logs.filter((l) => 
      l.action.toLowerCase().includes(s) || 
      l.resultSummary.toLowerCase().includes(s) ||
      (l.command && l.command.toLowerCase().includes(s)) ||
      (l.repository && l.repository.toLowerCase().includes(s)) ||
      (l.targetWebsite && l.targetWebsite.toLowerCase().includes(s))
    );
  }
  return logs.slice(0, limit);
}

export async function clearAuditLogs(): Promise<void> {
  logCache = [];
  try {
    await fs.writeFile(AUDIT_FILE, JSON.stringify([], null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to clear audit logs:', err);
  }
}
