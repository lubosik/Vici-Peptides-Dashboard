import { Sidebar } from '@/components/sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getOrders } from '@/lib/queries/orders'
import { formatCurrency, formatPercent } from '@/lib/metrics/calculations'
import Link from 'next/link'
import { Download, Search, Filter } from 'lucide-react'

interface RevenuePageProps {
  searchParams: {
    page?: string
    status?: string
    paymentMethod?: string
    couponCode?: string
    freeShipping?: string
    dateFrom?: string
    dateTo?: string
    search?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }
}

export default async function RevenuePage({ searchParams }: RevenuePageProps) {
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
    pageSize: 50,
    totalPages: 0,
  }
  let allOrders: any[] = []
  let hasError = false
  let errorMessage = ''

  try {
    ordersData = await getOrders(supabase, filters, page, 50, sortBy, sortOrder)

    // Get unique payment methods and statuses for filters
    const { data, error } = await supabase
      .from('orders')
      .select('payment_method, order_status, coupon_code, free_shipping')
    
    if (error) throw error
    allOrders = data
  } catch (error) {
    console.error('Error fetching revenue data:', error)
    hasError = true
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
    // Provide fallback values
    ordersData = {
      orders: [],
      total: 0,
      page: 1,
      pageSize: 50,
      totalPages: 0,
    }
    allOrders = []
  }

  const paymentMethods = Array.from(new Set((allOrders || []).map(o => o.payment_method).filter(Boolean)))
  const statuses = Array.from(new Set((allOrders || []).map(o => o.order_status).filter(Boolean)))
  const couponCodes = Array.from(new Set((allOrders || []).map(o => o.coupon_code).filter(Boolean)))

  // Apply additional filters
  let filteredOrders = ordersData.orders
  if (searchParams.paymentMethod) {
    filteredOrders = filteredOrders.filter((o: any) => o.payment_method === searchParams.paymentMethod)
  }
  if (searchParams.couponCode) {
    filteredOrders = filteredOrders.filter((o: any) => o.coupon_code === searchParams.couponCode)
  }
  if (searchParams.freeShipping === 'yes') {
    filteredOrders = filteredOrders.filter((o: any) => o.free_shipping === true)
  } else if (searchParams.freeShipping === 'no') {
    filteredOrders = filteredOrders.filter((o: any) => o.free_shipping === false)
  }

  const totalRevenue = filteredOrders.reduce((sum: number, o: any) => sum + o.order_total, 0)
  const totalProfit = filteredOrders.reduce((sum: number, o: any) => sum + o.order_profit, 0)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto lg:ml-0">
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Revenue</h1>
              <p className="text-muted-foreground mt-2">
                Transactional revenue ledger and time-series explorer
              </p>
              {hasError && (
                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ Error loading revenue data: {errorMessage}
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

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {filteredOrders.length} orders
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(totalProfit)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  After costs
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercent(totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Average margin
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter revenue transactions by multiple criteria</CardDescription>
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
                  <label className="text-sm font-medium mb-2 block">Payment Method</label>
                  <Select name="paymentMethod" defaultValue={searchParams.paymentMethod}>
                    <option value="">All Methods</option>
                    {paymentMethods.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Coupon Code</label>
                  <Select name="couponCode" defaultValue={searchParams.couponCode}>
                    <option value="">All Coupons</option>
                    {couponCodes.filter(Boolean).map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Free Shipping</label>
                  <Select name="freeShipping" defaultValue={searchParams.freeShipping}>
                    <option value="">All</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
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
                    <Link href="/revenue">Clear</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Revenue Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                Revenue Transactions ({filteredOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No revenue transactions found. Try adjusting your filters.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Coupon</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-right">Shipping</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order: any) => {
                      const margin = order.order_total > 0 
                        ? (order.order_profit / order.order_total) * 100 
                        : 0
                      return (
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
                          <TableCell>{order.payment_method || '-'}</TableCell>
                          <TableCell>{order.coupon_code || '-'}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(order.order_subtotal || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(order.shipping_charged || 0)}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {order.coupon_discount > 0 ? `-${formatCurrency(order.coupon_discount)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(order.order_total)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(order.order_profit)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPercent(margin)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
