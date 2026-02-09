import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/backfill-line-item-costs
 * Backfill order_lines.our_cost_per_unit from products.our_cost for lines with 0 or null cost.
 * DB triggers will recompute line_cost, line_profit, and roll up to orders.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()

    const { data: lines, error: fetchError } = await supabase
      .from('order_lines')
      .select('line_id, product_id, our_cost_per_unit')
      .or('our_cost_per_unit.is.null,our_cost_per_unit.eq.0')

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!lines?.length) {
      return NextResponse.json({
        updated: 0,
        message: 'No line items need backfill (all have cost)',
      })
    }

    const productIds = [...new Set(lines.map((l) => l.product_id))]
    const { data: products } = await supabase
      .from('products')
      .select('product_id, our_cost')
      .in('product_id', productIds)

    const costMap = new Map<number, number>()
    products?.forEach((p) => {
      const cost = p.our_cost != null && !isNaN(Number(p.our_cost)) ? Number(p.our_cost) : 0
      costMap.set(p.product_id, cost)
    })

    let updated = 0
    for (const line of lines) {
      const cost = costMap.get(line.product_id) ?? 0
      if (cost <= 0) continue

      const { error: updateErr } = await supabase
        .from('order_lines')
        .update({ our_cost_per_unit: cost })
        .eq('line_id', line.line_id)

      if (!updateErr) updated++
    }

    revalidatePath('/orders')
    revalidatePath('/products')
    revalidatePath('/')
    revalidatePath('/analytics')

    return NextResponse.json({
      updated,
      total_checked: lines.length,
      message: `Backfilled ${updated} line items with product cost`,
    })
  } catch (error) {
    console.error('Error backfilling line item costs:', error)
    return NextResponse.json(
      {
        error: 'Failed to backfill line item costs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
