/**
 * Products queries for the dashboard
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export interface ProductFilters {
  search?: string
  stockStatus?: string
  lowStock?: boolean
  outOfStock?: boolean
}

export interface ProductWithSales {
  product_id: number
  product_name: string
  variant_strength: string | null
  sku_code: string | null
  lot_number: string | null
  starting_qty: number | null
  qty_sold: number
  current_stock: number
  reorder_level: number | null
  stock_status: string
  our_cost: number | null
  retail_price: number | null
  unit_margin: number | null
  margin_percent: number | null
  woo_product_id: number | null
  // Sales-derived metrics
  total_revenue: number
  total_cost: number
  total_profit: number
  roi_percent: number | null
}

/**
 * Get products with sales metrics
 */
export async function getProducts(
  supabase: SupabaseClient,
  filters: ProductFilters = {},
  page: number = 1,
  pageSize: number = 50,
  sortBy: string = 'product_name',
  sortOrder: 'asc' | 'desc' = 'asc'
): Promise<{
  products: ProductWithSales[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })

  // Exclude placeholder products (Product + number pattern and specific IDs)
  // We'll filter these out after fetching, as Supabase NOT with ilike can be tricky
  // First, exclude specific placeholder product IDs
  const placeholderIds = [203, 209, 212, 220, 221, 222]
  if (placeholderIds.length > 0) {
    query = query.not('product_id', 'in', `(${placeholderIds.join(',')})`)
  }

  // Apply filters
  if (filters.search) {
    query = query.or(`product_name.ilike.%${filters.search}%,sku_code.ilike.%${filters.search}%,variant_strength.ilike.%${filters.search}%`)
  }

  if (filters.stockStatus) {
    query = query.eq('stock_status', filters.stockStatus)
  } else if (filters.lowStock) {
    query = query.eq('stock_status', 'LOW STOCK')
  } else if (filters.outOfStock) {
    query = query.eq('stock_status', 'OUT OF STOCK')
  } else {
    // Default: only show products in stock
    query = query.eq('stock_status', 'In Stock')
  }

  // Apply sorting
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })

  // Apply pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data: products, error, count } = await query

  if (error) throw error

  // Get sales metrics from order_lines
  const productIds = (products || []).map(p => p.product_id)
  
  if (productIds.length === 0) {
    return {
      products: [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    }
  }

  // Get sales data from order_lines (use admin so we get all rows; then filter by order status)
  const admin = createAdminClient()
  const { data: allLines, error: linesError } = await admin
    .from('order_lines')
    .select('product_id, qty_ordered, line_total, line_cost, line_profit, order_number')
    .in('product_id', productIds)

  if (linesError) throw linesError

  const excludedStatuses = new Set(['checkout-draft', 'cancelled', 'draft', 'refunded', 'failed'])
  const orderNumbers = [...new Set((allLines || []).map((l: { order_number: string }) => l.order_number))]
  let orderStatuses: { order_number: string; order_status: string }[] | null = null
  if (orderNumbers.length > 0) {
    const res = await admin.from('orders').select('order_number, order_status').in('order_number', orderNumbers)
    orderStatuses = res.data
  }

  const statusByOrder = new Map<string, string>()
  ;(orderStatuses || []).forEach((o) => {
    statusByOrder.set(o.order_number, o.order_status || '')
  })

  const salesData = (allLines || []).filter(
    (line: { order_number: string }) => !excludedStatuses.has(statusByOrder.get(line.order_number) || '')
  )

  // Aggregate sales by product (qty_sold from sum of qty_ordered so variants show correct totals)
  const salesMap = new Map<number, {
    total_revenue: number
    total_cost: number
    total_profit: number
    qty_sold: number
  }>()

  salesData?.forEach(line => {
    const productId = line.product_id
    const existing = salesMap.get(productId) || {
      total_revenue: 0,
      total_cost: 0,
      total_profit: 0,
      qty_sold: 0,
    }
    const lineTotal = Number(line.line_total) || 0
    const lineCost = Number(line.line_cost) || 0
    const lineProfit = lineTotal - lineCost
    const qty = Number((line as any).qty_ordered) || 0
    existing.total_revenue += lineTotal
    existing.total_cost += lineCost
    existing.total_profit += lineProfit
    existing.qty_sold += qty
    salesMap.set(productId, existing)
  })

  // Combine product data with sales metrics (use order_lines qty_ordered for qty_sold when available)
  const productsWithSales: ProductWithSales[] = (products || []).map(product => {
    const sales = salesMap.get(product.product_id) || {
      total_revenue: 0,
      total_cost: 0,
      total_profit: 0,
      qty_sold: 0,
    }

    // Calculate ROI
    const roiPercent = sales.total_cost > 0
      ? (sales.total_profit / sales.total_cost) * 100
      : null

    return {
      ...product,
      qty_sold: sales.qty_sold > 0 ? sales.qty_sold : (Number(product.qty_sold) || 0),
      current_stock: Number(product.current_stock) || 0,
      our_cost: product.our_cost ? Number(product.our_cost) : null,
      retail_price: product.retail_price ? Number(product.retail_price) : null,
      unit_margin: product.unit_margin ? Number(product.unit_margin) : null,
      margin_percent: product.margin_percent ? Number(product.margin_percent) : null,
      total_revenue: sales.total_revenue,
      total_cost: sales.total_cost,
      total_profit: sales.total_profit,
      roi_percent: roiPercent, // Use the calculated value, not undefined
    }
  })

  // Adjust total count to exclude filtered placeholder products
  const adjustedTotal = productsWithSales.length < (products || []).length
    ? (count || 0) - ((products || []).length - productsWithSales.length)
    : (count || 0)

  return {
    products: productsWithSales,
    total: Math.max(0, adjustedTotal),
    page,
    pageSize,
    totalPages: Math.ceil(Math.max(0, adjustedTotal) / pageSize),
  }
}

