import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  FileCode2,
  RotateCcw,
  ExternalLink,
  Lock,
  Globe,
  FileCheck,
} from 'lucide-react';
import { SecurityAlert, Language, OwnerPolicy } from '../types/client.js';

interface SecurityAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  currentWorkspace: string;
}

export const SecurityAlertModal: React.FC<SecurityAlertModalProps> = ({
  isOpen,
  onClose,
  language,
  currentWorkspace,
}) => {
  const isAr = language === 'ar';
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [policy, setPolicy] = useState<OwnerPolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [bypassReason, setBypassReason] = useState('');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Quick Tools
  const [sbomData, setSbomData] = useState<any | null>(null);
  const [tlsUrl, setTlsUrl] = useState('');
  const [tlsResult, setTlsResult] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'alerts' | 'sbom' | 'tls'>('alerts');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [alertsRes, policyRes] = await Promise.all([
        fetch('/api/security/alerts'),
        fetch('/api/policy'),
      ]);
      const alertsData = await alertsRes.json();
      const policyData = await policyRes.json();
      setAlerts(alertsData.alerts || []);
      setPolicy(policyData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleBypass = async (alert: SecurityAlert) => {
    if (!bypassReason.trim()) {
      setActionMsg({
        type: 'error',
        text: isAr ? 'يجب إدخال سبب التجاوز وتسجيل المراجعة' : 'Bypass reason is required for audit trail',
      });
      return;
    }

    try {
      const res = await fetch('/api/security/alerts/bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: alert.id,
          user: 'Owner',
          reason: bypassReason.trim(),
          workspaceId: currentWorkspace,
        }),
      });

      const data = await res.json();
      if (data.allowed) {
        setActionMsg({
          type: 'success',
          text: isAr ? data.reasonAr || data.reason : data.reason,
        });
        setBypassReason('');
        setSelectedAlert(null);
        await loadData();
      } else {
        setActionMsg({
          type: 'error',
          text: isAr ? data.reasonAr || data.reason : data.reason,
        });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleRevoke = async (alertId: string) => {
    try {
      const res = await fetch('/api/security/alerts/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, user: 'Owner', workspaceId: currentWorkspace }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({
          type: 'success',
          text: isAr ? 'تم إلغاء التجاوز وإعادة تفعيل الإخطار الأمني' : 'Alert bypass revoked successfully',
        });
        await loadData();
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleGenerateSBOM = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/security/sbom?workspaceId=${currentWorkspace}`);
      const data = await res.json();
      setSbomData(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleTlsAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tlsUrl.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/security/tls-header', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tlsUrl.trim(), workspaceId: currentWorkspace }),
      });
      const data = await res.json();
      setTlsResult(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-950/80 text-rose-300 border-rose-800';
      case 'HIGH':
        return 'bg-red-950/80 text-red-300 border-red-800';
      case 'MEDIUM':
        return 'bg-amber-950/80 text-amber-300 border-amber-800';
      case 'LOW':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
      default:
        return 'bg-blue-950/80 text-blue-300 border-blue-800';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-950/60 border border-red-800 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <span>{isAr ? 'نظام إدارة الإخطارات الأمنية والفحص الدفاعي' : 'Security Alert Manager & Defensive Tools'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-zinc-800 text-zinc-300">
                  {alerts.length} {isAr ? 'إخطار' : 'Alerts'}
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                {isAr
                  ? 'تصنيف الخطورة، ضوابط التجاوز الصارمة، الفحص الدفاعي للرؤوس، وتوليد وثيقة المكونات (SBOM).'
                  : 'Manage active security alerts, strict bypass governance, passive header audits, and SBOM.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 text-sm"
          >
            ✕
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 px-4">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'alerts'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{isAr ? 'الإخطارات الأمنية' : 'Active Alerts'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400">
              {alerts.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('sbom');
              if (!sbomData) handleGenerateSBOM();
            }}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'sbom'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>{isAr ? 'وثيقة المكونات البرمجية (SBOM)' : 'CycloneDX SBOM'}</span>
          </button>

          <button
            onClick={() => setActiveTab('tls')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'tls'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{isAr ? 'فحص رؤوس الأمان (TLS & Headers)' : 'Passive Header Audit'}</span>
          </button>
        </div>

        {/* Message Banner */}
        {actionMsg && (
          <div
            className={`m-4 p-3 rounded-lg text-xs flex items-center justify-between ${
              actionMsg.type === 'success'
                ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                : 'bg-rose-950/60 border border-rose-800 text-rose-300'
            }`}
          >
            <span>{actionMsg.text}</span>
            <button onClick={() => setActionMsg(null)} className="hover:opacity-80">✕</button>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'alerts' && (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    alert.bypassed
                      ? 'bg-zinc-900/40 border-zinc-800/80 opacity-60'
                      : alert.severity === 'CRITICAL'
                      ? 'bg-rose-950/20 border-rose-800/60'
                      : 'bg-zinc-900/60 border-zinc-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-bold border ${getSeverityBadge(
                          alert.severity
                        )}`}
                      >
                        {alert.severity}
                      </span>
                      <h4 className="text-xs font-bold text-zinc-100">
                        {isAr ? alert.titleAr || alert.title : alert.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      {alert.bypassed ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            {isAr ? 'تم التجاوز بعد المراجعة' : 'Bypassed by Owner'}
                          </span>
                          <button
                            onClick={() => handleRevoke(alert.id)}
                            title={isAr ? 'إلغاء التجاوز' : 'Revoke Bypass'}
                            className="text-zinc-400 hover:text-rose-400 p-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : alert.canBypass ? (
                        <button
                          onClick={() => setSelectedAlert(alert)}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] rounded-lg border border-zinc-700 font-medium"
                        >
                          {isAr ? 'طلب تجاوز بعد المراجعة' : 'Request Reviewed Bypass'}
                        </button>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 font-mono flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          {isAr ? 'محظور التجاوز أمنياً' : 'Unbypassable'}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-zinc-300 mb-2 leading-relaxed">
                    {isAr ? alert.descriptionAr || alert.description : alert.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-900">
                    <div>
                      <span className="text-zinc-500">{isAr ? 'المورد المتأثر:' : 'Resource:'} </span>
                      <span className="text-emerald-400">{alert.resource}</span>
                    </div>
                    {alert.suggestedFix && (
                      <div>
                        <span className="text-zinc-500">{isAr ? 'الإصلاح الموصى به:' : 'Fix:'} </span>
                        <span className="text-zinc-300">{alert.suggestedFix}</span>
                      </div>
                    )}
                  </div>

                  {alert.bypassed && alert.bypassReason && (
                    <div className="mt-2 text-[11px] text-zinc-400 bg-zinc-950/40 p-2 rounded border border-zinc-900">
                      <strong>{isAr ? 'سبب التجاوز المسجل في سجل التدقيق:' : 'Audit Override Reason:'}</strong> {alert.bypassReason} ({alert.bypassedBy})
                    </div>
                  )}

                  {/* Inline Bypass Form */}
                  {selectedAlert?.id === alert.id && (
                    <div className="mt-3 p-3 bg-zinc-950 border border-emerald-900/60 rounded-xl space-y-2">
                      <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تأكيد تجاوز الإخطار وتسجيله في سجل التدقيق (Audit Log)' : 'Confirm Reviewed Alert Bypass'}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        {isAr
                          ? 'يُسمح بتجاوز الإخطارات المعلوماتية والمنخفضة فقط بعد توثيق السبب والمسؤولية.'
                          : 'Only informational and low severity alerts may be bypassed after explicit documented justification.'}
                      </p>
                      <input
                        type="text"
                        value={bypassReason}
                        onChange={(e) => setBypassReason(e.target.value)}
                        placeholder={isAr ? 'اكتب سبب التجاوز الفني (مطلوب للتدقيق)...' : 'Document technical reason for override...'}
                        className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedAlert(null)}
                          className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                        >
                          {isAr ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBypass(alert)}
                          className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg"
                        >
                          {isAr ? 'تسجيل التجاوز في السجل' : 'Record & Bypass'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {alerts.length === 0 && (
                <div className="p-8 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
                  <span>{isAr ? 'لا توجد إخطارات أمنية نشطة حالياً' : 'No active security alerts'}</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sbom' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">
                  {isAr ? 'قائمة المكونات البرمجية بمواصفات CycloneDX 1.5:' : 'CycloneDX 1.5 Software Bill of Materials:'}
                </span>
                <button
                  onClick={handleGenerateSBOM}
                  className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium"
                >
                  {isAr ? 'إعادة التوليد' : 'Regenerate SBOM'}
                </button>
              </div>

              {sbomData ? (
                <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-96">
                  {JSON.stringify(sbomData, null, 2)}
                </pre>
              ) : (
                <div className="p-8 text-center text-xs text-zinc-500">
                  {isAr ? 'جارٍ توليد وثيقة SBOM...' : 'Generating SBOM...'}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tls' && (
            <div className="space-y-4">
              <form onSubmit={handleTlsAudit} className="flex gap-2">
                <input
                  type="text"
                  value={tlsUrl}
                  onChange={(e) => setTlsUrl(e.target.value)}
                  placeholder={isAr ? 'أدخل رابط النطاق المصرح به (مثال: example.com)...' : 'Enter authorized domain (e.g. github.com)...'}
                  className="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={loading || !tlsUrl.trim()}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{isAr ? 'فحص دفاعي آمن' : 'Passive Audit'}</span>
                </button>
              </form>

              {tlsResult && (
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs border-b border-zinc-800 pb-2">
                    <span className="font-mono text-zinc-200">{tlsResult.url}</span>
                    <span className="font-mono text-emerald-400">HTTP {tlsResult.status || 200}</span>
                  </div>

                  <div className="space-y-2">
                    {(tlsResult.checks || []).map((c: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          {c.present ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                          <span className="font-mono text-zinc-300 font-semibold">{c.header}</span>
                        </div>
                        <span className="text-[11px] text-zinc-400">{c.recommendation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
