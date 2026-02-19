import type { SupabaseClient } from '@supabase/supabase-js'
import { getTodayInMiami } from '@/lib/datetime'

interface AffiliateParams {
  order_number: string
  woo_order_id?: number | null
  order_total: number
  coupon_discount?: number | null
  coupon_code?: string | null
}

/**
 * Ensure an affiliate expense exists for an order that used a coupon.
 * - If no coupon was used, does nothing.
 * - If an affiliate expense already exists for this order, updates its amount.
 * - Otherwise inserts a new expense row.
 *
 * Affiliate amount: 10% of order_total.
 */
export async function upsertAffiliateExpenseForOrder(
  supabase: SupabaseClient,
  params: AffiliateParams
): Promise<{ created: boolean; updated: boolean }> {
  const { order_number, woo_order_id, order_total, coupon_discount, coupon_code } = params

  if (!order_number || !order_total || order_total <= 0) {
    return { created: false, updated: false }
  }

  const usedCoupon =
    (coupon_discount != null && Number(coupon_discount) > 0) ||
    (coupon_code != null && String(coupon_code).trim().length > 0)

  if (!usedCoupon) {
    return { created: false, updated: false }
  }

  const affiliateAmount = Math.round(order_total * 0.1 * 100) / 100
  if (!affiliateAmount || affiliateAmount <= 0) {
    return { created: false, updated: false }
  }

  const { data: existingList, error: existingErr } = await supabase
    .from('expenses')
    .select('expense_id')
    .eq('order_number', order_number)
    .eq('category', 'affiliate')
    .limit(1)

  if (existingErr) {
    console.error('upsertAffiliateExpenseForOrder: failed to check existing expenses', existingErr)
    return { created: false, updated: false }
  }

  const descriptionBase = `Affiliate payment for ${order_number}`
  const description = coupon_code
    ? `${descriptionBase} (coupon ${coupon_code})`
    : descriptionBase

  if (existingList && existingList.length > 0) {
    const expenseId = existingList[0].expense_id
    const { error: updateErr } = await supabase
      .from('expenses')
      .update({
        amount: affiliateAmount,
        description,
        vendor: 'Affiliate',
        source: 'affiliate_auto',
        metadata: coupon_code ? { coupon_code } : null,
      })
      .eq('expense_id', expenseId)

    if (updateErr) {
      console.error('upsertAffiliateExpenseForOrder: failed to update affiliate expense', updateErr)
      return { created: false, updated: false }
    }
    return { created: false, updated: true }
  }

  const { error: insertErr } = await supabase.from('expenses').insert({
    expense_date: getTodayInMiami(),
    category: 'affiliate',
    description,
    vendor: 'Affiliate',
    amount: affiliateAmount,
    source: 'affiliate_auto',
    order_number,
    order_id: woo_order_id ?? null,
    metadata: coupon_code ? { coupon_code } : null,
  })

  if (insertErr) {
    console.error('upsertAffiliateExpenseForOrder: failed to insert affiliate expense', insertErr)
    return { created: false, updated: false }
  }

  return { created: true, updated: false }
}

