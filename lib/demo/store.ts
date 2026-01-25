/**
 * Zustand store for demo data with localStorage persistence
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { DemoData, DemoOrder, DemoProduct, DemoExpense, DemoOrderLine } from './types'
import { generateDemoData } from './generator'

interface DemoStore extends DemoData {
  // Actions
  resetData: () => void
  addOrder: (order: DemoOrder, lines: DemoOrderLine[]) => void
  updateOrderStatus: (orderNumber: string, status: string) => void
  deleteProduct: (productId: number) => void
  addProduct: (product: DemoProduct) => void
  addExpense: (expense: Omit<DemoExpense, 'expense_id' | 'created_at' | 'updated_at'>) => void
  deleteExpense: (expenseId: number) => void
  updateProduct: (productId: number, updates: Partial<DemoProduct>) => void
}

const STORAGE_KEY = 'neonmetrics-demo-data'

export const useDemoStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      // Initial data
      orders: [],
      orderLines: [],
      products: [],
      expenses: [],

      // Reset to default demo data
      resetData: () => {
        const defaultData = generateDemoData()
        set(defaultData)
      },

      // Add order with line items
      addOrder: (order, lines) => {
        set((state) => ({
          orders: [order, ...state.orders],
          orderLines: [...state.orderLines, ...lines],
        }))
      },

      // Update order status
      updateOrderStatus: (orderNumber, status) => {
        set((state) => ({
          orders: state.orders.map((order) =>
            order.order_number === orderNumber
              ? { ...order, order_status: status, updated_at: new Date().toISOString() }
              : order
          ),
        }))
      },

      // Delete product
      deleteProduct: (productId) => {
        set((state) => ({
          products: state.products.filter((p) => p.product_id !== productId),
          // Also remove order lines referencing this product
          orderLines: state.orderLines.filter((l) => l.product_id !== productId),
        }))
      },

      // Add product
      addProduct: (product) => {
        set((state) => ({
          products: [...state.products, product].sort((a, b) =>
            a.product_name.localeCompare(b.product_name)
          ),
        }))
      },

      // Update product
      updateProduct: (productId, updates) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.product_id === productId ? { ...p, ...updates } : p
          ),
        }))
      },

      // Add expense
      addExpense: (expenseData) => {
        const maxId = Math.max(0, ...get().expenses.map((e) => e.expense_id))
        const expense: DemoExpense = {
          ...expenseData,
          expense_id: maxId + 1,
          created_at: new Date().toISOString(),
          updated_at: null,
        }
        set((state) => ({
          expenses: [expense, ...state.expenses].sort(
            (a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()
          ),
        }))
      },

      // Delete expense
      deleteExpense: (expenseId) => {
        set((state) => ({
          expenses: state.expenses.filter((e) => e.expense_id !== expenseId),
        }))
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state && state.orders.length === 0 && state.products.length === 0) {
          const defaultData = generateDemoData()
          state.orders = defaultData.orders
          state.orderLines = defaultData.orderLines
          state.products = defaultData.products
          state.expenses = defaultData.expenses
        }
      },
    }
  )
)
