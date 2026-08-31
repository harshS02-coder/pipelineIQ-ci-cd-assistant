import React from 'react'
import { FileCode2 } from 'lucide-react'

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  content: string
}

interface DiffViewerProps {
  filename: string
  lines: DiffLine[]
}

export function DiffViewer({ filename, lines }: DiffViewerProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-[#0A0A0B] overflow-hidden text-sm">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-[#141416]">
        <FileCode2 className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-muted-foreground">{filename}</span>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="font-mono text-xs leading-relaxed">
          {lines.map((line, index) => (
            <div
              key={index}
              className={`flex rounded px-2 -mx-2 ${
                line.type === 'added'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : line.type === 'removed'
                  ? 'bg-red-500/10 text-red-400'
                  : 'text-muted-foreground'
              }`}
            >
              <span className="select-none w-6 text-right opacity-50 shrink-0 mr-4">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <span className="whitespace-pre">{line.content}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}
