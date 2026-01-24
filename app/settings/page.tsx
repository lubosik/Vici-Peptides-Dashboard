import { Sidebar } from '@/components/sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { CheckCircle, XCircle, Clock, Database, Webhook, Palette, Wifi, WifiOff } from 'lucide-react'
import { RealtimeConnectionStatus } from '@/components/settings/realtime-status'
import { OnboardingToggle } from '@/components/settings/onboarding-toggle'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { WooCommerceSync } from '@/components/settings/woocommerce-sync'

// Force dynamic rendering to prevent build-time errors when env vars aren't available
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()

  // Check Supabase connection
  let connectionStatus = 'unknown'
  let connectionError: string | null = null
  let lastIngestion = null
  let ingestionEvents: any[] = []
  let ordersCount = 0
  let orderLinesCount = 0
  let productsCount = 0
  let expensesCount = 0

  try {
    const { error } = await supabase.from('orders').select('order_number').limit(1)
    connectionStatus = error ? 'error' : 'connected'
    connectionError = error?.message || null

    // Get last ingestion timestamp from ingestion_audit
    const { data: lastIng } = await supabase
      .from('ingestion_audit')
      .select('ingested_at, status, error_message')
      .order('ingested_at', { ascending: false })
      .limit(1)
      .single()
    lastIngestion = lastIng

    // Get last 20 ingestion events
    const { data: events } = await supabase
      .from('ingestion_audit')
      .select('ingested_at, status, error_message, order_number')
      .order('ingested_at', { ascending: false })
      .limit(20)
    ingestionEvents = events || []

    // Get row counts for data pipeline health
    const { count: orders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
    ordersCount = orders || 0
    
    const { count: orderLines } = await supabase
      .from('order_lines')
      .select('*', { count: 'exact', head: true })
    orderLinesCount = orderLines || 0
    
    const { count: products } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
    productsCount = products || 0
    
    const { count: expenses } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
    expensesCount = expenses || 0
  } catch (error: any) {
    connectionStatus = 'error'
    connectionError = error?.message || 'Unknown error'
    console.error('Error loading settings data:', error)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto lg:ml-0">
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-2">
              System configuration and health monitoring
            </p>
          </div>

          {/* Connection Status */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Supabase Connection
              </CardTitle>
              <CardDescription>Database connection status and health</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {connectionStatus === 'connected' ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-600">Connected</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-600">Error</span>
                      {connectionError && (
                        <span className="text-sm text-muted-foreground">
                          {connectionError}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  <div>URL: {process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)}...</div>
                </div>
                <div className="border-t pt-4">
                  <div className="text-sm font-medium mb-2">Realtime Subscriptions</div>
                  <RealtimeConnectionStatus />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ingestion Timestamps */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Ingestion Timestamps
              </CardTitle>
              <CardDescription>Last data ingestion events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Last Order Ingestion</div>
                  <div className="font-medium">
                    {lastIngestion?.ingested_at
                      ? new Date(lastIngestion.ingested_at).toLocaleString()
                      : 'Never'}
                  </div>
                  {lastIngestion && (
                    <div className="text-sm mt-1">
                      {lastIngestion.status === 'success' ? (
                        <span className="text-green-600">✓ Success</span>
                      ) : (
                        <span className="text-red-600">
                          ✗ Failed: {lastIngestion.error_message || 'Unknown error'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Last CSV Import</div>
                  <div className="font-medium text-muted-foreground">
                    Run <code className="text-xs bg-muted px-2 py-1 rounded">npm run import</code> to import CSV data
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Webhook Health */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhook Health
              </CardTitle>
              <CardDescription>Last 20 ingestion events from Make.com webhooks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <form action="/api/test-ingestion" method="POST">
                  <Button type="submit" variant="outline" className="w-full">
                    Send Test Ingestion
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground mt-2">
                  Sends a safe test order to verify ingestion endpoint works
                </p>
              </div>
              {ingestionEvents && ingestionEvents.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {ingestionEvents.map((event, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {event.order_number || 'Unknown Order'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(event.ingested_at).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        {event.status === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No ingestion events yet. Webhooks will appear here when orders are ingested.
                </div>
              )}
            </CardContent>
          </Card>

          {/* WooCommerce Sync */}
          <WooCommerceSync />

          {/* Theme Settings */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Theme Settings
              </CardTitle>
              <CardDescription>Customize dashboard appearance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Theme</label>
                  <ThemeToggle />
                  <p className="text-xs text-muted-foreground mt-2">
                    Choose between light, dark, or system preference
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Default Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Default Settings</CardTitle>
              <CardDescription>Configure default values and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <OnboardingToggle />
                <div>
                  <label className="text-sm font-medium mb-2 block">Free Shipping Threshold</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="$0.00"
                    disabled
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Default free shipping threshold (coming soon)
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Default Date Range</label>
                  <select className="w-full px-3 py-2 border rounded-md" disabled>
                    <option>Last 30 days</option>
                    <option>Last 90 days</option>
                    <option>Last year</option>
                    <option>All time</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Currency</label>
                  <select className="w-full px-3 py-2 border rounded-md" disabled>
                    <option>USD ($)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
