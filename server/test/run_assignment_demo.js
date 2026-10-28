const { executeAssignmentTests } = require('./assignmentTestRunner');

async function runCli() {
  console.log('================================================================================');
  console.log('PBGMS ASSIGNMENT UNIT TEST REPORT: 10 TEST CASES (8 PASS, 2 INTENTIONAL FAIL)');
  console.log('================================================================================\n');

  try {
    const result = await executeAssignmentTests();

    console.log('--- MODULE 1: Role-Specific Dashboard and Authorization (5 Tests) ---');
    for (const t of result.tests.slice(0, 5)) {
      console.log(`[${t.status}] ${t.id}: ${t.name} (${t.executionDurationMs}ms)`);
      if (t.isIntentionalFail) {
        console.log(`   -> Reason: ${t.errorMessage || t.actualStatusOrValue}`);
      }
    }

    console.log('\n--- MODULE 2: Theme Toggle and Persistence (5 Tests) ---');
    for (const t of result.tests.slice(5, 10)) {
      console.log(`[${t.status}] ${t.id}: ${t.name} (${t.executionDurationMs}ms)`);
      if (t.isIntentionalFail) {
        console.log(`   -> Reason: ${t.errorMessage || t.actualStatusOrValue}`);
      }
    }

    console.log('\n================================================================================');
    console.log('SUMMARY TABLE:');
    console.log('================================================================================');
    console.table(result.tests.map(r => ({
      'Test ID': r.id,
      'Module': r.module,
      'Status': r.status,
      'Assertion': r.assertionResult,
      'Expected': (r.expectedStatusOrValue || '').slice(0, 40),
      'Observed': (r.actualStatusOrValue || '').slice(0, 45)
    })));

    console.log(`Total Tests Run: ${result.summary.totalExecuted}`);
    console.log(`Passing Tests:   ${result.summary.passingCount} / 8`);
    console.log(`Intentional:     ${result.summary.intentionalFailCount} / 2 (Documented Expected Failures)`);
    console.log(`Unexpected:      ${result.summary.unexpectedErrorCount} / 0`);

    if (result.summary.passingCount === 8 && result.summary.intentionalFailCount === 2 && result.summary.unexpectedErrorCount === 0) {
      console.log('\n✅ ASSIGNMENT DEMONSTRATION VERIFICATION SUCCESSFUL: EXACTLY 8 PASSING AND 2 INTENTIONALLY FAILING ASSERTIONS PRODUCED.');
      process.exit(0);
    } else {
      console.error('\n❌ ASSIGNMENT VERIFICATION FAILED: Did not match exact 8 PASS / 2 INTENTIONAL FAIL criteria.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during assignment demonstration runner:', err);
    process.exit(1);
  }
}

runCli();
