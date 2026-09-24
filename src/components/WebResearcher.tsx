import React, { useState } from 'react';
import {
  Search,
  Globe,
  GitBranch,
  Star,
  ExternalLink,
  BookOpen,
  Package,
  FileCode,
  RotateCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Send,
} from 'lucide-react';
import { Language, DiscoveredSecurityTool } from '../types/client.js';
import { translations } from '../locales/translations.js';

interface WebResearcherProps {
  language: Language;
  workspaceId: string;
}

export const WebResearcher: React.FC<WebResearcherProps> = ({ language, workspaceId }) => {
  const isAr = language === 'ar';
  const t = translations[language];

  // Search state
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [discoveredTools, setDiscoveredTools] = useState<DiscoveredSecurityTool[]>([]);

  // GitHub inspection
  const [repoInput, setRepoInput] = useState('');
  const [inspectingRepo, setInspectingRepo] = useState(false);
  const [repoData, setRepoData] = useState<any | null>(null);

  // Pre-flight outbound inspection test
  const [outboundService, setOutboundService] = useState('external-api.com');
  const [outboundPayload, setOutboundPayload] = useState('{\n  "query": "cve-2024-test",\n  "version": "1.0.0"\n}');
  const [outboundInspection, setOutboundInspection] = useState<any | null>(null);
  const [inspectingOutbound, setInspectingOutbound] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || searching) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/research/search?query=${encodeURIComponent(query)}&workspaceId=${encodeURIComponent(
          workspaceId
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setDiscoveredTools(data.discoveredSecurityTools || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleInspectRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoInput.trim() || inspectingRepo) return;
    setInspectingRepo(true);
    try {
      const res = await fetch(
        `/api/research/github?repo=${encodeURIComponent(repoInput)}&workspaceId=${encodeURIComponent(
          workspaceId
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        setRepoData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInspectingRepo(false);
    }
  };

  const handleInspectOutbound = async (e: React.FormEvent) => {
    e.preventDefault();
    setInspectingOutbound(true);
    try {
      let parsedPayload: any = outboundPayload;
      try {
        parsedPayload = JSON.parse(outboundPayload);
      } catch {
        // use string as-is
      }
      const res = await fetch('/api/research/inspect-outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: outboundService,
          payload: parsedPayload,
        }),
      });
      const data = await res.json();
      setOutboundInspection(data);
    } catch (err: any) {
      setOutboundInspection({ approved: false, leakRisk: true, reasons: [err.message] });
    } finally {
      setInspectingOutbound(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-y-auto p-5 space-y-6">
      {/* Search Header */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>{isAr ? 'البحث عن خدمات ومواقع وأدوات الأمن السيبراني' : 'Web & Cybersecurity Services Researcher'}</span>
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
            Multi-Source: Web • Docs • NPM • PyPI • GitHub
          </span>
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          {isAr
            ? 'البحث في الإنترنت عن الأدوات الأمنية، المواقع، التوثيق، المكتبات، وتقييم نطاق استخدامها القانوني والآمن.'
            : 'Autonomous web researcher for security tools, documentation, services, and safe in-scope compliance evaluation.'}
        </p>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isAr
                ? 'ابحث عن أداة أو خدمة أمنية (مثال: semgrep sast, trivy container scanner, owasp top 10)...'
                : 'Search for security tools, services, or docs (e.g. semgrep sast, trivy, bandit)...'
            }
            className="w-full py-2.5 pl-9 pr-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim() || searching}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition-all shrink-0"
        >
          {searching ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          <span>{isAr ? 'بحث' : 'Search'}</span>
        </button>
      </form>

      {/* Discovered Security Tools Evaluation Cards */}
      {discoveredTools.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-emerald-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>{isAr ? 'تقييم الأدوات الأمنية المكتشفة وضوابط النطاق' : 'Discovered Security Tools Safety Evaluation'}</span>
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">
              {discoveredTools.length} {isAr ? 'أدوات مقيّمة' : 'Tools Evaluated'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {discoveredTools.map((tool, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-200">{tool.toolName}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-zinc-800 text-zinc-300">
                        {tool.toolType}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-500">{tool.siteName}</span>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-bold border ${
                      tool.posture === 'DEFENSIVE'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                        : 'bg-amber-950/80 text-amber-300 border-amber-800'
                    }`}
                  >
                    {tool.posture}
                  </span>
                </div>

                <p className="text-zinc-300 text-[11px] leading-relaxed">{tool.purpose}</p>

                <div className="space-y-1 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-900 text-[11px] font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">{isAr ? 'النطاق المصرح به:' : 'Scope Permitted:'}</span>
                    <span className={tool.scopePermitted ? 'text-emerald-400' : 'text-rose-400'}>
                      {tool.scopePermitted ? 'YES (In-Scope)' : 'REQUIRES EXPLICIT APPROVAL'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">{isAr ? 'الاستخدام الآمن:' : 'Safe Usage:'} </span>
                    <span className="text-zinc-300">{tool.safeUsageInScope}</span>
                  </div>
                  {tool.potentialRisks && (
                    <div>
                      <span className="text-zinc-500">{isAr ? 'المخاطر المحتملة:' : 'Risks:'} </span>
                      <span className="text-amber-400">{tool.potentialRisks}</span>
                    </div>
                  )}
                </div>

                {tool.url && (
                  <div className="pt-1 flex justify-end">
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
                    >
                      <span>{isAr ? 'زيارة الموقع / التوثيق' : 'Visit Docs/Site'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Multi-Source Search Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>{isAr ? 'نتائج البحث والتوثيق المكتشفة' : 'Web & Documentation Results'}</span>
          </h3>

          <div className="space-y-2">
            {results.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5 transition-all hover:border-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-cyan-400 border border-zinc-700 font-semibold">
                    {item.source}
                  </span>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-zinc-400 hover:text-cyan-400 flex items-center gap-1 font-mono"
                    >
                      <span className="truncate max-w-[250px]">{item.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  )}
                </div>
                <h4 className="text-xs font-semibold text-zinc-200">{item.title}</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">{item.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pre-Flight Outbound Leak & Scope Inspector */}
      <div className="pt-6 border-t border-zinc-800 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>{isAr ? 'فحص تدفق البيانات الخارجية وحماية الأسرار (Pre-Flight Data Inspection)' : 'Pre-Flight Data Leak & Scope Inspector'}</span>
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {isAr
              ? 'يتحقق الوكيل من أي حمولة بيانات قبل إرسالها إلى أي موقع أو خدمة خارجية لمنع تسريب المفاتيح والأسرار خارج النطاق.'
              : 'Evaluates outbound payloads before external transmission to guarantee zero token or secret leakage.'}
          </p>
        </div>

        <form onSubmit={handleInspectOutbound} className="space-y-3 bg-zinc-900/40 border border-zinc-800 p-4 rounded-xl">
          <div className="flex gap-2">
            <input
              type="text"
              value={outboundService}
              onChange={(e) => setOutboundService(e.target.value)}
              placeholder="Destination Service or URL..."
              className="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200"
            />
            <button
              type="submit"
              disabled={inspectingOutbound}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isAr ? 'فحص التسريب' : 'Inspect Outbound'}</span>
            </button>
          </div>
          <textarea
            value={outboundPayload}
            onChange={(e) => setOutboundPayload(e.target.value)}
            rows={3}
            placeholder="Payload JSON or string to test..."
            className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200"
          />

          {outboundInspection && (
            <div
              className={`p-3 rounded-lg border text-xs ${
                outboundInspection.approved
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold mb-1">
                {outboundInspection.approved ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                <span>
                  {outboundInspection.approved
                    ? (isAr ? 'البيانات آمنة وخالية من الأسرار المصرح بنقلها' : 'Payload Approved: Clean & Safe for External Service')
                    : (isAr ? 'تحذير: تم حظر نقل البيانات لوجود أسرار أو تسريب محتمل' : 'BLOCKED: Secret leak or unauthorized data detected!')}
                </span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px] font-mono">
                {(outboundInspection.reasons || []).map((r: string, idx: number) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </div>

      {/* GitHub Repository Inspector */}
      <div className="pt-6 border-t border-zinc-800 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-purple-400" />
            <span>{t.inspectRepoTitle}</span>
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {isAr
              ? 'فحص بيانات المستودعات، النجوم، الشفرات، ومحتوى README مباشرة.'
              : 'Fetch full metadata, star metrics, and README contents directly from GitHub.'}
          </p>
        </div>

        <form onSubmit={handleInspectRepo} className="flex gap-2">
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder={t.repoPlaceholder}
            className="flex-1 py-2.5 px-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
          />
          <button
            type="submit"
            disabled={!repoInput.trim() || inspectingRepo}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition-all shrink-0"
          >
            {inspectingRepo ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
            <span>{t.inspectBtn}</span>
          </button>
        </form>

        {repoData && !repoData.error && (
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-zinc-100 font-mono">
                  {repoData.fullName}
                </span>
                <span className="text-[11px] font-mono text-amber-400 flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-amber-400" />
                  {repoData.stars}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                  {repoData.language || 'Code'}
                </span>
              </div>
              <a
                href={repoData.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-mono"
              >
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-xs text-zinc-300">{repoData.description}</p>

            {repoData.readme && (
              <div className="mt-3">
                <span className="text-xs font-semibold text-zinc-400 block mb-1">
                  README Preview:
                </span>
                <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-850 font-mono text-xs text-zinc-300 max-h-60 overflow-y-auto leading-relaxed">
                  {repoData.readme}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
