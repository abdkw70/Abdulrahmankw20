import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  Terminal,
  FileCode,
  Shield,
  User,
  Search,
  Globe,
  GitBranch,
  Github,
  Lock,
} from 'lucide-react';
import { Language, AuditLogEntry, OperatingMode } from '../types/client.js';
import { translations } from '../locales/translations.js';

interface AuditLogViewProps {
  language: Language;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ language }) => {
  const isAr = language === 'ar';
  const t = translations[language];
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '150' });
      if (filter !== 'all') params.append('filter', filter);
      if (modeFilter !== 'all') params.append('mode', modeFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من مسح سجل التدقيق؟' : 'Clear audit history?')) return;
    try {
      await fetch('/api/audit-logs', { method: 'DELETE' });
      setLogs([]);
    } catch (err) {
      console.error(err);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apexsec_audit_${Date.now()}.json`;
    a.click();
  };

  const exportMarkdown = () => {
    let md = `# ApexSec Comprehensive Audit Trail Report\nGenerated: ${new Date().toISOString()}\n\n`;
    md += `| Timestamp | Mode | Tool | Action | Scope | Risk | Status | Override Reason |\n`;
    md += `|---|---|---|---|---|---|---|---|\n`;
    for (const log of logs) {
      md += `| ${log.timestamp} | ${log.mode || 'N/A'} | ${log.tool} | ${log.action.replace(/\|/g, '-')} | ${log.authorizedScope || 'default'} | ${log.riskLevel} | ${log.success ? 'SUCCESS' : 'FAILED'} | ${log.alertOverride?.reason || 'None'} |\n`;
    }
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apexsec_audit_${Date.now()}.md`;
    a.click();
  };

  useEffect(() => {
    fetchLogs();
  }, [filter, modeFilter]);

  const getToolIcon = (tool: string) => {
    switch (tool) {
      case 'terminal_execute':
        return <Terminal className="w-3.5 h-3.5 text-amber-400" />;
      case 'file_write':
      case 'file_delete':
      case 'file_read':
        return <FileCode className="w-3.5 h-3.5 text-blue-400" />;
      case 'security_audit':
      case 'security_scanner':
      case 'poc_runner':
        return <Shield className="w-3.5 h-3.5 text-red-400" />;
      case 'web_search':
        return <Globe className="w-3.5 h-3.5 text-cyan-400" />;
      case 'github_service':
      case 'github_inspect':
      case 'github_sync':
        return <Github className="w-3.5 h-3.5 text-purple-400" />;
      case 'owner':
        return <User className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  const getModeBadge = (mode?: string) => {
    switch (mode) {
      case 'unrestricted':
        return { text: isAr ? '🟢 بدون قيود' : '🟢 Unrestricted', style: 'bg-emerald-950/80 text-emerald-300 border-emerald-800' };
      case 'medium':
        return { text: isAr ? '🟡 قيود متوسطة' : '🟡 Medium', style: 'bg-amber-950/80 text-amber-300 border-amber-800' };
      case 'cautious':
        return { text: isAr ? '🔵 بحذر' : '🔵 Cautious', style: 'bg-blue-950/80 text-blue-300 border-blue-800' };
      default:
        return { text: 'System', style: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Header bar */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/40 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>{t.auditTitle}</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {isAr
              ? 'سجل غير قابل للتعديل يوثق جميع الأوامر، استعلامات الشبكة، النطاق المصرح به، وقرارات تجاوز الإخطارات.'
              : 'Tamper-evident audit log of commands, network requests, authorized scopes, and alert overrides.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
              placeholder={isAr ? 'بحث في السجل...' : 'Search logs...'}
              className="pl-8 pr-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none w-36"
            />
          </div>

          {/* Mode Filter */}
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-300 font-mono focus:outline-none"
          >
            <option value="all">{isAr ? 'كافة الأوضاع' : 'All Modes'}</option>
            <option value="unrestricted">{isAr ? 'بدون قيود' : 'Unrestricted'}</option>
            <option value="medium">{isAr ? 'قيود متوسطة' : 'Medium'}</option>
            <option value="cautious">{isAr ? 'بحذر' : 'Cautious'}</option>
          </select>

          {/* Tool Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-300 font-mono focus:outline-none"
          >
            <option value="all">{isAr ? 'كافة الأدوات' : 'All Tools'}</option>
            <option value="terminal_execute">Terminal</option>
            <option value="file_write">Filesystem</option>
            <option value="security_audit">Security SAST</option>
            <option value="web_search">Web & Tools</option>
            <option value="github_service">GitHub</option>
          </select>

          <button
            onClick={exportJson}
            title={t.exportJson}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
          <button
            onClick={exportMarkdown}
            title={t.exportMd}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>MD</span>
          </button>

          <button
            onClick={fetchLogs}
            title="Refresh"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleClearLogs}
            title={t.clearLogs}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            {isAr ? 'لا توجد سجلات مطابقة للفلتر المحدد' : 'No audit records matching criteria.'}
          </div>
        ) : (
          logs.map((log) => {
            const modeBadge = getModeBadge(log.mode);
            const isExpanded = expandedLogId === log.id;
            return (
              <div
                key={log.id}
                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-850 hover:border-zinc-700 cursor-pointer transition-colors space-y-2"
              >
                <div className="flex items-center justify-between text-[11px] gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getToolIcon(log.tool)}
                    <span className="font-semibold text-zinc-200">{log.tool}</span>
                    <span className="text-zinc-500 font-sans">·</span>
                    <span className="text-zinc-300 font-sans">{log.action}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-sans border ${modeBadge.style}`}>
                      {modeBadge.text}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        log.riskLevel === 'CRITICAL'
                          ? 'bg-red-950 text-red-400 border border-red-800'
                          : log.riskLevel === 'HIGH'
                          ? 'bg-orange-950 text-orange-400 border border-orange-800'
                          : log.riskLevel === 'MEDIUM'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {log.riskLevel}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        log.success
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                          : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                      }`}
                    >
                      {log.success ? 'SUCCESS' : 'FAILED'}
                    </span>
                    <span className="text-zinc-500 text-[10px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-400 font-sans">
                  {log.resultSummary}
                </div>

                {/* Audit Override Indicator if present */}
                {log.alertOverride && (
                  <div className="p-2 bg-amber-950/40 border border-amber-800/80 rounded-lg text-[11px] text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      <strong>{isAr ? 'تجاوز أمني مسجل:' : 'Security Alert Bypassed:'}</strong> {log.alertOverride.reason} (by {log.alertOverride.user})
                    </span>
                  </div>
                )}

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="pt-2 border-t border-zinc-800/80 space-y-2 text-[11px] bg-zinc-950/60 p-2.5 rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-zinc-400">
                      <div>
                        <span className="text-zinc-500">{isAr ? 'المستخدم:' : 'User:'} </span>
                        <span className="text-zinc-200">{log.user || 'Owner'}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">{isAr ? 'النطاق المصرح به:' : 'Authorized Scope:'} </span>
                        <span className="text-emerald-400">{log.authorizedScope || 'workspace'}</span>
                      </div>
                      {log.repository && (
                        <div>
                          <span className="text-zinc-500">{isAr ? 'المستودع:' : 'Repository:'} </span>
                          <span className="text-purple-400">{log.repository}</span>
                        </div>
                      )}
                      {log.command && (
                        <div className="col-span-2">
                          <span className="text-zinc-500">{isAr ? 'الأمر المنفذ:' : 'Executed Command:'} </span>
                          <code className="text-cyan-300 bg-zinc-900 px-1 py-0.5 rounded">{log.command}</code>
                        </div>
                      )}
                      {log.networkRequest && (
                        <div className="col-span-2">
                          <span className="text-zinc-500">{isAr ? 'طلب الشبكة:' : 'Network Request:'} </span>
                          <span className="text-zinc-300">{log.networkRequest.method} {log.networkRequest.url}</span>
                        </div>
                      )}
                    </div>

                    {log.params && (
                      <div>
                        <span className="text-zinc-500 block mb-0.5">Parameters:</span>
                        <pre className="p-2 rounded bg-zinc-900 text-[10px] text-zinc-400 overflow-x-auto max-h-36">
                          {JSON.stringify(log.params, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
