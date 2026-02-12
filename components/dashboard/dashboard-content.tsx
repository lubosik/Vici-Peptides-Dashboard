'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardKPIs } from '@/lib/metrics/queries'
import { ExpenseSummary } from '@/lib/queries/expenses'
import { RevenueChart } from '@/components/charts/revenue-chart'
import { NetProfitChart } from '@/components/charts/net-profit-chart'
import { ExpensesChart } from '@/components/charts/expenses-chart'
import { formatCurrency, formatPercent } from '@/lib/metrics/calculations'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface DashboardContentProps {
  kpis: DashboardKPIs
  revenueData: Array<{ date: string; revenue: number; profit: number; orders: number }>
  netProfitData: Array<{ date: string; revenue: number; expenses: number; netProfit: number }>
  expenseSummary: ExpenseSummary
}

export function DashboardContent({
  kpis,
  revenueData,
  netProfitData,
  expenseSummary,
}: DashboardContentProps) {
  const periodChange = kpis.periodChange

  const TrendIcon = ({ value }: { value: number }) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-600" />
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-600" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-0">
      {/* Page Title */}
      <div className="pt-2 sm:pt-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">Overview of your business metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(kpis.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        {/* Total Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalOrders.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendIcon value={periodChange.orders.percent} />
              <span className="ml-1">
                {periodChange.orders.percent > 0 ? '+' : ''}
                {formatPercent(periodChange.orders.percent)} from last period
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total Profit */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpis.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(kpis.totalProfit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
            <p className="text-xs text-muted-foreground mt-1">
              Margin: {formatPercent(kpis.profitMargin)}
            </p>
          </CardContent>
        </Card>

        {/* Active Products */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.activeProducts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Products in stock</p>
          </CardContent>
        </Card>
      </div>

      {/* Net Profit & Expenses Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Net Profit</CardTitle>
            <CardDescription>After all expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(kpis.netProfit)}</div>
            <p className="text-sm text-muted-foreground mt-2">
              Margin: {formatPercent(kpis.netProfitMargin)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue: {formatCurrency(kpis.totalRevenue)} - Expenses: {formatCurrency(kpis.totalExpenses)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Expenses</CardTitle>
            <CardDescription>All business expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{formatCurrency(kpis.totalExpenses)}</div>
            <p className="text-sm text-muted-foreground mt-2">
              Expense Ratio: {formatPercent((kpis.totalExpenses / kpis.totalRevenue) * 100)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Revenue & Profit Over Time</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Net Profit Over Time</CardTitle>
            <CardDescription>Revenue - Expenses (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <NetProfitChart data={netProfitData} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expenses by Category</CardTitle>
          <CardDescription>Breakdown of expenses</CardDescription>
        </CardHeader>
        <CardContent>
          <ExpensesChart data={expenseSummary.expensesByCategory} />
        </CardContent>
      </Card>
    </div>
  )
}
