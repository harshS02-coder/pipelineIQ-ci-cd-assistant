import React from 'react'
import Link from 'next/link'
import { Hexagon, Plus, GitBranch } from 'lucide-react'

const MOCK_REPOS = [
  { id: 1, name: 'api-gateway', status: 'failed' },
  { id: 2, name: 'web-frontend', status: 'success' },
  { id: 3, name: 'auth-service', status: 'analyzing' },
  { id: 4, name: 'payment-worker', status: 'success' },
]

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

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border/50 bg-[#0A0A0B] h-screen sticky top-0">
      <div className="h-14 flex items-center px-6 border-b border-border/50">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-foreground transition-opacity hover:opacity-80">
          <Hexagon className="h-6 w-6 text-primary fill-primary/20" />
          <span className="tracking-tight">PipelineIQ</span>
        </Link>
      </div>
      
      <div className="flex-1 py-6 px-4 overflow-y-auto">
        <div className="mb-4 flex items-center justify-between px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Repositories</span>
        </div>
        <nav className="space-y-1">
          {MOCK_REPOS.map((repo) => (
            <Link
              key={repo.id}
              href={`/dashboard?repo=${repo.name}`}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-card transition-colors group"
            >
              <GithubIcon className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              <span className="flex-1 truncate">{repo.name}</span>
              <span className="relative flex h-2 w-2">
                {repo.status === 'analyzing' && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    repo.status === 'success'
                      ? 'bg-emerald-500'
                      : repo.status === 'failed'
                      ? 'bg-red-500'
                      : 'bg-amber-500'
                  }`}
                ></span>
              </span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-border/50">
        <button className="w-full flex items-center justify-center gap-2 bg-card hover:bg-card/80 text-foreground border border-border/50 rounded-md py-2 px-4 text-sm font-medium transition-colors">
          <Plus className="h-4 w-4" />
          Connect Repo
        </button>
      </div>
    </aside>
  )
}
