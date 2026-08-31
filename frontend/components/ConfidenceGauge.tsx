'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'motion/react'

interface ConfidenceGaugeProps {
  value: number
  size?: number
  strokeWidth?: number
}

export function ConfidenceGauge({
  value,
  size = 140,
  strokeWidth = 10,
}: ConfidenceGaugeProps) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  let color = 'stroke-emerald-500' // >80%
  if (value < 50) color = 'stroke-red-500'
  else if (value <= 80) color = 'stroke-amber-500'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Background Circle */}
      <svg className="absolute inset-0 transform -rotate-90" width={size} height={size}>
        <circle
          className="stroke-border"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Animated Foreground Circle */}
        {mounted && (
          <motion.circle
            className={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
          />
        )}
      </svg>
      {/* Center Text */}
      <div className="flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold font-mono tracking-tighter">
          {mounted ? (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              {value}%
            </motion.span>
          ) : '0%'}
        </span>
        <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mt-1">
          Confidence
        </span>
      </div>
    </div>
  )
}
