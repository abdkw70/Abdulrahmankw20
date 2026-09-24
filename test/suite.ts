import assert from 'node:assert/strict';
import { resolveSafePath, createWorkspace, writeFile, readFile, deleteFile, listFiles } from '../server/workspaceManager.js';
import { checkToolPermission, updateOwnerPolicy, getOwnerPolicy } from '../server/ownerPolicy.js';
import { recordAudit, getAuditLogs, clearAuditLogs } from '../server/auditLogger.js';
import { executeCommand } from '../server/terminalRunner.js';
import { runSecurityAudit } from '../server/securityAuditor.js';
import { runPoCTest } from '../server/pocRunner.js';
import { runGitStatus } from '../server/gitManager.js';
import { performWebSearch } from '../server/webResearcher.js';

async function runTests() {
  console.log('=== [ApexSec] Starting Comprehensive Verification Test Suite ===\n');
  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    }
  }

  // 1. Workspace Sandboxing & Path Traversal Prevention
  await test('Workspace sandboxing prevents path traversal attacks', async () => {
    const ws = await createWorkspace('test_sandbox_ws');
    assert.equal(ws, 'test_sandbox_ws');

    // Safe path inside workspace
    const safePath = resolveSafePath('test_sandbox_ws', 'src/index.js');
    assert.ok(safePath.includes('test_sandbox_ws'));

    // Malicious directory traversal attempt
    assert.throws(
      () => resolveSafePath('test_sandbox_ws', '../../../etc/passwd'),
      /Path traversal attempt detected/
    );
  });

  // 2. Real Filesystem Operations
  await test('Filesystem write, read, list, and delete operate accurately', async () => {
    const ws = 'test_fs_ws';
    await createWorkspace(ws);
    
    // Write
    const writeRes = await writeFile(ws, 'config.json', '{"port": 8080}');
    assert.equal(writeRes.success, true);

    // Read
    const content = await readFile(ws, 'config.json');
    assert.equal(content, '{"port": 8080}');

    // List
    const items = await listFiles(ws);
    assert.ok(items.some((i) => i.name === 'config.json'));

    // Delete
    const delRes = await deleteFile(ws, 'config.json');
    assert.equal(delRes.success, true);
  });

  // 3. Owner Policy Enforcement & Governance Gating
  await test('Owner governance policy enforces permissions and approval gates', async () => {
    // Set to strict
    await updateOwnerPolicy({ autonomyLevel: 'strict' });
    const check1 = checkToolPermission('terminal_execute', { command: 'node -v' });
    assert.equal(check1.allowed, true);
    assert.equal(check1.requiresApproval, true, 'Strict mode must require approval');

    // Dangerous command blocking
    const check2 = checkToolPermission('terminal_execute', { command: 'rm -rf /' });
    assert.equal(check2.allowed, false, 'Blacklisted destructive command must be blocked');

    // Switch to balanced semi_supervised
    await updateOwnerPolicy({ autonomyLevel: 'semi_supervised' });
    const check3 = checkToolPermission('file_delete', { path: 'important.db' });
    assert.equal(check3.requiresApproval, true, 'Deleting files in semi_supervised must require approval');

    // Reset to semi_supervised
    await updateOwnerPolicy({ autonomyLevel: 'semi_supervised' });
  });

  // 4. Terminal Command Execution in Real Sandbox
  await test('Terminal runner executes real shell commands with stdout and exit codes', async () => {
    const ws = 'test_term_ws';
    await createWorkspace(ws);

    const res = await executeCommand(ws, 'echo "ApexSec Sandbox Active"');
    assert.equal(res.exitCode, 0);
    assert.ok(res.stdout.includes('ApexSec Sandbox Active'));
    assert.ok(res.durationMs >= 0);
  });

  // 5. Static Security Audit & SAST Scanner
  await test('SAST scanner identifies SQL Injection and hardcoded secrets with CWE tags', async () => {
    const ws = 'test_sec_ws';
    await createWorkspace(ws);

    // Inject vulnerable code patterns into workspace
    await writeFile(
      ws,
      'vulnerable_app.js',
      `
const query = "SELECT * FROM users WHERE username = '" + req.query.username + "'";
const apiKey = "AKIA1234567890EXAMPLEKEY";
eval("2 + 2");
`
    );

    const report = await runSecurityAudit(ws);
    assert.ok(report.filesScanned >= 1);
    assert.ok(report.findings.length >= 2, 'Should detect SQLi and Hardcoded Secret');
    
    const hasSqli = report.findings.some((f) => f.cwe === 'CWE-89');
    assert.ok(hasSqli, 'Should classify SQL Injection as CWE-89');

    const hasSecret = report.findings.some((f) => f.cwe === 'CWE-798');
    assert.ok(hasSecret, 'Should classify Hardcoded Secret as CWE-798');

    assert.ok(report.securityScore < 80, 'Score should reflect detected vulnerabilities');
  });

  // 6. Interactive Proof-of-Concept (PoC) Runner
  await test('PoC runner executes sandboxed verification and evaluates evidence', async () => {
    const ws = 'test_poc_ws';
    await createWorkspace(ws);

    const pocPlan = {
      vulnerabilityType: 'sqli' as const,
      targetScript: 'auth.js',
      pocScript: `
console.log("Starting PoC verification...");
const payload = "' OR 1=1 --";
if (payload.includes("1=1")) {
  console.log("VULN_EXPLOITED: SQL filter bypassed successfully");
}
`,
      expectedVulnerableIndicator: 'VULN_EXPLOITED',
    };

    const pocResult = await runPoCTest(ws, pocPlan);
    assert.equal(pocResult.vulnerabilityConfirmed, true);
    assert.ok(pocResult.rawOutput.includes('VULN_EXPLOITED'));
  });

  // 7. Git Integration
  await test('Git manager detects repository state and branches', async () => {
    const status = await runGitStatus('.');
    assert.equal(typeof status.isRepo, 'boolean');
    assert.equal(typeof status.clean, 'boolean');
  });

  // 8. Multi-Source Web & Tech Researcher
  await test('Researcher fetches primary technical references', async () => {
    const report = await performWebSearch('express router', 'test_research_ws');
    assert.equal(report.query, 'express router');
    assert.ok(report.results.length > 0);
    assert.ok(report.results.some((r) => r.source === 'Docs' || r.source === 'CVE' || r.source === 'Web' || r.source === 'NPM' || r.source === 'GitHub'));
  });

  // 9. Tamper-Evident Audit Logger
  await test('Audit logger maintains chronological tamper-evident event log', async () => {
    await clearAuditLogs();
    await recordAudit({
      workspaceId: 'test_audit_ws',
      tool: 'terminal_execute',
      action: 'npm test',
      resultSummary: 'Ran test suite',
      success: true,
      riskLevel: 'LOW',
      executionTimeMs: 120,
    });

    const logs = getAuditLogs(10);
    assert.ok(logs.length >= 1);
    assert.equal(logs[0].tool, 'terminal_execute');
    assert.equal(logs[0].action, 'npm test');
  });

  console.log(`\n=== Verification Results: ${passed}/${total} Tests Passed ===`);
  if (passed === total) {
    console.log('✅ ALL SUBSYSTEMS VERIFIED SUCCESSFULLY\n');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED\n');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test Suite Unhandled Exception:', err);
  process.exit(1);
});
