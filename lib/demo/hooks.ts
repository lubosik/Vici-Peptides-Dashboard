/**
 * Client-side hooks for accessing demo data
 */

import { useDemoStore } from './store'
import { useMemo } from 'react'
import type { OrderFilters, ProductFilters, ExpenseFilters } from './queries'
import {
  getOrders as getOrdersQuery,
  getProducts as getProductsQuery,
  getExpenses as getExpensesQuery,
  getExpenseSummary as getExpenseSummaryQuery,
  getOrderWithLines as getOrderWithLinesQuery,
  getOrderStatuses as getOrderStatusesQuery,
  getStockSummary as getStockSummaryQuery,
  getExpenseCategories as getExpenseCategoriesQuery,
} from './queries'

export function useDemoOrders(
  filters: OrderFilters = {},
  page: number = 1,
  pageSize: number = 20,
  sortBy: string = 'order_date',
  sortOrder: 'asc' | 'desc' = 'desc'
) {
  return useMemo(() => {
    return getOrdersQuery(filters, page, pageSize, sortBy, sortOrder)
  }, [filters, page, pageSize, sortBy, sortOrder])
}

export function useDemoProducts(
  filters: ProductFilters = {},
  page: number = 1,
  pageSize: number = 50,
  sortBy: string = 'product_name',
  sortOrder: 'asc' | 'desc' = 'asc'
) {
  return useMemo(() => {
    return getProductsQuery(filters, page, pageSize, sortBy, sortOrder)
  }, [filters, page, pageSize, sortBy, sortOrder])
}

export function useDemoExpenses(
  filters: ExpenseFilters = {},
  page: number = 1,
  pageSize: number = 20,
  sortBy: string = 'expense_date',
  sortOrder: 'asc' | 'desc' = 'desc'
) {
  return useMemo(() => {
    return getExpensesQuery(filters, page, pageSize, sortBy, sortOrder)
  }, [filters, page, pageSize, sortBy, sortOrder])
}

export function useDemoExpenseSummary(dateFrom?: string, dateTo?: string) {
  return useMemo(() => {
    return getExpenseSummaryQuery(dateFrom, dateTo)
  }, [dateFrom, dateTo])
}

export function useDemoOrderWithLines(orderNumber: string) {
  return useMemo(() => {
    try {
      return getOrderWithLinesQuery(orderNumber)
    } catch (error) {
      return null
    }
  }, [orderNumber])
}

export function useDemoOrderStatuses() {
  return useMemo(() => {
    return getOrderStatusesQuery()
  }, [])
}

export function useDemoStockSummary() {
  return useMemo(() => {
    return getStockSummaryQuery()
  }, [])
}

export function useDemoExpenseCategories() {
  return useMemo(() => {
    return getExpenseCategoriesQuery()
  }, [])
}
