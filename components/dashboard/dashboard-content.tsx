'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardKPIs } from '@/lib/metrics/queries'
import { ExpenseSummary } from '@/lib/queries/expenses'
import { RevenueChart } from '@/components/charts/revenue-chart'
import { NetProfitChart } from '@/components/charts/net-profit-chart'
import { ExpensesChart } from '@/components/charts/expenses-chart'
import { formatCurrency, formatPercent } from '@/lib/metrics/calculations'
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Clock,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface RecentOrder {
  order_number: string
  woo_order_id: number | null
  customer_name: string | null
  order_total: number
  order_status: string
  order_date: string
  tracking_number?: string | null
}

interface DashboardContentProps {
  kpis: DashboardKPIs
  revenueData: Array<{ date: string; revenue: number; profit: number; orders: number }>
  netProfitData: Array<{ date: string; revenue: number; expenses: number; netProfit: number }>
  expenseSummary: ExpenseSummary
  recentOrders?: RecentOrder[]
  period?: string
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  completed:       { label: 'Completed',  dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40',   text: 'text-emerald-700 dark:text-emerald-400' },
  processing:      { label: 'Processing', dot: 'bg-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/40',         text: 'text-blue-700 dark:text-blue-400' },
  shipped:         { label: 'Shipped',    dot: 'bg-violet-500',  bg: 'bg-violet-50 dark:bg-violet-950/40',     text: 'text-violet-700 dark:text-violet-400' },
  'on-hold':       { label: 'On Hold',    dot: 'bg-amber-500',   bg: 'bg-amber-50 dark:bg-amber-950/40',       text: 'text-amber-700 dark:text-amber-400' },
  cancelled:       { label: 'Cancelled',  dot: 'bg-red-500',     bg: 'bg-red-50 dark:bg-red-950/40',           text: 'text-red-700 dark:text-red-400' },
  refunded:        { label: 'Refunded',   dot: 'bg-slate-400',   bg: 'bg-slate-100 dark:bg-slate-800/40',      text: 'text-slate-600 dark:text-slate-400' },
  'checkout-draft':{ label: 'Draft',      dot: 'bg-slate-300',   bg: 'bg-slate-100 dark:bg-slate-800/40',      text: 'text-slate-500 dark:text-slate-400' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, dot: 'bg-slate-400', bg: 'bg-slate-100 dark:bg-slate-800/40', text: 'text-slate-600 dark:text-slate-400' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', cfg.bg, cfg.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

// ─── Trend badge ──────────────────────────────────────────────────────────────

function TrendBadge({ percent }: { percent: number }) {
  if (Math.abs(percent) < 0.01) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        0%
      </span>
    )
  }
  const positive = percent > 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {positive ? '+' : ''}{percent.toFixed(1)}%
    </span>
  )
}

// ─── Date formatter ───────────────────────────────────────────────────────────

function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

// ─── Period selector ──────────────────────────────────────────────────────────

function PeriodSelector({ current }: { current?: string }) {
  const periods = [
    { value: 'all', label: 'All Time' },
    { value: 'month', label: 'This Month' },
    { value: 'week', label: 'This Week' },
  ]
  const active = current || 'all'
  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      {periods.map((p) => (
        <Link
          key={p.value}
          href={`/?period=${p.value}`}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            active === p.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {p.label}
        </Link>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardContent({
  kpis,
  revenueData,
  netProfitData,
  expenseSummary,
  recentOrders = [],
  period,
}: DashboardContentProps) {
  return (
    <div className="space-y-6 px-3 sm:px-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 sm:pt-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of your business metrics</p>
        </div>
        <PeriodSelector current={period} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <Card className="border-border/60 hover:border-border transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(kpis.totalRevenue)}</div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">All time</p>
              <TrendBadge percent={kpis.periodChange.revenue.percent} />
            </div>
          </CardContent>
        </Card>

        {/* Total Orders */}
        <Card className="border-border/60 hover:border-border transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
              <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{kpis.totalOrders.toLocaleString()}</div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">All time</p>
              <TrendBadge percent={kpis.periodChange.orders.percent} />
            </div>
          </CardContent>
        </Card>

        {/* Total Profit */}
        <Card className="border-border/60 hover:border-border transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Profit</CardTitle>
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', kpis.totalProfit >= 0 ? 'bg-violet-100 dark:bg-violet-950/50' : 'bg-red-100 dark:bg-red-950/50')}>
              {kpis.totalProfit >= 0
                ? <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                : <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />}
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', kpis.totalProfit >= 0 ? 'text-foreground' : 'text-red-600')}>
              {formatCurrency(kpis.totalProfit)}
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">Margin: {formatPercent(kpis.profitMargin)}</p>
              <TrendBadge percent={kpis.periodChange.profit.percent} />
            </div>
          </CardContent>
        </Card>

        {/* Active Products */}
        <Card className="border-border/60 hover:border-border transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Products</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center">
              <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{kpis.activeProducts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-2">Products in stock</p>
          </CardContent>
        </Card>
      </div>

      {/* Net Profit & Expenses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={cn('border-l-4', kpis.netProfit >= 0 ? 'border-l-emerald-500' : 'border-l-red-500')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            <CardDescription>After all expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn('text-3xl font-bold', kpis.netProfit >= 0 ? 'text-foreground' : 'text-red-600')}>
              {formatCurrency(kpis.netProfit)}
            </div>
            <p className="text-sm text-muted-foreground mt-2">Margin: {formatPercent(kpis.netProfitMargin)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue: {formatCurrency(kpis.totalRevenue)} — Expenses: {formatCurrency(kpis.totalExpenses)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <CardDescription>All business expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{formatCurrency(kpis.totalExpenses)}</div>
            <p className="text-sm text-muted-foreground mt-2">
              Expense Ratio: {formatPercent(kpis.totalRevenue > 0 ? (kpis.totalExpenses / kpis.totalRevenue) * 100 : 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue &amp; Profit Over Time</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Net Profit Over Time</CardTitle>
            <CardDescription>Revenue − Expenses (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <NetProfitChart data={netProfitData} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders + Expenses side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recent Orders</CardTitle>
              <CardDescription>Latest activity</CardDescription>
            </div>
            <Link href="/orders" className="text-xs text-primary hover:underline font-medium">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground px-6">
                <Clock className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No orders yet</p>
                <p className="text-xs mt-1">Orders will appear here once synced</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {recentOrders.map((order) => {
                  const href = `/orders/${order.woo_order_id ?? encodeURIComponent(order.order_number)}`
                  return (
                    <Link
                      key={order.order_number}
                      href={href}
                      className="flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold text-muted-foreground group-hover:bg-primary/10">
                          {(order.customer_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{order.order_number}</p>
                          <p className="text-xs text-muted-foreground truncate">{order.customer_name || 'Unknown customer'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                        <StatusBadge status={order.order_status} />
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">{formatCurrency(order.order_total)}</p>
                          <p className="text-xs text-muted-foreground">{formatRelativeDate(order.order_date)}</p>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses by Category</CardTitle>
            <CardDescription>Breakdown of all expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <ExpensesChart data={expenseSummary.expensesByCategory} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
