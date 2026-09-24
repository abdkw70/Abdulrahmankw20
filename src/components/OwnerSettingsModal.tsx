import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Terminal,
  FileCode,
  Globe,
  Play,
  Lock,
  X,
  Check,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { Language, OwnerPolicy, AutonomyLevel } from '../types/client.js';
import { translations } from '../locales/translations.js';

interface OwnerSettingsModalProps {
  language: Language;
  onClose: () => void;
  onPolicyUpdated: (newPolicy: OwnerPolicy) => void;
}

export const OwnerSettingsModal: React.FC<OwnerSettingsModalProps> = ({
  language,
  onClose,
  onPolicyUpdated,
}) => {
  const t = translations[language];
  const [policy, setPolicy] = useState<OwnerPolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fetchPolicy = async () => {
    try {
      const res = await fetch('/api/policy');
      if (res.ok) {
        const data = await res.json();
        setPolicy(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;

    setLoading(true);
    try {
      const res = await fetch('/api/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });

      if (res.ok) {
        const updated = await res.json();
        setPolicy(updated);
        onPolicyUpdated(updated);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, []);

  if (!policy) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-850 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">{t.ownerSettingsTitle}</h3>
              <p className="text-[11px] text-zinc-400">Strict sandboxing, permission gates, and execution policies</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Autonomy Level Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 block">{t.autonomySetting}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPolicy({ ...policy, autonomyLevel: 'strict' })}
                className={`p-3 rounded-xl border text-left rtl:text-right space-y-1 transition-colors ${
                  policy.autonomyLevel === 'strict'
                    ? 'bg-amber-950/40 border-amber-500/80 text-amber-200'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-850'
                }`}
              >
                <div className="font-semibold text-xs flex items-center justify-between">
                  <span>Strict</span>
                  {policy.autonomyLevel === 'strict' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">{t.autonomyStrict}</p>
              </button>

              <button
                type="button"
                onClick={() => setPolicy({ ...policy, autonomyLevel: 'semi_supervised' })}
                className={`p-3 rounded-xl border text-left rtl:text-right space-y-1 transition-colors ${
                  policy.autonomyLevel === 'semi_supervised'
                    ? 'bg-blue-950/40 border-blue-500/80 text-blue-200'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-850'
                }`}
              >
                <div className="font-semibold text-xs flex items-center justify-between">
                  <span>Balanced</span>
                  {policy.autonomyLevel === 'semi_supervised' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">{t.autonomySemi}</p>
              </button>

              <button
                type="button"
                onClick={() => setPolicy({ ...policy, autonomyLevel: 'autonomous' })}
                className={`p-3 rounded-xl border text-left rtl:text-right space-y-1 transition-colors ${
                  policy.autonomyLevel === 'autonomous'
                    ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-850'
                }`}
              >
                <div className="font-semibold text-xs flex items-center justify-between">
                  <span>Auto-Pilot</span>
                  {policy.autonomyLevel === 'autonomous' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">{t.autonomyFull}</p>
              </button>
            </div>
          </div>

          {/* Individual Tool Permission Toggles */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
              {t.toolPermissionsTitle}
            </h4>

            <div className="space-y-2 bg-zinc-950 p-4 rounded-xl border border-zinc-850 text-xs">
              {/* Terminal */}
              <div className="flex items-center justify-between py-1 border-b border-zinc-900">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="font-medium text-zinc-200">{t.permTerminal}</span>
                    <span className="block text-[10px] text-zinc-500">Run shell commands in workspace root</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-[11px] text-zinc-400 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policy.terminal.requireApproval}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          terminal: { ...policy.terminal, requireApproval: e.target.checked },
                        })
                      }
                      className="rounded accent-emerald-500"
                    />
                    <span>Ask Approval</span>
                  </label>
                  <input
                    type="checkbox"
                    checked={policy.terminal.enabled}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        terminal: { ...policy.terminal, enabled: e.target.checked },
                      })
                    }
                    className="rounded accent-emerald-500 w-4 h-4"
                  />
                </div>
              </div>

              {/* Filesystem Write */}
              <div className="flex items-center justify-between py-1 border-b border-zinc-900">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  <div>
                    <span className="font-medium text-zinc-200">{t.permFsWrite}</span>
                    <span className="block text-[10px] text-zinc-500">Allow agent to create and modify source files</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={policy.filesystem.writeEnabled}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      filesystem: { ...policy.filesystem, writeEnabled: e.target.checked },
                    })
                  }
                  className="rounded accent-emerald-500 w-4 h-4"
                />
              </div>

              {/* Filesystem Delete */}
              <div className="flex items-center justify-between py-1 border-b border-zinc-900">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-red-400" />
                  <div>
                    <span className="font-medium text-zinc-200">{t.permFsDelete}</span>
                    <span className="block text-[10px] text-zinc-500">Permanently delete files</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-[11px] text-zinc-400 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policy.filesystem.requireApprovalForDelete}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          filesystem: {
                            ...policy.filesystem,
                            requireApprovalForDelete: e.target.checked,
                          },
                        })
                      }
                      className="rounded accent-emerald-500"
                    />
                    <span>Ask Approval</span>
                  </label>
                  <input
                    type="checkbox"
                    checked={policy.filesystem.deleteEnabled}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        filesystem: { ...policy.filesystem, deleteEnabled: e.target.checked },
                      })
                    }
                    className="rounded accent-emerald-500 w-4 h-4"
                  />
                </div>
              </div>

              {/* Network */}
              <div className="flex items-center justify-between py-1 border-b border-zinc-900">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="font-medium text-zinc-200">{t.permNetwork}</span>
                    <span className="block text-[10px] text-zinc-500">Outbound research, GitHub inspection, and web scraping</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={policy.network.enabled}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      network: { ...policy.network, enabled: e.target.checked },
                    })
                  }
                  className="rounded accent-emerald-500 w-4 h-4"
                />
              </div>

              {/* Security Lab & PoC */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-red-400" />
                  <div>
                    <span className="font-medium text-zinc-200">{t.permSecLab}</span>
                    <span className="block text-[10px] text-zinc-500">Run security audit and sandboxed exploit PoC tests</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={policy.securityLab.allowPocExecution}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      securityLab: {
                        ...policy.securityLab,
                        allowPocExecution: e.target.checked,
                      },
                    })
                  }
                  className="rounded accent-emerald-500 w-4 h-4"
                />
              </div>
            </div>
          </div>

          {/* Timeouts */}
          <div className="flex items-center justify-between bg-zinc-950 p-3.5 rounded-xl border border-zinc-850 text-xs">
            <span className="text-zinc-300 font-medium">{t.timeoutLimits}</span>
            <input
              type="number"
              min={5}
              max={300}
              value={policy.terminal.timeoutSeconds}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  terminal: {
                    ...policy.terminal,
                    timeoutSeconds: Number(e.target.value) || 30,
                  },
                })
              }
              className="w-20 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-center text-xs text-zinc-100 font-mono"
            />
          </div>

          {/* Submit */}
          <div className="pt-2 flex items-center justify-between">
            {savedSuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <Check className="w-3.5 h-3.5" />
                {t.settingsSaved}
              </span>
            )}
            <div className="flex items-center gap-2 ml-auto rtl:mr-auto rtl:ml-0">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs text-zinc-400 hover:text-zinc-200"
              >
                {t.close}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-950/50"
              >
                {loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>{t.saveSettings}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
