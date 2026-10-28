const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../middleware/auth');
const { executeAssignmentTests } = require('../../test/assignmentTestRunner');

// In-memory mutex to prevent concurrent test executions
let isRunning = false;

// Store the latest real execution result in memory so reloads or concurrent admins can inspect historical runs
let latestExecutionRecord = null;

/**
 * POST /api/testing/run
 * Requires ADMIN or SYSTEM_ADMIN role.
 * Runs the fixed 10 PBGMS assignment unit test cases without arbitrary shell execution.
 * Enforces execution timeout and concurrency protection.
 */
router.post('/run', authenticate, requireRoles('ADMIN', 'SYSTEM_ADMIN'), async (req, res) => {
  if (isRunning) {
    return res.status(409).json({
      success: false,
      message: 'A test execution is already in progress. Please wait for it to complete.'
    });
  }

  isRunning = true;
  const timeoutMs = 30000; // 30s maximum execution guard

  try {
    const runPromise = executeAssignmentTests();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Test execution timed out after 30 seconds.')), timeoutMs)
    );

    const result = await Promise.race([runPromise, timeoutPromise]);

    // Store in historical record with executing admin's identity
    latestExecutionRecord = {
      ...result,
      triggeredBy: req.user ? { name: req.user.name, role: req.user.role } : null
    };

    return res.status(200).json({
      success: true,
      data: latestExecutionRecord
    });
  } catch (err) {
    console.error('PBGMS Assignment Test Execution Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'An unexpected error occurred while executing assignment tests.'
    });
  } finally {
    isRunning = false;
  }
});

/**
 * GET /api/testing/latest
 * Requires ADMIN or SYSTEM_ADMIN role.
 * Returns the latest actual test execution record if one exists, or null.
 * Never fabricates results.
 */
router.get('/latest', authenticate, requireRoles('ADMIN', 'SYSTEM_ADMIN'), (req, res) => {
  if (!latestExecutionRecord) {
    return res.status(200).json({
      success: true,
      data: null,
      message: 'No test execution has occurred in this session. Status: NOT RUN.'
    });
  }

  return res.status(200).json({
    success: true,
    data: latestExecutionRecord,
    isHistorical: true
  });
});

/**
 * GET /api/testing/export-csv
 * Requires ADMIN or SYSTEM_ADMIN role.
 * Generates and downloads a CSV report strictly from the latest actual execution result.
 */
router.get('/export-csv', authenticate, requireRoles('ADMIN', 'SYSTEM_ADMIN'), (req, res) => {
  if (!latestExecutionRecord || !latestExecutionRecord.tests) {
    return res.status(404).json({
      success: false,
      message: 'Cannot export report: No test suite has been executed yet.'
    });
  }

  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '""';
    return `"${String(str).replace(/"/g, '""')}"`;
  };

  let csv = 'Test ID,Name,Module,Input Type,Authenticated Role,Endpoint / Input,Expected Result,Observed Result,HTTP Status,Assertion Result,Status,Intentional Fail,Duration (ms),Error\n';

  for (const t of latestExecutionRecord.tests) {
    csv += [
      escapeCsv(t.id),
      escapeCsv(t.name),
      escapeCsv(t.module),
      escapeCsv(t.inputType),
      escapeCsv(t.authenticatedRole),
      escapeCsv(t.inputSummary || t.requestEndpoint),
      escapeCsv(t.expectedStatusOrValue),
      escapeCsv(t.actualStatusOrValue),
      escapeCsv(t.actualHttpStatus || 'N/A'),
      escapeCsv(t.assertionResult),
      escapeCsv(t.status),
      escapeCsv(t.isIntentionalFail ? 'YES' : 'NO'),
      escapeCsv(t.executionDurationMs),
      escapeCsv(t.errorMessage || '')
    ].join(',') + '\n';
  }

  csv += '\nSUMMARY METRICS\n';
  csv += `Execution Timestamp,${escapeCsv(latestExecutionRecord.executedAt)}\n`;
  csv += `Total Duration (ms),${escapeCsv(latestExecutionRecord.totalDurationMs)}\n`;
  csv += `Total Executed,${escapeCsv(latestExecutionRecord.summary.totalExecuted)}\n`;
  csv += `Passing Assertions,${escapeCsv(latestExecutionRecord.summary.passingCount)}\n`;
  csv += `Intentional Assertion Failures,${escapeCsv(latestExecutionRecord.summary.intentionalFailCount)}\n`;
  csv += `Unexpected Errors,${escapeCsv(latestExecutionRecord.summary.unexpectedErrorCount)}\n`;
  csv += `Tests Not Run,${escapeCsv(latestExecutionRecord.summary.notRunCount)}\n`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="pbgms_assignment_test_report.csv"');
  return res.status(200).send(csv);
});

module.exports = router;
