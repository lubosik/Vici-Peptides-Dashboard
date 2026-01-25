'use client'

import { Card, CardContent } from '@/components/ui/card'

interface PercentageRingProps {
  percentage: number
  label: string
  gradient: 'cyan' | 'pink' | 'green' | 'orange' | 'purple'
}

const gradientColors = {
  cyan: { from: 'rgb(120, 200, 255)', to: 'rgb(100, 255, 200)' },
  pink: { from: 'rgb(255, 100, 200)', to: 'rgb(255, 150, 250)' },
  green: { from: 'rgb(100, 255, 150)', to: 'rgb(150, 255, 200)' },
  orange: { from: 'rgb(255, 150, 100)', to: 'rgb(255, 200, 150)' },
  purple: { from: 'rgb(150, 100, 255)', to: 'rgb(200, 150, 255)' },
}

function PercentageRing({ percentage, label, gradient }: PercentageRingProps) {
  const radius = 35
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference
  const colors = gradientColors[gradient]

  return (
    <div className="flex flex-col items-center relative">
      {/* Ring */}
      <div className="relative w-20 h-20 mb-3">
        <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke="rgba(60, 40, 90, 0.3)"
            strokeWidth="6"
            fill="none"
          />
          <circle
            cx="40"
            cy="40"
            r={radius}
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
          <div className={`text-xl font-bold ${
            gradient === 'cyan' ? 'neon-text-cyan' :
            gradient === 'pink' ? 'neon-text-pink' :
            gradient === 'green' ? 'neon-text-green' :
            gradient === 'orange' ? 'neon-text-orange' :
            'text-purple-400'
          }`}>
            {percentage}%
          </div>
        </div>
      </div>
      
      {/* Vertical line connecting to label */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-border/50" />
      
      {/* Label */}
      <div className="text-xs text-muted-foreground text-center mt-4">{label}</div>
    </div>
  )
}

interface PercentageRingsProps {
  rings: Array<{ percentage: number; label: string; gradient: PercentageRingProps['gradient'] }>
}

export function PercentageRings({ rings }: PercentageRingsProps) {
  return (
    <Card className="p-6">
      <CardContent className="p-0">
        <div className="flex items-start justify-around relative">
          {/* Horizontal connecting line */}
          <div className="absolute top-20 left-0 right-0 h-0.5 bg-border/30" />
          
          {rings.map((ring, idx) => (
            <div key={idx} className="relative flex-1 flex flex-col items-center">
              <PercentageRing {...ring} />
              {/* Connecting dots on horizontal line */}
              {idx < rings.length - 1 && (
                <div className="absolute top-20 left-full w-full h-0.5 bg-border/30 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-border/70" />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
