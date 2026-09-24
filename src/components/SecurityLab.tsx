import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Play,
  RotateCw,
  FileCode,
  CheckCircle2,
  ExternalLink,
  Flame,
  Bug,
  Lock,
} from 'lucide-react';
import { Language, SecurityAuditReport, VulnerabilityFinding } from '../types/client.js';
import { translations } from '../locales/translations.js';

interface SecurityLabProps {
  language: Language;
  workspaceId: string;
}

export const SecurityLab: React.FC<SecurityLabProps> = ({ language, workspaceId }) => {
  const t = translations[language];
  const [report, setReport] = useState<SecurityAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [pocLoading, setPocLoading] = useState(false);
  const [pocResult, setPocResult] = useState<{ confirmed: boolean; output: string } | null>(null);
  const [selectedVuln, setSelectedVuln] = useState<VulnerabilityFinding | null>(null);

  const runAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/security/audit?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
        if (data.findings?.length > 0) {
          setSelectedVuln(data.findings[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runSamplePoc = async () => {
    setPocLoading(true);
    setPocResult(null);
    try {
      const res = await fetch('/api/security/poc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          plan: {
            vulnerabilityType: 'sqli',
            targetScript: 'vulnerable_api.js',
            pocScript: `// ApexSec Sandboxed PoC Test for SQL Injection (CWE-89)
console.log("[PoC] Starting test against mock input: ' OR '1'='1");
const rawInput = "' OR '1'='1";
const query = "SELECT * FROM users WHERE name = '" + rawInput + "'";
console.log("[PoC] Resulting query: " + query);
if (query.includes("'1'='1")) {
  console.log("[PoC_SUCCESS] Vulnerability Confirmed: Arbitrary boolean condition injected into SQL statement.");
} else {
  console.log("[PoC_FAILED] Injection escaped.");
}
`,
            expectedVulnerableIndicator: '[PoC_SUCCESS]',
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPocResult({
          confirmed: data.vulnerabilityConfirmed,
          output: data.rawOutput || data.evidence,
        });
      }
    } catch (err: any) {
      setPocResult({
        confirmed: false,
        output: `Error running PoC: ${err.message}`,
      });
    } finally {
      setPocLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, [workspaceId]);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-950/80 text-red-400 border-red-800';
      case 'HIGH':
        return 'bg-orange-950/80 text-orange-400 border-orange-800';
      case 'MEDIUM':
        return 'bg-amber-950/80 text-amber-400 border-amber-800';
      default:
        return 'bg-blue-950/80 text-blue-400 border-blue-800';
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Top Bar */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/40 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            {t.secLabTitle}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">{t.secLabSubtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={runAudit}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md shadow-red-950/40 transition-all"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t.runAuditNow}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Score Meter & Findings List */}
        <div className="w-80 border-r border-zinc-800 bg-zinc-900/20 flex flex-col shrink-0">
          {/* Security Posture Score Card */}
          {report && (
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">{t.securityScore}</span>
                <span
                  className={`text-lg font-bold font-mono ${
                    report.securityScore >= 80
                      ? 'text-emerald-400'
                      : report.securityScore >= 50
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}
                >
                  {report.securityScore}/100
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    report.securityScore >= 80
                      ? 'bg-emerald-500'
                      : report.securityScore >= 50
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${report.securityScore}%` }}
                />
              </div>

              {/* Metric summary */}
              <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
                <div className="p-1 rounded bg-red-950/30 text-red-400 border border-red-900/40">
                  <div className="font-bold">{report.summary.critical}</div>
                  <div className="text-[9px] text-zinc-500">{t.critical}</div>
                </div>
                <div className="p-1 rounded bg-orange-950/30 text-orange-400 border border-orange-900/40">
                  <div className="font-bold">{report.summary.high}</div>
                  <div className="text-[9px] text-zinc-500">{t.high}</div>
                </div>
                <div className="p-1 rounded bg-amber-950/30 text-amber-400 border border-amber-900/40">
                  <div className="font-bold">{report.summary.medium}</div>
                  <div className="text-[9px] text-zinc-500">{t.medium}</div>
                </div>
                <div className="p-1 rounded bg-blue-950/30 text-blue-400 border border-blue-900/40">
                  <div className="font-bold">{report.summary.low}</div>
                  <div className="text-[9px] text-zinc-500">{t.low}</div>
                </div>
              </div>
            </div>
          )}

          {/* Findings List */}
          <div className="p-3 border-b border-zinc-800 text-xs font-semibold text-zinc-300 flex items-center justify-between">
            <span>{t.findingsSummary}</span>
            <span className="text-[11px] font-mono text-zinc-500">
              {report?.findings.length || 0}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {!report || report.findings.length === 0 ? (
              <div className="text-center py-10 px-4 text-xs text-zinc-500 flex flex-col items-center">
                <ShieldCheck className="w-8 h-8 text-emerald-500/60 mb-2" />
                <p>{t.noVulnerabilities}</p>
              </div>
            ) : (
              report.findings.map((vuln) => (
                <button
                  key={vuln.id}
                  onClick={() => setSelectedVuln(vuln)}
                  className={`w-full text-left rtl:text-right p-2.5 rounded-lg text-xs space-y-1 transition-colors border ${
                    selectedVuln?.id === vuln.id
                      ? 'bg-zinc-850 border-emerald-500/60 text-zinc-100 shadow-sm'
                      : 'bg-zinc-900/40 hover:bg-zinc-800/60 border-zinc-800/60 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${getSeverityBadge(
                        vuln.severity
                      )}`}
                    >
                      {vuln.severity}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">{vuln.cwe}</span>
                  </div>
                  <p className="font-medium text-xs truncate text-zinc-200">{vuln.title}</p>
                  <p className="text-[10px] text-zinc-500 font-mono truncate">
                    {vuln.file}:{vuln.line}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Detailed Vulnerability Inspector & PoC Runner */}
        <div className="flex-1 flex flex-col bg-zinc-950 overflow-y-auto p-5 space-y-5">
          {selectedVuln ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-zinc-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getSeverityBadge(
                        selectedVuln.severity
                      )}`}
                    >
                      {selectedVuln.severity}
                    </span>
                    <span className="text-xs font-mono text-emerald-400 font-bold">
                      {selectedVuln.cwe}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-100">{selectedVuln.title}</h3>
                  <div className="text-xs text-zinc-400 font-mono mt-1 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-zinc-500" />
                    <span>
                      {selectedVuln.file} (Line {selectedVuln.line})
                    </span>
                  </div>
                </div>
              </div>

              {/* Vulnerable Code snippet */}
              <div>
                <span className="text-xs font-semibold text-zinc-300 block mb-1">
                  {t.vulnerableSnippet}
                </span>
                <pre className="p-3 rounded-lg bg-zinc-900 border border-red-950 text-red-300 font-mono text-xs overflow-x-auto">
                  {selectedVuln.snippet}
                </pre>
              </div>

              {/* Description */}
              <div>
                <span className="text-xs font-semibold text-zinc-300 block mb-1">
                  Description / الوصف:
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {language === 'ar' ? selectedVuln.descriptionAr : selectedVuln.description}
                </p>
              </div>

              {/* Impact */}
              <div>
                <span className="text-xs font-semibold text-zinc-300 block mb-1">
                  {t.impact}
                </span>
                <p className="text-xs text-amber-300/90 leading-relaxed bg-amber-950/20 p-2.5 rounded-lg border border-amber-900/30">
                  {selectedVuln.impact}
                </p>
              </div>

              {/* Remediation Patch */}
              <div>
                <span className="text-xs font-semibold text-zinc-300 block mb-1">
                  {t.remediation}
                </span>
                <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 text-xs leading-relaxed">
                  {language === 'ar' ? selectedVuln.remediationAr : selectedVuln.remediation}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-500 text-xs">
              Select a vulnerability from the list to inspect details.
            </div>
          )}

          {/* Interactive PoC Test Lab */}
          <div className="pt-4 border-t border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  {t.pocTestSection}
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">{t.pocDesc}</p>
              </div>

              <button
                onClick={runSamplePoc}
                disabled={pocLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md"
              >
                <Play className={`w-3.5 h-3.5 ${pocLoading ? 'animate-spin' : ''}`} />
                <span>{t.runPocBtn}</span>
              </button>
            </div>

            {pocResult && (
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-medium">{t.pocOutput}</span>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      pocResult.confirmed
                        ? 'bg-red-950 text-red-400 border border-red-800'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}
                  >
                    {pocResult.confirmed ? 'VULNERABILITY REPRODUCED' : 'TEST COMPLETED'}
                  </span>
                </div>
                <pre className="p-2.5 rounded bg-zinc-950 font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed border border-zinc-850">
                  {pocResult.output}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
