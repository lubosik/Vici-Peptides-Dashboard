import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

/** Allow dashboard session only (no API key for this action). */
async function authenticate(request: Request): Promise<boolean> {
  const key = request.headers.get('x-api-key') || new URL(request.url).searchParams.get('api_key')
  if (process.env.WEBHOOK_API_KEY && key === process.env.WEBHOOK_API_KEY) return true
  const cookieStore = await cookies()
  if (cookieStore.get('auth_session')?.value) return true
  return false
}

/**
 * POST /api/products/recalculate-from-orders
 * Recomputes for each product from order_lines (non-cancelled orders):
 * - qty_sold = sum(qty_ordered)
 * - retail_price = max(customer_paid_per_unit) when product.retail_price is null/0
 * - current_stock = starting_qty - qty_sold
 * Then revenue/profit in the dashboard will show correctly.
 */
export async function POST(request: Request) {
  try {
    if (!(await authenticate(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const excludedStatuses = ['checkout-draft', 'cancelled', 'draft', 'refunded', 'failed']

    const { data: allLines, error: linesError } = await supabase
      .from('order_lines')
      .select('product_id, qty_ordered, customer_paid_per_unit, line_total, order_number')

    if (linesError) {
      return NextResponse.json({ error: linesError.message }, { status: 500 })
    }

    const orderNumbers = [...new Set((allLines || []).map((l: { order_number: string }) => l.order_number))]
    const { data: orders } = await supabase
      .from('orders')
      .select('order_number, order_status')
      .in('order_number', orderNumbers)

    const statusByOrder = new Map<string, string>()
    ;(orders || []).forEach((o: { order_number: string; order_status: string }) => {
      statusByOrder.set(o.order_number, o.order_status || '')
    })

    const validLines = (allLines || []).filter(
      (line: { order_number: string }) => !excludedStatuses.includes(statusByOrder.get(line.order_number) || '')
    )

    const qtySoldByProduct = new Map<number, number>()
    const maxPriceByProduct = new Map<number, number>()

    validLines.forEach((line: { product_id: number; qty_ordered?: number; customer_paid_per_unit?: number; line_total?: number }) => {
      const pid = line.product_id
      const qty = Number(line.qty_ordered) || 0
      qtySoldByProduct.set(pid, (qtySoldByProduct.get(pid) || 0) + qty)
      let price = Number(line.customer_paid_per_unit) || 0
      if (price <= 0 && qty > 0) {
        const total = Number(line.line_total) || 0
        price = total / qty
      }
      if (price > 0) {
        const existing = maxPriceByProduct.get(pid)
        if (existing == null || price > existing) maxPriceByProduct.set(pid, price)
      }
    })

    const { data: products } = await supabase.from('products').select('product_id, starting_qty, retail_price')

    let updated = 0
    for (const product of products || []) {
      const pid = product.product_id
      const qtySold = qtySoldByProduct.get(pid) ?? 0
      const startingQty = Number(product.starting_qty) ?? 0
      const currentStock = Math.max(0, startingQty - qtySold)

      const updates: Record<string, unknown> = {
        qty_sold: qtySold,
        current_stock: currentStock,
      }

      const currentRetail = product.retail_price != null ? Number(product.retail_price) : null
      const maxPrice = maxPriceByProduct.get(pid)
      if ((currentRetail == null || currentRetail === 0) && maxPrice != null && maxPrice > 0) {
        updates.retail_price = maxPrice
      }

      const { error: updateError } = await supabase
        .from('products')
        .update(updates)
        .eq('product_id', pid)

      if (!updateError) updated++
    }

    return NextResponse.json({
      success: true,
      message: `Recalculated from orders: ${updated} products updated (qty_sold, current_stock, retail_price where missing).`,
      updated,
    })
  } catch (e) {
    console.error('POST /api/products/recalculate-from-orders:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Recalculate failed' },
      { status: 500 }
    )
  }
}
