'use client'

import { Card, CardContent } from '@/components/ui/card'

interface CircularStatMeterProps {
  value: number
  label: string
  description: string
  percentage: number
  gradient: 'cyan' | 'pink' | 'green' | 'orange'
}

const gradientColors = {
  cyan: 'from-cyan-400 to-blue-500',
  pink: 'from-pink-400 to-rose-500',
  green: 'from-green-400 to-emerald-500',
  orange: 'from-orange-400 to-amber-500',
}

export function CircularStatMeter({ value, label, description, percentage, gradient }: CircularStatMeterProps) {
  const circumference = 2 * Math.PI * 45 // radius = 45
  const offset = circumference - (percentage / 100) * circumference

  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-32 h-32 mb-4">
            <svg className="w-32 h-32 transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted/20"
              />
              <defs>
                <linearGradient id={`gradient-${gradient}-${value}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={gradient === 'cyan' ? '#67e8f9' : gradient === 'pink' ? '#f472b6' : gradient === 'green' ? '#4ade80' : '#fb923c'} />
                  <stop offset="100%" stopColor={gradient === 'cyan' ? '#3b82f6' : gradient === 'pink' ? '#ec4899' : gradient === 'green' ? '#10b981' : '#f59e0b'} />
                </linearGradient>
              </defs>
              {/* Progress circle */}
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke={`url(#gradient-${gradient}-${value})`}
                strokeWidth="8"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{value.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-foreground mb-1">{label}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
