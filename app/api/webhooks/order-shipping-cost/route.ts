/**
 * POST /api/webhooks/order-shipping-cost
 * Make.com calls this after fetching Shippo label cost for an order.
 * Always overwrites the order's shipping_cost (whether there's a value already or not).
 * Optionally creates or updates the shipping expense for that order (one per order, amount updated on re-fetch).
 * Auth: x-api-key header (WEBHOOK_API_KEY).
 * Body: { order_id?: number, order_number?: string, shipping_cost: number, create_expense?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTodayInMiami } from '@/lib/datetime'

export const dynamic = 'force-dynamic'

function authenticate(request: NextRequest): boolean {
  const key = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('api_key')
  if (!process.env.WEBHOOK_API_KEY) return true
  return key === process.env.WEBHOOK_API_KEY
}

export async function POST(request: NextRequest) {
  try {
    if (!authenticate(request)) {
      return NextResponse.json({ error: 'Unauthorized. Send x-api-key with WEBHOOK_API_KEY.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const orderId = body.order_id != null ? Number(body.order_id) : null
    const orderNumber = typeof body.order_number === 'string' ? body.order_number.trim() : null
    const shippingCost = typeof body.shipping_cost === 'number' && !Number.isNaN(body.shipping_cost)
      ? Math.round(body.shipping_cost * 100) / 100
      : typeof body.shipping_cost === 'string'
        ? Math.round(parseFloat(body.shipping_cost) * 100) / 100
        : null
    const createExpense = body.create_expense !== false

    if (shippingCost == null || shippingCost < 0) {
      return NextResponse.json({ error: 'shipping_cost (number) is required' }, { status: 400 })
    }
    if (!orderId && !orderNumber) {
      return NextResponse.json({ error: 'order_id or order_number is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    let order: { order_number: string; woo_order_id: number | null } | null = null
    if (orderId != null) {
      const { data } = await supabase
        .from('orders')
        .select('order_number, woo_order_id')
        .eq('woo_order_id', orderId)
        .maybeSingle()
      order = data
    }
    if (!order && orderNumber) {
      const { data } = await supabase
        .from('orders')
        .select('order_number, woo_order_id')
        .eq('order_number', orderNumber)
        .maybeSingle()
      order = data
    }
    // If order_number was sent as #2654, also try matching by woo_order_id (DB has "Order #2654")
    if (!order && orderNumber && /^#?\d+$/.test(orderNumber.replace(/\s/g, ''))) {
      const numericId = parseInt(orderNumber.replace(/^#\s*/, ''), 10)
      if (!Number.isNaN(numericId)) {
        const { data } = await supabase
          .from('orders')
          .select('order_number, woo_order_id')
          .eq('woo_order_id', numericId)
          .maybeSingle()
        order = data
      }
    }
    if (!order) {
      return NextResponse.json({ error: 'Order not found', order_id: orderId, order_number: orderNumber }, { status: 404 })
    }

    // Always overwrite the order's shipping cost (whether there's a value already or not)
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        shipping_cost: shippingCost,
        shipping_cost_source: 'shippo_label_transaction',
        shipping_cost_last_synced_at: new Date().toISOString(),
      })
      .eq('order_number', order.order_number)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    let expenseCreated = false
    if (createExpense) {
      const { data: existingList } = await supabase
        .from('expenses')
        .select('expense_id')
        .eq('order_number', order.order_number)
        .eq('category', 'shipping')
        .limit(1)

      if (existingList?.length) {
        // Update existing expense so re-fetch overwrites wrong cost on dashboard
        await supabase
          .from('expenses')
          .update({ amount: shippingCost })
          .eq('order_number', order.order_number)
          .eq('category', 'shipping')
      } else {
        const { error: insertErr } = await supabase
          .from('expenses')
          .insert({
            expense_date: getTodayInMiami(),
            category: 'shipping',
            description: `Shipping cost for ${order.order_number}`,
            vendor: 'Shippo',
            amount: shippingCost,
            source: 'shippo_api',
            order_number: order.order_number,
          })
        expenseCreated = !insertErr
      }
    }

    revalidatePath('/')
    revalidatePath('/orders')
    revalidatePath(`/orders/${order.woo_order_id ?? order.order_number}`)
    revalidatePath('/expenses')

    return NextResponse.json({
      success: true,
      order_number: order.order_number,
      woo_order_id: order.woo_order_id,
      shipping_cost: shippingCost,
      expense_created: expenseCreated,
    })
  } catch (e) {
    console.error('POST /api/webhooks/order-shipping-cost:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update shipping cost' },
      { status: 500 }
    )
  }
}
