'use client'

import React, { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, GitBranch, Copy, Terminal, ChevronDown, FileWarning, Zap, Code2, ShieldCheck, Lock, Check, X } from 'lucide-react'
import { StatusPill } from '@/components/StatusPill'
import { ConfidenceGauge } from '@/components/ConfidenceGauge'
import { DiffViewer } from '@/components/DiffViewer'

const MOCK_LOGS = [
  { time: '08:42:17', level: 'INFO', text: 'Starting deploy to production' },
  { time: '08:42:19', level: 'INFO', text: 'Installing dependencies (pnpm install --frozen-lockfile)' },
  { time: '08:42:34', level: 'INFO', text: 'Running build command: next build' },
  { time: '08:42:41', level: 'INFO', text: '▲ Next.js 16.3.0' },
  { time: '08:42:45', level: 'WARN', text: 'Image with src "/hero.png" was detected without width/height' },
  { time: '08:42:48', level: 'ERROR', text: 'Module not found: Can\'t resolve "@/components/hero"' },
  { time: '08:42:48', level: 'ERROR', text: 'Import trace for requested module: ./app/page.tsx' },
  { time: '08:42:48', level: 'ERROR', text: 'Build failed with exit code 1' },
]

const DIFF_LINES: { type: 'added' | 'removed' | 'unchanged', content: string }[] = [
  { type: 'unchanged', content: "import { useState, useEffect } from 'react'" },
  { type: 'removed', content: "import Hero from '@/components/hero'" },
  { type: 'added', content: "import Hero from '@/components/HeroSection'" },
  { type: 'unchanged', content: "import { Button } from '@/components/ui/button'" },
  { type: 'unchanged', content: "" },
  { type: 'unchanged', content: "export default function Page() {" },
]

export default function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params)
  const id = unwrappedParams.id
  
  const [logsOpen, setLogsOpen] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copySha = () => {
    navigator.clipboard?.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center gap-6">
          <Link href="/dashboard" className="p-2 rounded-md hover:bg-card border border-transparent hover:border-border/50 text-muted-foreground transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 font-mono">
              <span>api-gateway</span>
              <span>/</span>
              <span className="flex items-center gap-1 text-foreground font-sans bg-card px-2 py-0.5 rounded border border-border/50">
                <GitBranch className="w-3 h-3" /> feat/rate-limits
              </span>
              <span>/</span>
              <button onClick={copySha} className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors">
                {id} <Copy className="w-3 h-3" />
                {copied && <span className="text-emerald-500 font-sans">Copied</span>}
              </button>
            </div>
            <h1 className="text-xl font-bold truncate">Add per-user request throttling</h1>
          </div>
          <StatusPill status="failed" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* LEFT: Raw Logs */}
          <div className="lg:sticky lg:top-32 rounded-xl border border-border/50 bg-[#0A0A0B] overflow-hidden">
            <button 
              onClick={() => setLogsOpen(!logsOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#141416] border-b border-border/50 text-sm font-semibold hover:bg-[#1f1f22] transition-colors"
            >
              <span className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                Raw Logs
              </span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${logsOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {logsOpen && (
              <div className="p-2 max-h-[600px] overflow-y-auto">
                {MOCK_LOGS.map((log, i) => (
                  <div key={i} className={`grid grid-cols-[30px_60px_50px_1fr] gap-3 px-3 py-1.5 text-[0.7rem] font-mono leading-relaxed rounded ${
                    log.level === 'ERROR' ? 'bg-red-500/10 text-red-400' :
                    log.level === 'WARN' ? 'bg-amber-500/10 text-amber-400' :
                    'text-muted-foreground hover:bg-[#141416]'
                  }`}>
                    <span className="text-right opacity-40 select-none">{(i + 1).toString().padStart(2, '0')}</span>
                    <span className="opacity-60">{log.time}</span>
                    <span className={log.level === 'INFO' ? 'text-emerald-500' : ''}>{log.level}</span>
                    <span className="break-all">{log.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: AI Analysis Stack */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-xs font-mono font-bold tracking-wider text-primary uppercase">
                AI Diagnosis
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                PipelineIQ / v2.0
              </div>
            </div>

            {/* Root Cause */}
            <div className="rounded-xl border border-border/50 bg-card p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <FileWarning className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Root Cause</h2>
                  <p className="text-sm text-muted-foreground mt-1">Dependency import cannot be resolved</p>
                </div>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed ml-14">
                The build references <code className="bg-[#0A0A0B] text-primary px-1.5 py-0.5 rounded border border-border/50 font-mono text-xs">@/components/hero</code>, but the module does not exist at that path. This usually happens after a component rename or an incomplete merge. The failure is isolated to the application entry point.
              </p>
            </div>

            {/* Confidence Score */}
            <div className="rounded-xl border border-border/50 bg-card p-6 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Confidence Score</h2>
                  <p className="text-sm text-muted-foreground mt-1">High-confidence diagnosis</p>
                  <p className="text-xs text-muted-foreground mt-4 max-w-xs leading-relaxed">
                    Based on 14 similar build failures in your repository history and analysis of the current file tree.
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <ConfidenceGauge value={87} size={120} strokeWidth={8} />
              </div>
            </div>

            {/* Suggested Fix */}
            <div className="rounded-xl border border-border/50 bg-card p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Suggested Fix</h2>
                  <p className="text-sm text-muted-foreground mt-1">Update the stale component import</p>
                </div>
              </div>
              <DiffViewer filename="app/page.tsx" lines={DIFF_LINES} />
            </div>

            {/* Constraints */}
            <div className="rounded-xl border border-border/50 bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="w-6 h-6 text-primary" />
                <h2 className="font-bold">Security Constraints</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 bg-[#0A0A0B] border border-border/50 rounded-md px-3 py-1.5 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5 text-success" /> Scope: config files only
                </span>
                <span className="inline-flex items-center gap-2 bg-[#0A0A0B] border border-border/50 rounded-md px-3 py-1.5 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5 text-amber-500" /> Requires approval
                </span>
                <span className="inline-flex items-center gap-2 bg-[#0A0A0B] border border-border/50 rounded-md px-3 py-1.5 text-xs text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-emerald-500" /> Confidence threshold met
                </span>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/50 shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-xs font-mono text-muted-foreground">RUN {id}</span>
            <span className="text-sm font-medium">Analysis complete · ready for review</span>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <Link href="#pr-diff" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors hidden sm:inline-block mr-4">
              View full PR diff
            </Link>
            <button className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex-1 sm:flex-none text-center rounded-md border border-transparent hover:border-border/50 hover:bg-card">
              Dismiss
            </button>
            <button 
              onClick={() => setConfirmOpen(true)}
              className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md shadow-lg shadow-primary/20 flex-1 sm:flex-none flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
            >
              Apply Fix <Zap className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/50 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <button 
                onClick={() => setConfirmOpen(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold mb-2">Apply suggested fix?</h2>
              <p className="text-sm text-muted-foreground mb-6">
                PipelineIQ will update one application import and create a commit on <code className="bg-[#0A0A0B] px-1 py-0.5 rounded border border-border/50 text-xs">feat/rate-limits</code>.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-sm">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Config files only</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>87% confidence threshold met</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Lock className="w-4 h-4 text-amber-500" />
                  <span>Your approval is required</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button 
                  onClick={() => setConfirmOpen(false)}
                  className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setConfirmOpen(false)}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md flex items-center gap-2 transition-colors"
                >
                  Approve & apply <Zap className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
