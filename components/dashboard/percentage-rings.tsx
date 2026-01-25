'use client'

import { Card, CardContent } from '@/components/ui/card'

interface PercentageRingProps {
  percentage: number
  label: string
  gradient: 'cyan' | 'pink' | 'green' | 'orange' | 'yellow'
}

const gradientColors = {
  cyan: { from: '#67e8f9', to: '#3b82f6' },
  pink: { from: '#f472b6', to: '#ec4899' },
  green: { from: '#4ade80', to: '#10b981' },
  orange: { from: '#fb923c', to: '#f59e0b' },
  yellow: { from: '#fde047', to: '#eab308' },
}

function PercentageRing({ percentage, label, gradient }: PercentageRingProps) {
  const circumference = 2 * Math.PI * 35 // radius = 35
  const offset = circumference - (percentage / 100) * circumference
  const colors = gradientColors[gradient]

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24 mb-2">
        <svg className="w-24 h-24 transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="35"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-muted/20"
          />
          <circle
            cx="48"
            cy="48"
            r="35"
            stroke={`url(#gradient-${gradient})`}
            strokeWidth="6"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
          <defs>
            <linearGradient id={`gradient-${gradient}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.from} />
              <stop offset="100%" stopColor={colors.to} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-lg font-bold text-foreground">{percentage}%</div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground text-center">{label}</div>
    </div>
  )
}

interface PercentageRingsProps {
  rings: Array<{ percentage: number; label: string; gradient: PercentageRingProps['gradient'] }>
}

export function PercentageRings({ rings }: PercentageRingsProps) {
  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-around">
          {rings.map((ring, idx) => (
            <div key={idx} className="flex flex-col items-center relative">
              <PercentageRing {...ring} />
              {idx < rings.length - 1 && (
                <div className="absolute top-12 left-full w-8 h-0.5 bg-muted/30 flex items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted/50"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
