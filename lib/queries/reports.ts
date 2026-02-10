/**
 * Dashboard reports - Supabase fallback when WooCommerce Reports API is unavailable
 */

import { SupabaseClient } from '@supabase/supabase-js'

function getDateRange(period: string): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  let dateFrom: string

  switch (period) {
    case 'week':
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      dateFrom = startOfWeek.toISOString().split('T')[0]
      break
    case 'month':
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      break
    case 'last_month':
      dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
      return { dateFrom, dateTo: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] }
    case 'year':
      dateFrom = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
      break
    default:
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  }

  return { dateFrom, dateTo: tomorrowStr }
}

export async function getSalesReportFromDb(
  supabase: SupabaseClient,
  period: string = 'month'
): Promise<{
  total_sales: string
  net_sales: string
  total_orders: number
  total_items: number
  total_shipping: string
  total_discount: string
}> {
  const { dateFrom, dateTo } = getDateRange(period)

  const { data, error } = await supabase
    .from('orders')
    .select('order_total, order_subtotal, shipping_charged, coupon_discount, order_status, order_number, woo_order_id')
    .gte('order_date', dateFrom)
    .lt('order_date', dateTo)
    .not('order_status', 'in', '("checkout-draft","cancelled","draft")')

  if (error) throw error

  const orders = data || []
  const total_sales = orders.reduce((sum, o) => sum + (Number(o.order_total) || 0), 0)
  const net_sales = orders.reduce((sum, o) => sum + (Number(o.order_total) || 0) - (Number(o.coupon_discount) || 0), 0)
  const total_shipping = orders.reduce((sum, o) => sum + (Number(o.shipping_charged) || 0), 0)
  const total_discount = orders.reduce((sum, o) => sum + (Number(o.coupon_discount) || 0), 0)

  const orderNumbers = orders.map((o: any) => o.order_number).filter(Boolean)
  const orderIds = orders.map((o: any) => o.woo_order_id).filter(Boolean)
  let total_items = 0
  if (orderNumbers.length > 0) {
    const { data: lines } = await supabase
      .from('order_lines')
      .select('qty_ordered')
      .in('order_number', orderNumbers)
    total_items = (lines || []).reduce((sum, l) => sum + (Number(l.qty_ordered) || 0), 0)
  }
  if (total_items === 0 && orderIds.length > 0) {
    const { data: lines } = await supabase
      .from('order_lines')
      .select('qty_ordered')
      .in('order_id', orderIds)
    total_items = (lines || []).reduce((sum, l) => sum + (Number(l.qty_ordered) || 0), 0)
  }

  return {
    total_sales: total_sales.toFixed(2),
    net_sales: net_sales.toFixed(2),
    total_orders: orders.length,
    total_items,
    total_shipping: total_shipping.toFixed(2),
    total_discount: total_discount.toFixed(2),
  }
}

export async function getTopSellersFromDb(
  supabase: SupabaseClient,
  period: string = 'month',
  limit: number = 10
): Promise<Array<{ product_id: number; title: string; quantity: number }>> {
  const { dateFrom, dateTo } = getDateRange(period)

  const { data: orders } = await supabase
    .from('orders')
    .select('order_number, woo_order_id')
    .gte('order_date', dateFrom)
    .lt('order_date', dateTo)
    .not('order_status', 'in', '("checkout-draft","cancelled","draft")')

  const orderNumbers = (orders || []).map((o: any) => o.order_number).filter(Boolean)
  const orderIds = (orders || []).map((o: any) => o.woo_order_id).filter(Boolean)

  let lines: any[] = []
  if (orderNumbers.length > 0) {
    const { data: byOrderNumber } = await supabase
      .from('order_lines')
      .select('product_id, qty_ordered')
      .in('order_number', orderNumbers)
    lines = byOrderNumber || []
  }
  if (lines.length === 0 && orderIds.length > 0) {
    const { data: byOrderId } = await supabase
      .from('order_lines')
      .select('product_id, qty_ordered')
      .in('order_id', orderIds)
    lines = byOrderId || []
  }
  if (lines.length === 0) {
    const { data: allLines } = await supabase
      .from('order_lines')
      .select('product_id, qty_ordered')
      .limit(5000)
    lines = allLines || []
  }

  const productMap = new Map<number, number>()
  lines.forEach((line: any) => {
    const pid = line.product_id
    productMap.set(pid, (productMap.get(pid) || 0) + (Number(line.qty_ordered) || 0))
  })

  const productIds = [...productMap.keys()]
  const { data: products } = await supabase
    .from('products')
    .select('product_id, product_name')
    .in('product_id', productIds)

  const nameMap = new Map<number, string>()
  products?.forEach((p: any) => nameMap.set(p.product_id, p.product_name || `Product ${p.product_id}`))

  return Array.from(productMap.entries())
    .map(([product_id, quantity]) => ({
      product_id,
      title: nameMap.get(product_id) || `Product ${product_id}`,
      quantity,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit)
}

export async function getOrdersTotalsFromDb(
  supabase: SupabaseClient
): Promise<Array<{ slug: string; name: string; total: number }>> {
  const { data, error } = await supabase
    .from('orders')
    .select('order_status')

  if (error) throw error

  const statusMap = new Map<string, number>()
  ;(data || []).forEach((o: any) => {
    const status = o.order_status || 'unknown'
    statusMap.set(status, (statusMap.get(status) || 0) + 1)
  })

  return Array.from(statusMap.entries()).map(([slug, total]) => ({
    slug,
    name: slug.replace(/-/g, ' '),
    total,
  }))
}
