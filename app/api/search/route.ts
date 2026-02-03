import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Search API endpoint for preview results
 * Returns matching orders, products, and expenses
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')?.trim() || ''

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] })
    }

    const supabase = await createClient()
    const results: any[] = []

    // Search orders
    const { data: orders } = await supabase
      .from('orders')
      .select('order_number, customer_name, order_date, order_total')
      .or(`order_number.ilike.%${query}%,customer_name.ilike.%${query}%`)
      .limit(5)

    if (orders) {
      orders.forEach(order => {
        results.push({
          type: 'order',
          id: order.order_number,
          title: `Order ${order.order_number}`,
          subtitle: order.customer_name,
          url: `/orders/${encodeURIComponent(order.order_number)}`,
        })
      })
    }

    // Search products
    const { data: products } = await supabase
      .from('products')
      .select('product_id, product_name, sku_code')
      .or(`product_name.ilike.%${query}%,sku_code.ilike.%${query}%`)
      .limit(5)

    if (products) {
      products.forEach(product => {
        results.push({
          type: 'product',
          id: product.product_id,
          title: product.product_name,
          subtitle: product.sku_code ? `SKU: ${product.sku_code}` : 'Product',
          url: `/products?search=${encodeURIComponent(query)}`,
        })
      })
    }

    // Search expenses
    const { data: expenses } = await supabase
      .from('expenses')
      .select('expense_id, description, category, amount, expense_date')
      .or(`description.ilike.%${query}%,category.ilike.%${query}%`)
      .limit(5)

    if (expenses) {
      expenses.forEach(expense => {
        results.push({
          type: 'expense',
          id: expense.expense_id,
          title: expense.description || expense.category,
          subtitle: `$${Number(expense.amount).toFixed(2)} - ${expense.category}`,
          url: `/expenses?search=${encodeURIComponent(query)}`,
        })
      })
    }

    return NextResponse.json({ results: results.slice(0, 10) })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
