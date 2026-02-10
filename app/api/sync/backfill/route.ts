/**
 * Backfill products.qty_sold from order_lines (only counting non-draft/cancelled orders).
 * POST /api/sync/backfill
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = createAdminClient()

    const { data: lines, error: linesError } = await supabase
      .from('order_lines')
      .select(`
        product_id,
        qty_ordered,
        orders!inner(order_status)
      `)
      .not('orders.order_status', 'in', '("checkout-draft","cancelled","draft")')

    if (linesError) {
      return NextResponse.json({ error: linesError.message }, { status: 500 })
    }

    const qtyByProduct = new Map<number, number>()
    for (const row of lines || []) {
      const pid = Number(row.product_id)
      if (!pid) continue
      const qty = Number((row as any).qty_ordered) || 0
      qtyByProduct.set(pid, (qtyByProduct.get(pid) ?? 0) + qty)
    }

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('product_id')

    if (productsError) {
      return NextResponse.json({ error: productsError.message }, { status: 500 })
    }

    let updated = 0
    for (const p of products || []) {
      const productId = Number(p.product_id)
      const qty = qtyByProduct.get(productId) ?? 0
      const { error: upErr } = await supabase
        .from('products')
        .update({ qty_sold: qty })
        .eq('product_id', productId)
      if (!upErr) updated++
    }

    return NextResponse.json({
      success: true,
      updated,
      total_products: (products || []).length,
      message: `Backfilled qty_sold for ${updated} products`,
    })
  } catch (error) {
    console.error('Backfill failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backfill failed' },
      { status: 500 }
    )
  }
}
