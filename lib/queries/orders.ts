/**
 * Orders queries for the dashboard
 */

import { SupabaseClient } from '@supabase/supabase-js'

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

  // Calculate profit margin for each order
  const ordersWithMargin = (data || []).map((order) => ({
    ...order,
    profit_margin: order.order_total > 0 
      ? (order.order_profit / order.order_total) * 100 
      : 0,
    order_subtotal: Number(order.order_subtotal) || 0,
    order_total: Number(order.order_total) || 0,
    order_profit: Number(order.order_profit) || 0,
    shipping_charged: Number(order.shipping_charged) || 0,
    coupon_discount: Number(order.coupon_discount) || 0,
    free_shipping: Boolean(order.free_shipping),
  }))

  // Get line item counts (only if we have orders)
  const countsMap = new Map<string, number>()
  if (ordersWithMargin.length > 0) {
    const orderNumbers = ordersWithMargin.map((o) => o.order_number)
    const { data: lineCounts, error: lineCountsError } = await supabase
      .from('order_lines')
      .select('order_number')
      .in('order_number', orderNumbers)

    if (lineCountsError) {
      console.error('Error fetching line item counts:', lineCountsError)
      // Continue without line counts rather than failing
    } else {
      lineCounts?.forEach((line) => {
        countsMap.set(line.order_number, (countsMap.get(line.order_number) || 0) + 1)
      })
    }
  }

  const ordersWithCounts = ordersWithMargin.map((order) => ({
    ...order,
    line_items_count: countsMap.get(order.order_number) || 0,
  }))

  return {
    orders: ordersWithCounts,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  }
}

/**
 * Get single order with line items
 */
export async function getOrderWithLines(
  supabase: SupabaseClient,
  orderNumber: string
) {
  // Try multiple formats of the order number
  const formatsToTry = [
    orderNumber, // Original
    decodeURIComponent(orderNumber), // URL decoded
    orderNumber.replace(/%20/g, ' ').replace(/%23/g, '#'), // Manual decode
    orderNumber.replace(/\+/g, ' '), // Plus to space
  ]
  
  // Remove duplicates
  const uniqueFormats = Array.from(new Set(formatsToTry))
  
  let order = null
  let orderError = null
  
  // Try each format until we find a match
  for (const format of uniqueFormats) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', format)
      .maybeSingle()
    
    if (data && !error) {
      order = data
      orderError = null
      console.log(`✅ Found order with format: "${format}"`)
      break
    }
    
    if (error) {
      console.error(`Error trying format "${format}":`, error)
      orderError = error
    }
  }

  // If still not found, try a case-insensitive search or partial match
  if (!order) {
    // Extract just the number part (e.g., "1791" from "Order #1791" or "Order%20%231791")
    const numberMatch = orderNumber.match(/\d+/)
    if (numberMatch) {
      const orderNum = numberMatch[0]
      console.log(`🔍 Trying to find order by number: ${orderNum}`)
      
      // Try searching for orders containing this number
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .ilike('order_number', `%${orderNum}%`)
        .limit(5)
      
      if (orders && orders.length > 0) {
        // Find exact match if possible
        const exactMatch = orders.find(o => 
          o.order_number.toLowerCase().includes(orderNum.toLowerCase())
        )
        if (exactMatch) {
          order = exactMatch
          console.log(`✅ Found order by number search: "${order.order_number}"`)
        } else {
          // Use first match
          order = orders[0]
          console.log(`⚠️ Using first match by number search: "${order.order_number}"`)
        }
      }
    }
  }

  if (orderError && !order) {
    console.error('Error fetching order:', orderError)
    throw orderError
  }
  
  if (!order) {
    console.error(`❌ Order not found after trying formats:`, uniqueFormats)
    
    // Get sample orders for debugging
    const { data: sampleOrders } = await supabase
      .from('orders')
      .select('order_number')
      .limit(10)
    console.error(`   Sample orders in database:`, sampleOrders?.map(o => o.order_number))
    
    throw new Error(`Order not found: ${orderNumber}`)
  }
  
  console.log(`✅ Successfully found order: ${order.order_number}`)

  // Use the actual order_number from the database for line items query
  const actualOrderNumber = order.order_number

  // Debug: Check what order numbers exist in order_lines
  if (process.env.NODE_ENV === 'development') {
    const { data: sampleLines } = await supabase
      .from('order_lines')
      .select('order_number')
      .limit(10)
    console.log(`📊 Sample order_numbers in order_lines:`, sampleLines?.map(l => l.order_number).slice(0, 5))
  }

  // Get line items - use left join so we get line items even if product doesn't exist
  // First, let's check if any line items exist at all for this order
  const { count: lineItemsCount, error: countError } = await supabase
    .from('order_lines')
    .select('*', { count: 'exact', head: true })
    .eq('order_number', actualOrderNumber)

  if (countError) {
    console.error('Error counting line items:', countError)
  }

  console.log(`🔍 Querying line items for order_number="${actualOrderNumber}" (found ${lineItemsCount || 0} total)`)

  // Also try querying without exact match to see if there's a format mismatch
  if (lineItemsCount === 0 && process.env.NODE_ENV === 'development') {
    // Extract just the number part for fuzzy matching
    const orderNumMatch = actualOrderNumber.match(/\d+/)
    if (orderNumMatch) {
      const { data: similarLines } = await supabase
        .from('order_lines')
        .select('order_number')
        .ilike('order_number', `%${orderNumMatch[0]}%`)
        .limit(5)
      if (similarLines && similarLines.length > 0) {
        console.warn(`⚠️  Found similar order numbers (fuzzy match):`, similarLines.map(l => l.order_number))
      }
    }
  }

  // Query line items by order_number first, then fallback to order_id (woo_order_id) if no results
  let { data: lineItems, error: linesError } = await supabase
    .from('order_lines')
    .select(`
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
      products(product_id, product_name, sku_code)
    `)
    .eq('order_number', actualOrderNumber)
    .order('line_id', { ascending: true })

  // Fallback: if no line items by order_number, try by order_id (WooCommerce ID)
  if ((!lineItems || lineItems.length === 0) && order.woo_order_id != null) {
    const { data: byOrderId } = await supabase
      .from('order_lines')
      .select(`
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
        products(product_id, product_name, sku_code)
      `)
      .eq('order_id', order.woo_order_id)
      .order('line_id', { ascending: true })

    if (byOrderId && byOrderId.length > 0) {
      lineItems = byOrderId
      linesError = null
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

  // Ensure all dates are strings and all data is serializable
  const serializedOrder = {
    ...order,
    order_date: order.order_date ? String(order.order_date) : null,
    created_at: order.created_at ? String(order.created_at) : null,
    updated_at: order.updated_at ? String(order.updated_at) : null,
    order_total: Number(order.order_total) || 0,
    order_profit: Number(order.order_profit) || 0,
    order_subtotal: Number(order.order_subtotal) || 0,
    order_cost: Number(order.order_cost) || 0,
    shipping_charged: Number(order.shipping_charged) || 0,
    shipping_cost: Number(order.shipping_cost) || 0,
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
    
    // Ensure all values are plain objects/primitive types
    return {
      line_id: Number(line.line_id) || 0,
      product_id: Number(line.product_id) || 0,
      qty_ordered: Number(line.qty_ordered) || 0,
      our_cost_per_unit: Number(line.our_cost_per_unit) || 0,
      customer_paid_per_unit: Number(line.customer_paid_per_unit) || 0,
      line_total: Number(line.line_total) || 0,
      line_cost: Number(line.line_cost) || 0,
      line_profit: Number(line.line_profit) || 0,
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
