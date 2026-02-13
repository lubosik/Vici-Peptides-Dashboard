/**
 * Orders queries for the dashboard
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

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

/**
 * Get orders with filters and pagination
 */
export async function getOrders(
  supabase: SupabaseClient,
  filters: OrderFilters = {},
  page: number = 1,
  pageSize: number = 20,
  sortBy: string = 'order_date',
  sortOrder: 'asc' | 'desc' = 'desc'
) {
  let query = supabase
    .from('orders')
    .select(`
      order_number,
      woo_order_id,
      order_date,
      customer_name,
      customer_email,
      order_status,
      order_subtotal,
      order_total,
      order_profit,
      shipping_charged,
      coupon_code,
      coupon_discount,
      free_shipping,
      payment_method,
      created_at
    `, { count: 'exact' })

  // Apply filters
  if (filters.status) {
    query = query.eq('order_status', filters.status)
  }

  if (filters.dateFrom) {
    query = query.gte('order_date', filters.dateFrom)
  }

  if (filters.dateTo) {
    query = query.lte('order_date', filters.dateTo)
  }

  if (filters.customerEmail) {
    query = query.ilike('customer_email', `%${filters.customerEmail}%`)
  }

  if (filters.search) {
    query = query.or(`order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%`)
  }

  // Apply sorting
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })

  // Apply pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) throw error

  // Always compute line_items_count from order_lines by order_id (reliable; no embed)
  const countsByOrderId = new Map<number, number>()
  const ordersWithMargin = (data || []).map((order: any) => {
    const margin = order.order_total > 0
      ? (order.order_profit / order.order_total) * 100
      : 0
    return {
      ...order,
      profit_margin: margin,
      order_subtotal: Number(order.order_subtotal) || 0,
      order_total: Number(order.order_total) || 0,
      order_profit: Number(order.order_profit) || 0,
      shipping_charged: Number(order.shipping_charged) || 0,
      coupon_discount: Number(order.coupon_discount) || 0,
      free_shipping: Boolean(order.free_shipping),
      line_items_count: 0,
    }
  })

  const wooIds = ordersWithMargin.map((o) => o.woo_order_id).filter((id): id is number => id != null)
  if (wooIds.length > 0) {
    const admin = createAdminClient()
    const { data: byId } = await admin
      .from('order_lines')
      .select('order_id')
      .in('order_id', wooIds)
    byId?.forEach((line: { order_id: number | null }) => {
      const id = Number(line.order_id)
      if (!Number.isNaN(id)) countsByOrderId.set(id, (countsByOrderId.get(id) || 0) + 1)
    })
    ordersWithMargin.forEach((order) => {
      if (order.woo_order_id != null) {
        const n = countsByOrderId.get(Number(order.woo_order_id))
        if (n != null) order.line_items_count = n
      }
    })
  }

  // Shipping cost per order from expenses (Shippo etc.): category='shipping', order_number matches
  const orderNumbers = ordersWithMargin.map((o) => o.order_number).filter(Boolean)
  const shippingCostByOrder = new Map<string, number>()
  if (orderNumbers.length > 0) {
    const admin = createAdminClient()
    const { data: shippingExpenses } = await admin
      .from('expenses')
      .select('order_number, amount')
      .eq('category', 'shipping')
      .in('order_number', orderNumbers)
    shippingExpenses?.forEach((row: { order_number: string | null; amount: number }) => {
      if (row.order_number != null) {
        const current = shippingCostByOrder.get(row.order_number) || 0
        shippingCostByOrder.set(row.order_number, current + (Number(row.amount) || 0))
      }
    })
  }
  ordersWithMargin.forEach((order) => {
    const shippingCost = shippingCostByOrder.get(order.order_number) ?? 0
    order.shipping_cost = Math.round(shippingCost * 100) / 100
    order.net_profit = Math.round(((Number(order.order_profit) || 0) - shippingCost) * 100) / 100
    order.net_margin = order.order_total > 0 ? (order.net_profit / order.order_total) * 100 : 0
  })

  return {
    orders: ordersWithMargin,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  }
}

/**
 * Get single order with line items.
 * Order identifier can be the numeric WooCommerce ID (e.g. "2539") or order_number (e.g. "Order #2539").
 * We use the ID in URLs: /orders/2539 → GET wp-json/wc/v3/orders/2539
 */
