/**
 * Demo query functions that replace Supabase queries
 * These functions read from the Zustand store instead of the database
 */

import { useDemoStore } from './store'
import type { DemoOrder, DemoProduct, DemoExpense, DemoOrderLine } from './types'

// Helper to get store state
// Note: These functions only work on the client side
function getStoreState() {
  if (typeof window === 'undefined') {
    // Server-side: return empty state
    return {
      orders: [],
      orderLines: [],
      products: [],
      expenses: [],
    }
  }
  // Client-side: get from Zustand store
  return useDemoStore.getState()
}

// Order queries
export interface OrderFilters {
  status?: string
  dateFrom?: string
  dateTo?: string
  customerEmail?: string
  search?: string
}

export interface OrderWithLines {
  order_number: string
  order_date: string
  customer_name: string
  customer_email: string
  order_status: string
  order_total: number
  order_profit: number
  profit_margin: number
  payment_method: string
  line_items_count: number
}

export function getOrders(
  filters: OrderFilters = {},
  page: number = 1,
  pageSize: number = 20,
  sortBy: string = 'order_date',
  sortOrder: 'asc' | 'desc' = 'desc'
) {
  const state = getStoreState()
  let orders = [...state.orders]

  // Apply filters
  if (filters.status) {
    orders = orders.filter((o) => o.order_status === filters.status)
  }
  if (filters.dateFrom) {
    orders = orders.filter((o) => o.order_date >= filters.dateFrom!)
  }
  if (filters.dateTo) {
    orders = orders.filter((o) => o.order_date <= filters.dateTo!)
  }
  if (filters.customerEmail) {
    orders = orders.filter((o) =>
      o.customer_email.toLowerCase().includes(filters.customerEmail!.toLowerCase())
    )
  }
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    orders = orders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(searchLower) ||
        o.customer_name.toLowerCase().includes(searchLower) ||
        o.customer_email.toLowerCase().includes(searchLower)
    )
  }

  // Apply sorting
  orders.sort((a, b) => {
    let aVal: any = a[sortBy as keyof DemoOrder]
    let bVal: any = b[sortBy as keyof DemoOrder]
    
    if (sortBy === 'order_date') {
      aVal = new Date(aVal).getTime()
      bVal = new Date(bVal).getTime()
    }
    
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
    }
    
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
    }
  })

  // Get line item counts
  const lineCounts = new Map<string, number>()
  state.orderLines.forEach((line) => {
    lineCounts.set(line.order_number, (lineCounts.get(line.order_number) || 0) + 1)
  })

  // Calculate profit margins and add line item counts
  const ordersWithCounts: OrderWithLines[] = orders.map((order) => ({
    ...order,
    profit_margin: order.order_total > 0 ? (order.order_profit / order.order_total) * 100 : 0,
    line_items_count: lineCounts.get(order.order_number) || 0,
  }))

  // Apply pagination
  const total = ordersWithCounts.length
  const from = (page - 1) * pageSize
  const to = from + pageSize
  const paginatedOrders = ordersWithCounts.slice(from, to)

  return {
    orders: paginatedOrders,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export function getOrderWithLines(orderNumber: string) {
  const state = getStoreState()
  
  // Try to find order (handle URL encoding)
  const decodedOrderNumber = decodeURIComponent(orderNumber)
  const order = state.orders.find(
    (o) => o.order_number === orderNumber || o.order_number === decodedOrderNumber
  )

  if (!order) {
    throw new Error(`Order not found: ${orderNumber}`)
  }

  const lineItems = state.orderLines
    .filter((l) => l.order_number === order.order_number)
    .map((line) => {
      const product = state.products.find((p) => p.product_id === line.product_id)
      return {
        ...line,
        product: product
          ? {
              product_id: product.product_id,
              product_name: product.product_name,
              sku_code: product.sku_code,
            }
          : null,
      }
    })
    .sort((a, b) => a.line_id - b.line_id)

  return {
    order: {
      ...order,
      order_date: String(order.order_date),
      created_at: String(order.created_at),
      updated_at: order.updated_at ? String(order.updated_at) : null,
    },
    lineItems,
  }
}

export function getOrderStatuses(): string[] {
  const state = getStoreState()
  const statuses = new Set(state.orders.map((o) => o.order_status))
  return Array.from(statuses).sort()
}

export function updateOrderStatus(orderNumber: string, newStatus: string) {
  const store = useDemoStore.getState()
  store.updateOrderStatus(orderNumber, newStatus)
  const state = getStoreState()
  return state.orders.find((o) => o.order_number === orderNumber)!
}

// Product queries
export interface ProductFilters {
  search?: string
  stockStatus?: string
  lowStock?: boolean
  outOfStock?: boolean
}

export interface ProductWithSales extends DemoProduct {
  total_revenue: number
  total_cost: number
  total_profit: number
  roi_percent: number | null
}

export function getProducts(
  filters: ProductFilters = {},
  page: number = 1,
  pageSize: number = 50,
  sortBy: string = 'product_name',
  sortOrder: 'asc' | 'desc' = 'asc'
) {
  const state = getStoreState()
  let products = [...state.products]

  // Apply filters
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    products = products.filter(
      (p) =>
        p.product_name.toLowerCase().includes(searchLower) ||
        (p.sku_code && p.sku_code.toLowerCase().includes(searchLower)) ||
        (p.variant_strength && p.variant_strength.toLowerCase().includes(searchLower))
    )
  }
  if (filters.stockStatus) {
    products = products.filter((p) => p.stock_status === filters.stockStatus)
  } else if (filters.lowStock) {
    products = products.filter((p) => p.stock_status === 'LOW STOCK')
  } else if (filters.outOfStock) {
    products = products.filter((p) => p.stock_status === 'OUT OF STOCK')
  }

  // Calculate sales metrics
  const salesMap = new Map<number, { total_revenue: number; total_cost: number; total_profit: number }>()
  
  state.orderLines.forEach((line) => {
    const existing = salesMap.get(line.product_id) || {
      total_revenue: 0,
      total_cost: 0,
      total_profit: 0,
    }
    existing.total_revenue += line.line_total
    existing.total_cost += line.line_cost
    existing.total_profit += line.line_profit
    salesMap.set(line.product_id, existing)
  })

  // Combine with sales data
  const productsWithSales: ProductWithSales[] = products.map((product) => {
    const sales = salesMap.get(product.product_id) || {
      total_revenue: 0,
      total_cost: 0,
      total_profit: 0,
    }
    const roiPercent = sales.total_cost > 0 ? (sales.total_profit / sales.total_cost) * 100 : null

    return {
      ...product,
      total_revenue: sales.total_revenue,
      total_cost: sales.total_cost,
      total_profit: sales.total_profit,
      roi_percent: roiPercent,
    }
  })

  // Apply sorting
  productsWithSales.sort((a, b) => {
    let aVal: any = a[sortBy as keyof ProductWithSales]
    let bVal: any = b[sortBy as keyof ProductWithSales]
    
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
    }
    
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
    }
  })

  // Apply pagination
  const total = productsWithSales.length
  const from = (page - 1) * pageSize
  const to = from + pageSize
  const paginatedProducts = productsWithSales.slice(from, to)

  return {
    products: paginatedProducts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export function getStockSummary() {
  const state = getStoreState()
  const summary = {
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    total: state.products.length,
  }

  state.products.forEach((product) => {
    const status = product.stock_status.toUpperCase().trim()
    if (status === 'IN STOCK') summary.inStock++
    else if (status === 'LOW STOCK') summary.lowStock++
    else if (status === 'OUT OF STOCK') summary.outOfStock++
  })

  return summary
}

// Expense queries
export interface ExpenseFilters {
  category?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export function getExpenses(
  filters: ExpenseFilters = {},
  page: number = 1,
  pageSize: number = 20,
  sortBy: string = 'expense_date',
  sortOrder: 'asc' | 'desc' = 'desc'
) {
  const state = getStoreState()
  let expenses = [...state.expenses]

  // Apply filters
  if (filters.category) {
    expenses = expenses.filter((e) => e.category === filters.category)
  }
  if (filters.dateFrom) {
    expenses = expenses.filter((e) => e.expense_date >= filters.dateFrom!)
  }
  if (filters.dateTo) {
    expenses = expenses.filter((e) => e.expense_date <= filters.dateTo!)
  }
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    expenses = expenses.filter(
      (e) =>
        e.description.toLowerCase().includes(searchLower) ||
        (e.vendor && e.vendor.toLowerCase().includes(searchLower))
    )
  }

  // Apply sorting
  expenses.sort((a, b) => {
    let aVal: any = a[sortBy as keyof DemoExpense]
    let bVal: any = b[sortBy as keyof DemoExpense]
    
    if (sortBy === 'expense_date') {
      aVal = new Date(aVal).getTime()
      bVal = new Date(bVal).getTime()
    }
    
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
    }
    
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
    }
  })

  // Apply pagination
  const total = expenses.length
  const from = (page - 1) * pageSize
  const to = from + pageSize
  const paginatedExpenses = expenses.slice(from, to)

  return {
    expenses: paginatedExpenses,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export function getExpenseCategories(): string[] {
  const state = getStoreState()
  const categories = new Set(state.expenses.map((e) => e.category).filter(Boolean))
  return Array.from(categories).sort()
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

export function getExpenseSummary(dateFrom?: string, dateTo?: string): ExpenseSummary {
  const state = getStoreState()
  let expenses = [...state.expenses]

  if (dateFrom) {
    expenses = expenses.filter((e) => e.expense_date >= dateFrom)
  }
  if (dateTo) {
    expenses = expenses.filter((e) => e.expense_date <= dateTo)
  }

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
