import { searchGitHubPython } from '../server/webResearcher.js';
import { executeCommand } from '../server/terminalRunner.js';
import { writeFile, readFile } from '../server/workspaceManager.js';
import { runSecurityAudit } from '../server/securityAuditor.js';
import { processPythonStudioRequest } from '../server/pythonStudio.js';

async function runAllTests() {
  console.log('====================================================');
  console.log('APEXSEC AUTOMATED TEST SUITE: PYTHON & SECURITY VERIFICATION');
  console.log('====================================================');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      throw new Error(`Test assertion failed: ${msg}`);
    }
  }

  // 1. Test GitHub Python search
  console.log('\n--- 1. Testing GitHub Python Search ---');
  const ghResult = await searchGitHubPython('cryptography hmac', 'test-workspace');
  assert(ghResult.success === true, 'GitHub search API returned success=true');
  assert(Array.isArray(ghResult.repos), 'GitHub search returned repos array');
  assert(ghResult.repos.length > 0, 'Discovered at least 1 repository on GitHub');
  assert(typeof ghResult.repos[0].fullName === 'string', 'Repo object has fullName');
  assert(typeof ghResult.repos[0].stars === 'number', 'Repo object has star count');
  console.log(`Discovered: ${ghResult.repos[0].fullName} (${ghResult.repos[0].stars} stars)`);

  // 2. Test Real Python 3 Execution in Sandbox
  console.log('\n--- 2. Testing Real Python 3 Sandbox Execution ---');
  const sampleScript = `#!/usr/bin/env python3
import hashlib
import json

def test_hash():
    data = b"ApexSec-Real-Verification-Test"
    digest = hashlib.sha256(data).hexdigest()
    return {"digest": digest, "len": len(digest)}

if __name__ == '__main__':
    res = test_hash()
    print("OUTPUT_JSON:" + json.dumps(res))
    assert res["len"] == 64
    print("[SUCCESS] All assertions passed!")
`;

  await writeFile('test-workspace', 'verify_test.py', sampleScript);
  const termRes = await executeCommand('test-workspace', 'python3 verify_test.py');
  if (termRes.exitCode !== 0) {
    console.error('termRes stderr:', termRes.stderr);
    console.error('termRes stdout:', termRes.stdout);
  }
  assert(termRes.exitCode === 0, `Python script executed with exitCode 0 (got: ${termRes.exitCode})`);
  assert(termRes.stdout.includes('OUTPUT_JSON:'), 'Stdout contains generated output');
  assert(termRes.stdout.includes('[SUCCESS] All assertions passed!'), 'Stdout confirms all assertions passed');
  console.log('Python Output:\n', termRes.stdout.trim());

  // 3. Test Workspace File System
  console.log('\n--- 3. Testing Workspace File Persistence ---');
  const readBack = await readFile('test-workspace', 'verify_test.py');
  assert(readBack.includes('ApexSec-Real-Verification-Test'), 'File correctly written and read back from workspace');

  // 4. Test SAST Security Scanner
  console.log('\n--- 4. Testing SAST Security Scanner ---');
  const auditRes = await runSecurityAudit('test-workspace');
  assert(auditRes.workspaceId === 'test-workspace', 'Security scan completed for test workspace');
  assert(typeof auditRes.filesScanned === 'number', 'Scanner counted analyzed files');
  console.log(`Scanned ${auditRes.filesScanned} files. Security Score: ${auditRes.securityScore}/100`);

  // 5. Test Python Studio Pipeline (Full Code + Execution)
  console.log('\n--- 5. Testing Python Studio Pipeline (Complete Code + Real Run) ---');
  const studioRes = await processPythonStudioRequest(
    'اكتب كود بايثون كامل لخوارزمية تشفير HMAC مع فحص الصلاحية واختبره',
    'test-workspace',
    { autoExecute: true, targetFilename: 'studio_test.py' }
  );

  assert(typeof studioRes.reply === 'string' && studioRes.reply.length > 0, 'Studio produced detailed technical reply');
  assert(!!studioRes.pythonCode && studioRes.pythonCode.length > 50, 'Studio generated substantial Python code');
  assert(!!studioRes.pythonCode && !studioRes.pythonCode.includes('...'), 'Generated code has zero "..." truncation placeholders');
  assert(!!studioRes.pythonCode && !studioRes.pythonCode.includes('# TODO'), 'Generated code has zero "# TODO" placeholders');
  assert(!!studioRes.pythonCode && studioRes.pythonCode.includes('if __name__ =='), 'Generated code includes executable entry block');
  assert(!!studioRes.executionResult && studioRes.executionResult.exitCode === 0, `Studio code executed in Python sandbox with exitCode 0`);
  assert(studioRes.testedSuccessfully === true, 'testedSuccessfully flag is true');
  if (studioRes.executionResult) {
    console.log(`Execution Duration: ${studioRes.executionResult.durationMs}ms`);
    console.log('Live Stdout from Python sandbox:\n', studioRes.executionResult.stdout.trim());
  }

  // 6. Test 3-Mode Operating System Policy Switching
  console.log('\n--- 6. Testing 3-Mode Operating System Policy Switching ---');
  const { switchOperatingMode, getOwnerPolicy, checkToolPermission } = await import('../server/ownerPolicy.js');
  
  // Set initial baseline to cautious
  await switchOperatingMode('cautious');

  // Transition: Cautious -> Unrestricted (LESS_RESTRICTIVE)
  const unres = await switchOperatingMode('unrestricted');
  assert(unres.policy.operatingMode === 'unrestricted', 'Switched to unrestricted mode');
  assert(unres.summary.direction === 'LESS_RESTRICTIVE', 'Direction marked as LESS_RESTRICTIVE');
  const termUnres = checkToolPermission('terminal_execute', { command: 'echo 123' }, getOwnerPolicy());
  assert(termUnres.allowed === true && !termUnres.requireApproval, 'Terminal executes without approval in unrestricted mode');

  // Transition: Unrestricted -> Medium (MORE_RESTRICTIVE)
  const med = await switchOperatingMode('medium');
  assert(med.policy.operatingMode === 'medium', 'Switched to medium mode');
  assert(med.summary.direction === 'MORE_RESTRICTIVE', 'Transition unrestricted -> medium is MORE_RESTRICTIVE');

  // Transition: Medium -> Cautious (MORE_RESTRICTIVE)
  const caut = await switchOperatingMode('cautious');
  assert(caut.policy.operatingMode === 'cautious', 'Switched to cautious mode');
  assert(caut.summary.direction === 'MORE_RESTRICTIVE', 'Direction marked as MORE_RESTRICTIVE');
  assert(caut.summary.requiresReconfirmationForSensitiveTasks === true, 'Reconfirmation required when switching to cautious');
  const termCaut = checkToolPermission('terminal_execute', { command: 'echo 123' }, getOwnerPolicy());
  assert(termCaut.requireApproval === true, 'Terminal execution requires explicit approval in cautious mode');

  // 7. Test Scope Validator & Offensive Attack Blocking
  console.log('\n--- 7. Testing Scope Validator & Unauthorized Target Blocking ---');
  const { validateScopeAndSafety } = await import('../server/scopeValidator.js');
  const outOfScopeCheck = validateScopeAndSafety(
    'terminal_execute',
    { command: 'nmap -sS -p 1-65535 unauthorized-target.com' },
    getOwnerPolicy(),
    'test-workspace'
  );
  assert(outOfScopeCheck.valid === false, 'Blocked offensive nmap scan against unauthorized target');
  assert(outOfScopeCheck.violations.length > 0, 'Violation recorded for offensive scan');

  // 8. Test Security Alert Manager & Bypass Control
  console.log('\n--- 8. Testing Security Alert Manager & Bypass Control ---');
  const { createAlert, requestAlertBypass, getActiveAlerts } = await import('../server/securityAlertManager.js');
  
  // Critical alert
  const critAlert = await createAlert({
    severity: 'CRITICAL',
    type: 'secret_leak',
    title: 'Exposed Private Key',
    titleAr: 'مفتاح خاص مكشوف',
    description: 'Private SSH key found in source',
    descriptionAr: 'تم العثور على مفتاح SSH خاص',
    resource: 'id_rsa',
    canBypass: false,
  });
  const critBypass = await requestAlertBypass(critAlert.id, 'Owner', 'Bypass anyway', getOwnerPolicy());
  assert(critBypass.allowed === false, 'CRITICAL alert cannot be bypassed (strictly enforced)');

  // Low alert
  const lowAlert = await createAlert({
    severity: 'LOW',
    type: 'config_risk',
    title: 'Missing Strict Headers',
    titleAr: 'رؤوس أمان مفقودة',
    description: 'Header recommendation',
    descriptionAr: 'توصية بإضافة رؤوس أمان',
    resource: 'server.ts',
    canBypass: true,
  });
  const lowBypass = await requestAlertBypass(lowAlert.id, 'Owner', 'Accepted for development environment', getOwnerPolicy());
  assert(lowBypass.allowed === true, 'LOW alert allowed bypass after owner documented review');

  console.log('====================================================');
  console.log(`ALL ${passed}/${total} AUTOMATED INTEGRATION TESTS PASSED!`);
  console.log('====================================================');
}

runAllTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