/**
 * Get product by ID with full details
 */
export async function getProductById(
  supabase: SupabaseClient,
  productId: number
): Promise<ProductWithSales | null> {
  // Check if this is a placeholder product ID
  const placeholderIds = [203, 209, 212, 220, 221, 222]
  if (placeholderIds.includes(productId)) {
    return null
  }

  const { data: product, error } = await supabase
    .from('products')
    .select(`
      product_id,
      product_name,
      variant_strength,
      sku_code,
      lot_number,
      starting_qty,
      qty_sold,
      current_stock,
      reorder_level,
      stock_status,
      our_cost,
      retail_price,
      unit_margin,
      margin_percent,
      woo_product_id
    `)
    .eq('product_id', productId)
    .single()

  if (error || !product) return null

  // Check if product name matches placeholder pattern
  const productName = (product.product_name || '').trim()
  const isPlaceholder = /^Product\s+\d+$/i.test(productName)
  if (isPlaceholder) {
    return null
  }

  // Get sales metrics
  // Join with orders to exclude draft/cancelled orders (no money exchanged)
  const { data: salesData } = await supabase
    .from('order_lines')
    .select(`
      line_total,
      line_cost,
      line_profit,
      orders!inner(order_status)
    `)
    .eq('product_id', productId)
    .not('orders.order_status', 'in', '("checkout-draft","cancelled","draft","refunded","failed")')

  const sales = (salesData || []).reduce(
    (acc, line) => {
      const lineTotal = Number(line.line_total) || 0
      const lineCost = Number(line.line_cost) || 0
      // Calculate profit: always compute from line_total - line_cost to ensure accuracy
      // The database trigger should maintain this, but we calculate it here as a fallback
      const lineProfit = lineTotal - lineCost
      
      return {
        total_revenue: acc.total_revenue + lineTotal,
        total_cost: acc.total_cost + lineCost,
        total_profit: acc.total_profit + lineProfit,
      }
    },
    { total_revenue: 0, total_cost: 0, total_profit: 0 }
  )

  const roiPercent = sales.total_cost > 0
    ? (sales.total_profit / sales.total_cost) * 100
    : null

  return {
    ...product,
    qty_sold: Number(product.qty_sold) || 0,
    current_stock: Number(product.current_stock) || 0,
    our_cost: product.our_cost ? Number(product.our_cost) : null,
    retail_price: product.retail_price ? Number(product.retail_price) : null,
    unit_margin: product.unit_margin ? Number(product.unit_margin) : null,
    margin_percent: product.margin_percent ? Number(product.margin_percent) : null,
    woo_product_id: product.woo_product_id ? Number(product.woo_product_id) : null,
    total_revenue: sales.total_revenue,
    total_cost: sales.total_cost,
    total_profit: sales.total_profit,
    roi_percent: roiPercent,
  }
}

/**
 * Get stock status summary
 */
export async function getStockSummary(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('products')
    .select('stock_status')

  if (error) throw error

  const summary = {
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    total: (data || []).length,
  }

  data?.forEach(product => {
    const status = (product.stock_status || '').toUpperCase().trim()
    if (status === 'IN STOCK') summary.inStock++
    else if (status === 'LOW STOCK') summary.lowStock++
    else if (status === 'OUT OF STOCK') summary.outOfStock++
  })

  return summary
}
