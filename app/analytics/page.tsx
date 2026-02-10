import { Sidebar } from '@/components/sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { getRevenueOverTime } from '@/lib/metrics/queries'
import { RevenueChart } from '@/components/charts/revenue-chart'
import { NetProfitChart } from '@/components/charts/net-profit-chart'
import { getNetProfitOverTime } from '@/lib/metrics/net-profit'
import { getExpenseSummary } from '@/lib/queries/expenses'
import { ExpensesChart } from '@/components/charts/expenses-chart'
import { AnalyticsClient } from '@/components/analytics/analytics-client'

// Force dynamic rendering to prevent build-time errors when env vars aren't available
export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const supabase = await createClient()

  let revenueData: any[] = []
  let netProfitData: any[] = []
  let expenseSummary: any = { total: 0, thisMonth: 0, average: 0, expensesByCategory: [] }
  let hasError = false
  let errorMessage = ''

  try {
    [revenueData, netProfitData, expenseSummary] = await Promise.all([
      getRevenueOverTime(supabase, 90),
      getNetProfitOverTime(supabase, 90),
      getExpenseSummary(supabase),
    ])
  } catch (error) {
    console.error('Error fetching analytics data:', error)
    hasError = true
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
    revenueData = []
    netProfitData = []
    expenseSummary = { total: 0, thisMonth: 0, average: 0, expensesByCategory: [] }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <AnalyticsClient>
        <main className="flex-1 overflow-y-auto lg:ml-0">
          <div className="container mx-auto p-3 sm:p-4 lg:p-6 xl:p-8">
            <div className="mb-4 sm:mb-6 lg:mb-8 pt-2 sm:pt-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Analytics</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
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

          {/* Revenue, Net Profit, Expenses */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <RevenueChart data={revenueData} />
            <NetProfitChart data={netProfitData} />
          </div>
          <div className="mb-6">
            <ExpensesChart data={expenseSummary.expensesByCategory} />
          </div>
          </div>
        </main>
      </AnalyticsClient>
    </div>
  )
}
