'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'motion/react'
import { Hexagon, ArrowRight, GitMerge, FileSearch, Zap, ShieldCheck, Check, ArrowDown, Bell } from 'lucide-react'
import { AnimatedTerminal } from '@/components/AnimatedTerminal'

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
)

export default function LandingPage() {
  const { scrollY } = useScroll()
  const navBackground = useTransform(scrollY, [0, 50], ['rgba(10, 10, 11, 0)', 'rgba(10, 10, 11, 0.8)'])
  const navBorder = useTransform(scrollY, [0, 50], ['rgba(39, 39, 42, 0)', 'rgba(39, 39, 42, 0.5)'])

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30">
      {/* Sticky Nav */}
      <motion.nav
        style={{ backgroundColor: navBackground, borderColor: navBorder }}
        className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md transition-colors"
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hexagon className="w-6 h-6 text-primary fill-primary/20" />
            <span className="font-bold text-xl tracking-tight">PipelineIQ</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <Link href="#product" className="hover:text-foreground transition-colors">Product</Link>
            <Link href="#how-it-works" className="hover:text-foreground transition-colors">How it works</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="md:flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Connect GitHub Repo
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto min-h-screen flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6"
          >
            <Zap className="w-4 h-4" />
            PipelineIQ 2.0 is now live
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight"
          >
            CI/CD failures explained before you open the logs
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            AI-powered CI/CD intelligence that turns pipeline failures into clear, actionable root causes with one-click security-scoped fixes.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/dashboard"
              className="flex items-center justify-center w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3.5 rounded-lg font-medium transition-all hover:scale-105 active:scale-95"
            >
              <GithubIcon className="w-5 h-5" />
              Connect GitHub Repo
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center justify-center w-full sm:w-auto gap-2 bg-card hover:bg-card/80 border border-border/50 text-foreground px-8 py-3.5 rounded-lg font-medium transition-all hover:scale-105 active:scale-95"
            >
              See how it works
            </a>
          </motion.div>
        </div>

        {/* Visual Centerpiece */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative w-full max-w-4xl mx-auto"
        >
          {mounted && <AnimatedTerminal />}
        </motion.div>
      </section>

      {/* Trust/Stats Strip */}
      <section className="border-y border-border/50 bg-card/20 backdrop-blur-sm py-12">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-border/50">
          {[
            { label: 'Failures Analyzed', value: '2.4M+' },
            { label: 'Avg Time to Root Cause', value: '4.2s' },
            { label: 'Suggestion Accuracy', value: '96.8%' },
            { label: 'Developer Hours Saved', value: '140k+' },
          ].map((stat, i) => (
            <div key={i} className="text-center px-4">
              <div className="text-4xl font-bold font-mono text-primary mb-2 tracking-tight">{stat.value}</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight mb-4">How it works</h2>
          <p className="text-muted-foreground">From a broken build to a merged fix in minutes, not hours.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-8 relative">
          {/* Connecting Line (desktop only) */}
          <div className="hidden md:block absolute top-1/2 left-0 w-full h-[1px] bg-border/50 -translate-y-1/2 z-0" />

          {[
            { icon: <GitMerge />, title: 'Push Code', desc: 'Developer pushes code that breaks the CI pipeline.' },
            { icon: <Zap />, title: 'Webhook Fires', desc: 'GitHub instantly notifies PipelineIQ of the failure.' },
            { icon: <FileSearch />, title: 'LLM Analyzes', desc: 'Our AI parses raw logs to identify the exact root cause.' },
            { icon: <ShieldCheck />, title: 'Fix Suggested', desc: 'A secure, scoped patch is generated for your approval.' },
          ].map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: i * 0.15 }}
              className="relative z-10 bg-[#141416] border border-border/50 rounded-xl p-6 text-center shadow-xl group hover:border-primary/50 transition-colors"
            >
              <div className="w-12 h-12 mx-auto bg-[#0A0A0B] border border-border/50 rounded-lg flex items-center justify-center text-primary mb-4 group-hover:scale-110 group-hover:bg-primary/10 transition-all">
                {step.icon}
              </div>
              <h3 className="font-bold mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-24 px-6 bg-card/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Everything you need to debug faster</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <FileSearch />, title: 'Root Cause Analysis', desc: 'Stop grepping through thousands of log lines. We extract the exact error.' },
              { icon: <Zap />, title: 'Confidence Scoring', desc: 'Every diagnosis comes with a confidence score based on historical data.' },
              { icon: <Check />, title: 'Auto-fix with Guardrails', desc: 'Approve fixes directly from the dashboard and let us open the PR.' },
              { icon: <Bell />, title: 'Slack & Email Alerts', desc: 'Get notified immediately with a summary of what went wrong.' },
              { icon: <Hexagon />, title: 'Multi-repo Dashboard', desc: 'View the health of all your repositories in one unified interface.' },
              { icon: <ShieldCheck />, title: 'Security-scoped Fixes', desc: 'Fixes are isolated to specific files (e.g., configs) to prevent unintended logic changes.' },
            ].map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#141416] border border-border/50 rounded-xl p-6 hover:-translate-y-1 hover:border-primary/30 transition-all"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4">
                  {feat.icon}
                </div>
                <h3 className="font-bold mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-32 px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-b from-[#141416] to-[#0A0A0B] border border-primary/20 rounded-2xl p-8 md:p-12 text-center"
        >
          <ShieldCheck className="w-12 h-12 text-primary mx-auto mb-6" />
          <h2 className="text-3xl font-bold tracking-tight mb-4">Enterprise-grade Security by Default</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            We understand that letting AI write code requires trust. PipelineIQ's auto-fix feature is strictly governed by mandatory guardrails.
          </p>

          <div className="bg-[#0A0A0B] border border-border/50 rounded-xl p-6 max-w-md mx-auto text-left space-y-4">
            {[
              'Confidence threshold must exceed 85%',
              'Write access strictly scoped to configuration files',
              'No direct commits to default branch',
              'Mandatory human approval required for merge'
            ].map((rule, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3" />
                </div>
                <span className="text-sm font-medium">{rule}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Hexagon className="w-5 h-5 text-primary fill-primary/20" />
            <span className="font-bold tracking-tight">PipelineIQ</span>
          </div>
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} PipelineIQ Inc. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm font-medium text-muted-foreground">
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Docs</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
