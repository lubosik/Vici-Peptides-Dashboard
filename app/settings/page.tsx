'use client'

import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { RefreshCw, CheckCircle, AlertCircle, Database } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  const router = useRouter()
  const [syncingDashboard, setSyncingDashboard] = useState(false)
  const [syncingAllOrders, setSyncingAllOrders] = useState(false)
  const [refreshingStock, setRefreshingStock] = useState(false)
  const [backfillingCosts, setBackfillingCosts] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{ success: boolean; message: string } | null>(null)

  const handleSyncWholeDashboard = async (fullResync = false) => {
    setSyncingDashboard(true)
    setSyncStatus(null)
    try {
      const response = await fetch('/api/sync/woocommerce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: fullResync ? 'full' : 'incremental',
          orders: true,
          products: true,
          coupons: true,
        }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        const orders = data.results?.orders
        const products = data.results?.products
        const parts: string[] = []
        if (orders) parts.push(`${orders.synced ?? 0} orders`)
        if (products) parts.push(`${products.synced ?? 0} products`)
        const msg = parts.length
          ? `Synced ${parts.join(', ')}.${(orders?.errors || products?.errors) ? ' Some errors.' : ''}`
          : 'Dashboard sync completed.'
        setSyncStatus({ success: true, message: msg })
        setTimeout(() => router.refresh(), 2000)
      } else {
        setSyncStatus({
          success: false,
          message: data.error || data.message || 'Failed to sync dashboard',
        })
      }
    } catch (error) {
      setSyncStatus({
        success: false,
        message: 'An error occurred while syncing the dashboard',
      })
    } finally {
      setSyncingDashboard(false)
    }
  }

  const handleFullResync = () => handleSyncWholeDashboard(true)

  /** Fetch every order via GET orders/<id>, upsert order + line items. Runs until all orders done. */
  const handleSyncAllOrdersLineItems = async () => {
    setSyncingAllOrders(true)
    setSyncStatus(null)
    let offset = 0
    let totalSynced = 0
    let totalErrors = 0
    let total = 0
    try {
      for (;;) {
        const res = await fetch('/api/sync/all-orders-line-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset, limit: 12 }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setSyncStatus({ success: false, message: data.error || 'Sync failed' })
          break
        }
        total = data.total ?? 0
        totalSynced += data.synced ?? 0
        totalErrors += data.errors ?? 0
        setSyncStatus({
          success: true,
          message: data.hasMore
            ? `Syncing... ${offset + (data.synced ?? 0)}/${total} orders (${totalSynced} synced, ${totalErrors} errors). Keep going...`
            : `Done. Synced ${totalSynced}/${total} orders; ${totalErrors} errors. Line items are now in the dashboard.`,
        })
        if (!data.hasMore) {
          setTimeout(() => router.refresh(), 2000)
          break
        }
        offset = data.nextOffset ?? offset + 12
      }
    } catch (e) {
      setSyncStatus({
        success: false,
        message: 'Network error. You can click again to continue from where you left off.',
      })
    } finally {
      setSyncingAllOrders(false)
    }
  }

  const handleRefreshProductStock = async () => {
    setRefreshingStock(true)
    setSyncStatus(null)
    try {
      const res = await fetch('/api/sync/product-stock', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSyncStatus({
          success: true,
          message: data.message || `Updated stock for ${data.updated ?? 0} products.`,
        })
        setTimeout(() => router.refresh(), 2000)
      } else {
        setSyncStatus({ success: false, message: data.error || 'Failed to refresh product stock' })
      }
    } catch (e) {
      setSyncStatus({ success: false, message: 'An error occurred while refreshing product stock' })
    } finally {
      setRefreshingStock(false)
    }
  }

  const handleBackfillLineItemCosts = async () => {
    setBackfillingCosts(true)
    setSyncStatus(null)
    try {
      const res = await fetch('/api/admin/backfill-line-item-costs', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSyncStatus({
          success: true,
          message: data.updated
            ? `Backfilled ${data.updated} line items with product costs.`
            : data.message || 'Line item costs backfilled.',
        })
        setTimeout(() => router.refresh(), 2000)
      } else {
        setSyncStatus({ success: false, message: data.error || 'Failed to backfill line item costs' })
      }
    } catch (e) {
      setSyncStatus({ success: false, message: 'An error occurred while backfilling costs' })
    } finally {
      setBackfillingCosts(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-3 sm:p-4 lg:p-6 xl:p-8">
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-2">
                Manage your dashboard settings
              </p>
            </div>

            {/* Data Sync Settings */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Data Synchronization</CardTitle>
                <CardDescription>
                  Sync orders and line items from WooCommerce so the dashboard stays up to date
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {syncStatus && (
                    <Alert variant={syncStatus.success ? 'default' : 'destructive'}>
                      {syncStatus.success ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertDescription>{syncStatus.message}</AlertDescription>
                    </Alert>
                  )}

                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Sync whole dashboard</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Fetch orders and products from WooCommerce. Use incremental to bring in new data, or full resync to refresh all products and orders.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => handleSyncWholeDashboard(false)}
                        disabled={syncingDashboard || syncingAllOrders}
                        className="flex items-center gap-2"
                      >
                        {syncingDashboard ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <Database className="h-4 w-4" />
                            Sync (incremental)
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleFullResync}
                        disabled={syncingDashboard || syncingAllOrders}
                        className="flex items-center gap-2"
                        title="Re-fetch all products and orders from WooCommerce"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Full resync (products + orders)
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Sync all orders</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Fetches every order from WooCommerce (<code className="text-xs bg-muted px-1 rounded">GET /orders/&lt;id&gt;</code>), upserts each order and its line items. Includes line items so each order page shows products. Runs in batches.
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      For a full sync with no timeout, run in terminal: <code className="text-xs bg-muted px-1 rounded">npm run sync-line-items</code>
                    </p>
                    <Button
                      onClick={handleSyncAllOrdersLineItems}
                      disabled={syncingAllOrders || syncingDashboard}
                      className="flex items-center gap-2"
                    >
                      {syncingAllOrders ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Syncing orders...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Sync all orders &amp; line items
                        </>
                      )}
                    </Button>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Refresh product stock from WooCommerce</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Calls <code className="text-xs bg-muted px-1 rounded">GET /products/&lt;id&gt;</code> for each product and updates current stock and stock status so dashboard reflects real-time levels (no negative stock).
                    </p>
                    <Button
                      onClick={handleRefreshProductStock}
                      disabled={refreshingStock || syncingDashboard || syncingAllOrders}
                      className="flex items-center gap-2"
                    >
                      {refreshingStock ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Refreshing stock...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Refresh product stock
                        </>
                      )}
                    </Button>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Backfill line item costs</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      For line items with 0 cost, copy our_cost from the products table. DB triggers will recompute margins and profit.
                    </p>
                    <Button
                      onClick={handleBackfillLineItemCosts}
                      disabled={backfillingCosts || syncingDashboard}
                      className="flex items-center gap-2"
                    >
                      {backfillingCosts ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Backfilling...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Backfill Line Item Costs
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <strong>Vici Peptides Dashboard</strong> - Real-time analytics and order management
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
