'use client'

import React from 'react'
import Link from 'next/link'
import { StatCard } from '@/components/StatCard'
import { StatusPill } from '@/components/StatusPill'
import { Activity, AlertCircle, Wrench, ShieldAlert, ChevronRight, GitBranch } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const CHART_DATA = [
  { date: '10 Aug', failures: 12 },
  { date: '11 Aug', failures: 18 },
  { date: '12 Aug', failures: 15 },
  { date: '13 Aug', failures: 25 },
  { date: '14 Aug', failures: 10 },
  { date: '15 Aug', failures: 8 },
  { date: '16 Aug', failures: 32 },
  { date: '17 Aug', failures: 14 },
  { date: '18 Aug', failures: 11 },
  { date: '19 Aug', failures: 22 },
  { date: '20 Aug', failures: 19 },
  { date: '21 Aug', failures: 9 },
  { date: '22 Aug', failures: 7 },
  { date: '23 Aug', failures: 4 },
]

const MOCK_RUNS = [
  { id: 'run-1', repo: 'api-gateway', branch: 'feat/rate-limits', msg: 'Add per-user request throttling', status: 'failed', time: '12m ago', sha: 'b72d9e4f' },
  { id: 'run-2', repo: 'auth-service', branch: 'main', msg: 'Merge pull request #142 from /hotfix', status: 'analyzing', time: '28m ago', sha: 'a1f8c49e' },
  { id: 'run-3', repo: 'web-frontend', branch: 'main', msg: 'Update hero image dimensions', status: 'success', time: '2h ago', sha: 'c4e9b10a' },
  { id: 'run-4', repo: 'payment-worker', branch: 'fix/stripe-webhook', msg: 'Handle duplicate events', status: 'success', time: '5h ago', sha: '9d2c4b1f' },
  { id: 'run-5', repo: 'api-gateway', branch: 'main', msg: 'Revert "Add per-user request throttling"', status: 'success', time: '1d ago', sha: 'f1a2b3c4' },
]

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm">Monitor your CI/CD health and AI-powered failure analysis.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Runs (7d)" value="1,248" icon={<Activity />} trend={{ value: 12.5, label: 'vs last week' }} />
        <StatCard title="Failures Detected" value="142" icon={<AlertCircle />} trend={{ value: -5.2, label: 'vs last week' }} />
        <StatCard title="Auto-fixes Applied" value="86" icon={<Wrench />} description="60.5% resolution rate" />
        <StatCard title="Avg Confidence" value="94.2%" icon={<ShieldAlert />} description="Across all AI suggestions" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-border/50 bg-card p-6">
          <h2 className="text-lg font-semibold mb-6">Failure Trends (14 days)</h2>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={CHART_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFailures" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#141416', borderColor: '#27272A', borderRadius: '8px' }}
                  itemStyle={{ color: '#F8FAFC' }}
                />
                <Area type="monotone" dataKey="failures" stroke="#8B5CF6" strokeWidth={3} fillOpacity={1} fill="url(#colorFailures)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-1 rounded-xl border border-border/50 bg-card p-6 flex flex-col">
          <h2 className="text-lg font-semibold mb-4">Pipeline Health</h2>
          <div className="flex-1 flex flex-col justify-center gap-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Success Rate</span>
              <span className="text-sm font-mono text-emerald-500">88.6%</span>
            </div>
            <div className="w-full h-2 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '88.6%' }}></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-4 rounded-lg bg-[#0A0A0B] border border-border/50">
                <div className="text-2xl font-bold font-mono">14</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Active Repos</div>
              </div>
              <div className="p-4 rounded-lg bg-[#0A0A0B] border border-border/50">
                <div className="text-2xl font-bold font-mono">3</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Analyzing</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="p-6 border-b border-border/50">
          <h2 className="text-lg font-semibold">Recent Workflow Runs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-[#0A0A0B]/50 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Repository / Branch</th>
                <th className="px-6 py-4 font-medium">Commit Message</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {MOCK_RUNS.map((run) => (
                <tr key={run.id} className="hover:bg-[#0A0A0B]/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{run.repo}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground bg-border/30 px-2 py-0.5 rounded-full">
                        <GitBranch className="w-3 h-3" />
                        {run.branch}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{run.sha}</span>
                      <span className="truncate max-w-[200px] md:max-w-[300px] block" title={run.msg}>{run.msg}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusPill status={run.status as 'success' | 'failed' | 'analyzing'} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground text-xs">
                    {run.time}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {(run.status === 'failed' || run.status === 'analyzing') ? (
                      <Link
                        href={`/analysis/${run.sha}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        View Analysis
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
