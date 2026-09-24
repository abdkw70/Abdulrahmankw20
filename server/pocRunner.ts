import fs from 'node:fs/promises';
import path from 'node:path';
import { executeCommand, CommandResult } from './terminalRunner.js';
import { getWorkspaceRoot } from './workspaceManager.js';
import { recordAudit } from './auditLogger.js';

export interface PoCExecutionPlan {
  vulnerabilityType: 'sqli' | 'cmdi' | 'path_traversal' | 'xss' | 'custom';
  targetScript: string;
  pocScript: string;
  expectedVulnerableIndicator: string;
}

export interface PoCTestResult {
  vulnerabilityConfirmed: boolean;
  rawOutput: string;
  testDurationMs: number;
  evidence: string;
  remediationVerified: boolean;
}

export async function runPoCTest(
  workspaceId: string,
  plan: PoCExecutionPlan
): Promise<PoCTestResult> {
  const root = getWorkspaceRoot(workspaceId);
  const testId = `poc_${Date.now()}`;
  const testFile = path.join(root, `${testId}.js`);

  try {
    await fs.writeFile(testFile, plan.pocScript, 'utf-8');

    const result = await executeCommand(workspaceId, `node ${testId}.js`);
    const outputCombined = `${result.stdout}\n${result.stderr}`;
    const confirmed = outputCombined.includes(plan.expectedVulnerableIndicator);

    const testResult: PoCTestResult = {
      vulnerabilityConfirmed: confirmed,
      rawOutput: outputCombined,
      testDurationMs: result.durationMs,
      evidence: confirmed
        ? `Observed indicator "${plan.expectedVulnerableIndicator}" in execution output.`
        : `Indicator "${plan.expectedVulnerableIndicator}" was NOT observed in output.`,
      remediationVerified: false,
    };

    await recordAudit({
      workspaceId,
      tool: 'poc_runner',
      action: `Executed PoC test for ${plan.vulnerabilityType}`,
      params: { type: plan.vulnerabilityType, target: plan.targetScript },
      resultSummary: confirmed ? 'VULNERABILITY CONFIRMED (PoC Succeeded)' : 'PoC failed to trigger',
      success: true,
      riskLevel: 'HIGH',
      executionTimeMs: result.durationMs,
    });

    return testResult;
  } finally {
    try {
      await fs.unlink(testFile);
    } catch {
      // ignore
    }
  }
}
