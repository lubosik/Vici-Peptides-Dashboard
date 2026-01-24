import { Sidebar } from '@/components/sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { getRevenueOverTime, getTopProducts } from '@/lib/metrics/queries'
import { RevenueChart } from '@/components/charts/revenue-chart'
import { ProductsChart } from '@/components/charts/products-chart'
import { NetProfitChart } from '@/components/charts/net-profit-chart'
import { getNetProfitOverTime } from '@/lib/metrics/net-profit'
import { getExpenseSummary } from '@/lib/queries/expenses'
import { ExpensesChart } from '@/components/charts/expenses-chart'

export default async function AnalyticsPage() {
  const supabase = await createClient()

  let revenueData, topProducts, netProfitData, expenseSummary, ordersWithCoupons, shippingData, statusData
  let hasError = false
  let errorMessage = ''

  try {
    [
      revenueData,
      topProducts,
      netProfitData,
      expenseSummary,
    ] = await Promise.all([
      getRevenueOverTime(supabase, 90),
      getTopProducts(supabase, 10),
      getNetProfitOverTime(supabase, 90),
      getExpenseSummary(supabase),
    ])

    // Get coupon usage stats
    const { data: couponData, error: couponError } = await supabase
      .from('orders')
      .select('coupon_code, coupon_discount')
      .not('coupon_code', 'is', null)
    
    if (couponError) throw couponError
    ordersWithCoupons = couponData

    // Get shipping absorption stats
    const { data: shipData, error: shipError } = await supabase
      .from('orders')
      .select('free_shipping, shipping_net_cost_absorbed, shipping_charged')
    
    if (shipError) throw shipError
    shippingData = shipData

    // Get order status mix
    const { data: statData, error: statusError } = await supabase
      .from('orders')
      .select('order_status')
    
    if (statusError) throw statusError
    statusData = statData
  } catch (error) {
    console.error('Error fetching analytics data:', error)
    hasError = true
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
    // Provide fallback values
    revenueData = []
    topProducts = []
    netProfitData = []
    expenseSummary = {
      total: 0,
      thisMonth: 0,
      average: 0,
      expensesByCategory: [],
    }
    ordersWithCoupons = []
    shippingData = []
    statusData = []
  }

  const couponUsage = new Map<string, { count: number; totalDiscount: number }>()
  ordersWithCoupons?.forEach(order => {
    const code = order.coupon_code
    if (code) {
      const existing = couponUsage.get(code) || { count: 0, totalDiscount: 0 }
      couponUsage.set(code, {
        count: existing.count + 1,
        totalDiscount: existing.totalDiscount + (Number(order.coupon_discount) || 0),
      })
    }
  })

  const shippingStats = {
    freeShippingOrders: 0,
    totalAbsorbed: 0,
    totalCharged: 0,
  }

  shippingData?.forEach(order => {
    if (order.free_shipping) {
      shippingStats.freeShippingOrders++
    }
    shippingStats.totalAbsorbed += Number(order.shipping_net_cost_absorbed) || 0
    shippingStats.totalCharged += Number(order.shipping_charged) || 0
  })

  // Get order status mix
  const statusMix = new Map<string, number>()
  statusData?.forEach(order => {
    const status = order.order_status
    statusMix.set(status, (statusMix.get(status) || 0) + 1)
  })

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto lg:ml-0">
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Analytics</h1>
            <p className="text-muted-foreground mt-2">
              Comprehensive analytics and insights
            </p>
            {hasError && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Error loading analytics data: {errorMessage}
                </p>
              </div>
            )}
          </div>

          {/* Revenue and Profit Charts */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <RevenueChart data={revenueData} />
            <NetProfitChart data={netProfitData} />
          </div>

          {/* Top Products and Expenses */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <ProductsChart data={topProducts} />
            <ExpensesChart data={expenseSummary.expensesByCategory} />
          </div>

          {/* Coupon Usage */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Coupon Usage</CardTitle>
              <CardDescription>Coupon codes and discount impact</CardDescription>
            </CardHeader>
            <CardContent>
              {couponUsage.size === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No coupons used
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.from(couponUsage.entries()).map(([code, stats]) => (
                    <div key={code} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">{code}</div>
                        <div className="text-sm text-muted-foreground">
                          {stats.count} orders
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-red-600">
                          -${stats.totalDiscount.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Total discount
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping Absorption */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Shipping Analysis</CardTitle>
              <CardDescription>Shipping costs and absorption</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-sm text-muted-foreground">Free Shipping Orders</div>
                  <div className="text-2xl font-bold">{shippingStats.freeShippingOrders}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Absorbed</div>
                  <div className="text-2xl font-bold text-red-600">
                    ${shippingStats.totalAbsorbed.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Charged</div>
                  <div className="text-2xl font-bold text-green-600">
                    ${shippingStats.totalCharged.toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Status Mix */}
          <Card>
            <CardHeader>
              <CardTitle>Order Status Distribution</CardTitle>
              <CardDescription>Breakdown of orders by status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.from(statusMix.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => {
                    const total = statusData?.length || 1
                    const percentage = (count / total) * 100
                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{status}</span>
                          <span className="font-medium">{count} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
