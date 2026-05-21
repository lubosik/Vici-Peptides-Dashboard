import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { DashboardContent } from '@/components/dashboard/dashboard-content'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDashboardKPIs } from '@/lib/metrics/queries'
import { getRevenueOverTime } from '@/lib/metrics/queries'
import { getNetProfitOverTime } from '@/lib/metrics/net-profit'
import { getExpenseSummary } from '@/lib/queries/expenses'

export const dynamic = 'force-dynamic'

interface DashboardPageProps {
  searchParams: { period?: string }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = createAdminClient()
  const rawPeriod = searchParams.period
  const period = rawPeriod === 'month' || rawPeriod === 'week' ? rawPeriod : 'all'

  const [kpis, revenueDataRaw, netProfitData, expenseSummary, recentOrdersRaw] = await Promise.all([
    getDashboardKPIs(supabase, period as 'all' | 'month' | 'week'),
    getRevenueOverTime(supabase, 30),
    getNetProfitOverTime(supabase, 30),
    getExpenseSummary(supabase),
    supabase
      .from('orders')
      .select('order_number, woo_order_id, customer_name, order_total, order_status, order_date, tracking_number')
      .order('order_date', { ascending: false })
      .limit(8),
  ])

  const revenueData = revenueDataRaw.map((d) => ({
    date: d.date,
    revenue: d.revenue,
    profit: d.profit,
    orders: d.orders || 0,
  }))

  const recentOrders = (recentOrdersRaw.data || []).map((o) => ({
    order_number: String(o.order_number),
    woo_order_id: o.woo_order_id ? Number(o.woo_order_id) : null,
    customer_name: o.customer_name ? String(o.customer_name) : null,
    order_total: Number(o.order_total) || 0,
    order_status: String(o.order_status),
    order_date: String(o.order_date),
    tracking_number: o.tracking_number ? String(o.tracking_number) : null,
  }))

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <DashboardClient>
            <div className="container mx-auto p-3 sm:p-4 lg:p-6 xl:p-8">
              <DashboardContent
                kpis={kpis}
                revenueData={revenueData}
                netProfitData={netProfitData}
                expenseSummary={expenseSummary}
                recentOrders={recentOrders}
                period={period}
              />
            </div>
          </DashboardClient>
        </main>
      </div>
    </div>
  )
}
