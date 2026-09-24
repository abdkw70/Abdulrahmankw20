import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TermIcon,
  Play,
  Trash2,
  CornerDownLeft,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { Language } from '../types/client.js';
import { translations } from '../locales/translations.js';

interface TerminalEntry {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timestamp: string;
}

interface TerminalConsoleProps {
  language: Language;
  workspaceId: string;
}

export const TerminalConsole: React.FC<TerminalConsoleProps> = ({ language, workspaceId }) => {
  const t = translations[language];
  const [command, setCommand] = useState('');
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [running, setRunning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const execute = async (cmdToRun: string) => {
    const cmd = cmdToRun.trim();
    if (!cmd || running) return;

    setRunning(true);
    const entryId = `term_${Date.now()}`;

    try {
      const res = await fetch('/api/terminal/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          command: cmd,
        }),
      });

      const data = await res.json();
      setEntries((prev) => [
        ...prev,
        {
          id: entryId,
          command: cmd,
          stdout: data.stdout || '',
          stderr: data.stderr || '',
          exitCode: data.exitCode,
          durationMs: data.durationMs || 0,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err: any) {
      setEntries((prev) => [
        ...prev,
        {
          id: entryId,
          command: cmd,
          stdout: '',
          stderr: err.message,
          exitCode: 1,
          durationMs: 0,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setRunning(false);
      setCommand('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    execute(command);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 font-mono text-xs">
      {/* Header bar */}
      <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-300">
          <TermIcon className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold text-xs">{t.terminalTitle}</span>
          <span className="text-zinc-600 text-[10px]">[{workspaceId}]</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick preset commands */}
          <button
            onClick={() => execute('ls -la')}
            disabled={running}
            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300"
          >
            ls -la
          </button>
          <button
            onClick={() => execute('git status')}
            disabled={running}
            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300"
          >
            git status
          </button>
          <button
            onClick={() => execute('node -v')}
            disabled={running}
            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300"
          >
            node -v
          </button>
          <button
            onClick={() => setEntries([])}
            title={t.clearTerminal}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 ml-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Output Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {entries.length === 0 ? (
          <div className="text-zinc-600 py-6 text-center text-xs">
            <p>ApexSec Sandboxed Linux Shell Ready.</p>
            <p className="text-[10px] mt-1">{t.terminalHelp}</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span>$</span>
                  <span className="text-zinc-100 font-semibold">{entry.command}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {entry.durationMs}ms
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded ${
                      entry.exitCode === 0
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                        : 'bg-red-950/60 text-red-400 border border-red-800/60'
                    }`}
                  >
                    exit {entry.exitCode ?? 'err'}
                  </span>
                </div>
              </div>

              {entry.stdout && (
                <pre className="p-2.5 rounded-lg bg-zinc-900/80 text-zinc-200 overflow-x-auto text-[11px] leading-relaxed border border-zinc-850">
                  {entry.stdout}
                </pre>
              )}

              {entry.stderr && (
                <pre className="p-2.5 rounded-lg bg-red-950/20 text-red-400 overflow-x-auto text-[11px] leading-relaxed border border-red-900/40">
                  {entry.stderr}
                </pre>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-900/40">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold select-none text-sm">$</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            disabled={running}
            placeholder={t.commandPlaceholder}
            className="flex-1 bg-transparent border-0 focus:outline-none text-zinc-100 text-xs placeholder:text-zinc-600 font-mono"
          />
          <button
            type="submit"
            disabled={!command.trim() || running}
            className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold"
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
            <span>{t.runCommand}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
