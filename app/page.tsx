import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { DashboardContent } from '@/components/dashboard/dashboard-content'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { createClient } from '@/lib/supabase/server'
import { getDashboardKPIs } from '@/lib/metrics/queries'
import { getRevenueOverTime } from '@/lib/metrics/queries'
import { getTopProducts } from '@/lib/metrics/queries'
import { getNetProfitOverTime } from '@/lib/metrics/net-profit'
import { getExpenseSummary } from '@/lib/queries/expenses'

export const dynamic = 'force-dynamic'

// Force dynamic rendering to ensure real-time data
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch all dashboard data in parallel
  const [kpis, revenueDataRaw, topProductsRaw, netProfitData, expenseSummary] = await Promise.all([
    getDashboardKPIs(supabase, 'all'),
    getRevenueOverTime(supabase, 30),
    getTopProducts(supabase, 5),
    getNetProfitOverTime(supabase, 30),
    getExpenseSummary(supabase),
  ])

  // Transform revenue data to match component expectations
  const revenueData = revenueDataRaw.map(d => ({
    date: d.date,
    revenue: d.revenue,
    profit: d.profit,
    orders: d.orders || 0, // Add orders property (default to 0 if not present)
  }))

  // Transform top products to match component expectations
  const topProducts = topProductsRaw.map(p => ({
    productId: p.productId,
    productName: p.productName,
    revenue: p.revenue,
    qtySold: p.qtySold,
    profit: p.profit,
  }))

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <DashboardClient>
            <div className="container mx-auto p-6 lg:p-8">
              <DashboardContent
                kpis={kpis}
                revenueData={revenueData}
                topProducts={topProducts}
                netProfitData={netProfitData}
                expenseSummary={expenseSummary}
              />
            </div>
          </DashboardClient>
        </main>
      </div>
    </div>
  )
}
