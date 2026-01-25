'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface StackedBarsProps {
  title: string
  bars: Array<{
    segments: Array<{ width: number; color: 'pink' | 'purple' | 'blue' | 'green' | 'yellow' }>
  }>
}

const colorMap = {
  pink: 'bg-pink-500',
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
}

export function StackedBars({ title, bars }: StackedBarsProps) {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-sm font-medium uppercase">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {bars.map((bar, idx) => (
          <div key={idx} className="flex gap-1 h-4">
            {bar.segments.map((segment, segIdx) => (
              <div
                key={segIdx}
                className={`${colorMap[segment.color]} rounded`}
                style={{ width: `${segment.width}%` }}
              />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
