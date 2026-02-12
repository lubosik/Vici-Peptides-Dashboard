import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['In Stock', 'OUT OF STOCK']

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

    const body = await request.json()
    const stockStatus = typeof body.stockStatus === 'string' ? body.stockStatus.trim() : null
    if (!stockStatus || !VALID_STATUSES.includes(stockStatus)) {
      return NextResponse.json(
        { error: 'stockStatus must be "In Stock" or "OUT OF STOCK"' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('products')
      .update({ stock_status_override: stockStatus })
      .eq('product_id', id)
      .select('product_id, stock_status, stock_status_override')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      product_id: data.product_id,
      stock_status_override: data.stock_status_override,
      display_status: data.stock_status_override ?? data.stock_status,
    })
  } catch (e) {
    console.error('PATCH /api/products/[productId]/stock:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update stock' },
      { status: 500 }
    )
  }
}
