'use client'

import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDemoStore } from '@/lib/demo/store'
import { isDemoMode } from '@/lib/demo/mode'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  const store = useDemoStore()
  const router = useRouter()
  const [resetting, setResetting] = useState(false)
  const isDemo = isDemoMode()

  const handleResetDemoData = () => {
    if (!confirm('Are you sure you want to reset all demo data? This will restore the default dataset and cannot be undone.')) {
      return
    }
    setResetting(true)
    store.resetData()
    setTimeout(() => {
      setResetting(false)
      router.refresh()
      alert('Demo data has been reset to default values.')
    }, 500)
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-2">
                Manage your dashboard settings
              </p>
            </div>

            {isDemo && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Demo Mode</CardTitle>
                  <CardDescription>
                    This dashboard is running in demo mode with sample data.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Reset all demo data to the default dataset. This will restore the original sample orders, products, and expenses.
                      </p>
                      <Button
                        variant="destructive"
                        onClick={handleResetDemoData}
                        disabled={resetting}
                      >
                        {resetting ? 'Resetting...' : 'Reset Demo Data'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <strong>NeonMetrics Dashboard</strong> - A modern analytics dashboard demo.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Version 1.0.0
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
