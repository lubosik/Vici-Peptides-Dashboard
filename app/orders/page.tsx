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
import Link from 'next/link'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { DeleteOrderButton } from '@/components/orders/delete-order-button'

// Force dynamic rendering to ensure real-time data from Supabase
export const dynamic = 'force-dynamic'

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

  let ordersData: any = {
    orders: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  }
  let statuses: string[] = []
  let hasError = false
  let errorMessage = ''

  try {
    // Fetch real orders from Supabase
    ordersData = await getOrders(supabase, filters, page, 20, sortBy, sortOrder)
    statuses = await getOrderStatuses(supabase)
  } catch (error) {
    console.error('Error fetching orders:', error)
    hasError = true
    errorMessage = error instanceof Error ? error.message : 'Failed to load orders'
  }

  // Build URL with current params for navigation
  const buildUrl = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams()
    
    // Keep existing params
    if (searchParams.page && !updates.page) params.set('page', searchParams.page)
    if (searchParams.status && !updates.status) params.set('status', searchParams.status)
    if (searchParams.search && !updates.search) params.set('search', searchParams.search)
    if (searchParams.dateFrom && !updates.dateFrom) params.set('dateFrom', searchParams.dateFrom)
    if (searchParams.dateTo && !updates.dateTo) params.set('dateTo', searchParams.dateTo)
    if (searchParams.sortBy && !updates.sortBy) params.set('sortBy', searchParams.sortBy)
    if (searchParams.sortOrder && !updates.sortOrder) params.set('sortOrder', searchParams.sortOrder)
    
    // Apply updates
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
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
            <div className="mb-4 sm:mb-6 lg:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pt-2 sm:pt-0">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Orders</h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-2">
                  Manage and view all orders from WooCommerce
                </p>
              </div>
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
              <CardHeader>
                <CardTitle>Filters</CardTitle>
                <CardDescription>Filter orders by status, date, or search</CardDescription>
              </CardHeader>
              <CardContent>
                <form method="get" className="grid gap-4 md:grid-cols-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Search</label>
                    <Input
                      name="search"
                      placeholder="Order #, customer, email..."
                      defaultValue={filters.search}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select name="status" defaultValue={filters.status || ''}>
                      <option value="">All Statuses</option>
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date From</label>
                    <Input
                      type="date"
                      name="dateFrom"
                      defaultValue={filters.dateFrom}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date To</label>
                    <Input
                      type="date"
                      name="dateTo"
                      defaultValue={filters.dateTo}
                    />
                  </div>
                  <div className="md:col-span-4 flex gap-2">
                    <Button type="submit">Apply Filters</Button>
                    <Button type="button" variant="outline" asChild>
                      <Link href="/orders">Clear</Link>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Orders Table */}
            <Card>
              <CardHeader>
                <CardTitle>Orders ({ordersData.total})</CardTitle>
                <CardDescription>Real-time orders from WooCommerce</CardDescription>
              </CardHeader>
              <CardContent>
                {ordersData.orders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {hasError ? 'Error loading orders. Please try again.' : 'No orders found.'}
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Shipping cost</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                          <TableHead className="text-right">Items</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ordersData.orders.map((order: any) => (
                          <TableRow key={order.order_number}>
                            <TableCell className="font-medium">
                              <Link
                                href={`/orders/${order.woo_order_id != null ? order.woo_order_id : encodeURIComponent(order.order_number)}`}
                                className="text-primary hover:underline"
                              >
                                {order.order_number}
                              </Link>
                            </TableCell>
                            <TableCell>
                              {order.order_date 
                                ? new Date(order.order_date).toLocaleDateString()
                                : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{order.customer_name || 'N/A'}</div>
                                <div className="text-sm text-muted-foreground">
                                  {order.customer_email || ''}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${
                                order.order_status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                order.order_status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                                order.order_status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {order.order_status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(order.order_total)}
                            </TableCell>
                            <TableCell className="text-right">
                              {(order.shipping_cost ?? 0) > 0 ? (
                                <Link
                                  href={`/expenses?search=${encodeURIComponent(order.order_number)}`}
                                  className="text-primary hover:underline"
                                  title="View in Expenses"
                                >
                                  {formatCurrency(order.shipping_cost ?? 0)}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className={`text-right ${(order.net_profit ?? order.order_profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(order.net_profit ?? order.order_profit)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPercent(order.net_margin ?? order.profit_margin)}
                            </TableCell>
                            <TableCell className="text-right">
                              {order.line_items_count || 0}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 justify-end">
                                <DeleteOrderButton
                                  orderNumber={order.order_number}
                                  wooOrderId={order.woo_order_id}
                                  label={order.order_number}
                                />
                                <Button variant="ghost" size="sm" asChild>
                                  <Link href={`/orders/${order.woo_order_id != null ? order.woo_order_id : encodeURIComponent(order.order_number)}`}>
                                    View
                                  </Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination */}
                    {ordersData.totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-muted-foreground">
                          Page {ordersData.page} of {ordersData.totalPages} ({ordersData.total} total)
                        </div>
                        <div className="flex gap-2">
                          {page > 1 && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={buildUrl({ page: String(page - 1) })}>
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                              </Link>
                            </Button>
                          )}
                          {page < ordersData.totalPages && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={buildUrl({ page: String(page + 1) })}>
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
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
