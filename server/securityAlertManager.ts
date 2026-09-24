import fs from 'node:fs/promises';
import path from 'node:path';
import { SecurityAlert, SecurityAlertSeverity, OwnerPolicy } from './types.js';
import { recordAudit } from './auditLogger.js';

const DATA_DIR = path.resolve(process.cwd(), 'agent_data');
const ALERTS_FILE = path.join(DATA_DIR, 'security_alerts.json');

let activeAlerts: SecurityAlert[] = [];

export async function initSecurityAlertManager(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const content = await fs.readFile(ALERTS_FILE, 'utf-8');
    activeAlerts = JSON.parse(content);
  } catch {
    activeAlerts = [];
    await fs.writeFile(ALERTS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

export function getActiveAlerts(): SecurityAlert[] {
  return [...activeAlerts];
}

export async function addSecurityAlert(alertData: Omit<SecurityAlert, 'id' | 'timestamp' | 'canBypass' | 'bypassed'>): Promise<SecurityAlert> {
  // CRITICAL severity and destructive / secret leakage alerts can NEVER be bypassed automatically
  const isUnbypassable =
    alertData.severity === 'CRITICAL' ||
    alertData.type === 'secret_leak' ||
    alertData.type === 'destructive_command' ||
    alertData.type === 'data_loss' ||
    alertData.type === 'unauthorized_access';

  const newAlert: SecurityAlert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ...alertData,
    canBypass: !isUnbypassable,
    bypassed: false,
    timestamp: new Date().toISOString(),
  };

  // Check if identical active alert already exists to prevent duplicate flood
  const existingIdx = activeAlerts.findIndex(
    (a) => a.title === newAlert.title && a.resource === newAlert.resource && !a.bypassed
  );
  if (existingIdx >= 0) {
    activeAlerts[existingIdx] = newAlert;
  } else {
    activeAlerts.unshift(newAlert);
  }

  // Cap in-memory alert history at 150
  if (activeAlerts.length > 150) {
    activeAlerts = activeAlerts.slice(0, 150);
  }

  try {
    await fs.writeFile(ALERTS_FILE, JSON.stringify(activeAlerts, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist security alerts:', err);
  }

  return newAlert;
}

export interface BypassDecision {
  allowed: boolean;
  reason: string;
  reasonAr: string;
  alert?: SecurityAlert;
}

export async function requestAlertBypass(
  alertId: string,
  user: string,
  reason: string,
  policy: OwnerPolicy,
  workspaceId = 'default-workspace'
): Promise<BypassDecision> {
  const alert = activeAlerts.find((a) => a.id === alertId);
  if (!alert) {
    return {
      allowed: false,
      reason: 'Alert not found.',
      reasonAr: 'لم يتم العثور على الإخطار الأمني.',
    };
  }

  // 1. Critical and unbypassable alerts can NEVER be bypassed
  if (!alert.canBypass || alert.severity === 'CRITICAL') {
    return {
      allowed: false,
      reason: `Alert of severity "${alert.severity}" or type "${alert.type}" cannot be bypassed under any circumstances.`,
      reasonAr: `الإخطار بمستوى خطورة "${alert.severity}" أو نوع "${alert.type}" محظور تجاوزه نهائياً لضمان سلامة النظام.`,
      alert,
    };
  }

  // 2. Check if owner policy allows bypassing non-critical alerts
  if (!policy.allowNonCriticalAlertBypassAfterReview) {
    return {
      allowed: false,
      reason: 'Bypassing non-critical alerts is disabled in owner governance policy ("السماح بتجاوز الإخطارات غير الحرجة").',
      reasonAr: 'تجاوز الإخطارات غير الحرجة معطل في سياسة المالك ("السماح بتجاوز الإخطارات غير الحرجة بعد المراجعة").',
      alert,
    };
  }

  // 3. In cautious mode, only INFORMATIONAL and LOW may be bypassed after explicit review
  if (policy.operatingMode === 'cautious' && (alert.severity === 'MEDIUM' || alert.severity === 'HIGH')) {
    return {
      allowed: false,
      reason: `In Cautious Mode ("بحذر"), only INFORMATIONAL and LOW alerts can be bypassed with review. This alert is ${alert.severity}.`,
      reasonAr: `في وضع "بحذر"، يسمح فقط بتجاوز الإخطارات المعلوماتية والمنخفضة بعد المراجعة. هذا الإخطار بمستوى ${alert.severity}.`,
      alert,
    };
  }

  // Mark bypassed
  alert.bypassed = true;
  alert.bypassReason = reason;
  alert.bypassedBy = user;

  try {
    await fs.writeFile(ALERTS_FILE, JSON.stringify(activeAlerts, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist security alerts:', err);
  }

  // Record into Audit Log
  await recordAudit({
    workspaceId,
    user,
    mode: policy.operatingMode,
    tool: 'security_scanner',
    action: `Security Alert Bypassed: ${alert.title}`,
    securityAlert: alert.id,
    alertOverride: {
      alertId: alert.id,
      reason,
      user,
    },
    resultSummary: `Alert "${alert.title}" (${alert.severity}) bypassed by ${user}. Reason: ${reason}`,
    success: true,
    riskLevel: alert.severity === 'LOW' ? 'LOW' : 'MEDIUM',
  });

  return {
    allowed: true,
    reason: `Alert "${alert.title}" bypassed successfully and recorded in audit log.`,
    reasonAr: `تم تجاوز الإخطار "${alert.titleAr || alert.title}" بنجاح وتسجيل القرار في سجل التدقيق.`,
    alert,
  };
}

export async function revokeAlertBypass(alertId: string, user: string, workspaceId = 'default-workspace'): Promise<boolean> {
  const alert = activeAlerts.find((a) => a.id === alertId);
  if (!alert) return false;

  alert.bypassed = false;
  delete alert.bypassReason;
  delete alert.bypassedBy;

  try {
    await fs.writeFile(ALERTS_FILE, JSON.stringify(activeAlerts, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist security alerts:', err);
  }

  await recordAudit({
    workspaceId,
    user,
    mode: 'cautious',
    tool: 'security_scanner',
    action: `Alert Bypass Revoked: ${alert.title}`,
    securityAlert: alert.id,
    resultSummary: `Bypass on alert "${alert.title}" revoked by ${user}`,
    success: true,
    riskLevel: 'LOW',
  });

  return true;
}

export const createAlert = addSecurityAlert;
