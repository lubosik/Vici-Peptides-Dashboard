'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function CalendarCard() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const month = currentDate.toLocaleString('default', { month: 'long' })
  const year = currentDate.getFullYear()

  // Get first day of month and number of days
  const firstDay = new Date(year, currentDate.getMonth(), 1).getDay()
  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate()

  // Generate calendar days
  const days = []
  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  // Days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  // Highlight specific dates (like in reference: 6, 7, 13, 14, 20, 21, 27, 28)
  const highlightedDates = [6, 7, 13, 14, 20, 21, 27, 28]

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, currentDate.getMonth() + 1, 1))
  }

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-sm font-semibold">
            <span className="neon-text-orange">{month}</span>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day, index) => (
            <div
              key={index}
              className="text-xs text-center text-muted-foreground font-medium py-1"
            >
              {day}
            </div>
          ))}
        </div>
        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            if (day === null) {
              return <div key={index} className="aspect-square" />
            }
            const isHighlighted = highlightedDates.includes(day)
            return (
              <div
                key={index}
                className={`aspect-square flex items-center justify-center text-sm rounded ${
                  isHighlighted
                    ? 'bg-destructive/20 text-destructive neon-glow-orange'
                    : 'text-foreground hover:bg-muted/30'
                }`}
              >
                {day}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
