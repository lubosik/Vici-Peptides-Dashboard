'use client'

import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface RevenueData {
  date: string
  revenue: number
  profit: number
  orders: number
}

interface RevenueChartProps {
  data: RevenueData[]
}

export function RevenueChart({ data }: RevenueChartProps) {
  // Format data for chart
  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: item.revenue,
    profit: item.profit,
    orders: item.orders,
  }))

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider">Revenue Over Time</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">Daily revenue and profit trends</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(255, 100, 200)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="rgb(255, 100, 200)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(60, 40, 90, 0.3)" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: 'rgb(180, 200, 220)' }}
              stroke="rgba(60, 40, 90, 0.5)"
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'rgb(180, 200, 220)' }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
              stroke="rgba(60, 40, 90, 0.5)"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 10, 25, 0.95)',
                border: '1px solid rgba(80, 50, 120, 0.5)',
                borderRadius: '0.5rem',
                color: 'rgb(240, 250, 255)',
              }}
              formatter={(value: number) => `$${value.toLocaleString()}`}
            />
            <Legend 
              wrapperStyle={{ color: 'rgb(180, 200, 220)' }}
            />
            <Area
              type="monotone"
              dataKey="profit"
              stroke="none"
              fill="url(#colorRevenue)"
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="rgb(255, 150, 100)"
              strokeWidth={2}
              name="Revenue"
              dot={{ r: 3, fill: 'rgb(255, 150, 100)' }}
            />
            <Line
              type="monotone"
              dataKey="profit"
              stroke="rgb(255, 100, 200)"
              strokeWidth={2}
              name="Profit"
              dot={{ r: 3, fill: 'rgb(255, 100, 200)' }}
            />
            <Line
              type="monotone"
              dataKey="orders"
              stroke="rgb(150, 100, 255)"
              strokeWidth={2}
              name="Orders"
              dot={{ r: 3, fill: 'rgb(150, 100, 255)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
