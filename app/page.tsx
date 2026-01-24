import { Sidebar } from '@/components/sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, ShoppingCart, TrendingUp, Package, Receipt } from 'lucide-react'
import { RevenueChart } from '@/components/charts/revenue-chart'
import { ProductsChart } from '@/components/charts/products-chart'
import { NetProfitChart } from '@/components/charts/net-profit-chart'
import { getNetProfitOverTime } from '@/lib/metrics/net-profit'
import { createClient } from '@/lib/supabase/server'
import { getDashboardKPIs, getRevenueOverTime, getTopProducts } from '@/lib/metrics/queries'
import { formatCurrency, formatPercent } from '@/lib/metrics/calculations'
import { WelcomeTour } from '@/components/onboarding/welcome-tour'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Fetch all dashboard data with error handling
  let kpis: any = {
    totalRevenue: 0,
    totalOrders: 0,
    totalProfit: 0,
    profitMargin: 0,
    averageOrderValue: 0,
    activeProducts: 0,
    totalExpenses: 0,
    netProfit: 0,
    netProfitMargin: 0,
    periodChange: {
      revenue: { value: 0, percent: 0 },
      orders: { value: 0, percent: 0 },
      profit: { value: 0, percent: 0 },
    },
  }
  let revenueData: any[] = []
  let topProducts: any[] = []
  let netProfitData: any[] = []
  let hasError = false
  
  try {
    [kpis, revenueData, topProducts, netProfitData] = await Promise.all([
      getDashboardKPIs(supabase, 'all'),
      getRevenueOverTime(supabase, 30),
      getTopProducts(supabase, 10),
      getNetProfitOverTime(supabase, 30),
    ])
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    hasError = true
    // Provide fallback values
    kpis = {
      totalRevenue: 0,
      totalOrders: 0,
      totalProfit: 0,
      profitMargin: 0,
      averageOrderValue: 0,
      activeProducts: 0,
      totalExpenses: 0,
      netProfit: 0,
      netProfitMargin: 0,
      periodChange: {
        revenue: { value: 0, percent: 0 },
        orders: { value: 0, percent: 0 },
        profit: { value: 0, percent: 0 },
      },
    }
    revenueData = []
    topProducts = []
    netProfitData = []
  }

  return (
    <DashboardClient>
      <div className="flex min-h-screen bg-background">
        <WelcomeTour />
        <Sidebar />
        <main className="flex-1 overflow-y-auto lg:ml-0">
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              Welcome to your analytics dashboard
            </p>
            {hasError && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Error loading dashboard data. Please check your Supabase connection and run <code className="bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded">npm run diagnose</code> to troubleshoot.
                </p>
              </div>
            )}
          </div>

          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(kpis.totalRevenue)}</div>
                <p className={`text-xs ${kpis.periodChange.revenue.percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpis.periodChange.revenue.percent >= 0 ? '+' : ''}
                  {formatPercent(kpis.periodChange.revenue.percent)} from last period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Orders
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.totalOrders}</div>
                <p className={`text-xs ${kpis.periodChange.orders.percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpis.periodChange.orders.percent >= 0 ? '+' : ''}
                  {formatPercent(kpis.periodChange.orders.percent)} from last period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Profit Margin
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercent(kpis.profitMargin)}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(kpis.totalProfit)} profit
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Products
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.activeProducts}</div>
                <p className="text-xs text-muted-foreground">
                  In stock
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Net Profit KPI Cards */}
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Expenses
                </CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(kpis.totalExpenses)}</div>
                <p className="text-xs text-muted-foreground">
                  All time expenses
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Net Profit
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${kpis.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(kpis.netProfit)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Revenue - Expenses
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Net Profit Margin
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${kpis.netProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercent(kpis.netProfitMargin)}
                </div>
                <p className="text-xs text-muted-foreground">
                  After expenses
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <RevenueChart data={revenueData} />
            <ProductsChart data={topProducts} />
          </div>

          {/* Net Profit Chart */}
          <div className="grid gap-4 md:grid-cols-1">
            <NetProfitChart data={netProfitData} />
          </div>
        </div>
      </main>
      </div>
    </DashboardClient>
  )
}
