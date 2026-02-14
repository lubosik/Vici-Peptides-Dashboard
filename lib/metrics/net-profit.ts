/**
 * Net profit calculations
 * Net Profit = Total Revenue - Total Expenses
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface NetProfitMetrics {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  netProfitMargin: number
  expenseRatio: number
  period: {
    start: string
    end: string
  }
}

/**
 * Calculate net profit metrics for a given period
 */
export async function getNetProfitMetrics(
  supabase: SupabaseClient,
  dateFrom?: string,
  dateTo?: string
): Promise<NetProfitMetrics> {
  const now = new Date()
  const startDate = dateFrom || new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const endDate = dateTo || now.toISOString()

  // Get total revenue from orders
  // Exclude checkout-draft and cancelled orders (no money exchanged)
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('order_total')
    .not('order_status', 'in', '("checkout-draft","cancelled","draft","on-hold")')
    .gte('order_date', startDate)
    .lte('order_date', endDate)

  if (ordersError) throw ordersError

  const totalRevenue = (orders || []).reduce(
    (sum, o) => sum + (Number(o.order_total) || 0),
    0
  )

  // Get total expenses
  const { data: expenses, error: expensesError } = await supabase
    .from('expenses')
    .select('amount')
    .gte('expense_date', startDate)
    .lte('expense_date', endDate)

  if (expensesError) throw expensesError

  const totalExpenses = (expenses || []).reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  )

  // Calculate net profit
  const netProfit = totalRevenue - totalExpenses

  // Calculate net profit margin (as percentage of revenue)
  const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  // Calculate expense ratio (expenses as percentage of revenue)
  const expenseRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    netProfitMargin,
    expenseRatio,
    period: {
      start: startDate,
      end: endDate,
    },
  }
}

/**
 * Get net profit over time (for charts)
 */
export async function getNetProfitOverTime(
  supabase: SupabaseClient,
  days: number = 30
): Promise<Array<{
  date: string
  revenue: number
  expenses: number
  netProfit: number
}>> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get orders grouped by date
  // Exclude checkout-draft and cancelled orders (no money exchanged)
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('order_date, order_total')
    .not('order_status', 'in', '("checkout-draft","cancelled","draft","on-hold")')
    .gte('order_date', startDate.toISOString())
    .order('order_date', { ascending: true })

  if (ordersError) throw ordersError

  // Get expenses grouped by date
  const { data: expenses, error: expensesError } = await supabase
    .from('expenses')
    .select('expense_date, amount')
    .gte('expense_date', startDate.toISOString())
    .order('expense_date', { ascending: true })

  if (expensesError) throw expensesError

  // Group orders by date
  const revenueByDate = new Map<string, number>()
  orders?.forEach((order) => {
    const date = new Date(order.order_date).toISOString().split('T')[0]
    revenueByDate.set(date, (revenueByDate.get(date) || 0) + (Number(order.order_total) || 0))
  })

  // Group expenses by date
  const expensesByDate = new Map<string, number>()
  expenses?.forEach((expense) => {
    const date = new Date(expense.expense_date).toISOString().split('T')[0]
    expensesByDate.set(date, (expensesByDate.get(date) || 0) + (Number(expense.amount) || 0))
  })

  // Combine and fill missing dates
  const result: Array<{
    date: string
    revenue: number
    expenses: number
    netProfit: number
  }> = []

  const currentDate = new Date(startDate)
  const endDate = new Date()

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0]
    const revenue = revenueByDate.get(dateStr) || 0
    const expenses = expensesByDate.get(dateStr) || 0
    const netProfit = revenue - expenses

    result.push({
      date: dateStr,
      revenue,
      expenses,
      netProfit,
    })

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return result
}
