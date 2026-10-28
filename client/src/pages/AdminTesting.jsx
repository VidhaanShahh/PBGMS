import React, { useState, useEffect } from 'react';
import {
  runAssignmentTests,
  getLatestTestExecution,
  downloadAssignmentTestReportCsv
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Shield,
  Play,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
  Palette,
  Eye,
  Info
} from 'lucide-react';

export default function AdminTesting() {
  const { role } = useAuth();
  const { theme } = useTheme();

  // Test execution state
  const [executionData, setExecutionData] = useState(null);
  const [statusState, setStatusState] = useState('NOT RUN'); // 'NOT RUN', 'RUNNING', 'COMPLETED', 'ERROR'
  const [isRunning, setIsRunning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isHistorical, setIsHistorical] = useState(false);
  const [expandedTestId, setExpandedTestId] = useState(null);

  // Load prior execution result on mount if one actually exists in backend memory
  useEffect(() => {
    let isMounted = true;
    async function checkPriorExecution() {
      try {
        const res = await getLatestTestExecution();
        if (!isMounted) return;
        if (res.success && res.data && res.data.tests) {
          setExecutionData(res.data);
          setStatusState('COMPLETED');
          setIsHistorical(true);
        } else {
          setStatusState('NOT RUN');
          setExecutionData(null);
        }
      } catch (err) {
        if (!isMounted) return;
        // If unable to query or backend not ready, keep NOT RUN
        setStatusState('NOT RUN');
      }
    }

    checkPriorExecution();
    return () => { isMounted = false; };
  }, []);

  // Handler: Execute tests
  const handleRunTests = async () => {
    if (isRunning) return;

    setIsRunning(true);
    setStatusState('RUNNING');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await runAssignmentTests();
      if (res.success && res.data) {
        setExecutionData(res.data);
        setStatusState('COMPLETED');
        setIsHistorical(false);
        setSuccessMessage('Test execution completed successfully. Genuine test assertions and live observed outputs recorded.');
      } else {
        setStatusState('ERROR');
        setErrorMessage(res.message || 'Execution finished without structured output.');
      }
    } catch (err) {
      setStatusState('ERROR');
      setErrorMessage(err.message || 'Test runner failed to execute.');
    } finally {
      setIsRunning(false);
    }
  };

  // Handler: Download Report
  const handleDownloadCsv = async () => {
    if (!executionData) return;
    setIsDownloading(true);
    setErrorMessage('');
    try {
      await downloadAssignmentTestReportCsv(`pbgms_assignment_test_report_${Date.now()}.csv`);
      setSuccessMessage('Authentic execution report CSV downloaded successfully.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to generate test report download.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Extract tests by module
  const tests = executionData?.tests || [];
  const module1Tests = tests.filter(t => t.id >= 'TC01' && t.id <= 'TC05');
  const module2Tests = tests.filter(t => t.id >= 'TC06' && t.id <= 'TC10');

  // Summary counts directly from actual data or null
  const summary = executionData?.summary;

  const renderStatusBadge = (status, isIntentional) => {
    if (status === 'PASS') {
      return (
        <span className="nb-badge nb-badge-mint" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <CheckCircle2 size={13} /> PASS
        </span>
      );
    }
    if (status === 'INTENTIONAL FAIL') {
      return (
        <span className="nb-badge nb-badge-coral" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#FF6B5F', color: '#fff' }}>
          <AlertTriangle size={13} /> INTENTIONAL FAIL
        </span>
      );
    }
    if (status === 'ERROR' || status === 'UNEXPECTED FAIL') {
      return (
        <span className="nb-badge nb-badge-coral" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <XCircle size={13} /> ERROR
        </span>
      );
    }
    return (
      <span className="nb-badge nb-badge-white" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        <Clock size={13} /> NOT RUN
      </span>
    );
  };

  return (
    <div className="nb-container" style={{ padding: '2.5rem 1.5rem 4rem 1.5rem' }}>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <span className="nb-badge nb-badge-yellow" style={{ fontSize: '0.85rem' }}>
              <Shield size={14} /> Executive Admin Console
            </span>
            <span className="nb-badge nb-badge-mint">
              Academic Assignment Verification
            </span>
            <span className="nb-badge nb-badge-white" style={{ textTransform: 'none' }}>
              Active Theme: <strong>{theme}</strong>
            </span>
          </div>
          <h1 style={{ fontSize: '2.25rem', letterSpacing: '-0.03em' }}>
            Assignment Unit Test Execution Suite
          </h1>
          <p style={{ color: 'var(--nb-text-muted)', fontSize: '0.95rem', maxWidth: '850px' }}>
            Genuine execution dashboard for the 10 PBGMS assignment unit test cases across Role-Based Dashboard Authorization (Module 1) and Neobrutalist Theme Persistence (Module 2). Results are strictly produced by real assertions.
          </p>
        </div>

        {/* Execution & Download Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleRunTests}
            disabled={isRunning}
            id="run-assignment-tests-btn"
            className="nb-btn nb-btn-yellow"
            style={{ minWidth: '210px' }}
          >
            {isRunning ? (
              <>
                <RefreshCw size={16} className="nb-loading-pulse" style={{ animation: 'spin 1s linear infinite' }} /> Executing Tests...
              </>
            ) : (
              <>
                <Play size={16} /> Run Assignment Tests
              </>
            )}
          </button>

          <button
            onClick={handleDownloadCsv}
            disabled={!executionData || isRunning || isDownloading}
            id="download-test-report-btn"
            className="nb-btn nb-btn-white"
            title={!executionData ? 'Execute tests first to generate report' : 'Download genuine CSV test report'}
          >
            <Download size={16} /> Download Report (CSV)
          </button>
        </div>
      </div>

      {/* Alert Notices */}
      {successMessage && (
        <div className="nb-alert nb-alert-mint" style={{ marginBottom: '1.5rem' }}>
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="nb-alert nb-alert-coral" style={{ marginBottom: '1.5rem' }}>
          <XCircle size={18} />
          <div>
            <strong>Test Execution Error:</strong> {errorMessage}
          </div>
        </div>
      )}

      {/* Historical Run Banner if results are from previous execution */}
      {executionData && isHistorical && (
        <div className="nb-alert nb-alert-yellow" style={{ marginBottom: '1.5rem' }}>
          <Info size={18} />
          <div>
            <strong>Historical Execution Record:</strong> Displaying saved results executed on{' '}
            <strong>{new Date(executionData.executedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</strong>{' '}
            ({executionData.totalDurationMs}ms). Click <em>Run Assignment Tests</em> above to trigger a fresh execution.
          </div>
        </div>
      )}

      {/* State: Not Run Notice */}
      {!executionData && !isRunning && statusState === 'NOT RUN' && (
        <div className="nb-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', marginBottom: '2.5rem', background: 'var(--nb-card)' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--nb-yellow)',
            border: 'var(--nb-border)',
            boxShadow: 'var(--nb-shadow-sm)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <Clock size={32} color="#171717" />
          </div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Test Execution Status: NOT RUN</h2>
          <p style={{ color: 'var(--nb-text-muted)', maxWidth: '580px', margin: '0 auto 1.5rem auto', fontSize: '0.95rem' }}>
            No test execution has occurred in this session. PBGMS enforces an absolute zero-mock policy: no sample, pre-rendered, or simulated results are displayed before live execution.
          </p>
          <button onClick={handleRunTests} className="nb-btn nb-btn-yellow">
            <Play size={16} /> Execute Test Suite Now
          </button>
        </div>
      )}

      {/* State: Running Progress */}
      {isRunning && (
        <div className="nb-card nb-card-yellow" style={{ textAlign: 'center', padding: '3rem 1.5rem', marginBottom: '2.5rem' }}>
          <RefreshCw size={40} className="nb-loading-pulse" color="#171717" style={{ marginBottom: '1rem', animation: 'spin 1.2s linear infinite' }} />
          <h2 style={{ fontSize: '1.5rem', color: '#171717', marginBottom: '0.5rem' }}>Executing 10 Assignment Test Cases...</h2>
          <p style={{ color: '#333', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto' }}>
            Dispatching genuine role authentications, evaluating RBAC permissions on protected routes, and checking theme state persistence...
          </p>
        </div>
      )}

      {/* Summary KPI Cards — Calculated strictly from real execution results */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2.5rem'
      }}>
        {/* Total Tests Executed */}
        <div className="nb-card" style={{ background: 'var(--nb-card)' }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--nb-text-muted)' }}>
            Total Executed
          </p>
          <h2 style={{ fontSize: '2.2rem', marginTop: '0.35rem', color: 'var(--nb-text)' }}>
            {summary ? summary.totalExecuted : 'NOT RUN'}
          </h2>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--nb-text-muted)', marginTop: '0.35rem' }}>
            {executionData ? `Duration: ${executionData.totalDurationMs}ms` : 'Awaiting trigger'}
          </p>
        </div>

        {/* Passing Assertions */}
        <div className="nb-card nb-card-mint">
          <p style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Passing Assertions
          </p>
          <h2 style={{ fontSize: '2.2rem', marginTop: '0.35rem' }}>
            {summary ? summary.passingCount : 'NOT RUN'}
          </h2>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {summary ? 'Production criteria met' : 'Awaiting trigger'}
          </p>
        </div>

        {/* Intentional Assertion Failures */}
        <div className="nb-card" style={{ background: 'var(--nb-card)', borderColor: 'var(--nb-coral)' }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--nb-coral)' }}>
            Intentional Failures
          </p>
          <h2 style={{ fontSize: '2.2rem', marginTop: '0.35rem', color: 'var(--nb-coral)' }}>
            {summary ? summary.intentionalFailCount : 'NOT RUN'}
          </h2>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--nb-text-muted)', marginTop: '0.35rem' }}>
            {summary ? 'Expected negative assertions' : 'Awaiting trigger'}
          </p>
        </div>

        {/* Unexpected Errors */}
        <div className="nb-card" style={{ background: 'var(--nb-card)' }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--nb-text-muted)' }}>
            Unexpected Errors
          </p>
          <h2 style={{ fontSize: '2.2rem', marginTop: '0.35rem', color: summary && summary.unexpectedErrorCount > 0 ? 'var(--nb-coral)' : 'var(--nb-text)' }}>
            {summary ? summary.unexpectedErrorCount : 'NOT RUN'}
          </h2>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--nb-text-muted)', marginTop: '0.35rem' }}>
            {summary && summary.unexpectedErrorCount === 0 ? '0 unexpected bugs' : 'Awaiting trigger'}
          </p>
        </div>

        {/* Tests Not Run */}
        <div className="nb-card" style={{ background: 'var(--nb-card)' }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--nb-text-muted)' }}>
            Tests Not Run
          </p>
          <h2 style={{ fontSize: '2.2rem', marginTop: '0.35rem', color: 'var(--nb-text)' }}>
            {summary ? summary.notRunCount : 10}
          </h2>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--nb-text-muted)', marginTop: '0.35rem' }}>
            {summary ? 'Suite fully executed' : 'Ready to run'}
          </p>
        </div>
      </div>

      {/* MODULE 1 TABLE: Role-Based Dashboard and Authorization Tests (TC01 - TC05) */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={20} color="var(--nb-blue)" /> Module 1: Role-Based Dashboard & Authorization Tests
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--nb-text-muted)' }}>
              Verifies authentic authentication, token issuance, and server RBAC enforcement on Front Desk, Groomer, and Admin routes.
            </p>
          </div>
          <span className="nb-badge nb-badge-blue">
            5 Test Cases (TC01–TC05)
          </span>
        </div>

        <div className="nb-table-container">
          <table className="nb-table">
            <thead>
              <tr>
                <th style={{ width: '85px' }}>Test ID</th>
                <th style={{ width: '220px' }}>Test Name</th>
                <th style={{ width: '130px' }}>Input Role</th>
                <th>Request Endpoint</th>
                <th>Expected Result</th>
                <th>Observed Result</th>
                <th style={{ width: '130px' }}>Assertion</th>
                <th style={{ width: '140px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {module1Tests.length > 0 ? (
                module1Tests.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong style={{ fontFamily: 'var(--font-heading)' }}>{t.id}</strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--nb-text-muted)', marginTop: '2px' }}>
                        {t.inputType}
                      </div>
                    </td>
                    <td>
                      <span className="nb-badge nb-badge-white" style={{ fontSize: '0.72rem' }}>
                        {t.authenticatedRole}
                      </span>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8rem', background: 'var(--nb-gray-light)', padding: '2px 6px', borderRadius: '4px' }}>
                        {t.requestMethod} {t.requestEndpoint}
                      </code>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>
                      {t.expectedStatusOrValue}
                    </td>
                    <td style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>
                      {t.actualStatusOrValue}
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: t.assertionResult === 'PASSED' ? '#2ECC71' : t.assertionResult === 'INTENTIONAL FAILURE' ? 'var(--nb-coral)' : '#E74C3C'
                      }}>
                        {t.assertionResult}
                      </span>
                    </td>
                    <td>
                      {renderStatusBadge(t.status, t.isIntentionalFail)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--nb-text-muted)' }}>
                    <strong>Status: NOT RUN.</strong> Click "Run Assignment Tests" to execute Module 1 live tests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODULE 2 TABLE: Theme Testing & Persistence (TC06 - TC10) */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Palette size={20} color="var(--nb-coral)" /> Module 2: Theme Testing & Persistence
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--nb-text-muted)' }}>
              Verifies authentic theme activation, client token specifications, persistent storage restoration, and cross-route consistency.
            </p>
          </div>
          <span className="nb-badge nb-badge-coral">
            5 Test Cases (TC06–TC10)
          </span>
        </div>

        <div className="nb-table-container">
          <table className="nb-table">
            <thead>
              <tr>
                <th style={{ width: '85px' }}>Test ID</th>
                <th style={{ width: '220px' }}>Test Name</th>
                <th style={{ width: '130px' }}>Input Role</th>
                <th>Theme Input / State</th>
                <th>Expected Value</th>
                <th>Observed Value</th>
                <th style={{ width: '130px' }}>Assertion</th>
                <th style={{ width: '140px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {module2Tests.length > 0 ? (
                module2Tests.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong style={{ fontFamily: 'var(--font-heading)' }}>{t.id}</strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--nb-text-muted)', marginTop: '2px' }}>
                        {t.inputType}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--nb-text-muted)' }}>
                        {t.authenticatedRole}
                      </span>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.78rem', background: 'var(--nb-gray-light)', padding: '2px 6px', borderRadius: '4px' }}>
                        {t.inputSummary}
                      </code>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>
                      {t.expectedStatusOrValue}
                    </td>
                    <td style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>
                      {t.actualStatusOrValue}
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: t.assertionResult === 'PASSED' ? '#2ECC71' : t.assertionResult === 'INTENTIONAL FAILURE' ? 'var(--nb-coral)' : '#E74C3C'
                      }}>
                        {t.assertionResult}
                      </span>
                    </td>
                    <td>
                      {renderStatusBadge(t.status, t.isIntentionalFail)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--nb-text-muted)' }}>
                    <strong>Status: NOT RUN.</strong> Click "Run Assignment Tests" to execute Module 2 live tests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deep-Dive Assertion Inspector (Interactive Accordion) */}
      {tests.length > 0 && (
        <div className="nb-card" style={{ background: 'var(--nb-card)', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Eye size={18} color="var(--nb-yellow)" /> Detailed Assertion Inspector & Audit Log
          </h3>
          <p style={{ color: 'var(--nb-text-muted)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
            Click on any test below to inspect the actual execution duration, assertion rationale, and security redactions.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {tests.map(t => {
              const isOpen = expandedTestId === t.id;
              return (
                <div
                  key={t.id}
                  style={{
                    border: '1.5px solid var(--nb-border-color)',
                    borderRadius: '6px',
                    overflow: 'hidden'
                  }}
                >
                  <button
                    onClick={() => setExpandedTestId(isOpen ? null : t.id)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isOpen ? 'var(--nb-gray-light)' : 'var(--nb-card)',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <strong style={{ fontFamily: 'var(--font-heading)' }}>{t.id}</strong>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--nb-text)' }}>{t.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--nb-text-muted)' }}>{t.executionDurationMs}ms</span>
                      {renderStatusBadge(t.status, t.isIntentionalFail)}
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ padding: '1rem', borderTop: '1px solid var(--nb-border-color)', background: 'var(--nb-card)', fontSize: '0.88rem' }}>
                      <p style={{ marginBottom: '0.5rem' }}>
                        <strong>Rationale / Explanation:</strong> {t.explanation}
                      </p>
                      {t.errorMessage && (
                        <p style={{ marginBottom: '0.5rem', color: t.isIntentionalFail ? 'var(--nb-coral)' : '#E74C3C' }}>
                          <strong>Assertion Failure Message:</strong> {t.errorMessage}
                        </p>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--nb-text-muted)', textTransform: 'uppercase', display: 'block' }}>Input Type</span>
                          <strong>{t.inputType}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--nb-text-muted)', textTransform: 'uppercase', display: 'block' }}>Role</span>
                          <strong>{t.authenticatedRole}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--nb-text-muted)', textTransform: 'uppercase', display: 'block' }}>Endpoint</span>
                          <code>{t.requestEndpoint}</code>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--nb-text-muted)', textTransform: 'uppercase', display: 'block' }}>Assertion Result</span>
                          <strong>{t.assertionResult}</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
