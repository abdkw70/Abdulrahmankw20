import React, { useState, useEffect } from 'react';
import {
  FileText,
  Folder,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  FileCode,
  Check,
  AlertCircle,
  File,
} from 'lucide-react';
import { Language, WorkspaceItem } from '../types/client.js';
import { translations } from '../locales/translations.js';

interface CodeWorkspaceProps {
  language: Language;
  workspaceId: string;
}

export const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({ language, workspaceId }) => {
  const t = translations[language];
  const [files, setFiles] = useState<WorkspaceItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newFileModal, setNewFileModal] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fs/list?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.items || []);
        // Auto-select first file if none selected
        if (!selectedFile && data.items?.length > 0) {
          const firstFile = data.items.find((i: WorkspaceItem) => !i.isDirectory);
          if (firstFile) {
            loadFile(firstFile.path);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadFile = async (filePath: string) => {
    setSelectedFile(filePath);
    try {
      const res = await fetch(
        `/api/fs/read?workspaceId=${encodeURIComponent(workspaceId)}&path=${encodeURIComponent(filePath)}`
      );
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content || '');
        setOriginalContent(data.content || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      const res = await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          path: selectedFile,
          content: fileContent,
        }),
      });
      if (res.ok) {
        setOriginalContent(fileContent);
        setStatusMsg({ type: 'success', text: t.savedSuccessfully });
        setTimeout(() => setStatusMsg(null), 3000);
        fetchFiles();
      } else {
        const err = await res.json();
        setStatusMsg({ type: 'error', text: err.error || 'Failed to save' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const deleteCurrentFile = async () => {
    if (!selectedFile) return;
    if (!window.confirm(t.confirmDelete)) return;

    try {
      const res = await fetch('/api/fs/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          path: selectedFile,
        }),
      });
      if (res.ok) {
        setSelectedFile(null);
        setFileContent('');
        setOriginalContent('');
        setStatusMsg({ type: 'success', text: t.deletedSuccessfully });
        setTimeout(() => setStatusMsg(null), 3000);
        fetchFiles();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilePath.trim()) return;

    try {
      const res = await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          path: newFilePath.trim(),
          content: '// Created by ApexSec Agent\n',
        }),
      });
      if (res.ok) {
        setNewFileModal(false);
        const createdPath = newFilePath.trim();
        setNewFilePath('');
        await fetchFiles();
        loadFile(createdPath);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [workspaceId]);

  const isModified = fileContent !== originalContent;
  const lineCount = fileContent.split('\n').length;

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-200">
      {/* Sidebar: File Tree */}
      <div className="w-64 border-r border-zinc-800 bg-zinc-900/40 flex flex-col shrink-0">
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            {t.filesTitle}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setNewFileModal(true)}
              title={t.newFile}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={fetchFiles}
              title={t.refresh}
              className={`p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors ${
                loading ? 'animate-spin' : ''
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {files.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500">
              No files in workspace
            </div>
          ) : (
            files.map((item) => (
              <button
                key={item.path}
                onClick={() => !item.isDirectory && loadFile(item.path)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors text-left rtl:text-right ${
                  selectedFile === item.path
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {item.isDirectory ? (
                    <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  )}
                  <span className="truncate">{item.name}</span>
                </div>
                {!item.isDirectory && (
                  <span className="text-[10px] text-zinc-600 shrink-0">
                    {item.size < 1024 ? `${item.size}B` : `${Math.round(item.size / 1024)}KB`}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Area: Code Editor */}
      <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
        {selectedFile ? (
          <>
            {/* Editor Toolbar */}
            <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
                <File className="w-3.5 h-3.5 text-emerald-400" />
                <span>{selectedFile}</span>
                {isModified && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-800 font-sans">
                    Unsaved
                  </span>
                )}
                {statusMsg && (
                  <span
                    className={`text-[11px] font-sans flex items-center gap-1 ${
                      statusMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {statusMsg.type === 'success' ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <AlertCircle className="w-3 h-3" />
                    )}
                    {statusMsg.text}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={saveFile}
                  disabled={saving || !isModified}
                  className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                >
                  <Save className="w-3 h-3" />
                  <span>{t.save}</span>
                </button>
                <button
                  onClick={deleteCurrentFile}
                  title={t.delete}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Code Body with line numbers */}
            <div className="flex-1 flex overflow-hidden font-mono text-xs">
              {/* Line numbers gutter */}
              <div className="w-12 py-3 bg-zinc-950 text-zinc-600 text-right pr-3 select-none border-r border-zinc-850">
                {Array.from({ length: Math.max(lineCount, 1) }).map((_, i) => (
                  <div key={i} className="leading-6 text-[11px]">
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Text Area */}
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                className="flex-1 p-3 bg-transparent text-zinc-200 focus:outline-none resize-none leading-6 font-mono text-xs selection:bg-emerald-900 selection:text-white"
                spellCheck={false}
              />
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500">
            <FileCode className="w-12 h-12 text-zinc-700 mb-3" />
            <p className="text-sm font-medium text-zinc-400 mb-1">{t.selectAFile}</p>
          </div>
        )}
      </div>

      {/* New File Modal */}
      {newFileModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-semibold text-zinc-100 mb-2 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              {t.newFile}
            </h3>
            <form onSubmit={handleCreateFile} className="space-y-3">
              <input
                type="text"
                value={newFilePath}
                onChange={(e) => setNewFilePath(e.target.value)}
                placeholder={t.fileNamePrompt}
                autoFocus
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewFileModal(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={!newFilePath.trim()}
                  className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50 font-medium"
                >
                  {t.newFile}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
