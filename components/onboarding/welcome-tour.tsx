'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, ArrowRight, Check } from 'lucide-react'

interface TourStep {
  id: string
  title: string
  description: string
  target?: string
}

const tourSteps: TourStep[] = [
  {
    id: 'dashboard',
    title: 'Welcome to NeonMetrics Dashboard',
    description: 'This is your analytics dashboard demo. Here you can see key metrics, revenue trends, and visualizations with sample data.',
  },
  {
    id: 'kpis',
    title: 'Key Performance Indicators',
    description: 'These cards show your most important metrics: revenue, orders, profit margin, and active products. They update in real-time.',
  },
  {
    id: 'charts',
    title: 'Charts & Analytics',
    description: 'Visualize your data with interactive charts. See revenue trends, top products, and net profit over time.',
  },
  {
    id: 'navigation',
    title: 'Navigation',
    description: 'Use the sidebar to navigate between Dashboard, Orders, Products, Expenses, and more.',
  },
]

export function WelcomeTour() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Check if user has seen the tour before and if they want to see it again
    const hasSeenTour = localStorage.getItem('vici-dashboard-tour-completed')
    const showOnNextVisit = localStorage.getItem('vici-dashboard-show-tour') !== 'false'
    
    if (!hasSeenTour || showOnNextVisit) {
      setIsOpen(true)
      // Clear the "show on next visit" flag after showing
      if (hasSeenTour && showOnNextVisit) {
        localStorage.setItem('vici-dashboard-show-tour', 'false')
      }
    }
  }, [])

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleComplete = () => {
    localStorage.setItem('vici-dashboard-tour-completed', 'true')
    setIsOpen(false)
  }

  const handleSkip = () => {
    handleComplete()
  }

  if (!isOpen) return null

  const step = tourSteps[currentStep]
  const progress = ((currentStep + 1) / tourSteps.length) * 100

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 shadow-2xl border-2 border-primary/20 bg-background">
        <CardHeader className="bg-card border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-foreground">{step.title}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="hover:bg-muted"
              aria-label="Close tour"
            >
              <X className="h-5 w-5 text-foreground" />
            </Button>
          </div>
          <div className="mt-3">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 font-medium">
              Step {currentStep + 1} of {tourSteps.length}
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <CardDescription className="text-base mb-6 text-foreground leading-relaxed">
            {step.description}
          </CardDescription>
          <div className="flex justify-between gap-3">
            <Button 
              variant="outline" 
              onClick={handleSkip}
              className="flex-1"
            >
              Skip Tour
            </Button>
            <Button 
              onClick={handleNext}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {currentStep === tourSteps.length - 1 ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Complete
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
