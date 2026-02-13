/**
 * POST /api/orders/[orderNumber]/fetch-shippo-cost
 * Sends order details to Make.com webhook so the scenario can fetch Shippo label cost
 * and call back to set shipping_cost on the order (and optionally create expense).
 * Requires dashboard session (user must be logged in).
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderNumber: string }> | { orderNumber: string } }
) {
  try {
    const cookieStore = await cookies()
    if (!cookieStore.get('auth_session')?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = context.params instanceof Promise ? await context.params : context.params
    const orderNumber = (resolvedParams.orderNumber || '').trim()
    if (!orderNumber) {
      return NextResponse.json({ error: 'Missing order number' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const numericId = /^\d+$/.test(orderNumber) ? parseInt(orderNumber, 10) : null

    let order: { order_number: string; woo_order_id: number | null; shippo_transaction_object_id: string | null } | null = null
    if (numericId != null) {
      const { data } = await supabase
        .from('orders')
        .select('order_number, woo_order_id, shippo_transaction_object_id')
        .eq('woo_order_id', numericId)
        .maybeSingle()
      order = data
    }
    if (!order) {
      const { data } = await supabase
        .from('orders')
        .select('order_number, woo_order_id, shippo_transaction_object_id')
        .eq('order_number', orderNumber)
        .maybeSingle()
      order = data
    }
    if (!order) {
      const { data } = await supabase
        .from('orders')
        .select('order_number, woo_order_id, shippo_transaction_object_id')
        .ilike('order_number', `%${orderNumber}%`)
        .limit(1)
        .maybeSingle()
      order = data
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Always send order_number as #<id> (e.g. #2654) for Make.com/Shippo
    const numericId =
      order.woo_order_id != null
        ? String(order.woo_order_id)
        : (order.order_number || '').replace(/^[#\s]*(?:Order\s*#?\s*)?/i, '').trim() || order.order_number
    const orderNumberForWebhook = numericId ? `#${numericId.replace(/^#/, '')}` : order.order_number

    const webhookUrl = process.env.MAKE_COM_SHIPPO_WEBHOOK_URL || 'https://hook.us2.make.com/9l9y4ysr3hcvak6rpf29oej4bi5fuvko'
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_number: orderNumberForWebhook,
        woo_order_id: order.woo_order_id,
        shippo_transaction_object_id: order.shippo_transaction_object_id || undefined,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `Webhook returned ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, message: 'Order sent to Make.com. Shipping cost will update when the scenario runs.' })
  } catch (e) {
    console.error('POST fetch-shippo-cost:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to send order to webhook' },
      { status: 500 }
    )
  }
}
