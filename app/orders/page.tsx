'use client'

import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatPercent } from '@/lib/metrics/calculations'
import Link from 'next/link'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { useDemoOrders, useDemoOrderStatuses } from '@/lib/demo/hooks'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDemoStore } from '@/lib/demo/store'

export default function OrdersPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const store = useDemoStore()
  
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (store.orders.length === 0 && store.products.length === 0) {
      store.resetData()
    }
    setInitialized(true)
  }, [store])

  const page = parseInt(searchParams.get('page') || '1')
  const filters = {
    status: searchParams.get('status') || undefined,
    search: searchParams.get('search') || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
  }
  const sortBy = searchParams.get('sortBy') || 'order_date'
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

  const ordersData = useDemoOrders(filters, page, 20, sortBy, sortOrder)
  const statuses = useDemoOrderStatuses()

  if (!initialized) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-6 lg:p-8">
              <div className="text-center py-12">Loading...</div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    router.push(`/orders?${params.toString()}`)
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Orders</h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-2">
                  Manage and view all orders
                </p>
              </div>
            </div>

            {/* Filters */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Filters</CardTitle>
                <CardDescription>Filter orders by status, date, or search</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Search</label>
                    <Input
                      placeholder="Order #, customer, email..."
                      defaultValue={filters.search}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateSearchParams({ search: e.currentTarget.value || null })
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select
                      defaultValue={filters.status || ''}
                      onChange={(e) => updateSearchParams({ status: e.target.value || null })}
                    >
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
                      defaultValue={filters.dateFrom}
                      onChange={(e) => updateSearchParams({ dateFrom: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date To</label>
                    <Input
                      type="date"
                      defaultValue={filters.dateTo}
                      onChange={(e) => updateSearchParams({ dateTo: e.target.value || null })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Orders Table */}
            <Card>
              <CardHeader>
                <CardTitle>Orders ({ordersData.total})</CardTitle>
              </CardHeader>
              <CardContent>
                {ordersData.orders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No orders found.
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
                            <Button variant="outline" size="sm" onClick={() => updateSearchParams({ page: String(page - 1) })}>
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Previous
                            </Button>
                          )}
                          {page < ordersData.totalPages && (
                            <Button variant="outline" size="sm" onClick={() => updateSearchParams({ page: String(page + 1) })}>
                              Next
                              <ChevronRight className="h-4 w-4 ml-1" />
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
