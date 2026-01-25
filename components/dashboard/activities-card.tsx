'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Activity {
  text: string
  highlight?: boolean
}

interface ActivitiesCardProps {
  activities: Activity[]
}

export function ActivitiesCard({ activities }: ActivitiesCardProps) {
  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider">
          ACTIVITIES
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 space-y-2">
        {activities.map((activity, index) => (
          <p
            key={index}
            className={`text-sm ${
              activity.highlight
                ? 'text-destructive'
                : 'text-muted-foreground'
            }`}
          >
            {activity.text}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}
