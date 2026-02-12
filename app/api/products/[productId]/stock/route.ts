import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['In Stock', 'OUT OF STOCK']

/**
 * PATCH /api/products/[productId]/stock
 * Body (all optional; at least one required):
 *   - stockStatus: "In Stock" | "OUT OF STOCK"  (dashboard toggle)
 *   - starting_qty: number  (set inventory level; current_stock = starting_qty - qty_sold)
 * Used by dashboard and by Make.com to adjust stock levels.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await context.params
    const id = parseInt(productId, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const stockStatus = typeof body.stockStatus === 'string' ? body.stockStatus.trim() : null
    const startingQty = typeof body.starting_qty === 'number' && !Number.isNaN(body.starting_qty)
      ? Math.max(0, Math.floor(body.starting_qty))
      : null

    if (!stockStatus && startingQty === null) {
      return NextResponse.json(
        { error: 'Provide at least one of: stockStatus ("In Stock" | "OUT OF STOCK"), starting_qty (number)' },
        { status: 400 }
      )
    }

    if (stockStatus && !VALID_STATUSES.includes(stockStatus)) {
      return NextResponse.json(
        { error: 'stockStatus must be "In Stock" or "OUT OF STOCK"' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    if (startingQty !== null) {
      const { data: product } = await supabase
        .from('products')
        .select('qty_sold')
        .eq('product_id', id)
        .single()
      const qtySold = Number(product?.qty_sold) || 0
      const newCurrentStock = Math.max(0, startingQty - qtySold)
      const { data, error } = await supabase
        .from('products')
        .update({
          starting_qty: startingQty,
          current_stock: newCurrentStock,
          ...(stockStatus && { stock_status_override: stockStatus }),
        })
        .eq('product_id', id)
        .select('product_id, stock_status, stock_status_override, starting_qty, current_stock, qty_sold')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({
        success: true,
        product_id: data.product_id,
        stock_status_override: data.stock_status_override,
        display_status: data.stock_status_override ?? data.stock_status,
        starting_qty: data.starting_qty,
        current_stock: data.current_stock,
        qty_sold: data.qty_sold,
      })
    }

    const { data, error } = await supabase
      .from('products')
      .update({ stock_status_override: stockStatus })
      .eq('product_id', id)
      .select('product_id, stock_status, stock_status_override, starting_qty, current_stock, qty_sold')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      product_id: data.product_id,
      stock_status_override: data.stock_status_override,
      display_status: data.stock_status_override ?? data.stock_status,
      starting_qty: data.starting_qty,
      current_stock: data.current_stock,
      qty_sold: data.qty_sold,
    })
  } catch (e) {
    console.error('PATCH /api/products/[productId]/stock:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update stock' },
      { status: 500 }
    )
  }
}