export async function getOrderWithLines(
  supabase: SupabaseClient,
  orderNumber: string
) {
  const raw = orderNumber.trim()
  const numericId = /^\d+$/.test(raw) ? parseInt(raw, 10) : null

  let order = null
  let orderError = null

  // If param is numeric (e.g. 2539), look up by woo_order_id first to match API URL
  if (numericId != null) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('woo_order_id', numericId)
      .maybeSingle()
    if (data && !error) {
      order = data
      orderError = null
    } else if (error) orderError = error
  }

  // Otherwise try order_number formats
  if (!order) {
    const formatsToTry = [
      raw,
      decodeURIComponent(raw),
      raw.replace(/%20/g, ' ').replace(/%23/g, '#'),
      raw.replace(/\+/g, ' '),
    ]
    const uniqueFormats = Array.from(new Set(formatsToTry))
    for (const format of uniqueFormats) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_number', format)
        .maybeSingle()
      if (data && !error) {
        order = data
        orderError = null
        break
      }
      if (error) orderError = error
    }
  }

  if (!order) {
    const numberMatch = raw.match(/\d+/)
    if (numberMatch) {
      const orderNum = numberMatch[0]
      const { data: byWooId } = await supabase
        .from('orders')
        .select('*')
        .eq('woo_order_id', parseInt(orderNum, 10))
        .maybeSingle()
      if (byWooId) order = byWooId
      else {
        const { data: orders } = await supabase
          .from('orders')
          .select('*')
          .ilike('order_number', `%${orderNum}%`)
          .limit(5)
        const exactMatch = orders?.find((o: any) =>
          String(o.order_number).toLowerCase().includes(orderNum.toLowerCase())
        )
        if (exactMatch) order = exactMatch
        else if (orders?.length) order = orders[0]
      }
    }
  }

  if (orderError && !order) {
    console.error('Error fetching order:', orderError)
    throw orderError
  }
  
  if (!order) {
    console.error(`❌ Order not found:`, orderNumber)
    const { data: sampleOrders } = await supabase
      .from('orders')
      .select('order_number, woo_order_id')
      .limit(10)
    console.error(`   Sample orders in database:`, sampleOrders?.map((o: any) => `${o.order_number} (id: ${o.woo_order_id})`))
    throw new Error(`Order not found: ${orderNumber}`)
  }
  
  console.log(`✅ Successfully found order: ${order.order_number}`)

  const actualOrderNumber = order.order_number
  const selectCols = `
      line_id,
      product_id,
      qty_ordered,
      our_cost_per_unit,
      customer_paid_per_unit,
      line_total,
      line_cost,
      line_profit,
      order_number,
      order_id,
      name,
      sku,
      products(product_id, product_name, sku_code)
    `

  // Query line items by order_id (WooCommerce ID) first — sync script always sets this, so order detail page always finds items
  let lineItems: any[] | null = null
  let linesError: any = null

  if (order.woo_order_id != null) {
    const res = await supabase
      .from('order_lines')
      .select(selectCols)
      .eq('order_id', order.woo_order_id)
      .order('line_id', { ascending: true })
    lineItems = res.data
    linesError = res.error
  }

  // Fallback: by order_number in case order_id is missing on old rows
  if ((!lineItems || lineItems.length === 0) && actualOrderNumber) {
    const res = await supabase
      .from('order_lines')
      .select(selectCols)
      .eq('order_number', actualOrderNumber)
      .order('line_id', { ascending: true })
    if (res.data && res.data.length > 0) {
      lineItems = res.data
      linesError = res.error
    }
  }

  // If no results and we're in dev, try a few fallback queries
  if ((!lineItems || lineItems.length === 0) && process.env.NODE_ENV === 'development') {
    // Try without the "Order #" prefix (just the number)
    const orderNumOnly = actualOrderNumber.replace(/^Order\s*#?\s*/i, '')
    if (orderNumOnly !== actualOrderNumber) {
      const { data: fallbackItems } = await supabase
        .from('order_lines')
        .select('order_number, line_id, product_id')
        .ilike('order_number', `%${orderNumOnly}%`)
        .limit(5)
      if (fallbackItems && fallbackItems.length > 0) {
        console.warn(`⚠️  Found line items with different order_number format:`, fallbackItems.map(l => l.order_number))
      }
    }

    // Also check if there are ANY line items in the table
    const { count: totalLineItems } = await supabase
      .from('order_lines')
      .select('*', { count: 'exact', head: true })
    console.log(`📊 Total line items in database: ${totalLineItems || 0}`)
  }

  if (linesError) {
    console.error('❌ Error fetching line items:', linesError)
    console.error('   Order number used in query:', actualOrderNumber)
    console.error('   Order number type:', typeof actualOrderNumber)
    // Don't throw - return empty array instead so order can still be displayed
    console.warn('   Continuing without line items due to error')
  } else {
    console.log(`✅ Successfully fetched ${lineItems?.length || 0} line items for order ${actualOrderNumber}`)
    if (lineItems && lineItems.length > 0 && process.env.NODE_ENV === 'development') {
      console.log(`   First line item:`, JSON.stringify({
        line_id: lineItems[0].line_id,
        product_id: lineItems[0].product_id,
        qty_ordered: lineItems[0].qty_ordered,
        product: lineItems[0].products,
      }, null, 2))
    }
  }

  // Shipping cost from expenses (Shippo etc.) for this order
  let shippingCostFromExpenses = 0
  const admin = createAdminClient()
  const { data: shippingRows } = await admin
    .from('expenses')
    .select('amount')
    .eq('category', 'shipping')
    .eq('order_number', actualOrderNumber)
  shippingRows?.forEach((row: { amount: number }) => {
    shippingCostFromExpenses += Number(row.amount) || 0
  })
  shippingCostFromExpenses = Math.round(shippingCostFromExpenses * 100) / 100
  const orderProfitNum = Number(order.order_profit) || 0
  const orderTotalNum = Number(order.order_total) || 0
  const netProfit = Math.round((orderProfitNum - shippingCostFromExpenses) * 100) / 100
  const netMargin = orderTotalNum > 0 ? (netProfit / orderTotalNum) * 100 : 0

  // Ensure all dates are strings and all data is serializable
  const serializedOrder = {
    ...order,
    order_date: order.order_date ? String(order.order_date) : null,
    created_at: order.created_at ? String(order.created_at) : null,
    updated_at: order.updated_at ? String(order.updated_at) : null,
    order_total: orderTotalNum,
    order_profit: orderProfitNum,
    order_subtotal: Number(order.order_subtotal) || 0,
    order_cost: Number(order.order_cost) || 0,
    shipping_charged: Number(order.shipping_charged) || 0,
    shipping_cost: Number(order.shipping_cost) || 0,
    shipping_cost_from_expenses: shippingCostFromExpenses,
    net_profit: netProfit,
    net_margin: netMargin,
    coupon_discount: Number(order.coupon_discount) || 0,
  }

  // Ensure line items are fully serializable
  // Handle both cases: products as object or array (Supabase can return either)
  const serializedLineItems = ((linesError ? [] : (lineItems || []))).map((line: any) => {
    // Handle products - can be object, array, or null
    let product: any = null
    if (line.products) {
      if (Array.isArray(line.products) && line.products.length > 0) {
        product = line.products[0]
      } else if (typeof line.products === 'object') {
        product = line.products
      }
    }
    
    // Ensure all values are plain objects/primitive types; prefer line.name (from webhook) for display
    return {
      line_id: Number(line.line_id) || 0,
      product_id: Number(line.product_id) || 0,
      qty_ordered: Number(line.qty_ordered) || 0,
      our_cost_per_unit: Number(line.our_cost_per_unit) || 0,
      customer_paid_per_unit: Number(line.customer_paid_per_unit) || 0,
      line_total: Number(line.line_total) || 0,
      line_cost: Number(line.line_cost) || 0,
      line_profit: Number(line.line_profit) || 0,
      name: line.name ? String(line.name) : null,
      sku: line.sku ? String(line.sku) : null,
      product: product && typeof product === 'object' && !Array.isArray(product) ? {
        product_id: Number(product.product_id) || 0,
        product_name: String(product.product_name || ''),
        sku_code: product.sku_code ? String(product.sku_code) : null,
      } : null,
    }
  })

  return {
    order: serializedOrder,
    lineItems: serializedLineItems,
  }
}

/**
 * Get order statuses for filter dropdown
 */
export async function getOrderStatuses(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('orders')
    .select('order_status')
    .order('order_status')

  if (error) throw error

  const uniqueStatuses = Array.from(new Set((data || []).map((o) => o.order_status)))
  return uniqueStatuses
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  supabase: SupabaseClient,
  orderNumber: string,
  newStatus: string
) {
  const { data, error } = await supabase
    .from('orders')
    .update({ order_status: newStatus })
    .eq('order_number', orderNumber)
    .select()
    .single()

  if (error) throw error

  return data
}
