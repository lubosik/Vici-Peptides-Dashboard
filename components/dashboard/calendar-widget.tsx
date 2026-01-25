'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CalendarWidget() {
  const [currentDate, setCurrentDate] = useState(new Date())
  
  const month = currentDate.toLocaleString('default', { month: 'long' })
  const year = currentDate.getFullYear()
  
  const firstDay = new Date(year, currentDate.getMonth(), 1)
  const lastDay = new Date(year, currentDate.getMonth() + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()
  
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  
  const prevMonth = () => {
    setCurrentDate(new Date(year, currentDate.getMonth() - 1, 1))
  }
  
  const nextMonth = () => {
    setCurrentDate(new Date(year, currentDate.getMonth() + 1, 1))
  }
  
  // Highlight some dates (demo)
  const highlightedDates = [6, 13, 20, 27]
  
  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-6 w-6">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-sm font-medium">{month}</CardTitle>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-6 w-6">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day, idx) => (
            <div key={idx} className="text-xs text-center text-muted-foreground font-medium py-1">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-8"></div>
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const isHighlighted = highlightedDates.includes(day)
            return (
              <div
                key={day}
                className={`h-8 flex items-center justify-center text-sm rounded ${
                  isHighlighted
                    ? 'bg-primary/20 text-primary font-medium'
                    : 'text-foreground'
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
