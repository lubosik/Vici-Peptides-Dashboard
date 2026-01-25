'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ProgressBarProps {
  label: string
  percentage: number
  gradient: 'cyan-pink' | 'green-yellow' | 'orange-red'
}

const gradientClasses = {
  'cyan-pink': 'from-cyan-400 via-pink-400 to-pink-500',
  'green-yellow': 'from-green-400 via-yellow-400 to-yellow-500',
  'orange-red': 'from-orange-400 via-red-400 to-red-500',
}

function ProgressBar({ label, percentage, gradient }: ProgressBarProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="h-2 w-full bg-muted/20 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${gradientClasses[gradient]} transition-all duration-500 rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

interface ProgressBarsCardProps {
  title: string
  bars: Array<{ label: string; percentage: number; gradient: ProgressBarProps['gradient'] }>
}

export function ProgressBarsCard({ title, bars }: ProgressBarsCardProps) {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-sm font-medium uppercase">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {bars.map((bar, idx) => (
          <ProgressBar key={idx} {...bar} />
        ))}
      </CardContent>
    </Card>
  )
}

interface SingleProgressBarProps {
  title: string
  percentage: number
  value: string
  gradient: 'cyan-pink' | 'pink-cyan'
}

export function SingleProgressBar({ title, percentage, value, gradient }: SingleProgressBarProps) {
  const gradientClass = gradient === 'cyan-pink' 
    ? 'from-pink-400 via-cyan-400 to-cyan-500'
    : 'from-cyan-400 via-pink-400 to-pink-500'

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-sm font-medium uppercase">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-2xl font-bold text-primary">{value}</div>
          <div className="h-1.5 w-full bg-muted/20 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${gradientClass} transition-all duration-500 rounded-full`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
