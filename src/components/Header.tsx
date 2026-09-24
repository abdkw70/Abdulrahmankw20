import React, { useState, useEffect } from 'react';
import {
  Shield,
  Terminal,
  Settings,
  AlertOctagon,
  Globe,
  FolderKanban,
  Plus,
  Radio,
  CheckCircle2,
  Clock,
  Wrench,
  AlertTriangle,
  Github,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  Info,
} from 'lucide-react';
import { Language, AgentStatus, OperatingMode } from '../types/client.js';
import { translations } from '../locales/translations.js';

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  workspaces: string[];
  currentWorkspace: string;
  onSelectWorkspace: (ws: string) => void;
  onCreateWorkspace: (ws: string) => void;
  agentStatus: AgentStatus;
  operatingMode: OperatingMode;
  onModeChange: (mode: OperatingMode) => void;
  onEmergencyAbort: () => void;
  onOpenSettings: () => void;
  onOpenGitHub?: () => void;
  onOpenAlerts?: () => void;
  alertCount?: number;
  githubConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  workspaces,
  currentWorkspace,
  onSelectWorkspace,
  onCreateWorkspace,
  agentStatus,
  operatingMode,
  onModeChange,
  onEmergencyAbort,
  onOpenSettings,
  onOpenGitHub,
  onOpenAlerts,
  alertCount = 0,
  githubConnected = false,
}) => {
  const isAr = language === 'ar';
  const t = translations[language];
  const [showNewWsModal, setShowNewWsModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [modeSummaryModal, setModeSummaryModal] = useState<any | null>(null);

  const isAgentActive =
    agentStatus === 'planning' ||
    agentStatus === 'researching' ||
    agentStatus === 'executing' ||
    agentStatus === 'verifying' ||
    agentStatus === 'debugging' ||
    agentStatus === 'awaiting_approval' ||
    agentStatus === 'researching_websites' ||
    agentStatus === 'checking_docs' ||
    agentStatus === 'reading_repo' ||
    agentStatus === 'validating_scope' ||
    agentStatus === 'reviewing_alerts' ||
    agentStatus === 'running_scan' ||
    agentStatus === 'editing_files' ||
    agentStatus === 'running_tests' ||
    agentStatus === 'fixing_error' ||
    agentStatus === 'creating_commit' ||
    agentStatus === 'creating_pr';

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newWsName.trim()) {
      onCreateWorkspace(newWsName.trim());
      setNewWsName('');
      setShowNewWsModal(false);
    }
  };

  const handleSwitchMode = async (targetMode: OperatingMode) => {
    if (targetMode === operatingMode) return;
    try {
      const res = await fetch('/api/policy/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: targetMode }),
      });
      const data = await res.json();
      if (data.summary) {
        setModeSummaryModal(data.summary);
      }
      onModeChange(targetMode);
    } catch {
      onModeChange(targetMode);
    }
  };

  const getStatusBadge = () => {
    switch (agentStatus) {
      case 'idle':
        return { color: 'text-zinc-400 bg-zinc-800/80 border-zinc-700', text: t.idle, icon: Clock };
      case 'planning':
        return { color: 'text-blue-400 bg-blue-950/40 border-blue-800 animate-pulse', text: isAr ? '● التخطيط...' : 'Planning...', icon: Radio };
      case 'researching':
      case 'researching_websites':
        return { color: 'text-cyan-400 bg-cyan-950/40 border-cyan-800 animate-pulse', text: isAr ? '● البحث في المواقع...' : 'Researching Websites...', icon: Globe };
      case 'checking_docs':
        return { color: 'text-cyan-400 bg-cyan-950/40 border-cyan-800 animate-pulse', text: isAr ? '● فحص التوثيق الرسمي...' : 'Checking Docs...', icon: Globe };
      case 'reading_repo':
        return { color: 'text-indigo-400 bg-indigo-950/40 border-indigo-800 animate-pulse', text: isAr ? '● قراءة المستودع...' : 'Reading Repo...', icon: FolderKanban };
      case 'validating_scope':
        return { color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800 animate-pulse', text: isAr ? '● التحقق من النطاق المصرح به...' : 'Validating Scope...', icon: ShieldCheck };
      case 'executing':
      case 'editing_files':
        return { color: 'text-amber-400 bg-amber-950/40 border-amber-800 animate-pulse', text: isAr ? '● تعديل الملفات...' : 'Editing Files...', icon: Wrench };
      case 'running_tests':
        return { color: 'text-indigo-400 bg-indigo-950/40 border-indigo-800 animate-pulse', text: isAr ? '● تشغيل الاختبارات...' : 'Running Tests...', icon: Terminal };
      case 'reviewing_alerts':
      case 'running_scan':
        return { color: 'text-rose-400 bg-rose-950/40 border-rose-800 animate-pulse', text: isAr ? '● تشغيل الفحص الأمني...' : 'Security Scan...', icon: ShieldAlert };
      case 'fixing_error':
        return { color: 'text-orange-400 bg-orange-950/40 border-orange-800 animate-pulse', text: isAr ? '● تصحيح الخطأ تلقائياً...' : 'Auto-Fixing Error...', icon: AlertTriangle };
      case 'verifying':
        return { color: 'text-indigo-400 bg-indigo-950/40 border-indigo-800 animate-pulse', text: isAr ? '● التحقق النهائي...' : 'Verifying...', icon: Terminal };
      case 'creating_commit':
        return { color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800 animate-pulse', text: isAr ? '● إنشاء Commit...' : 'Creating Commit...', icon: Terminal };
      case 'creating_pr':
        return { color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800 animate-pulse', text: isAr ? '● إنشاء Pull Request...' : 'Creating PR...', icon: Terminal };
      case 'awaiting_approval':
        return { color: 'text-amber-300 bg-amber-900/60 border-amber-500 animate-bounce', text: t.awaiting_approval, icon: AlertTriangle };
      case 'completed':
        return { color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800', text: t.completed, icon: CheckCircle2 };
      case 'aborted':
        return { color: 'text-red-400 bg-red-950/40 border-red-800', text: t.aborted, icon: AlertOctagon };
      case 'failed':
        return { color: 'text-rose-400 bg-rose-950/40 border-rose-800', text: t.failed, icon: AlertTriangle };
      default:
        return { color: 'text-zinc-400 bg-zinc-800/80 border-zinc-700', text: t.idle, icon: Clock };
    }
  };

  const badge = getStatusBadge();
  const StatusIcon = badge.icon;

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur sticky top-0 z-30 px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3 max-w-[1920px] mx-auto">
        {/* Left: Brand & Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm tracking-wider font-semibold text-zinc-100 uppercase">
                ApexSec
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                v2.5 SEC-OPS
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        {/* Center: The 3 Operating Modes Selector & Live Status */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* 3-MODE TOGGLE CONTROL */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 p-0.5 rounded-xl shadow-inner">
            {/* Mode 1: Unrestricted (🟢 بدون قيود) */}
            <button
              onClick={() => handleSwitchMode('unrestricted')}
              title={isAr ? 'الوضع: بدون قيود (أعلى استقلالية ضمن الصلاحيات)' : 'Mode: No Restrictions (Autonomous within scope)'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                operatingMode === 'unrestricted'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="text-emerald-400">🟢</span>
              <span>{isAr ? 'بدون قيود' : 'No Restrictions'}</span>
            </button>

            {/* Mode 2: Medium Restrictions (🟡 قيود متوسطة) */}
            <button
              onClick={() => handleSwitchMode('medium')}
              title={isAr ? 'الوضع: قيود متوسطة (موافقة للعمليات المؤثرة)' : 'Mode: Medium Restrictions (Approval for high-impact)'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                operatingMode === 'medium'
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-700 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="text-amber-400">🟡</span>
              <span>{isAr ? 'قيود متوسطة' : 'Medium Restrictions'}</span>
            </button>

            {/* Mode 3: Cautious (🔵 بحذر) */}
            <button
              onClick={() => handleSwitchMode('cautious')}
              title={isAr ? 'الوضع: بحذر (أعلى مستوى من المراجعة والتحكم الصارم)' : 'Mode: Cautious (Strict review & control)'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                operatingMode === 'cautious'
                  ? 'bg-blue-950/80 text-blue-300 border border-blue-700 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="text-blue-400">🔵</span>
              <span>{isAr ? 'بحذر' : 'Cautious'}</span>
            </button>
          </div>

          {/* Active status indicator */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border ${badge.color}`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{badge.text}</span>
          </div>
        </div>

        {/* Right: Workspace, Tools, Governance & Controls */}
        <div className="flex items-center gap-2">
          {/* Workspace selector */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300">
            <FolderKanban className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={currentWorkspace}
              onChange={(e) => onSelectWorkspace(e.target.value)}
              className="bg-transparent text-zinc-200 font-mono focus:outline-none cursor-pointer text-xs"
            >
              {workspaces.map((ws) => (
                <option key={ws} value={ws} className="bg-zinc-900 text-zinc-200">
                  {ws}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowNewWsModal(true)}
              title={t.newWorkspace}
              className="text-zinc-400 hover:text-emerald-400 transition-colors ml-1 p-0.5"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Real GitHub Integration Button */}
          {onOpenGitHub && (
            <button
              onClick={onOpenGitHub}
              title={isAr ? 'تكامل GitHub الرسمي' : 'Real GitHub Integration'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 transition-colors"
            >
              <Github className="w-3.5 h-3.5 text-zinc-300" />
              <span className="hidden lg:inline">{isAr ? 'GitHub' : 'GitHub'}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  githubConnected ? 'bg-emerald-400' : 'bg-zinc-600'
                }`}
              />
            </button>
          )}

          {/* Security Alerts Button */}
          {onOpenAlerts && (
            <button
              onClick={onOpenAlerts}
              title={isAr ? 'إدارة الإخطارات الأمنية' : 'Security Alert Manager'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                alertCount > 0
                  ? 'bg-rose-950/60 border-rose-800 text-rose-300 hover:bg-rose-900/80 animate-pulse'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{isAr ? 'الإخطارات' : 'Alerts'}</span>
              {alertCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full font-mono text-[10px] bg-rose-600 text-white font-bold">
                  {alertCount}
                </span>
              )}
            </button>
          )}

          {/* Emergency Abort Switch */}
          {isAgentActive && (
            <button
              onClick={onEmergencyAbort}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950/50 border border-red-400 animate-pulse transition-all"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>{t.emergencyAbort}</span>
            </button>
          )}

          {/* Owner Governance Button */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden md:inline">{t.ownerSettings}</span>
          </button>

          {/* Language Switcher */}
          <button
            onClick={() => onLanguageChange(language === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors font-mono"
            title="Switch Language / تغيير اللغة"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
          </button>
        </div>
      </div>

      {/* Mode Switch Summary Modal */}
      {modeSummaryModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {modeSummaryModal.newMode === 'unrestricted'
                    ? '🟢'
                    : modeSummaryModal.newMode === 'medium'
                    ? '🟡'
                    : '🔵'}
                </span>
                <h3 className="text-sm font-bold text-zinc-100">
                  {isAr ? 'تم تغيير وضع التشغيل' : 'Operating Mode Changed'}
                </h3>
              </div>
              <button
                onClick={() => setModeSummaryModal(null)}
                className="text-zinc-400 hover:text-zinc-200 text-sm"
              >
                ✕
              </button>
            </div>

            {modeSummaryModal.requiresReconfirmationForSensitiveTasks && (
              <div className="p-3 bg-amber-950/60 border border-amber-800 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {isAr
                    ? 'تنبيه: تم الانتقال إلى وضع أكثر تقييداً. أي مهام حساسة قيد التنفيذ ستتطلب موافقة يدوية صريحة.'
                    : 'Notice: Switched to a more restrictive mode. Sensitive in-progress tasks now require explicit confirmation.'}
                </span>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>{isAr ? 'التغييرات في الصلاحيات والاستقلالية:' : 'Permissions & Governance Changes:'}</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-zinc-300">
                {(isAr
                  ? modeSummaryModal.changedPermissionsAr
                  : modeSummaryModal.changedPermissions
                ).map((item: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => setModeSummaryModal(null)}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold"
            >
              {isAr ? 'موافق ومتابعة' : 'Acknowledge & Continue'}
            </button>
          </div>
        </div>
      )}

      {/* New Workspace Modal */}
      {showNewWsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-semibold text-zinc-100 mb-2 flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-emerald-400" />
              {t.createWorkspace}
            </h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                placeholder={t.workspacePlaceholder}
                autoFocus
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewWsModal(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded-lg"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={!newWsName.trim()}
                  className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50 font-medium"
                >
                  {t.createWorkspace}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
