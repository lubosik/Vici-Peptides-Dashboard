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
  const [syncing, setSyncing] = useState(false)
  const [syncingDashboard, setSyncingDashboard] = useState(false)
  const [syncingAllOrders, setSyncingAllOrders] = useState(false)
  const [resyncingShippo, setResyncingShippo] = useState(false)
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

  const handleSyncLineItems = async () => {
    setSyncing(true)
    setSyncStatus(null)
    const MAX_BATCHES = 20
    let totalSynced = 0
    let totalErrors = 0
    let batchCount = 0
    try {
      for (let i = 0; i < MAX_BATCHES; i++) {
        const response = await fetch('/api/settings/sync-line-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (response.status === 504) {
          setSyncStatus({
            success: false,
            message: 'Request timed out. You can click again to sync more.',
          })
          break
        }
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          setSyncStatus({
            success: false,
            message: data.error || 'Failed to sync line items',
          })
          break
        }
        totalSynced += data.synced ?? 0
        totalErrors += data.errors ?? 0
        batchCount++
        if (!data.hasMore) {
          setSyncStatus({
            success: true,
            message: `Synced line items for ${totalSynced} orders.${totalErrors > 0 ? ` ${totalErrors} errors.` : ''}${data.message ? ` ${data.message}` : ''}`,
          })
          setTimeout(() => router.refresh(), 2000)
          break
        }
        setSyncStatus({
          success: true,
          message: `Syncing... ${totalSynced} orders so far (batch ${batchCount})`,
        })
      }
      if (batchCount >= MAX_BATCHES && totalSynced > 0) {
        setSyncStatus({
          success: true,
          message: `Synced ${totalSynced} orders (max batches reached). Click again to sync more if needed.`,
        })
        setTimeout(() => router.refresh(), 2000)
      }
    } catch (error) {
      setSyncStatus({
        success: false,
        message: 'Network error. Check your connection and try again.',
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleResyncShippoExpenses = async (forceAll = false) => {
    setResyncingShippo(true)
    setSyncStatus(null)
    try {
      const url = forceAll ? '/api/admin/resync-shippo-expenses?force=true' : '/api/admin/resync-shippo-expenses'
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSyncStatus({
          success: true,
          message: data.updated
            ? `Updated ${data.updated} Shippo expense amounts from Transactions API.`
            : data.message || 'Shippo expenses resynced.',
        })
        setTimeout(() => router.refresh(), 2000)
      } else {
        setSyncStatus({ success: false, message: data.error || 'Failed to resync Shippo expenses' })
      }
    } catch (e) {
      setSyncStatus({ success: false, message: 'An error occurred while resyncing Shippo expenses' })
    } finally {
      setResyncingShippo(false)
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
                        disabled={syncingDashboard || syncing || syncingAllOrders}
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
                        disabled={syncingDashboard || syncing || syncingAllOrders}
                        className="flex items-center gap-2"
                        title="Re-fetch all products and orders from WooCommerce"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Full resync (products + orders)
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Fetch all orders &amp; line items (GET each order)</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Calls WooCommerce <code className="text-xs bg-muted px-1 rounded">GET /orders/&lt;id&gt;</code> for every order (e.g. 207), then inserts each order and its line items into the dashboard. Use this to backfill or fix missing line items. Runs in batches; click once and wait until done.
                    </p>
                    <Button
                      onClick={handleSyncAllOrdersLineItems}
                      disabled={syncingAllOrders || syncingDashboard}
                      className="flex items-center gap-2"
                    >
                      {syncingAllOrders ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Fetching orders...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Fetch all orders &amp; line items
                        </>
                      )}
                    </Button>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Sync line items only (orders already in DB)</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Fetch line items from WooCommerce for orders that are missing them. Ensures every order detail page shows what products were ordered.
                    </p>
                    <Button
                      onClick={handleSyncLineItems}
                      disabled={syncing || syncingDashboard || syncingAllOrders}
                      className="flex items-center gap-2"
                    >
                      {syncing ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Syncing line items...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Sync Line Items from WooCommerce
                        </>
                      )}
                    </Button>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Re-sync Shippo expenses (label costs)</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Re-fetch rate.amount from Shippo Transactions API (what you pay per label, not what buyer pays). Updates expenses with wrong amounts.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={() => handleResyncShippoExpenses(false)}
                        disabled={resyncingShippo || syncing || syncingDashboard}
                        className="flex items-center gap-2"
                      >
                        {resyncingShippo ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Resyncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            Re-sync Shippo Expenses
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleResyncShippoExpenses(true)}
                        disabled={resyncingShippo || syncing || syncingDashboard}
                        className="flex items-center gap-2"
                        title="Update all 121 expenses with API values (verification pass)"
                      >
                        Force Refresh All
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Backfill line item costs</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      For line items with 0 cost, copy our_cost from the products table. DB triggers will recompute margins and profit.
                    </p>
                    <Button
                      onClick={handleBackfillLineItemCosts}
                      disabled={backfillingCosts || syncing || syncingDashboard}
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
