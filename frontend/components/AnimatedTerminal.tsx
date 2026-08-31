'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Terminal, ShieldCheck } from 'lucide-react'

const MOCK_LOGS = [
  "Building dependencies...",
  "Running tests...",
  "ERR! Test suite failed to execute",
  "ERR! Missing module '@auth/core' in layout.tsx",
  "Process exited with code 1"
]

export function AnimatedTerminal() {
  const [logIndex, setLogIndex] = useState(0)
  const [showAnalysis, setShowAnalysis] = useState(false)

  useEffect(() => {
    if (logIndex < MOCK_LOGS.length) {
      const timer = setTimeout(() => setLogIndex(i => i + 1), 600)
      return () => clearTimeout(timer)
    } else if (!showAnalysis) {
      const timer = setTimeout(() => setShowAnalysis(true), 800)
      return () => clearTimeout(timer)
    }
  }, [logIndex, showAnalysis])

  return (
    <div className="relative w-full max-w-2xl mx-auto h-[320px]">
      <AnimatePresence mode="wait">
        {!showAnalysis ? (
          <motion.div
            key="terminal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 rounded-xl border border-border/50 bg-[#0A0A0B] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center px-4 py-3 border-b border-border/50 bg-[#141416]">
              <div className="flex gap-2 mr-4">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
              </div>
              <Terminal className="w-4 h-4 text-muted-foreground mr-2" />
              <span className="text-xs font-mono text-muted-foreground">build-worker-01</span>
            </div>
            <div className="p-4 font-mono text-sm space-y-2">
              {MOCK_LOGS.slice(0, logIndex).map((log, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={log.startsWith('ERR!') ? 'text-red-400' : 'text-muted-foreground'}
                >
                  <span className="text-primary/50 mr-2">›</span>
                  {log}
                </motion.div>
              ))}
              {logIndex < MOCK_LOGS.length && (
                <motion.div
                  animate={{ opacity: [1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-2 h-4 bg-primary inline-block"
                />
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="analysis"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            className="absolute inset-0 rounded-xl border border-primary/30 bg-[#141416] shadow-[0_0_40px_-10px_rgba(139,92,246,0.3)] p-8 flex flex-col justify-center items-center text-center"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Root Cause Identified</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Missing authentication module in the root layout. PipelineIQ has generated a patch with 96% confidence.
            </p>
            <div className="flex gap-4">
              <div className="px-4 py-2 rounded-lg bg-[#0A0A0B] border border-border flex items-center gap-2">
                <span className="text-emerald-500 font-mono text-sm">96%</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Confidence</span>
              </div>
              <div className="px-4 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center gap-2 font-medium text-sm">
                View Suggested Fix
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
