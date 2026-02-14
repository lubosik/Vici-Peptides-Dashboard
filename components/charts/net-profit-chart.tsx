'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateShortInMiami } from '@/lib/datetime'

interface NetProfitData {
  date: string
  revenue: number
  expenses: number
  netProfit: number
}

interface NetProfitChartProps {
  data: NetProfitData[]
}

export function NetProfitChart({ data }: NetProfitChartProps) {
  // Format data for chart
  const chartData = data.map((item) => ({
    date: formatDateShortInMiami(item.date),
    revenue: item.revenue,
    expenses: item.expenses,
    netProfit: item.netProfit,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Profit Over Time</CardTitle>
        <CardDescription>Revenue, expenses, and net profit trends</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.375rem',
              }}
              formatter={(value: number) => `$${value.toLocaleString()}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              name="Revenue"
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="expenses"
              stroke="#ef4444"
              strokeWidth={2}
              name="Expenses"
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="netProfit"
              stroke="#10b981"
              strokeWidth={2}
              name="Net Profit"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
