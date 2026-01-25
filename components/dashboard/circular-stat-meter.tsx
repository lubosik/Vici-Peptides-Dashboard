'use client'

import { Card, CardContent } from '@/components/ui/card'

interface CircularStatMeterProps {
  value: number | string
  label: string
  description?: string
  percentage: number // 0-100 for the arc
  gradient: 'cyan-green' | 'pink-orange' | 'yellow-green'
}

export function CircularStatMeter({
  value,
  label,
  description,
  percentage,
  gradient,
}: CircularStatMeterProps) {
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  const gradientColors = {
    'cyan-green': { from: 'rgb(120, 200, 255)', to: 'rgb(100, 255, 150)' },
    'pink-orange': { from: 'rgb(255, 100, 200)', to: 'rgb(255, 150, 100)' },
    'yellow-green': { from: 'rgb(255, 200, 100)', to: 'rgb(100, 255, 150)' },
  }

  const colors = gradientColors[gradient]

  return (
    <Card className="p-6">
      <CardContent className="flex flex-col items-center justify-center p-0">
        <div className="relative w-32 h-32 mb-4">
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 140 140">
            {/* Background circle */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="rgba(60, 40, 90, 0.3)"
              strokeWidth="8"
            />
            {/* Progress arc */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={`url(#gradient-${gradient})`}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-500"
            />
            <defs>
              <linearGradient id={`gradient-${gradient}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={colors.from} />
                <stop offset="100%" stopColor={colors.to} />
              </linearGradient>
            </defs>
          </svg>
          {/* Center value */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className={`text-3xl font-bold ${
                gradient === 'cyan-green' ? 'neon-text-cyan' :
                gradient === 'pink-orange' ? 'neon-text-pink' :
                'neon-text-orange'
              }`}>
                {typeof value === 'number' ? value.toLocaleString() : value}
              </div>
            </div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-foreground mb-1">{label}</div>
          {description && (
            <div className="text-xs text-muted-foreground">{description}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
