/**
 * Helper functions for filtering orders
 * Excludes draft and cancelled orders from revenue/profit calculations
 */

/**
 * Order statuses that should be excluded from revenue/profit calculations
 * These are orders where no money has been exchanged
 */
export const EXCLUDED_ORDER_STATUSES = ['checkout-draft', 'cancelled', 'draft', 'on-hold'] as const

/**
 * Check if an order status should be excluded from revenue/profit calculations
 */
export function isExcludedOrderStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return EXCLUDED_ORDER_STATUSES.includes(status.toLowerCase() as any)
}

/**
 * Apply order status filter to exclude draft/cancelled orders
 * Use this for revenue/profit calculations
 */
export function excludeDraftCancelledOrders<T extends { order_status?: string | null }>(
  query: any
): any {
  return query.not('order_status', 'in', `(${EXCLUDED_ORDER_STATUSES.map(s => `"${s}"`).join(',')})`)
}

/**
 * Filter orders array to exclude draft/cancelled orders
 */
export function filterValidOrders<T extends { order_status?: string | null }>(
  orders: T[]
): T[] {
  return orders.filter(order => !isExcludedOrderStatus(order.order_status))
}
