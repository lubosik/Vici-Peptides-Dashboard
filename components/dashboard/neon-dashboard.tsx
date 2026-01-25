'use client'

import { useEffect } from 'react'
import { useDemoStore } from '@/lib/demo/store'
import { getOrders, getProducts, getExpenses, getExpenseSummary } from '@/lib/demo/queries'
import { CircularStatMeter } from './circular-stat-meter'
import { ProgressBarsCard } from './progress-bars-card'
import { ActivitiesCard } from './activities-card'
import { CalendarCard } from './calendar-card'
import { PercentageRings } from './percentage-rings'
import { RevenueChart } from '@/components/charts/revenue-chart'
import { formatCurrency } from '@/lib/metrics/calculations'

export function NeonDashboard() {
  const store = useDemoStore()

  // Calculate KPIs from demo data
  const orders = getOrders({}, 1, 1000).orders
  const products = getProducts({}, 1, 1000).products
  const expenses = getExpenses({}, 1, 1000).expenses
  const expenseSummary = getExpenseSummary()

  const totalRevenue = orders
    .filter((o) => ['completed', 'processing'].includes(o.order_status))
    .reduce((sum, o) => sum + o.order_total, 0)

  const totalOrders = orders.length
  const totalProfit = orders
    .filter((o) => ['completed', 'processing'].includes(o.order_status))
    .reduce((sum, o) => sum + o.order_profit, 0)

  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
  const activeProducts = products.filter((p) => p.stock_status === 'In Stock').length
  const totalExpenses = expenseSummary.totalExpenses
  const netProfit = totalProfit - totalExpenses
  const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  // Generate revenue over time data (last 30 days)
  const revenueData = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const dayOrders = orders.filter(
      (o) => o.order_date === dateStr && ['completed', 'processing'].includes(o.order_status)
    )
    const revenue = dayOrders.reduce((sum, o) => sum + o.order_total, 0)
    const profit = dayOrders.reduce((sum, o) => sum + o.order_profit, 0)
    revenueData.push({
      date: dateStr,
      revenue,
      profit,
      orders: dayOrders.length,
    })
  }

  // Activities data
  const activities = [
    { text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
    { text: 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', highlight: true },
    { text: 'Ut enim ad minim veniam, quis nostrud exercitation.' },
    { text: 'Duis aute irure dolor in reprehenderit in voluptate velit esse.', highlight: true },
    { text: 'Excepteur sint occaecat cupidatat non proident.' },
  ]

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-muted-foreground">
        DASHBOARD / HOME
      </div>

      {/* Top Row - 5 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <CircularStatMeter
          value={totalOrders}
          label="Orders Today"
          description="Total orders received"
          percentage={75}
          gradient="cyan-green"
        />
        <CircularStatMeter
          value={formatCurrency(totalRevenue)}
          label="Revenue"
          description="Total revenue generated"
          percentage={68}
          gradient="pink-orange"
        />
        <CircularStatMeter
          value={activeProducts}
          label="Active Products"
          description="Products in stock"
          percentage={82}
          gradient="yellow-green"
        />
        <ProgressBarsCard
          title="Engagement"
          value="64%"
          description="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
          bars={[
            { label: 'Metric 1', value: 75, gradient: 'cyan' },
            { label: 'Metric 2', value: 50, gradient: 'green' },
            { label: 'Metric 3', value: 90, gradient: 'pink' },
          ]}
        />
        <ProgressBarsCard
          title="Conversion"
          description="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
          bars={[
            { label: 'Rate 1', value: 60, gradient: 'cyan' },
            { label: 'Rate 2', value: 80, gradient: 'orange' },
            { label: 'Rate 3', value: 45, gradient: 'green' },
          ]}
        />
      </div>

      {/* Middle Row - Chart + Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart data={revenueData} />
        </div>
        <div className="lg:col-span-1">
          <div className="glass-card rounded-xl p-6 border border-border/30 neon-glow">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-4">Visualization</h3>
            <div className="space-y-2">
              {[75, 60, 85, 45, 90, 70, 55].map((value, idx) => {
                const gradients = ['cyan', 'green', 'orange', 'pink', 'cyan', 'green', 'orange']
                const gradient = gradients[idx % gradients.length]
                return (
                  <div
                    key={idx}
                    className={`h-3 rounded-full bg-gradient-to-r ${
                      gradient === 'cyan' ? 'from-cyan-500 to-cyan-400' :
                      gradient === 'green' ? 'from-green-500 to-green-400' :
                      gradient === 'orange' ? 'from-orange-500 to-orange-400' :
                      'from-pink-500 to-pink-400'
                    } neon-glow-${gradient}`}
                    style={{ width: `${value}%` }}
                  />
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Row - Activities + Calendar + Percentage Rings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ActivitiesCard activities={activities} />
        <CalendarCard />
        <PercentageRings
          rings={[
            { percentage: 40, label: 'Data text', gradient: 'pink' },
            { percentage: 75, label: 'Data text', gradient: 'green' },
            { percentage: 20, label: 'Data text', gradient: 'cyan' },
            { percentage: 80, label: 'Data text', gradient: 'orange' },
            { percentage: 60, label: 'Data text', gradient: 'purple' },
          ]}
        />
      </div>
    </div>
  )
}
