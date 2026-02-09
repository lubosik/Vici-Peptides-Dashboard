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
  const [resyncingShippo, setResyncingShippo] = useState(false)
  const [syncingInvoices, setSyncingInvoices] = useState(false)
  const [backfillingCosts, setBackfillingCosts] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{ success: boolean; message: string } | null>(null)

  const handleSyncWholeDashboard = async () => {
    setSyncingDashboard(true)
    setSyncStatus(null)
    try {
      const response = await fetch('/api/sync/woocommerce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'incremental',
          orders: true,
          products: true,
          coupons: true,
        }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        const orders = data.results?.orders
        const msg = orders
          ? `Synced ${orders.synced ?? 0} orders${orders.errors ? `, ${orders.errors} errors` : ''}.`
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

  const handleSyncLineItems = async () => {
    setSyncing(true)
    setSyncStatus(null)
    try {
      const response = await fetch('/api/settings/sync-line-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await response.json()
      if (response.ok) {
        setSyncStatus({
          success: true,
          message: `Synced line items for ${data.synced ?? 0} orders.${data.errors > 0 ? ` ${data.errors} errors.` : ''}${data.message ? ` ${data.message}` : ''}`,
        })
        setTimeout(() => router.refresh(), 2000)
      } else {
        setSyncStatus({
          success: false,
          message: data.error || 'Failed to sync line items',
        })
      }
    } catch (error) {
      setSyncStatus({
        success: false,
        message: 'An error occurred while syncing line items',
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncShippoInvoices = async () => {
    setSyncingInvoices(true)
    setSyncStatus(null)
    try {
      const res = await fetch('/api/admin/sync-shippo-invoices', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSyncStatus({
          success: true,
          message:
            data.created > 0
              ? `Created ${data.created} expense(s) from Shippo invoices.`
              : data.message || 'Shippo invoices synced.',
        })
        setTimeout(() => router.refresh(), 2000)
      } else {
        setSyncStatus({ success: false, message: data.error || 'Failed to sync Shippo invoices' })
      }
    } catch (e) {
      setSyncStatus({ success: false, message: 'An error occurred while syncing Shippo invoices' })
    } finally {
      setSyncingInvoices(false)
    }
  }

  const handleResyncShippoExpenses = async () => {
    setResyncingShippo(true)
    setSyncStatus(null)
    try {
      const res = await fetch('/api/admin/resync-shippo-expenses', { method: 'POST' })
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
                      Fetch all updated orders (and products) from WooCommerce. Use this to bring in new orders and keep the dashboard live.
                    </p>
                    <Button
                      onClick={handleSyncWholeDashboard}
                      disabled={syncingDashboard || syncing}
                      className="flex items-center gap-2"
                    >
                      {syncingDashboard ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Syncing dashboard...
                        </>
                      ) : (
                        <>
                          <Database className="h-4 w-4" />
                          Sync all orders from WooCommerce
                        </>
                      )}
                    </Button>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Sync line items only</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Fetch line items from WooCommerce for orders that are missing them. Ensures every order detail page shows what products were ordered.
                    </p>
                    <Button
                      onClick={handleSyncLineItems}
                      disabled={syncing || syncingDashboard}
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
                    <p className="text-sm font-medium text-foreground mb-1">Sync Shippo invoices (recommended)</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Pull PAID invoices from Shippo Invoices API into expenses. No Make.com needed.
                    </p>
                    <Button
                      onClick={handleSyncShippoInvoices}
                      disabled={syncingInvoices || syncing || syncingDashboard}
                      className="flex items-center gap-2"
                    >
                      {syncingInvoices ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Sync Shippo Invoices
                        </>
                      )}
                    </Button>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Re-sync Shippo expenses (label costs)</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Re-fetch actual label costs from Shippo Transactions API and update existing Shippo expenses with correct amounts.
                    </p>
                    <Button
                      onClick={handleResyncShippoExpenses}
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
