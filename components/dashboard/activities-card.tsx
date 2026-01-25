'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ActivitiesCard() {
  const activities = [
    'New order received from Customer 1024',
    'Product "Neon Pre-Workout" stock updated',
    'Expense added: Marketing campaign',
    'Order #DEMO-1001 status changed to shipped',
    'New product "Performance Stack" added',
  ]

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-sm font-medium uppercase">Activities</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity, idx) => (
            <div key={idx} className="text-sm text-muted-foreground">
              {activity}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
