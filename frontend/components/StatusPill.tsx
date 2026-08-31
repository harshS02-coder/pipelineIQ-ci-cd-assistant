import React from 'react'

export type StatusType = 'success' | 'failed' | 'analyzing'

interface StatusPillProps {
  status: StatusType
}

export function StatusPill({ status }: StatusPillProps) {
  const getStatusText = () => {
    switch (status) {
      case 'success':
        return 'Success'
      case 'failed':
        return 'Failed'
      case 'analyzing':
        return 'Analyzing'
    }
  }

  const getStatusStyles = () => {
    switch (status) {
      case 'success':
        return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
      case 'failed':
        return 'bg-red-500/10 text-red-500 border border-red-500/20'
      case 'analyzing':
        return 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusStyles()}`}
    >
      <span className="relative flex h-2 w-2">
        {status === 'analyzing' && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            status === 'success'
              ? 'bg-emerald-500'
              : status === 'failed'
              ? 'bg-red-500'
              : 'bg-amber-500'
          }`}
        ></span>
      </span>
      {getStatusText()}
    </span>
  )
}
