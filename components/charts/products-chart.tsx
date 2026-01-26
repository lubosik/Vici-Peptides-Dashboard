'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ProductData {
  productId: number
  productName: string
  revenue: number
  qtySold: number
  profit: number
}

interface ProductsChartProps {
  data: ProductData[]
}

interface ChartDataItem {
  name: string
  revenue: number
  profit: number
  profitColor: string
  qtySold: number
}

export function ProductsChart({ data }: ProductsChartProps) {
  // Format data for chart (limit to top 10 for readability)
  const chartData: ChartDataItem[] = data.slice(0, 10).map((item) => ({
    name: item.productName.length > 20 
      ? item.productName.substring(0, 20) + '...' 
      : item.productName,
    revenue: item.revenue,
    profit: item.profit,
    profitColor: item.profit >= 0 ? '#22c55e' : '#ef4444',
    qtySold: item.qtySold,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Products</CardTitle>
        <CardDescription>Best selling products by revenue</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="name"
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              angle={-45}
              textAnchor="end"
              height={100}
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
            <Bar
              dataKey="revenue"
              fill="#22c55e"
              name="Revenue"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="profit"
              name="Profit"
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.profitColor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
