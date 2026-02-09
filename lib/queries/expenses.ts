/**
 * Expenses queries for the dashboard
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface ExpenseFilters {
  category?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface ExpenseSummary {
  totalExpenses: number
  expensesByCategory: Array<{
    category: string
    total: number
    count: number
  }>
  expensesByMonth: Array<{
    month: string
    total: number
  }>
}

/**
 * Get expenses with filters and pagination
 */
export async function getExpenses(
  supabase: SupabaseClient,
  filters: ExpenseFilters = {},
  page: number = 1,
  pageSize: number = 20,
  sortBy: string = 'expense_date',
  sortOrder: 'asc' | 'desc' = 'desc'
) {
  let query = supabase
    .from('expenses')
    .select('*', { count: 'exact' })

  // Apply filters
  if (filters.category) {
    query = query.eq('category', filters.category)
  }

  if (filters.dateFrom) {
    query = query.gte('expense_date', filters.dateFrom)
  }

  if (filters.dateTo) {
    query = query.lte('expense_date', filters.dateTo)
  }

  if (filters.search) {
    query = query.or(`description.ilike.%${filters.search}%,vendor.ilike.%${filters.search}%`)
  }

  // Apply sorting
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })

  // Apply pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) throw error

  const expenses = (data || []).map((expense) => ({
    ...expense,
    amount: Number(expense.amount) || 0,
  }))

  return {
    expenses,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  }
}

/**
 * Get grand total of all expenses (all pages, no filters). Use for "Total Expenses" card.
 * Fetches amounts with a high limit and sums in code so the total is always correct.
 */
export async function getExpenseGrandTotal(supabase: SupabaseClient): Promise<{ total: number; count: number }> {
  const { data, error, count } = await supabase
    .from('expenses')
    .select('amount', { count: 'exact' })
    .limit(10000)

  if (error) throw error

  const rows = data || []
  const total = rows.reduce((sum, e) => sum + (Number(e?.amount) ?? 0), 0)
  return { total, count: count ?? rows.length }
}

/**
 * Get expense summary (totals, by category, by month) with optional filters.
 * Use this for "Total Expenses" so the sum is across ALL matching rows, not just the current page.
 */
export async function getExpenseSummary(
  supabase: SupabaseClient,
  dateFrom?: string,
  dateTo?: string,
  filters?: ExpenseFilters
): Promise<ExpenseSummary> {
  let query = supabase
    .from('expenses')
    .select('expense_date, category, amount')
    .limit(10000)

  if (dateFrom) {
    query = query.gte('expense_date', dateFrom)
  }

  if (dateTo) {
    query = query.lte('expense_date', dateTo)
  }

  if (filters?.category) {
    query = query.eq('category', filters.category)
  }

  if (filters?.search) {
    query = query.or(`description.ilike.%${filters.search}%,vendor.ilike.%${filters.search}%`)
  }

  const { data, error } = await query

  if (error) throw error

  const expenses = (data || []).map((e) => ({
    ...e,
    amount: Number(e?.amount) ?? 0,
  }))

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  // Group by category
  const categoryMap = new Map<string, { total: number; count: number }>()
  expenses.forEach((expense) => {
    const category = expense.category || 'Uncategorized'
    const existing = categoryMap.get(category) || { total: 0, count: 0 }
    categoryMap.set(category, {
      total: existing.total + expense.amount,
      count: existing.count + 1,
    })
  })

  const expensesByCategory = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      ...data,
    }))
    .sort((a, b) => b.total - a.total)

  // Group by month
  const monthMap = new Map<string, number>()
  expenses.forEach((expense) => {
    const date = new Date(expense.expense_date)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    monthMap.set(month, (monthMap.get(month) || 0) + expense.amount)
  })

  const expensesByMonth = Array.from(monthMap.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    totalExpenses,
    expensesByCategory,
    expensesByMonth,
  }
}

/**
 * Get expense categories for filter dropdown
 */
export async function getExpenseCategories(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('expenses')
    .select('category')
    .order('category')

  if (error) throw error

  const uniqueCategories = Array.from(new Set((data || []).map((e) => e.category).filter(Boolean)))
  return uniqueCategories
}

/**
 * Create new expense
 */
export async function createExpense(
  supabase: SupabaseClient,
  expense: {
    expense_date: string
    category: string
    description: string
    amount: number
    vendor?: string
    notes?: string
    source?: string
  }
) {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      ...expense,
      source: expense.source ?? 'manual',
    })
    .select()
    .single()

  if (error) throw error

  return data
}

/**
 * Update expense
 */
export async function updateExpense(
  supabase: SupabaseClient,
  expenseId: number,
  updates: Partial<{
    expense_date: string
    category: string
    description: string
    amount: number
    vendor: string
    notes: string
  }>
) {
  const { data, error } = await supabase
    .from('expenses')
    .update(updates)
    .eq('expense_id', expenseId)
    .select()
    .single()

  if (error) throw error

  return data
}

/**
 * Delete expense
 */
export async function deleteExpense(
  supabase: SupabaseClient,
  expenseId: number
) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('expense_id', expenseId)

  if (error) throw error
}
