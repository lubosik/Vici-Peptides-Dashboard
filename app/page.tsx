import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { DashboardContent } from '@/components/dashboard/dashboard-content'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDashboardKPIs } from '@/lib/metrics/queries'
import { getRevenueOverTime } from '@/lib/metrics/queries'
import { getNetProfitOverTime } from '@/lib/metrics/net-profit'
import { getExpenseSummary } from '@/lib/queries/expenses'

// Force dynamic rendering to ensure real-time data
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createAdminClient()

  const [kpis, revenueDataRaw, netProfitData, expenseSummary] = await Promise.all([
    getDashboardKPIs(supabase, 'all'),
    getRevenueOverTime(supabase, 30),
    getNetProfitOverTime(supabase, 30),
    getExpenseSummary(supabase),
  ])

  const revenueData = revenueDataRaw.map(d => ({
    date: d.date,
    revenue: d.revenue,
    profit: d.profit,
    orders: d.orders || 0,
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
              />
            </div>
          </DashboardClient>
        </main>
      </div>
    </div>
  )
}
