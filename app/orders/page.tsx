import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getOrders, getOrderStatuses } from '@/lib/queries/orders'
import { formatCurrency, formatPercent } from '@/lib/metrics/calculations'
import { formatDateInMiami } from '@/lib/datetime'
import Link from 'next/link'
import { Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { DeleteOrderButton } from '@/components/orders/delete-order-button'
import { SyncOrdersButton } from '@/components/orders/sync-orders-button'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  completed:        { label: 'Completed',  dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40',  text: 'text-emerald-700 dark:text-emerald-400' },
  processing:       { label: 'Processing', dot: 'bg-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/40',        text: 'text-blue-700 dark:text-blue-400' },
  shipped:          { label: 'Shipped',    dot: 'bg-violet-500',  bg: 'bg-violet-50 dark:bg-violet-950/40',    text: 'text-violet-700 dark:text-violet-400' },
  'on-hold':        { label: 'On Hold',    dot: 'bg-amber-500',   bg: 'bg-amber-50 dark:bg-amber-950/40',      text: 'text-amber-700 dark:text-amber-400' },
  cancelled:        { label: 'Cancelled',  dot: 'bg-red-500',     bg: 'bg-red-50 dark:bg-red-950/40',          text: 'text-red-700 dark:text-red-400' },
  refunded:         { label: 'Refunded',   dot: 'bg-slate-400',   bg: 'bg-slate-100 dark:bg-slate-800/40',     text: 'text-slate-600 dark:text-slate-400' },
  'checkout-draft': { label: 'Draft',      dot: 'bg-slate-300',   bg: 'bg-slate-100 dark:bg-slate-800/40',     text: 'text-slate-500 dark:text-slate-400' },
  failed:           { label: 'Failed',     dot: 'bg-red-400',     bg: 'bg-red-50 dark:bg-red-950/40',          text: 'text-red-600 dark:text-red-400' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    dot: 'bg-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800/40',
    text: 'text-slate-600 dark:text-slate-400',
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap', cfg.bg, cfg.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface OrdersPageProps {
  searchParams: {
    page?: string
    status?: string
    search?: string
    dateFrom?: string
    dateTo?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const supabase = await createClient()

  const page = parseInt(searchParams.page || '1')
  const filters = {
    status: searchParams.status,
    search: searchParams.search,
    dateFrom: searchParams.dateFrom,
    dateTo: searchParams.dateTo,
  }
  const sortBy = searchParams.sortBy || 'order_date'
  const sortOrder = searchParams.sortOrder || 'desc'

  let ordersData: any = { orders: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }
  let statuses: string[] = []
  let hasError = false
  let errorMessage = ''

  try {
    ordersData = await getOrders(supabase, filters, page, 20, sortBy, sortOrder)
    statuses = await getOrderStatuses(supabase)
  } catch (error) {
    console.error('Error fetching orders:', error)
    hasError = true
    errorMessage = error instanceof Error ? error.message : 'Failed to load orders'
  }

  const buildUrl = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams()
    if (searchParams.page && !updates.page) params.set('page', searchParams.page)
    if (searchParams.status && !updates.status) params.set('status', searchParams.status)
    if (searchParams.search && !updates.search) params.set('search', searchParams.search)
    if (searchParams.dateFrom && !updates.dateFrom) params.set('dateFrom', searchParams.dateFrom)
    if (searchParams.dateTo && !updates.dateTo) params.set('dateTo', searchParams.dateTo)
    if (searchParams.sortBy && !updates.sortBy) params.set('sortBy', searchParams.sortBy)
    if (searchParams.sortOrder && !updates.sortOrder) params.set('sortOrder', searchParams.sortOrder)
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value)
      else params.delete(key)
    })
    return `/orders?${params.toString()}`
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-3 sm:p-4 lg:p-6 xl:p-8">
            {/* Page header */}
            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 sm:pt-0">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Orders</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {ordersData.total > 0 ? `${ordersData.total.toLocaleString()} total orders` : 'Manage orders from WooCommerce'}
                </p>
              </div>
              <SyncOrdersButton />
            </div>

            {hasError && (
              <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Error loading orders: {errorMessage}
                </p>
              </div>
            )}

            {/* Filters */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Filter Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Search</label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        name="search"
                        placeholder="Order #, customer, email…"
                        defaultValue={filters.search}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
                    <Select name="status" defaultValue={filters.status || ''}>
                      <option value="">All Statuses</option>
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_CONFIG[status]?.label ?? status}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date From</label>
                    <Input type="date" name="dateFrom" defaultValue={filters.dateFrom} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date To</label>
                    <Input type="date" name="dateTo" defaultValue={filters.dateTo} />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
                    <Button type="submit" size="sm">Apply Filters</Button>
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link href="/orders">Clear</Link>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Orders Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Orders {ordersData.total > 0 && <span className="text-muted-foreground font-normal text-sm">({ordersData.total.toLocaleString()})</span>}
                </CardTitle>
                <CardDescription>Real-time orders from WooCommerce</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {ordersData.orders.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground px-6">
                    <ShoppingCartIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">{hasError ? 'Error loading orders. Please try again.' : 'No orders found.'}</p>
                    {!hasError && <p className="text-sm mt-1">Try adjusting your filters or sync from WooCommerce</p>}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-b border-border/50">
                            <TableHead className="text-xs">Order</TableHead>
                            <TableHead className="text-xs">Date</TableHead>
                            <TableHead className="text-xs">Customer</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs text-right">Total</TableHead>
                            <TableHead className="text-xs text-right">Shipping</TableHead>
                            <TableHead className="text-xs text-right">Profit</TableHead>
                            <TableHead className="text-xs text-right">Margin</TableHead>
                            <TableHead className="text-xs text-center">Items</TableHead>
                            <TableHead className="text-xs">Tracking</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ordersData.orders.map((order: any) => (
                            <TableRow key={order.order_number} className="hover:bg-muted/30 transition-colors">
                              <TableCell className="font-medium">
                                <Link
                                  href={`/orders/${order.woo_order_id != null ? order.woo_order_id : encodeURIComponent(order.order_number)}`}
                                  className="text-primary hover:underline text-sm"
                                >
                                  {order.order_number}
                                </Link>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {order.order_date ? formatDateInMiami(order.order_date) : 'N/A'}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="text-sm font-medium">{order.customer_name || 'N/A'}</div>
                                  <div className="text-xs text-muted-foreground">{order.customer_email || ''}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={order.order_status} />
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {formatCurrency(order.order_total)}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {(order.shipping_cost ?? 0) > 0
                                  ? formatCurrency(order.shipping_cost ?? 0)
                                  : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className={`text-right text-sm font-medium ${(order.net_profit ?? order.order_profit) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(order.net_profit ?? order.order_profit)}
                              </TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">
                                {formatPercent(order.net_margin ?? order.profit_margin)}
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {order.line_items_count || 0}
                              </TableCell>
                              <TableCell className="text-sm">
                                {order.tracking_number ? (
                                  <a
                                    href={`https://www.google.com/search?q=${encodeURIComponent(order.tracking_number)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                                  >
                                    {order.tracking_number.length > 16
                                      ? order.tracking_number.slice(0, 16) + '…'
                                      : order.tracking_number}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 justify-end">
                                  <Button variant="ghost" size="sm" asChild className="h-7 text-xs px-2">
                                    <Link href={`/orders/${order.woo_order_id != null ? order.woo_order_id : encodeURIComponent(order.order_number)}`}>
                                      View
                                    </Link>
                                  </Button>
                                  <DeleteOrderButton
                                    orderNumber={order.order_number}
                                    wooOrderId={order.woo_order_id}
                                    label={order.order_number}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {ordersData.totalPages > 1 && (
                      <div className="flex items-center justify-between px-6 py-4 border-t border-border/50">
                        <div className="text-sm text-muted-foreground">
                          Page {ordersData.page} of {ordersData.totalPages} · {ordersData.total.toLocaleString()} orders
                        </div>
                        <div className="flex gap-2">
                          {page > 1 && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={buildUrl({ page: String(page - 1) })}>
                                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                              </Link>
                            </Button>
                          )}
                          {page < ordersData.totalPages && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={buildUrl({ page: String(page + 1) })}>
                                Next <ChevronRight className="h-4 w-4 ml-1" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}

// Inline icon to avoid extra import
function ShoppingCartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}
