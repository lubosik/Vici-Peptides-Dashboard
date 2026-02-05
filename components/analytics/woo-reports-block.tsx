'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePeriodicRefetch } from '@/lib/hooks/use-periodic-refetch'
import { RefreshCw } from 'lucide-react'

type ReportPeriod = 'week' | 'month' | 'last_month' | 'year'

interface TopSellerItem {
  title: string
  product_id: number
  quantity: number
}

interface SalesReportItem {
  total_sales?: string
  net_sales?: string
  total_orders?: number
  total_items?: number
  total_tax?: string
  total_shipping?: string
  total_discount?: string
  totals_grouped_by?: string
  totals?: Record<string, { sales?: string; orders?: number; items?: number }>
}

interface OrdersTotalItem {
  slug: string
  name: string
  total: number
}

export function WooReportsBlock() {
  const [period, setPeriod] = useState<ReportPeriod>('month')
  const [topSellers, setTopSellers] = useState<TopSellerItem[]>([])
  const [sales, setSales] = useState<SalesReportItem | null>(null)
  const [ordersTotals, setOrdersTotals] = useState<OrdersTotalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReports = async () => {
    setError(null)
    try {
      const [topRes, salesRes, ordersRes] = await Promise.all([
        fetch(`/api/woo/reports?type=top_sellers&period=${period}`),
        fetch(`/api/woo/reports?type=sales&period=${period}`),
        fetch('/api/woo/reports?type=orders_totals'),
      ])

      if (!topRes.ok) throw new Error('Failed to fetch top sellers')
      if (!salesRes.ok) throw new Error('Failed to fetch sales')
      if (!ordersRes.ok) throw new Error('Failed to fetch orders totals')

      const [topData, salesData, ordersData] = await Promise.all([
        topRes.json(),
        salesRes.json(),
        ordersRes.json(),
      ])

      setTopSellers(Array.isArray(topData) ? topData : [])
      setSales(Array.isArray(salesData) && salesData[0] ? salesData[0] : null)
      setOrdersTotals(Array.isArray(ordersData) ? ordersData : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load WooCommerce reports')
      setTopSellers([])
      setSales(null)
      setOrdersTotals([])
    } finally {
      setLoading(false)
    }
  }

  usePeriodicRefetch({
    refetch: fetchReports,
    intervalMs: 60000,
    enabled: true,
  })

  useEffect(() => {
    setLoading(true)
    fetchReports()
  }, [period])

  if (loading && topSellers.length === 0 && !sales) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>WooCommerce Reports</CardTitle>
          <CardDescription>Live data from your store (refreshes every 60s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && topSellers.length === 0 && !sales) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>WooCommerce Reports</CardTitle>
          <CardDescription>Live data from your store</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">Ensure WooCommerce API credentials are set.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
      {/* Top sellers from WooCommerce API */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Top Sellers (WooCommerce)</CardTitle>
          <select
            className="text-xs border rounded px-2 py-1 bg-background"
            value={period}
            onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
          >
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="last_month">Last month</option>
            <option value="year">This year</option>
          </select>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Refreshes every 60s</p>
          {topSellers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No top sellers for this period</p>
          ) : (
            <ul className="space-y-2">
              {topSellers.slice(0, 10).map((item, i) => (
                <li key={`${item.product_id}-${i}`} className="flex justify-between text-sm">
                  <span className="truncate pr-2">{item.title}</span>
                  <span className="font-medium whitespace-nowrap">{item.quantity} sold</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Sales summary from WooCommerce API */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Report (WooCommerce)</CardTitle>
          <CardDescription>Period: {period}</CardDescription>
        </CardHeader>
        <CardContent>
          {sales ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total sales</span>
                <span className="font-medium">${sales.total_sales ?? '0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net sales</span>
                <span className="font-medium">${sales.net_sales ?? '0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Orders</span>
                <span className="font-medium">{sales.total_orders ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items</span>
                <span className="font-medium">{sales.total_items ?? 0}</span>
              </div>
              {(sales.total_shipping && parseFloat(sales.total_shipping) > 0) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium">${sales.total_shipping}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sales data for this period</p>
          )}
        </CardContent>
      </Card>

      {/* Orders totals by status */}
      <Card>
        <CardHeader>
          <CardTitle>Orders by Status (WooCommerce)</CardTitle>
          <CardDescription>Current totals</CardDescription>
        </CardHeader>
        <CardContent>
          {ordersTotals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {ordersTotals.map((row) => (
                <li key={row.slug} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{row.name}</span>
                  <span className="font-medium">{row.total}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
