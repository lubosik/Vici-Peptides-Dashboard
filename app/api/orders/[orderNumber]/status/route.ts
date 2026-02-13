/**
 * PATCH /api/orders/[orderNumber]/status
 * Update a single order's status (for Make.com or manual integrations).
 * Path segment can be numeric WooCommerce order ID (e.g. 2654) or order_number.
 * Auth: x-api-key header or api_key query (same WEBHOOK_API_KEY as order webhook).
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function authenticate(request: NextRequest): boolean {
  const key = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('api_key')
  if (!process.env.WEBHOOK_API_KEY) return true
  return key === process.env.WEBHOOK_API_KEY
}

const ALLOWED_STATUSES = [
  'pending',
  'processing',
  'completed',
  'on-hold',
  'cancelled',
  'refunded',
  'failed',
  'checkout-draft',
  'draft',
]

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderNumber: string }> | { orderNumber: string } }
) {
  try {
    if (!authenticate(request)) {
      return NextResponse.json(
        { error: 'Unauthorized. Send x-api-key header or api_key query with your WEBHOOK_API_KEY.' },
        { status: 401 }
      )
    }

    const resolvedParams = context.params instanceof Promise ? await context.params : context.params
    const orderNumberRaw = (resolvedParams.orderNumber || '').trim()
    const orderIdNum = /^\d+$/.test(orderNumberRaw) ? parseInt(orderNumberRaw, 10) : null

    if (orderIdNum == null) {
      return NextResponse.json(
        { error: 'Invalid order ID. Use the numeric order ID (e.g. 2539).' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const orderStatus =
      (typeof body.order_status === 'string' && body.order_status.trim()) ||
      (typeof body.status === 'string' && body.status.trim()) ||
      null

    if (!orderStatus) {
      return NextResponse.json(
        {
          error: 'Missing order_status. Send JSON body: { "order_status": "completed" } (or "status").',
        },
        { status: 400 }
      )
    }

    const statusLower = orderStatus.toLowerCase().trim()
    if (!ALLOWED_STATUSES.includes(statusLower)) {
      return NextResponse.json(
        {
          error: `Invalid order_status. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
        },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Find order by woo_order_id (numeric) or order_number (e.g. "Order #2539")
    const { data: byWooId } = await supabase
      .from('orders')
      .select('order_number, order_status, woo_order_id')
      .eq('woo_order_id', orderIdNum)
      .maybeSingle()

    let order = byWooId
    if (!order) {
      const { data: byOrderNumber } = await supabase
        .from('orders')
        .select('order_number, order_status, woo_order_id')
        .eq('order_number', `Order #${orderIdNum}`)
        .maybeSingle()
      order = byOrderNumber ?? null
    }

    if (!order) {
      return NextResponse.json(
        {
          error: 'Order not found',
          order_id: orderIdNum,
          message: `No order with ID ${orderIdNum}. Ensure the order exists in the dashboard.`,
        },
        { status: 404 }
      )
    }

    const { data: updated, error } = order.woo_order_id != null
      ? await supabase
          .from('orders')
          .update({ order_status: statusLower })
          .eq('woo_order_id', order.woo_order_id)
          .select('order_number, woo_order_id, order_status')
          .single()
      : await supabase
          .from('orders')
          .update({ order_status: statusLower })
          .eq('order_number', order.order_number)
          .select('order_number, woo_order_id, order_status')
          .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath('/')
    revalidatePath('/orders')
    revalidatePath(`/orders/${orderIdNum}`)

    return NextResponse.json({
      success: true,
      message: `Order ${updated.order_number} status updated to "${updated.order_status}".`,
      order_number: updated.order_number,
      woo_order_id: updated.woo_order_id,
      order_status: updated.order_status,
    })
  } catch (e) {
    console.error('PATCH /api/orders/[orderNumber]/status:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update order status' },
      { status: 500 }
    )
  }
}
