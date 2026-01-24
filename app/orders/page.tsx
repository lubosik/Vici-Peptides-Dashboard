import { Sidebar } from '@/components/sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getOrders, getOrderStatuses, type OrderFilters } from '@/lib/queries/orders'
import { formatCurrency, formatPercent } from '@/lib/metrics/calculations'
import Link from 'next/link'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'

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
  const filters: OrderFilters = {
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
    [ordersData, statuses] = await Promise.all([
      getOrders(supabase, filters, page, 20, sortBy, sortOrder),
      getOrderStatuses(supabase),
    ])
  } catch (error) {
    console.error('Error fetching orders:', error)
    hasError = true
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
    // Provide fallback values
    ordersData = {
      orders: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    }
    statuses = []
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto lg:ml-0">
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Orders</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-2">
                Manage and view all orders
              </p>
              {hasError && (
                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ Error loading orders: {errorMessage}
                  </p>
                </div>
              )}
            </div>
            <Button variant="outline" asChild>
              <a href={`/api/orders/export?${new URLSearchParams({
                ...(searchParams.status && { status: searchParams.status }),
                ...(searchParams.search && { search: searchParams.search }),
                ...(searchParams.dateFrom && { dateFrom: searchParams.dateFrom }),
                ...(searchParams.dateTo && { dateTo: searchParams.dateTo }),
              }).toString()}`}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </a>
            </Button>
          </div>

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
                    defaultValue={searchParams.search}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select name="status" defaultValue={searchParams.status}>
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
                    defaultValue={searchParams.dateFrom}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Date To</label>
                  <Input
                    type="date"
                    name="dateTo"
                    defaultValue={searchParams.dateTo}
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
              <CardTitle>
                Orders ({ordersData.total})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersData.orders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No orders found. {ordersData.total === 0 ? 'Import orders to get started.' : 'Try adjusting your filters.'}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Link href={`/orders?${new URLSearchParams({ ...searchParams, sortBy: 'order_number', sortOrder: sortBy === 'order_number' && sortOrder === 'asc' ? 'desc' : 'asc' }).toString()}`}>
                            Order #
                          </Link>
                        </TableHead>
                        <TableHead>
                          <Link href={`/orders?${new URLSearchParams({ ...searchParams, sortBy: 'order_date', sortOrder: sortBy === 'order_date' && sortOrder === 'asc' ? 'desc' : 'asc' }).toString()}`}>
                            Date
                          </Link>
                        </TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">
                          <Link href={`/orders?${new URLSearchParams({ ...searchParams, sortBy: 'order_total', sortOrder: sortBy === 'order_total' && sortOrder === 'asc' ? 'desc' : 'asc' }).toString()}`}>
                            Total
                          </Link>
                        </TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordersData.orders.map((order) => (
                        <TableRow key={order.order_number}>
                          <TableCell className="font-medium">
                            <Link 
                              href={`/orders/${encodeURIComponent(order.order_number)}`}
                              className="text-primary hover:underline"
                            >
                              {order.order_number}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {new Date(order.order_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{order.customer_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {order.customer_email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${
                              order.order_status === 'completed' ? 'bg-green-100 text-green-800' :
                              order.order_status === 'processing' ? 'bg-blue-100 text-blue-800' :
                              order.order_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {order.order_status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(order.order_total)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(order.order_profit)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPercent(order.profit_margin)}
                          </TableCell>
                          <TableCell className="text-right">
                            {order.line_items_count}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/orders/${encodeURIComponent(order.order_number)}`}>
                                View
                              </Link>
                            </Button>
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
                            <Link href={`/orders?${new URLSearchParams({ ...searchParams, page: String(page - 1) }).toString()}`}>
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Previous
                            </Link>
                          </Button>
                        )}
                        {page < ordersData.totalPages && (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/orders?${new URLSearchParams({ ...searchParams, page: String(page + 1) }).toString()}`}>
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
  )
}
