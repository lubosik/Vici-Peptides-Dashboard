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
import { Card, CardContent } from '@/components/ui/card'

interface ChartData {
  date: string
  'Data 01': number
  'Data 02': number
  'Data 03'?: number
}

interface NeonLineChartProps {
  data: ChartData[]
}

export function NeonLineChart({ data }: NeonLineChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <defs>
              <linearGradient id="data01Gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fb923c" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="data02Gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(147, 197, 253, 0.1)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'rgba(240, 240, 255, 0.6)', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(147, 197, 253, 0.2)' }}
            />
            <YAxis
              tick={{ fill: 'rgba(240, 240, 255, 0.6)', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(147, 197, 253, 0.2)' }}
              domain={[0, 'dataMax']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(30, 25, 50, 0.95)',
                border: '1px solid rgba(147, 197, 253, 0.3)',
                borderRadius: '0.5rem',
                color: 'rgba(240, 240, 255, 0.9)',
              }}
            />
            <Legend
              wrapperStyle={{ color: 'rgba(240, 240, 255, 0.8)' }}
              iconType="line"
            />
            <Area
              type="monotone"
              dataKey="Data 01"
              fill="url(#data01Gradient)"
              stroke="none"
            />
            <Line
              type="monotone"
              dataKey="Data 01"
              stroke="#fb923c"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#fb923c' }}
            />
            <Area
              type="monotone"
              dataKey="Data 02"
              fill="url(#data02Gradient)"
              stroke="none"
            />
            <Line
              type="monotone"
              dataKey="Data 02"
              stroke="#ec4899"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#ec4899' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
