import React, { useState } from 'react';
import {
  Code2,
  Play,
  RotateCw,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Star,
  GitFork,
  Save,
  Terminal,
  Sparkles,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { Language } from '../types/client.js';
import { translations } from '../locales/translations.js';

interface GitHubRepo {
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  url: string;
  topics: string[];
  license?: string;
  updatedAt: string;
}

interface PythonStudioProps {
  language: Language;
  workspaceId: string;
}

export const PythonStudio: React.FC<PythonStudioProps> = ({ language, workspaceId }) => {
  const t = translations[language];
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [responseMarkdown, setResponseMarkdown] = useState('');
  const [code, setCode] = useState<string>(`#!/usr/bin/env python3
"""
Python 3.10 Standard Library Real Execution & Verification Demo
No External Dependencies - 100% Complete Implementation
"""
import hashlib
import hmac
import secrets
import json
import time

class SecureTokenVault:
    def __init__(self, master_secret: str):
        self.salt = secrets.token_bytes(16)
        self.key = hashlib.pbkdf2_hmac(
            'sha256',
            master_secret.encode('utf-8'),
            self.salt,
            iterations=100000
        )

    def sign_payload(self, data: dict) -> dict:
        payload_bytes = json.dumps(data, sort_keys=True).encode('utf-8')
        signature = hmac.new(self.key, payload_bytes, hashlib.sha256).hexdigest()
        return {
            "payload": data,
            "signature": signature,
            "timestamp": time.time()
        }

    def verify_payload(self, signed_data: dict) -> bool:
        payload_bytes = json.dumps(signed_data["payload"], sort_keys=True).encode('utf-8')
        expected = hmac.new(self.key, payload_bytes, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signed_data["signature"])

if __name__ == '__main__':
    print("[*] Starting Secure Token Vault Verification...")
    vault = SecureTokenVault("ApexSec-Master-Passphrase-2026")
    
    sample_data = {"user": "admin", "role": "root_operator", "auth_level": 5}
    token = vault.sign_payload(sample_data)
    print(f"[✔] Generated Signed Token (HMAC-SHA256): {token['signature'][:24]}...")
    
    is_valid = vault.verify_payload(token)
    assert is_valid is True, "Verification failed!"
    print(f"[✔] Signature Authenticity Verified: {is_valid}")
    print("[SUCCESS] All Python test assertions passed successfully.")
`);

  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [executionResult, setExecutionResult] = useState<{
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
    testedSuccessfully: boolean;
  } | null>(null);

  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [targetFilename, setTargetFilename] = useState('main.py');

  // Templates
  const loadTemplate = (type: 'crypto' | 'scanner' | 'database' | 'scraper') => {
    if (type === 'crypto') {
      setCode(`#!/usr/bin/env python3
import hashlib, hmac, secrets, json

def generate_secure_digest(text: str, secret_key: str):
    salt = secrets.token_hex(8)
    derived = hashlib.pbkdf2_hmac('sha256', text.encode(), salt.encode(), 100000)
    signature = hmac.new(secret_key.encode(), derived, hashlib.sha256).hexdigest()
    return {"salt": salt, "signature": signature}

if __name__ == '__main__':
    res = generate_secure_digest("ClassifiedPayload", "ApexSecKey2026")
    print("[✔] Crypto Digest Generated:", json.dumps(res, indent=2))
    assert len(res["signature"]) == 64
    print("[SUCCESS] Hash verification completed without errors.")
`);
    } else if (type === 'scanner') {
      setCode(`#!/usr/bin/env python3
import socket
import time

def check_local_port(host: str, port: int, timeout: float = 0.5) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(timeout)
        return s.connect_ex((host, port)) == 0

if __name__ == '__main__':
    targets = [3000, 8080, 22, 5432]
    print(f"[*] Scanning localhost ports: {targets}...")
    for p in targets:
        open_status = check_local_port('127.0.0.1', p)
        print(f"    - Port {p}: {'OPEN' if open_status else 'CLOSED'}")
    print("[SUCCESS] Port scan completed.")
`);
    } else if (type === 'database') {
      setCode(`#!/usr/bin/env python3
import sqlite3
import json

def init_vault_db():
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE audit_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            status TEXT NOT NULL,
            risk_level TEXT NOT NULL
        )
    """)
    cursor.executemany("""
        INSERT INTO audit_records (action, status, risk_level)
        VALUES (?, ?, ?)
    """, [
        ("Git Commit", "SUCCESS", "LOW"),
        ("SAST Scan", "SUCCESS", "LOW"),
        ("PoC Test", "SUCCESS", "MEDIUM")
    ])
    conn.commit()
    
    cursor.execute("SELECT * FROM audit_records")
    rows = cursor.fetchall()
    conn.close()
    return rows

if __name__ == '__main__':
    records = init_vault_db()
    print("[*] In-Memory SQLite Database Initialized.")
    for r in records:
        print(f"    Record #{r[0]}: {r[1]} -> {r[2]} ({r[3]})")
    assert len(records) == 3
    print("[SUCCESS] Database queries executed and verified.")
`);
    } else if (type === 'scraper') {
      setCode(`#!/usr/bin/env python3
import urllib.request
import json
import re

def fetch_ip_info():
    try:
        url = "https://httpbin.org/get"
        req = urllib.request.Request(url, headers={'User-Agent': 'ApexSec-Agent/1.0'})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            return {"origin": data.get("origin"), "url": data.get("url")}
    except Exception as e:
        return {"simulated": True, "notice": f"Mock fallback due to environment: {str(e)}"}

if __name__ == '__main__':
    info = fetch_ip_info()
    print("[*] HTTP Client Execution Test:")
    print(json.dumps(info, indent=2))
    print("[SUCCESS] Network test finished.")
`);
    }
  };

  // Submit search and generation
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setResponseMarkdown('');
    setExecutionResult(null);

    try {
      const res = await fetch('/api/python/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          workspaceId,
          autoExecute: true,
          targetFilename,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();
      setResponseMarkdown(data.reply || '');
      setGithubRepos(data.githubRepos || []);

      if (data.pythonCode) {
        setCode(data.pythonCode);
      }

      if (data.executionResult) {
        setExecutionResult({
          exitCode: data.executionResult.exitCode,
          stdout: data.executionResult.stdout,
          stderr: data.executionResult.stderr,
          durationMs: data.executionResult.durationMs,
          testedSuccessfully: data.testedSuccessfully,
        });
      }
    } catch (err: any) {
      setResponseMarkdown(`⚠️ Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Execute Code directly in Python 3 sandbox
  const handleExecuteCode = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      // 1. Save file first
      await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          path: targetFilename,
          content: code,
        }),
      });

      // 2. Run python3
      const res = await fetch('/api/terminal/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          command: `python3 ${targetFilename}`,
        }),
      });

      const data = await res.json();
      setExecutionResult({
        exitCode: data.exitCode,
        stdout: data.stdout,
        stderr: data.stderr,
        durationMs: data.durationMs,
        testedSuccessfully: data.exitCode === 0,
      });
    } catch (err: any) {
      setExecutionResult({
        exitCode: 1,
        stdout: '',
        stderr: err.message,
        durationMs: 0,
        testedSuccessfully: false,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveToWorkspace = async () => {
    try {
      const res = await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          path: targetFilename,
          content: code,
        }),
      });
      if (res.ok) {
        setSaveStatus(language === 'ar' ? `تم الحفظ في ${targetFilename}` : `Saved to ${targetFilename}`);
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch (err: any) {
      setSaveStatus(`Error: ${err.message}`);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden text-zinc-100">
      {/* Top Banner / Prompt Bar */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/80 text-emerald-400">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-zinc-200">
                {language === 'ar' ? 'استوديو بايثون والبحث المباشر في GitHub' : 'Python 3 & Live GitHub Code Studio'}
              </h2>
              <p className="text-[11px] text-zinc-400">
                {language === 'ar'
                  ? 'بحث في أفضل مستودعات GitHub، كتابة أكواد بايثون كاملة بدون أي نقص، وتشغيل واختبار فعلي في بيئة Python 3.10'
                  : 'Search top GitHub repositories, generate 100% complete Python code without omissions, and test in real Python 3.10'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-900/80 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Python 3.10 Verified</span>
            </span>
          </div>
        </div>

        {/* Search & Instruction Form */}
        <form onSubmit={handleGenerate} className="space-y-2.5">
          <div className="relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                language === 'ar'
                  ? 'اطلب أي كود بايثون كامل، أو ابحث عن أفضل كود على جيت هاب واختبره... (مثال: خوارزمية تشفير متقدمة أو فاحص منافذ شبكي)'
                  : 'Request complete Python code, or search GitHub for the best code & test... (e.g., Cryptographic vault or port scanner)'
              }
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/80 disabled:opacity-50 font-sans"
            />
            <button
              type="submit"
              disabled={!prompt.trim() || isLoading}
              className="absolute ltr:right-2 rtl:left-2 top-2 flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold disabled:opacity-40 transition-all shadow-md shadow-emerald-950/40"
            >
              {isLoading ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{language === 'ar' ? 'جاري البحث والإنشاء...' : 'Searching & Generating...'}</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'بحث وتوليد واختبار' : 'Search & Test'}</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-medium">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              {language === 'ar' ? 'قوالب جاهزة ومختبرة:' : 'Tested Templates:'}
            </span>
            <button
              type="button"
              onClick={() => loadTemplate('crypto')}
              className="text-[11px] px-2.5 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60"
            >
              {language === 'ar' ? 'تشفير وحماية البيانات (Crypto)' : 'Cryptography (PBKDF2/HMAC)'}
            </button>
            <button
              type="button"
              onClick={() => loadTemplate('scanner')}
              className="text-[11px] px-2.5 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60"
            >
              {language === 'ar' ? 'فاحص منافذ شبكي (Port Scanner)' : 'Socket Port Scanner'}
            </button>
            <button
              type="button"
              onClick={() => loadTemplate('database')}
              className="text-[11px] px-2.5 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60"
            >
              {language === 'ar' ? 'قاعدة بيانات SQLite مدمجة' : 'SQLite In-Memory DB'}
            </button>
            <button
              type="button"
              onClick={() => loadTemplate('scraper')}
              className="text-[11px] px-2.5 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60"
            >
              {language === 'ar' ? 'عميل HTTP واستدعاء API' : 'HTTP/REST Client'}
            </button>
          </div>
        </form>
      </div>

      {/* Main Split Body: Left Code Editor & Controls / Right: Execution Console & GitHub Repos */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Code Viewer & Actions */}
        <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-zinc-800 overflow-hidden">
          {/* Editor Header Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-zinc-400">{language === 'ar' ? 'الملف الهدف:' : 'Target:'}</span>
              <input
                type="text"
                value={targetFilename}
                onChange={(e) => setTargetFilename(e.target.value)}
                className="w-28 px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded font-mono text-[11px] text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/80">
                {language === 'ar' ? 'كود كامل بدون نقصان' : '100% Complete Code'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs transition-colors border border-zinc-700/60"
                title="Copy code"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? (language === 'ar' ? 'تم النسخ' : 'Copied') : (language === 'ar' ? 'نسخ' : 'Copy')}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveToWorkspace}
                className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs transition-colors border border-zinc-700/60"
                title="Save file"
              >
                <Save className="w-3.5 h-3.5 text-blue-400" />
                <span>{language === 'ar' ? 'حفظ' : 'Save'}</span>
              </button>

              <button
                type="button"
                onClick={handleExecuteCode}
                disabled={isExecuting}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-md transition-all disabled:opacity-50"
              >
                {isExecuting ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>{language === 'ar' ? 'تشغيل واختبار حقيقي (Run)' : 'Execute & Test'}</span>
              </button>
            </div>
          </div>

          {saveStatus && (
            <div className="px-4 py-1.5 bg-emerald-950/50 border-b border-emerald-900/60 text-emerald-300 text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{saveStatus}</span>
            </div>
          )}

          {/* Code Textarea / Viewer */}
          <div className="flex-1 p-3 bg-zinc-950 overflow-hidden flex flex-col">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 w-full p-3 bg-zinc-900/40 text-zinc-100 font-mono text-xs leading-relaxed rounded-xl border border-zinc-800 focus:outline-none focus:border-emerald-500/80 resize-none overflow-auto"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Right: Live Terminal Execution Results & Discovered GitHub Repos */}
        <div className="w-full lg:w-[480px] xl:w-[520px] flex flex-col bg-zinc-950 overflow-hidden">
          {/* Execution Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-zinc-200">
                {language === 'ar' ? 'الطرفية والتحقق الفعلي (Sandbox Output)' : 'Sandbox Output & Live Execution'}
              </span>
            </div>

            {executionResult && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold flex items-center gap-1 ${
                  executionResult.testedSuccessfully
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-red-950 text-red-400 border border-red-800'
                }`}
              >
                {executionResult.testedSuccessfully ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{language === 'ar' ? 'تم الاختبار بنجاح (Exit 0)' : 'PASSED (Exit 0)'}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" />
                    <span>{language === 'ar' ? `فشل (Exit ${executionResult.exitCode})` : `FAILED (Exit ${executionResult.exitCode})`}</span>
                  </>
                )}
              </span>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {/* Live Terminal Output Box */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-950 border-b border-zinc-800 text-[10px] font-mono text-zinc-400">
                <span>$ python3 {targetFilename}</span>
                {executionResult && (
                  <span>{executionResult.durationMs}ms</span>
                )}
              </div>

              <div className="p-3 font-mono text-xs text-zinc-200 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
                {isExecuting ? (
                  <div className="flex items-center gap-2 text-zinc-400 py-4">
                    <RotateCw className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>{language === 'ar' ? 'جاري التشغيل الفعلي في بيئة بايثون المعزولة...' : 'Executing in Python 3.10 sandbox...'}</span>
                  </div>
                ) : executionResult ? (
                  <>
                    {executionResult.stdout && (
                      <div className="text-emerald-400/95">{executionResult.stdout}</div>
                    )}
                    {executionResult.stderr && (
                      <div className="text-red-400 mt-2 font-mono text-[11px] border-t border-zinc-800/80 pt-2">
                        {executionResult.stderr}
                      </div>
                    )}
                    {!executionResult.stdout && !executionResult.stderr && (
                      <div className="text-zinc-500 italic">No output produced (Exit 0)</div>
                    )}
                  </>
                ) : (
                  <div className="text-zinc-500 italic py-2">
                    {language === 'ar'
                      ? 'اضغط على "تشغيل واختبار حقيقي" لتنفيذ كود بايثون وعرض مخرجات الطرفية الفعلية.'
                      : 'Click "Execute & Test" to run Python code and inspect real stdout.'}
                  </div>
                )}
              </div>
            </div>

            {/* AI Explanation / Reasoning */}
            {responseMarkdown && (
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  {language === 'ar' ? 'تحليل وشرح الوكيل الفني:' : 'Agent Engineering Analysis:'}
                </span>
                <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {responseMarkdown.replace(/```python[\s\S]*?```/gi, '').trim()}
                </div>
              </div>
            )}

            {/* Top Discovered GitHub Repositories */}
            {githubRepos.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    {language === 'ar' ? 'أفضل مستودعات GitHub المكتشفة:' : 'Top GitHub Repositories Found:'}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {githubRepos.length} repos
                  </span>
                </div>

                <div className="space-y-2">
                  {githubRepos.map((repo, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                        >
                          <span>{repo.fullName}</span>
                          <ExternalLink className="w-3 h-3 text-zinc-500" />
                        </a>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                          <span className="flex items-center gap-0.5 text-amber-400">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>{repo.stars}</span>
                          </span>
                          <span className="flex items-center gap-0.5 text-zinc-400">
                            <GitFork className="w-3 h-3" />
                            <span>{repo.forks}</span>
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-zinc-400 line-clamp-2">
                        {repo.description}
                      </p>

                      {repo.topics && repo.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {repo.topics.slice(0, 4).map((topic, tidx) => (
                            <span
                              key={tidx}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
