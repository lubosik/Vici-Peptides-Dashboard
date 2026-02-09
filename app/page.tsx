import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { DashboardContent } from '@/components/dashboard/dashboard-content'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDashboardKPIs, getTopProducts, type TopProductsDateRange } from '@/lib/metrics/queries'
import { getRevenueOverTime } from '@/lib/metrics/queries'
import { getNetProfitOverTime } from '@/lib/metrics/net-profit'
import { getExpenseSummary } from '@/lib/queries/expenses'

// Force dynamic rendering to ensure real-time data
export const dynamic = 'force-dynamic'

interface DashboardPageProps {
  searchParams: Promise<{ topRange?: string; topFrom?: string; topTo?: string }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = createAdminClient()
  const params = await searchParams
  const topRange = (params.topRange || 'all') as TopProductsDateRange
  const topFrom = params.topFrom
  const topTo = params.topTo

  // Fetch all dashboard data in parallel
  const [kpis, revenueDataRaw, topProductsRaw, netProfitData, expenseSummary] = await Promise.all([
    getDashboardKPIs(supabase, 'all'),
    getRevenueOverTime(supabase, 30),
    getTopProducts(supabase, 5, { range: topRange, dateFrom: topFrom, dateTo: topTo }),
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
            <div className="container mx-auto p-3 sm:p-4 lg:p-6 xl:p-8">
              <DashboardContent
                kpis={kpis}
                revenueData={revenueData}
                topProducts={topProducts}
                topProductsRange={{ range: topRange, dateFrom: topFrom, dateTo: topTo }}
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
