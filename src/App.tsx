import React, { useState, useEffect, useRef } from 'react';
import {
  FileCode,
  Terminal,
  ShieldAlert,
  Globe,
  Clock,
  Code2,
  Github,
} from 'lucide-react';
import { Header } from './components/Header.js';
import { MissionControl } from './components/MissionControl.js';
import { CodeWorkspace } from './components/CodeWorkspace.js';
import { TerminalConsole } from './components/TerminalConsole.js';
import { SecurityLab } from './components/SecurityLab.js';
import { WebResearcher } from './components/WebResearcher.js';
import { PythonStudio } from './components/PythonStudio.js';
import { GitHubStudio } from './components/GitHubStudio.js';
import { AuditLogView } from './components/AuditLogView.js';
import { OwnerSettingsModal } from './components/OwnerSettingsModal.js';
import { SecurityAlertModal } from './components/SecurityAlertModal.js';
import {
  Language,
  AgentStatus,
  OperatingMode,
  PlanStep,
  PendingApproval,
  AgentMessage,
  OwnerPolicy,
} from './types/client.js';
import { translations } from './locales/translations.js';

export default function App() {
  const [language, setLanguage] = useState<Language>('ar');
  const t = translations[language];

  // Workspaces
  const [workspaces, setWorkspaces] = useState<string[]>(['default-workspace']);
  const [currentWorkspace, setCurrentWorkspace] = useState<string>('default-workspace');

  // Operating Mode & Policy
  const [operatingMode, setOperatingMode] = useState<OperatingMode>('cautious');
  const [ownerPolicy, setOwnerPolicy] = useState<OwnerPolicy | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [githubConnected, setGithubConnected] = useState(false);

  // Agent State
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);

  // Active Workbench Tab
  const [activeTab, setActiveTab] = useState<
    'files' | 'python' | 'github' | 'terminal' | 'security' | 'research' | 'audit'
  >('files');

  const eventSourceRef = useRef<EventSource | null>(null);

  // Set HTML dir attribute dynamically
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  // Load Workspaces, Policy, GitHub status, and Alerts
  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        if (data.workspaces?.length > 0) {
          setWorkspaces(data.workspaces);
        }
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    }
  };

  const fetchPolicy = async () => {
    try {
      const res = await fetch('/api/policy');
      if (res.ok) {
        const data = await res.json();
        setOwnerPolicy(data);
        if (data.operatingMode) {
          setOperatingMode(data.operatingMode);
        }
      }
    } catch (err) {
      console.error('Failed to load policy:', err);
    }
  };

  const checkAlertsAndGitHub = async () => {
    try {
      const [alertsRes, ghRes] = await Promise.all([
        fetch('/api/security/alerts'),
        fetch('/api/github/status'),
      ]);
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlertCount((data.alerts || []).filter((a: any) => !a.bypassed).length);
      }
      if (ghRes.ok) {
        const ghData = await ghRes.json();
        setGithubConnected(Boolean(ghData.connected));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchWorkspaces();
    fetchPolicy();
    checkAlertsAndGitHub();
    const interval = setInterval(checkAlertsAndGitHub, 12000);
    return () => clearInterval(interval);
  }, []);

  // Handle Mode Change
  const handleModeChange = (newMode: OperatingMode) => {
    setOperatingMode(newMode);
    fetchPolicy();
  };

  // Handle Workspace Creation
  const handleCreateWorkspace = async (newWs: string) => {
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: newWs }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchWorkspaces();
        setCurrentWorkspace(data.workspace);
      }
    } catch (err) {
      console.error('Failed to create workspace:', err);
    }
  };

  // Start Autonomous Mission
  const handleStartMission = async (userGoal: string) => {
    // Cleanup any existing SSE
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setAgentStatus('planning');
    setPlan([]);
    setPendingApproval(null);

    try {
      const res = await fetch('/api/agent/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userGoal,
          workspaceId: currentWorkspace,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to start agent');
      }

      const data = await res.json();
      setActiveTaskId(data.taskId);

      // Open SSE stream
      const sse = new EventSource(`/api/agent/stream/${data.taskId}`);
      eventSourceRef.current = sse;

      sse.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'init') {
            setPlan(parsed.data.plan || []);
            setMessages(parsed.data.messages || []);
            setAgentStatus(parsed.data.status || 'executing');
            setPendingApproval(parsed.data.pendingApproval || null);
          } else if (parsed.type === 'status') {
            setAgentStatus(parsed.data.status);
            if (
              parsed.data.status === 'completed' ||
              parsed.data.status === 'aborted' ||
              parsed.data.status === 'failed'
            ) {
              sse.close();
              checkAlertsAndGitHub();
            }
          } else if (parsed.type === 'plan') {
            setPlan(parsed.data.plan || []);
          } else if (parsed.type === 'message') {
            setMessages((prev) => [...prev, parsed.data]);
          } else if (parsed.type === 'approval_requested') {
            setPendingApproval(parsed.data);
            setAgentStatus('awaiting_approval');
          }
        } catch (e) {
          console.error('SSE parse error:', e);
        }
      };

      sse.onerror = () => {
        console.warn('SSE connection closed or lost');
      };
    } catch (err: any) {
      setAgentStatus('failed');
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'system',
          text: `Failed to launch mission: ${err.message}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  // Emergency Abort
  const handleEmergencyAbort = async () => {
    if (!activeTaskId) return;
    try {
      await fetch('/api/agent/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: activeTaskId }),
      });
      setAgentStatus('aborted');
      setPendingApproval(null);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Owner Approval / Rejection
  const handleApprove = async (approvalId: string, approved: boolean, feedback?: string) => {
    if (!activeTaskId) return;
    try {
      await fetch('/api/agent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: activeTaskId,
          approvalId,
          approved,
          feedback,
        }),
      });
      setPendingApproval(null);
      setAgentStatus(approved ? 'executing' : 'planning');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 antialiased overflow-hidden select-none">
      {/* Top Navigation Bar with 3-Mode Selector */}
      <Header
        language={language}
        onLanguageChange={setLanguage}
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={setCurrentWorkspace}
        onCreateWorkspace={handleCreateWorkspace}
        agentStatus={agentStatus}
        operatingMode={operatingMode}
        onModeChange={handleModeChange}
        onEmergencyAbort={handleEmergencyAbort}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenGitHub={() => setActiveTab('github')}
        onOpenAlerts={() => setShowAlertsModal(true)}
        alertCount={alertCount}
        githubConnected={githubConnected}
      />

      {/* Main Workspace Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Mission Control Cockpit */}
        <div className="w-full lg:w-[470px] xl:w-[510px] h-1/2 lg:h-full shrink-0 flex flex-col overflow-hidden">
          <MissionControl
            language={language}
            agentStatus={agentStatus}
            plan={plan}
            messages={messages}
            pendingApproval={pendingApproval}
            workspaceId={currentWorkspace}
            onStartMission={handleStartMission}
            onApprove={handleApprove}
            onAddMessage={(msg) => setMessages((prev) => [...prev, msg])}
          />
        </div>

        {/* Right: Integrated Multi-Tool Workbench */}
        <div className="flex-1 h-1/2 lg:h-full flex flex-col bg-zinc-950 overflow-hidden">
          {/* Workbench Tabs Navigation */}
          <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4">
            <div className="flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-none">
              <button
                onClick={() => setActiveTab('files')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'files'
                    ? 'bg-zinc-800 text-emerald-400 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{t.tabFiles}</span>
              </button>

              <button
                onClick={() => setActiveTab('python')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'python'
                    ? 'bg-zinc-800 text-emerald-400 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'استوديو بايثون' : 'Python Studio'}</span>
              </button>

              <button
                onClick={() => setActiveTab('github')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'github'
                    ? 'bg-zinc-800 text-purple-400 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                <Github className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'تكامل GitHub' : 'GitHub Integration'}</span>
                {githubConnected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('terminal')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'terminal'
                    ? 'bg-zinc-800 text-amber-400 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>{t.tabTerminal}</span>
              </button>

              <button
                onClick={() => setActiveTab('security')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'security'
                    ? 'bg-zinc-800 text-red-400 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{t.tabSecurity}</span>
                {alertCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-mono font-bold">
                    {alertCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('research')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'research'
                    ? 'bg-zinc-800 text-cyan-400 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'أبحاث الويب والأدوات' : 'Web & Security Tools'}</span>
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'audit'
                    ? 'bg-zinc-800 text-emerald-300 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{t.tabAudit}</span>
              </button>
            </div>
          </div>

          {/* Active Tab Panel */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'files' && (
              <CodeWorkspace language={language} workspaceId={currentWorkspace} />
            )}
            {activeTab === 'python' && (
              <PythonStudio language={language} workspaceId={currentWorkspace} />
            )}
            {activeTab === 'github' && (
              <GitHubStudio
                language={language}
                currentWorkspace={currentWorkspace}
                onRepoSynced={() => {
                  fetchWorkspaces();
                  setActiveTab('files');
                }}
              />
            )}
            {activeTab === 'terminal' && (
              <TerminalConsole language={language} workspaceId={currentWorkspace} />
            )}
            {activeTab === 'security' && (
              <SecurityLab language={language} workspaceId={currentWorkspace} />
            )}
            {activeTab === 'research' && (
              <WebResearcher language={language} workspaceId={currentWorkspace} />
            )}
            {activeTab === 'audit' && <AuditLogView language={language} />}
          </div>
        </div>
      </div>

      {/* Owner Settings Modal */}
      {showSettingsModal && (
        <OwnerSettingsModal
          language={language}
          onClose={() => setShowSettingsModal(false)}
          onPolicyUpdated={(newPolicy) => setOwnerPolicy(newPolicy)}
        />
      )}

      {/* Security Alert Manager & Defensive Tools Modal */}
      {showAlertsModal && (
        <SecurityAlertModal
          isOpen={showAlertsModal}
          onClose={() => {
            setShowAlertsModal(false);
            checkAlertsAndGitHub();
          }}
          language={language}
          currentWorkspace={currentWorkspace}
        />
      )}
    </div>
  );
}
