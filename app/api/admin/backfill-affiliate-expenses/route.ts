import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertAffiliateExpenseForOrder } from '@/lib/expenses/affiliate-expense'
import { EXCLUDED_ORDER_STATUSES } from '@/lib/queries/order-filters'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/admin/backfill-affiliate-expenses
 *
 * Create/update affiliate expenses (10% of order_total) for all existing orders
 * that used a coupon (coupon_discount > 0), excluding draft/cancelled/on-hold/etc.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()

    const { data: orders, error } = await supabase
      .from('orders')
      .select('order_number, woo_order_id, order_total, coupon_discount, coupon_code, order_status')
      .gt('order_total', 0)
      .gt('coupon_discount', 0)

    if (error) {
      console.error('backfill-affiliate-expenses: failed to fetch orders', error)
      return NextResponse.json(
        { error: 'Failed to fetch orders for backfill', details: error.message },
        { status: 500 }
      )
    }

    const excluded = new Set(EXCLUDED_ORDER_STATUSES.map((s) => s.toLowerCase()))
    let created = 0
    let updated = 0

    for (const order of orders || []) {
      const status = (order.order_status as string | null | undefined)?.toLowerCase() ?? ''
      if (excluded.has(status)) continue

      const result = await upsertAffiliateExpenseForOrder(supabase, {
        order_number: order.order_number as string,
        woo_order_id: (order.woo_order_id as number | null) ?? null,
        order_total: Number(order.order_total) || 0,
        coupon_discount: Number(order.coupon_discount) || 0,
        coupon_code: (order.coupon_code as string | null) ?? null,
      })

      if (result.created) created++
      if (result.updated) updated++
    }

    revalidatePath('/expenses')
    revalidatePath('/')
    revalidatePath('/analytics')

    return NextResponse.json({
      success: true,
      created,
      updated,
      message: `Affiliate expenses backfill complete. Created: ${created}, updated: ${updated}.`,
    })
  } catch (error) {
    console.error('Error backfilling affiliate expenses:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Failed to backfill affiliate expenses',
        message,
      },
      { status: 500 }
    )
  }
}

