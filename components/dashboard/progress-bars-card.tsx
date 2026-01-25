'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ProgressBarsCardProps {
  title: string
  value?: string
  description?: string
  bars: Array<{
    label: string
    value: number // 0-100
    gradient: 'cyan' | 'green' | 'pink' | 'orange'
  }>
}

export function ProgressBarsCard({
  title,
  value,
  description,
  bars,
}: ProgressBarsCardProps) {
  const gradientClasses = {
    cyan: 'bg-gradient-to-r from-cyan-500 to-cyan-400',
    green: 'bg-gradient-to-r from-green-500 to-green-400',
    pink: 'bg-gradient-to-r from-pink-500 to-pink-400',
    orange: 'bg-gradient-to-r from-orange-500 to-orange-400',
  }

  const glowClasses = {
    cyan: 'neon-glow-cyan',
    green: 'neon-glow-green',
    pink: 'neon-glow-pink',
    orange: 'neon-glow-orange',
  }

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider">
          {title}
        </CardTitle>
        {value && (
          <div className={`text-4xl font-bold mt-2 ${
            title.includes('64') ? 'neon-text-cyan' : ''
          }`}>
            {value}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0 space-y-3">
        {description && (
          <p className="text-xs text-muted-foreground mb-4">{description}</p>
        )}
        {bars.map((bar, index) => (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{bar.label}</span>
              <span className="text-foreground">{bar.value}%</span>
            </div>
            <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div
                className={`h-full ${gradientClasses[bar.gradient]} ${glowClasses[bar.gradient]} transition-all duration-500`}
                style={{ width: `${bar.value}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
