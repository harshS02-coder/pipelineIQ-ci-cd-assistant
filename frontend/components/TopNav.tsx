import React from 'react'
import Link from 'next/link'
import { Bell, Search, Hexagon } from 'lucide-react'

export function TopNav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center px-6 gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg md:hidden">
          <Hexagon className="h-5 w-5 text-primary" />
          <span>PipelineIQ</span>
        </Link>
        <div className="flex flex-1 items-center gap-4 md:ml-0 md:justify-end">
          <div className="relative w-full max-w-sm ml-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search runs, SHAs, or errors..."
              className="w-full bg-card/50 rounded-md border border-border/50 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
            />
          </div>
          <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
          </button>
          <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center text-sm font-medium text-primary">
            JS
          </div>
        </div>
      </div>
    </header>
  )
}
