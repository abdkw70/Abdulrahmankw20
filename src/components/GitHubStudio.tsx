import React, { useState, useEffect } from 'react';
import {
  Github,
  GitBranch,
  GitCommit,
  GitPullRequest,
  ShieldAlert,
  DownloadCloud,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Search,
  Lock,
  Globe,
  Key,
  Plus,
} from 'lucide-react';
import { Language } from '../types/client.js';

interface GitHubStudioProps {
  language: Language;
  currentWorkspace: string;
  onRepoSynced?: (workspaceId: string) => void;
}

export const GitHubStudio: React.FC<GitHubStudioProps> = ({
  language,
  currentWorkspace,
  onRepoSynced,
}) => {
  const isAr = language === 'ar';

  const [status, setStatus] = useState<any>({ connected: false });
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [repositories, setRepositories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);

  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [commits, setCommits] = useState<any[]>([]);
  const [pulls, setPulls] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any>({ dependabot: [], secretScanning: [] });
  const [activeTab, setActiveTab] = useState<'commits' | 'pulls' | 'alerts' | 'pr_create'>('commits');

  // PR Form
  const [prTitle, setPrTitle] = useState('');
  const [prHead, setPrHead] = useState('');
  const [prBase, setPrBase] = useState('main');
  const [prBody, setPrBody] = useState('');
  const [syncingRepo, setSyncingRepo] = useState(false);

  useEffect(() => {
    fetchStatus();

    // Check for GitHub OAuth callback code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      setConnecting(true);
      fetch('/api/github/oauth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setSuccessMsg(isAr ? 'تم ربط حساب GitHub بنجاح عبر OAuth!' : 'GitHub account connected via OAuth!');
            fetchStatus();
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            setError(data.error || 'OAuth authorization failed');
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setConnecting(false));
    }
  }, []);

  const handleOAuthLogin = async () => {
    setConnecting(true);
    setError(null);
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      const res = await fetch(`/api/github/oauth/url?redirectUri=${encodeURIComponent(redirectUri)}`);
      const data = await res.json();
      if (data.configured && data.url) {
        window.location.href = data.url;
      } else {
        setError(
          isAr
            ? 'تطبيق GitHub OAuth غير مهيأ بعد (GITHUB_CLIENT_ID). يرجى إدخال رمز الوصول الشخصي (PAT) في الحقل أدناه للاتصال الفوري.'
            : 'GitHub OAuth is not configured on server (GITHUB_CLIENT_ID). Please use Personal Access Token (PAT) below for instant connection.'
        );
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (status.connected) {
      fetchRepos();
    }
  }, [status.connected]);

  useEffect(() => {
    if (selectedRepo) {
      fetchRepoDetails(selectedRepo);
    }
  }, [selectedRepo]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/github/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      // ignore
    }
  };

  const fetchRepos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/github/repos');
      const data = await res.json();
      if (data.success) {
        setRepositories(data.repositories);
        if (data.repositories.length > 0 && !selectedRepo) {
          setSelectedRepo(data.repositories[0]);
        }
      } else {
        setError(data.error || 'Failed to list repositories');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/github/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim(), tokenType: 'pat' }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(isAr ? 'تم ربط حساب GitHub بنجاح!' : 'GitHub account connected successfully!');
        setTokenInput('');
        await fetchStatus();
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(isAr ? 'هل أنت متأكد من إلغاء ربط حساب GitHub؟' : 'Are you sure you want to disconnect GitHub?')) return;
    try {
      await fetch('/api/github/disconnect', { method: 'POST' });
      setStatus({ connected: false });
      setRepositories([]);
      setSelectedRepo(null);
    } catch {
      // ignore
    }
  };

  const fetchRepoDetails = async (repo: any) => {
    try {
      // 1. Branches
      const branchRes = await fetch(`/api/github/branches?owner=${repo.owner}&repo=${repo.name}`);
      const branchData = await branchRes.json();
      if (branchData.success) {
        setBranches(branchData.branches);
        setSelectedBranch(repo.defaultBranch || (branchData.branches[0]?.name ?? 'main'));
        setPrBase(repo.defaultBranch || 'main');
      }

      // 2. Commits
      const commitRes = await fetch(`/api/github/commits?owner=${repo.owner}&repo=${repo.name}`);
      const commitData = await commitRes.json();
      if (commitData.success) {
        setCommits(commitData.commits);
      }

      // 3. Pulls
      const pullRes = await fetch(`/api/github/pulls?owner=${repo.owner}&repo=${repo.name}`);
      const pullData = await pullRes.json();
      if (pullData.success) {
        setPulls(pullData.pulls);
      }

      // 4. Alerts
      const alertRes = await fetch(`/api/github/alerts?owner=${repo.owner}&repo=${repo.name}`);
      const alertData = await alertRes.json();
      if (alertData.success) {
        setAlerts(alertData.alerts);
      }
    } catch {
      // ignore
    }
  };

  const handleSyncToWorkspace = async () => {
    if (!selectedRepo) return;
    setSyncingRepo(true);
    setError(null);
    try {
      const res = await fetch('/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: selectedRepo.owner,
          repo: selectedRepo.name,
          workspaceId: currentWorkspace,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(
          isAr
            ? `تم مزامنة المستودع في مساحة العمل "${currentWorkspace}" بنجاح!`
            : `Repository synced to workspace "${currentWorkspace}" successfully!`
        );
        if (onRepoSynced) onRepoSynced(currentWorkspace);
      } else {
        setError(data.error || 'Failed to sync repository');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncingRepo(false);
    }
  };

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepo || !prTitle || !prHead || !prBase) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/github/pulls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: selectedRepo.owner,
          repo: selectedRepo.name,
          title: prTitle,
          head: prHead,
          base: prBase,
          body: prBody,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(isAr ? `تم إنشاء Pull Request #${data.pr.number} بنجاح!` : `Created Pull Request #${data.pr.number}!`);
        setPrTitle('');
        setPrBody('');
        setActiveTab('pulls');
        fetchRepoDetails(selectedRepo);
      } else {
        setError(data.error || 'Failed to create PR');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredRepos = repositories.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Top Banner / Integration Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/60 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-100">
            <Github className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              <span>{isAr ? 'تكامل GitHub المتقدم' : 'Real GitHub Integration'}</span>
              {status.connected ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3 h-3" />
                  {isAr ? 'متصل' : 'Connected'}
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1 font-mono">
                  <XCircle className="w-3 h-3" />
                  {isAr ? 'غير متصل' : 'Not Connected'}
                </span>
              )}
            </h2>
            <p className="text-xs text-zinc-400">
              {isAr
                ? 'إدارة المستودعات، الفروع، طلبات السحب (PRs)، والتنبيهات الأمنية مع حفظ الأسرار على الخادم فقط.'
                : 'Manage repositories, branches, commits, PRs, and security alerts with backend-only token storage.'}
            </p>
          </div>
        </div>

        {status.connected ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
              {status.avatarUrl && (
                <img src={status.avatarUrl} alt="Avatar" className="w-5 h-5 rounded-full" />
              )}
              <span className="text-zinc-200">@{status.username}</span>
              <span className="text-zinc-500 text-[10px]">({status.scopes?.slice(0, 2).join(', ')})</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg border border-red-900/50 transition-colors"
            >
              {isAr ? 'إلغاء الربط' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOAuthLogin}
              disabled={connecting}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg border border-zinc-700 flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              <span>{isAr ? 'تسجيل الدخول عبر GitHub OAuth' : 'Sign in with GitHub OAuth'}</span>
            </button>
            <span className="text-zinc-600 text-xs">{isAr ? 'أو' : 'or'}</span>
            <form onSubmit={handleConnect} className="flex items-center gap-2">
              <div className="relative">
                <Key className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={isAr ? 'رمز GitHub Personal Access Token (PAT)...' : 'GitHub Token (ghp_...)'}
                  className="pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500 w-56"
                />
              </div>
              <button
                type="submit"
                disabled={connecting || !tokenInput.trim()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-sm"
              >
                <span>{connecting ? (isAr ? 'جارٍ الاتصال...' : 'Connecting...') : (isAr ? 'ربط' : 'Connect')}</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="mx-4 mt-3 p-3 bg-emerald-950/50 border border-emerald-800 rounded-lg text-xs text-emerald-300 flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">✕</button>
        </div>
      )}

      {/* Main Content Area */}
      {!status.connected ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4">
            <Github className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-zinc-200 mb-2">
            {isAr ? 'اربط حساب GitHub للوصول إلى المستودعات' : 'Connect GitHub Account for Direct Repository Access'}
          </h3>
          <p className="text-xs text-zinc-400 max-w-md mb-6 leading-relaxed">
            {isAr
              ? 'يتم تخزين الرمز السري على الخادم بشكل معزول وآمن ولا يُعرض في الواجهة. يتيح ذلك للوكيل الهندسي استعراض المستودعات، قراءة الشفرات، إجراء الفحوصات الأمنية، وإنشاء Pull Requests تلقائياً.'
              : 'Tokens are stored exclusively in the secure backend service. Enables autonomous repo inspection, security scans, branch creations, and verified Pull Requests.'}
          </p>
          <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl text-left max-w-lg text-xs text-zinc-300 space-y-2">
            <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>{isAr ? 'الصلاحيات الموصى بها لرمز PAT:' : 'Recommended PAT Scopes:'}</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-zinc-400 font-mono text-[11px]">
              <li><strong className="text-zinc-200">repo</strong>: Full control of private and public repositories</li>
              <li><strong className="text-zinc-200">workflow</strong>: Update GitHub Action workflows</li>
              <li><strong className="text-zinc-200">security_events</strong>: Read & write security code scanning alerts</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Repositories Sidebar */}
          <div className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-950/40">
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isAr ? 'بحث في المستودعات...' : 'Search repos...'}
                  className="w-full pl-8 pr-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <button
                onClick={fetchRepos}
                title={isAr ? 'تحديث المستودعات' : 'Refresh repos'}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-lg"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
              {filteredRepos.map((repo) => {
                const isSelected = selectedRepo?.id === repo.id;
                return (
                  <button
                    key={repo.id}
                    onClick={() => setSelectedRepo(repo)}
                    className={`w-full p-3 text-left transition-colors flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-emerald-950/20 border-l-2 border-emerald-500'
                        : 'hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-zinc-200 truncate">
                        {repo.name}
                      </span>
                      {repo.isPrivate ? (
                        <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                      ) : (
                        <Globe className="w-3 h-3 text-zinc-500 shrink-0" />
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-[11px] text-zinc-400 line-clamp-1">{repo.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono mt-1">
                      {repo.language && <span className="text-emerald-400">{repo.language}</span>}
                      <span>⭐ {repo.stars}</span>
                      <span>🔱 {repo.forks}</span>
                    </div>
                  </button>
                );
              })}
              {filteredRepos.length === 0 && (
                <div className="p-6 text-center text-xs text-zinc-500">
                  {isAr ? 'لم يتم العثور على مستودعات' : 'No repositories found'}
                </div>
              )}
            </div>
          </div>

          {/* Repository Main Detail Panel */}
          {selectedRepo ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-zinc-900/20">
              {/* Repo Bar */}
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/40 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-100 font-mono">{selectedRepo.fullName}</h3>
                    <a
                      href={selectedRepo.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-500 hover:text-zinc-300 p-0.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                    <span className="flex items-center gap-1">
                      <GitBranch className="w-3 h-3 text-emerald-400" />
                      <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-zinc-200 font-mono text-[11px] focus:outline-none"
                      >
                        {branches.map((b) => (
                          <option key={b.name} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </span>
                    <span>{isAr ? 'الفرع الافتراضي:' : 'Default:'} {selectedRepo.defaultBranch}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncToWorkspace}
                    disabled={syncingRepo}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                  >
                    <DownloadCloud className={`w-3.5 h-3.5 ${syncingRepo ? 'animate-bounce' : ''}`} />
                    <span>
                      {syncingRepo
                        ? (isAr ? 'جارٍ المزامنة...' : 'Syncing...')
                        : (isAr ? `مزامنة في (${currentWorkspace})` : `Sync to (${currentWorkspace})`)}
                    </span>
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-zinc-800 bg-zinc-950/60 px-4">
                <button
                  onClick={() => setActiveTab('commits')}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === 'commits'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <GitCommit className="w-3.5 h-3.5" />
                  <span>{isAr ? 'أحدث Commits' : 'Recent Commits'}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400">
                    {commits.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('pulls')}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === 'pulls'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  <span>{isAr ? 'طلبات السحب (PRs)' : 'Pull Requests'}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400">
                    {pulls.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('pr_create')}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === 'pr_create'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إنشاء PR جديد' : 'New Pull Request'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('alerts')}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === 'alerts'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تنبيهات GitHub الأمنية' : 'Security Alerts'}</span>
                  {(alerts.dependabot.length > 0 || alerts.secretScanning.length > 0) && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-950 text-red-400 border border-red-800">
                      {alerts.dependabot.length + alerts.secretScanning.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Panes */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* 1. COMMITS TAB */}
                {activeTab === 'commits' && (
                  <div className="space-y-2">
                    {commits.map((c) => (
                      <div
                        key={c.fullSha}
                        className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <GitCommit className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div>
                            <p className="font-medium text-zinc-200">{c.message}</p>
                            <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                              {c.author} • {new Date(c.date).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-zinc-950 font-mono text-[11px] text-zinc-400 rounded border border-zinc-800">
                          {c.sha}
                        </span>
                      </div>
                    ))}
                    {commits.length === 0 && (
                      <p className="text-xs text-zinc-500 text-center py-6">
                        {isAr ? 'لا توجد commits متوفرة' : 'No commits found for branch'}
                      </p>
                    )}
                  </div>
                )}

                {/* 2. PULL REQUESTS TAB */}
                {activeTab === 'pulls' && (
                  <div className="space-y-2">
                    {pulls.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <GitPullRequest className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-zinc-200">{p.title}</span>
                              <span className="text-[10px] text-zinc-400">#{p.number}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-mono uppercase ${
                                  p.state === 'open'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                    : 'bg-zinc-800 text-zinc-400'
                                }`}
                              >
                                {p.state}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                              {p.headBranch} → {p.baseBranch} • by @{p.user}
                            </p>
                          </div>
                        </div>
                        <a
                          href={p.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-zinc-400 hover:text-emerald-400 text-[11px]"
                        >
                          <span>{isAr ? 'عرض في GitHub' : 'View on GitHub'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                    {pulls.length === 0 && (
                      <p className="text-xs text-zinc-500 text-center py-6">
                        {isAr ? 'لا توجد Pull Requests مفتوحة حالياً' : 'No open Pull Requests found'}
                      </p>
                    )}
                  </div>
                )}

                {/* 3. NEW PULL REQUEST TAB */}
                {activeTab === 'pr_create' && (
                  <form onSubmit={handleCreatePR} className="max-w-xl space-y-3 bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl">
                    <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                      <GitPullRequest className="w-4 h-4 text-emerald-400" />
                      <span>{isAr ? 'إنشاء Pull Request رسمي على GitHub' : 'Create Pull Request on GitHub'}</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1">{isAr ? 'فرع التعديلات (Head)' : 'Head Branch'}</label>
                        <select
                          value={prHead}
                          onChange={(e) => setPrHead(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200"
                        >
                          <option value="">{isAr ? '-- اختر الفرع --' : '-- Select Branch --'}</option>
                          {branches.map((b) => (
                            <option key={b.name} value={b.name}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1">{isAr ? 'الفرع الأساسي (Base)' : 'Base Branch'}</label>
                        <input
                          type="text"
                          value={prBase}
                          onChange={(e) => setPrBase(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">{isAr ? 'عنوان الـ PR' : 'Title'}</label>
                      <input
                        type="text"
                        value={prTitle}
                        onChange={(e) => setPrTitle(e.target.value)}
                        placeholder={isAr ? 'مثال: Fix SQL injection vulnerability in auth controller' : 'e.g., Fix SQL injection vulnerability'}
                        required
                        className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">{isAr ? 'الوصف والتفاصيل الهندسية' : 'Description / Summary'}</label>
                      <textarea
                        value={prBody}
                        onChange={(e) => setPrBody(e.target.value)}
                        rows={4}
                        placeholder={isAr ? 'تفاصيل التعديل واختبارات التحقق المنفذة...' : 'Describe changes and verification tests...'}
                        className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !prTitle || !prHead || !prBase}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                    >
                      {isAr ? 'إنشاء طلب السحب (Create PR)' : 'Create Pull Request'}
                    </button>
                  </form>
                )}

                {/* 4. SECURITY ALERTS TAB */}
                {activeTab === 'alerts' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-300 mb-2 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                        <span>Dependabot Advisories ({alerts.dependabot.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {alerts.dependabot.map((d: any) => (
                          <div key={d.number} className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs flex justify-between items-center">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-zinc-200">{d.package}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase bg-red-950 text-red-400 border border-red-800">
                                  {d.severity}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 mt-0.5">{d.summary}</p>
                            </div>
                            <a href={d.htmlUrl} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-emerald-400">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ))}
                        {alerts.dependabot.length === 0 && (
                          <p className="text-xs text-zinc-500 italic">{isAr ? 'لا توجد تنبيهات Dependabot نشطة' : 'No active Dependabot alerts'}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-zinc-300 mb-2 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-rose-400" />
                        <span>Secret Scanning Alerts ({alerts.secretScanning.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {alerts.secretScanning.map((s: any) => (
                          <div key={s.number} className="p-3 bg-rose-950/20 border border-rose-900/50 rounded-lg text-xs flex justify-between items-center">
                            <div>
                              <p className="font-semibold text-rose-300">{s.secretType}</p>
                              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">Found at {new Date(s.createdAt).toLocaleString()}</p>
                            </div>
                            <a href={s.htmlUrl} target="_blank" rel="noreferrer" className="text-rose-400 hover:text-rose-200">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ))}
                        {alerts.secretScanning.length === 0 && (
                          <p className="text-xs text-zinc-500 italic">{isAr ? 'لا توجد أسرار مسربة مرصودة في المستودع' : 'No leaked secrets detected'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-xs text-zinc-500">
              {isAr ? 'اختر مستودعاً من القائمة الجانبية لعرض تفاصيله' : 'Select a repository to inspect branches, commits, and pull requests'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
