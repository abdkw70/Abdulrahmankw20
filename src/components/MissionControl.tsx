import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  CheckCircle,
  Clock,
  AlertTriangle,
  Play,
  RotateCw,
  Terminal,
  FileCode,
  Globe,
  ShieldAlert,
  GitBranch,
  Search,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Code2,
  ExternalLink,
  Star,
  ShieldCheck,
  PlayCircle,
  Copy,
} from 'lucide-react';
import {
  Language,
  AgentStatus,
  PlanStep,
  PendingApproval,
  AgentMessage,
} from '../types/client.js';
import { translations } from '../locales/translations.js';

interface MissionControlProps {
  language: Language;
  agentStatus: AgentStatus;
  plan: PlanStep[];
  messages: AgentMessage[];
  pendingApproval: PendingApproval | null;
  workspaceId?: string;
  onStartMission: (goal: string) => void;
  onApprove: (approvalId: string, approved: boolean, feedback?: string) => void;
  onAddMessage?: (message: AgentMessage) => void;
}

export const MissionControl: React.FC<MissionControlProps> = ({
  language,
  agentStatus,
  plan,
  messages,
  pendingApproval,
  workspaceId = 'default-workspace',
  onStartMission,
  onApprove,
  onAddMessage,
}) => {
  const t = translations[language];
  const [controlMode, setControlMode] = useState<'chat' | 'mission'>('chat');
  const [goal, setGoal] = useState('');
  const [isSubmittingChat, setIsSubmittingChat] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [expandedToolIds, setExpandedToolIds] = useState<Record<string, boolean>>({});
  const [executingCodeId, setExecutingCodeId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { stdout: string; stderr: string; exitCode: number }>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isExecuting =
    agentStatus === 'planning' ||
    agentStatus === 'researching' ||
    agentStatus === 'executing' ||
    agentStatus === 'verifying' ||
    agentStatus === 'debugging' ||
    isSubmittingChat;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || isExecuting) return;

    const userText = goal.trim();
    setGoal('');

    if (controlMode === 'mission') {
      onStartMission(userText);
    } else {
      // Direct Chat & Python Studio Mode
      setIsSubmittingChat(true);

      const userMsg: AgentMessage = {
        id: `msg_user_${Date.now()}`,
        sender: 'user',
        text: userText,
        timestamp: new Date().toISOString(),
      };
      if (onAddMessage) onAddMessage(userMsg);

      try {
        const res = await fetch('/api/python/studio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userText,
            workspaceId,
            autoExecute: true,
            targetFilename: 'main.py',
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        const agentMsg: AgentMessage = {
          id: `msg_agent_${Date.now()}`,
          sender: 'agent',
          text: data.reply || 'تمت المعالجة.',
          timestamp: new Date().toISOString(),
          toolCall: data.executionResult
            ? {
                tool: 'code_execute',
                params: { file: data.savedFile || 'main.py' },
                output: {
                  exitCode: data.executionResult.exitCode,
                  stdout: data.executionResult.stdout,
                  stderr: data.executionResult.stderr,
                  durationMs: data.executionResult.durationMs,
                  testedSuccessfully: data.testedSuccessfully,
                  githubRepos: data.githubRepos,
                },
                riskLevel: 'LOW',
              }
            : undefined,
        };

        if (onAddMessage) onAddMessage(agentMsg);
      } catch (err: any) {
        const errMsg: AgentMessage = {
          id: `msg_err_${Date.now()}`,
          sender: 'agent',
          text: `⚠️ خطأ في المعالجة: ${err.message}`,
          timestamp: new Date().toISOString(),
        };
        if (onAddMessage) onAddMessage(errMsg);
      } finally {
        setIsSubmittingChat(false);
      }
    }
  };

  const handlePreset = (presetText: string) => {
    if (!isExecuting) {
      setGoal(presetText);
    }
  };

  const toggleToolExpand = (id: string) => {
    setExpandedToolIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Run Python code on demand
  const handleRunPythonCode = async (msgId: string, pythonCode: string) => {
    setExecutingCodeId(msgId);
    try {
      // 1. Save to workspace
      await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          path: 'main.py',
          content: pythonCode,
        }),
      });

      // 2. Execute via terminal runner
      const res = await fetch('/api/terminal/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          command: 'python3 main.py',
        }),
      });

      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [msgId]: {
          stdout: data.stdout || '',
          stderr: data.stderr || '',
          exitCode: data.exitCode ?? 0,
        },
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [msgId]: {
          stdout: '',
          stderr: err.message,
          exitCode: 1,
        },
      }));
    } finally {
      setExecutingCodeId(null);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getToolIcon = (tool?: string) => {
    switch (tool) {
      case 'terminal_execute':
        return <Terminal className="w-3.5 h-3.5 text-amber-400" />;
      case 'file_write':
      case 'file_read':
      case 'file_delete':
      case 'file_list':
        return <FileCode className="w-3.5 h-3.5 text-blue-400" />;
      case 'web_search':
        return <Globe className="w-3.5 h-3.5 text-cyan-400" />;
      case 'github_inspect':
      case 'git_operation':
        return <GitBranch className="w-3.5 h-3.5 text-purple-400" />;
      case 'security_audit':
      case 'poc_runner':
        return <ShieldAlert className="w-3.5 h-3.5 text-red-400" />;
      case 'code_execute':
        return <Code2 className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Play className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  // Helper to extract python code block from message
  const extractCode = (text: string): string | null => {
    const match = text.match(/```(?:python|py)\s*([\s\S]*?)\s*```/i);
    return match ? match[1].trim() : null;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800 overflow-hidden">
      {/* Top: Mode Switcher */}
      <div className="flex items-center border-b border-zinc-800 bg-zinc-900/80 p-1.5 gap-1.5">
        <button
          type="button"
          onClick={() => setControlMode('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
            controlMode === 'chat'
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>{t.chatModeTab || 'المحادثة وأكواد Python'}</span>
        </button>

        <button
          type="button"
          onClick={() => setControlMode('mission')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
            controlMode === 'mission'
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          <PlayCircle className="w-3.5 h-3.5" />
          <span>{t.missionModeTab || 'المهمة التلقائية الكاملة'}</span>
        </button>
      </div>

      {/* Input Prompt Section */}
      <div className="p-3.5 border-b border-zinc-800 bg-zinc-900/40">
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="relative">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={
                controlMode === 'chat'
                  ? (t.directChatPlaceholder || 'اسأل أي سؤال تقني، اطلب كود بايثون كامل بدون نقص، أو ابحث في GitHub...')
                  : t.missionPromptPlaceholder
              }
              disabled={isExecuting}
              rows={3}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/80 resize-none font-sans leading-relaxed disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!goal.trim() || isExecuting}
              className="absolute bottom-2.5 ltr:right-2.5 rtl:left-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold disabled:opacity-40 transition-all shadow-md shadow-emerald-950/40"
            >
              {isExecuting ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t.running}</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{controlMode === 'chat' ? (t.askQuestionBtn || 'إرسال واختبار') : t.startMission}</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <div className="text-[11px] font-medium text-zinc-400 mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>{t.presets}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handlePreset(t.presetPython || 'ابحث في GitHub عن أفضل كود بايثون واختبره حقيقياً')}
                className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/80 transition-colors"
              >
                ⭐ {t.presetPython || 'ابحث في GitHub عن كود بايثون'}
              </button>
              <button
                type="button"
                onClick={() => handlePreset(t.presetCompleteCode || 'كتابة واختبار كود بايثون كامل 100% بدون أي نقص')}
                className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/80 transition-colors"
              >
                ✔ {t.presetCompleteCode || 'كود بايثون كامل 100%'}
              </button>
              <button
                type="button"
                onClick={() => handlePreset(t.preset1)}
                className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 transition-colors"
              >
                {t.preset1}
              </button>
              <button
                type="button"
                onClick={() => handlePreset(t.preset2)}
                className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 transition-colors"
              >
                {t.preset2}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Sensitive Action Approval Required Card with Complete 11 Disclosure Fields */}
      {pendingApproval && (
        <div className="m-3 p-4 rounded-xl border border-amber-500/70 bg-zinc-950/90 text-amber-200 shadow-2xl space-y-3">
          <div className="flex items-start justify-between gap-3 border-b border-amber-900/40 pb-2.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
              <div>
                <span className="font-bold text-sm text-amber-300">
                  {language === 'ar' ? 'مراجعة أمنية مطلوبة قبل التنفيذ (وضع بحذر)' : 'Security Review Required Before Execution'}
                </span>
                <p className="text-[11px] text-zinc-400">
                  {language === 'ar'
                    ? 'يتم عرض كافة أبعاد العملية لضمان عدم الخروج عن النطاق المصرح به'
                    : 'Full operation disclosure for strict governance and boundary enforcement'}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-800 uppercase font-bold">
              {pendingApproval.riskLevel} RISK
            </span>
          </div>

          {/* 11 Fields Structured Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
            {/* 1. Operation */}
            <div>
              <span className="text-zinc-500">{language === 'ar' ? '1. العملية:' : '1. Operation:'} </span>
              <span className="text-amber-300 font-bold">{pendingApproval.operation || pendingApproval.tool}</span>
            </div>

            {/* 2. Target Repo/Website */}
            <div>
              <span className="text-zinc-500">{language === 'ar' ? '2. المستودع أو الموقع المستهدف:' : '2. Target Repo/Site:'} </span>
              <span className="text-emerald-400">{pendingApproval.targetWebsiteOrRepo || workspaceId}</span>
            </div>

            {/* 3. Scan Scope */}
            <div>
              <span className="text-zinc-500">{language === 'ar' ? '3. نطاق الفحص:' : '3. Scope:'} </span>
              <span className="text-zinc-300">{pendingApproval.scanScope || `Workspace: ${workspaceId}`}</span>
            </div>

            {/* 4. Affected Files */}
            <div>
              <span className="text-zinc-500">{language === 'ar' ? '4. الملفات المتأثرة:' : '4. Affected Files:'} </span>
              <span className="text-zinc-300">
                {pendingApproval.affectedFiles && pendingApproval.affectedFiles.length > 0
                  ? pendingApproval.affectedFiles.join(', ')
                  : (pendingApproval.params?.path || 'None')}
              </span>
            </div>

            {/* 5. Command to Run */}
            <div className="md:col-span-2">
              <span className="text-zinc-500">{language === 'ar' ? '5. الأمر المزمع تشغيله:' : '5. Command to Run:'} </span>
              <code className="text-cyan-300 bg-zinc-950 px-1.5 py-0.5 rounded">
                {pendingApproval.commandToRun || pendingApproval.params?.command || JSON.stringify(pendingApproval.params)}
              </code>
            </div>

            {/* 6. Expected Network Requests */}
            <div>
              <span className="text-zinc-500">{language === 'ar' ? '6. طلبات الشبكة المتوقعة:' : '6. Network Requests:'} </span>
              <span className="text-zinc-300">
                {pendingApproval.expectedNetworkRequests && pendingApproval.expectedNetworkRequests.length > 0
                  ? pendingApproval.expectedNetworkRequests.join(', ')
                  : 'Local Sandbox Only (No Outbound)'}
              </span>
            </div>

            {/* 7. Reason */}
            <div>
              <span className="text-zinc-500">{language === 'ar' ? '7. سبب العملية:' : '7. Reason:'} </span>
              <span className="text-zinc-300">
                {language === 'ar' ? pendingApproval.explanationAr || pendingApproval.reason : pendingApproval.explanation || pendingApproval.reason}
              </span>
            </div>

            {/* 8. Expected Impact */}
            <div>
              <span className="text-zinc-500">{language === 'ar' ? '8. التأثير المتوقع:' : '8. Expected Impact:'} </span>
              <span className="text-zinc-300">{pendingApproval.expectedImpact || 'Executes in isolated environment'}</span>
            </div>

            {/* 9. Potential Risks */}
            <div>
              <span className="text-zinc-500">{language === 'ar' ? '9. المخاطر المحتملة:' : '9. Potential Risks:'} </span>
              <span className="text-rose-400">{pendingApproval.potentialRisks || 'Modifies workspace state'}</span>
            </div>

            {/* 10. Required Permissions */}
            <div className="md:col-span-2">
              <span className="text-zinc-500">{language === 'ar' ? '10. الصلاحيات المطلوبة:' : '10. Required Permissions:'} </span>
              <span className="text-amber-400 font-semibold">
                {(pendingApproval.requiredPermissions || [pendingApproval.tool]).join(', ')}
              </span>
            </div>
          </div>

          {showRejectInput && (
            <input
              type="text"
              value={rejectFeedback}
              onChange={(e) => setRejectFeedback(e.target.value)}
              placeholder={t.rejectReasonPrompt}
              className="w-full px-3 py-2 bg-zinc-900 border border-amber-800 rounded-lg text-xs text-zinc-200 focus:outline-none"
            />
          )}

          {/* 11. Approval / Rejection Controls */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-zinc-500">
              {language === 'ar' ? '11. قرار المالك المسجل في سجل التدقيق:' : '11. Owner Governance Decision (Audited):'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onApprove(pendingApproval.id, true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md transition-all"
              >
                <Check className="w-4 h-4" />
                <span>{t.approve}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!showRejectInput) {
                    setShowRejectInput(true);
                  } else {
                    onApprove(pendingApproval.id, false, rejectFeedback);
                    setShowRejectInput(false);
                    setRejectFeedback('');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 hover:text-red-300 rounded-lg text-xs font-semibold border border-zinc-700 transition-all"
              >
                <X className="w-4 h-4" />
                <span>{t.reject}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Plan Tracker (if mission plan exists) */}
      {plan.length > 0 && (
        <div className="p-3 border-b border-zinc-800 bg-zinc-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              {t.planTitle}
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              {plan.filter((s) => s.status === 'completed').length}/{plan.length}
            </span>
          </div>

          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {plan.map((step, idx) => (
              <div
                key={step.id}
                className={`p-2 rounded-lg text-xs border transition-all ${
                  step.status === 'in_progress'
                    ? 'border-emerald-500/60 bg-emerald-950/20 text-emerald-200'
                    : step.status === 'completed'
                    ? 'border-zinc-800 bg-zinc-900/40 text-zinc-300'
                    : step.status === 'failed'
                    ? 'border-red-800/80 bg-red-950/20 text-red-300'
                    : 'border-zinc-800/60 bg-zinc-950/60 text-zinc-500'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="flex items-center gap-1.5 font-sans font-medium text-xs text-zinc-200">
                    {step.status === 'in_progress' && (
                      <RotateCw className="w-3 h-3 text-emerald-400 animate-spin" />
                    )}
                    {step.status === 'completed' && (
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                    )}
                    {step.status === 'pending' && (
                      <Clock className="w-3 h-3 text-zinc-500" />
                    )}
                    {step.status === 'failed' && (
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                    )}
                    <span>
                      {idx + 1}. {language === 'ar' ? step.titleAr || step.title : step.title}
                    </span>
                  </span>
                  {step.toolUsed && (
                    <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center gap-1">
                      {getToolIcon(step.toolUsed)}
                      <span>{step.toolUsed.replace('_', ' ')}</span>
                    </span>
                  )}
                </div>
                {step.resultSummary && (
                  <p className="mt-1 text-[11px] text-zinc-400 pl-5 rtl:pr-5 rtl:pl-0">
                    {step.resultSummary}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Stream (Messages, Responses, Code blocks, Live Python execution) */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
            <Sparkles className="w-8 h-8 text-zinc-700" />
            <p className="text-xs font-medium text-zinc-400">
              {controlMode === 'chat'
                ? (language === 'ar'
                    ? 'المساعد البرمجي المباشر جاهز: اكتب سؤالك، اطلب كود بايثون كامل، أو ابحث في GitHub.'
                    : 'Direct Coding Assistant ready: Ask questions, request complete Python code, or search GitHub.')
                : t.noPlanYet}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const pyCode = extractCode(msg.text);
            const liveResult = testResults[msg.id];
            const isCurrentlyRunning = executingCodeId === msg.id;

            return (
              <div
                key={msg.id}
                className={`p-3.5 rounded-xl text-xs space-y-2.5 ${
                  msg.sender === 'user'
                    ? 'bg-emerald-950/20 border border-emerald-900/50 text-zinc-200'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                  <span className="font-semibold uppercase text-zinc-300 flex items-center gap-1.5">
                    {msg.sender === 'user' ? '👤 OWNER' : '🤖 APEXSEC LEAD ENGINE'}
                  </span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>

                <div className="whitespace-pre-wrap leading-relaxed text-xs">
                  {msg.text}
                </div>

                {/* If Python Code is present, provide direct test & execution widget */}
                {pyCode && (
                  <div className="mt-2.5 rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-semibold text-emerald-400 flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5" />
                        <span>{t.completeCodeBadge || 'كود كامل 100% بدون نقصان'}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, pyCode)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] border border-zinc-700"
                        >
                          {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedId === msg.id ? (language === 'ar' ? 'تم' : 'Done') : (language === 'ar' ? 'نسخ' : 'Copy')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRunPythonCode(msg.id, pyCode)}
                          disabled={isCurrentlyRunning}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-all disabled:opacity-50 shadow-sm"
                        >
                          {isCurrentlyRunning ? (
                            <RotateCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          <span>{t.runPythonTest || '⚡ تشغيل واختبار في Python 3'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Live Test Results if triggered */}
                    {liveResult && (
                      <div className="mt-2 rounded-lg bg-zinc-900 border border-zinc-800 p-2 text-[10px] font-mono space-y-1">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span>$ python3 main.py</span>
                          <span className={liveResult.exitCode === 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                            {liveResult.exitCode === 0 ? (t.testSuccessBadge || '✔ Exit 0') : `Exit ${liveResult.exitCode}`}
                          </span>
                        </div>
                        {liveResult.stdout && (
                          <pre className="text-emerald-400 overflow-x-auto max-h-32 whitespace-pre-wrap">
                            {liveResult.stdout}
                          </pre>
                        )}
                        {liveResult.stderr && (
                          <pre className="text-red-400 overflow-x-auto max-h-32 whitespace-pre-wrap border-t border-zinc-800 pt-1">
                            {liveResult.stderr}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Tool Execution Details Accordion */}
                {msg.toolCall && (
                  <div className="mt-2 rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleToolExpand(msg.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-mono bg-zinc-900/60 hover:bg-zinc-850 text-zinc-300 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        {getToolIcon(msg.toolCall.tool)}
                        <span className="text-emerald-400">{msg.toolCall.tool}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {msg.toolCall.riskLevel && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                            {msg.toolCall.riskLevel}
                          </span>
                        )}
                        {expandedToolIds[msg.id] ? (
                          <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                      </div>
                    </button>

                    {expandedToolIds[msg.id] && (
                      <div className="p-3 text-[11px] font-mono space-y-2 border-t border-zinc-800 bg-zinc-950 text-zinc-400">
                        <div>
                          <span className="text-zinc-500">Parameters:</span>
                          <pre className="mt-1 p-2 rounded bg-zinc-900 text-zinc-300 overflow-x-auto text-[10px]">
                            {JSON.stringify(msg.toolCall.params, null, 2)}
                          </pre>
                        </div>
                        {msg.toolCall.output && (
                          <div>
                            <span className="text-zinc-500">Execution Output:</span>
                            <pre className="mt-1 p-2 rounded bg-zinc-900 text-emerald-400/90 overflow-x-auto text-[10px] max-h-48">
                              {typeof msg.toolCall.output === 'string'
                                ? msg.toolCall.output
                                : JSON.stringify(msg.toolCall.output, null, 2)}
                            </pre>
                          </div>
                        )}
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
