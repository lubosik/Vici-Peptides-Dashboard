/**
 * POST or PATCH /api/orders/update-status
 * Update a single order's status (for Make.com). Use this if the dynamic route
 * /api/orders/[orderId]/status returns 404 (e.g. before redeploy).
 * Auth: x-api-key header or api_key query (same WEBHOOK_API_KEY as order webhook).
 * Body: { "order_id": 2654, "order_status": "completed" }
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

export async function POST(request: NextRequest) {
  return updateStatus(request)
}

export async function PATCH(request: NextRequest) {
  return updateStatus(request)
}

async function updateStatus(request: NextRequest) {
  try {
    if (!authenticate(request)) {
      return NextResponse.json(
        { error: 'Unauthorized. Send x-api-key header or api_key query with your WEBHOOK_API_KEY.' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const orderId =
      typeof body.order_id === 'number' && !Number.isNaN(body.order_id)
        ? Math.floor(body.order_id)
        : typeof body.order_id === 'string'
          ? parseInt(body.order_id, 10)
          : null
    const orderStatus =
      (typeof body.order_status === 'string' && body.order_status.trim()) ||
      (typeof body.status === 'string' && body.status.trim()) ||
      null

    if (orderId == null || !Number.isInteger(orderId) || orderId < 1) {
      return NextResponse.json(
        { error: 'Missing or invalid order_id. Send JSON body: { "order_id": 2654, "order_status": "completed" }.' },
        { status: 400 }
      )
    }

    if (!orderStatus) {
      return NextResponse.json(
        { error: 'Missing order_status. Send JSON body: { "order_id": 2654, "order_status": "completed" }.' },
        { status: 400 }
      )
    }

    const statusLower = orderStatus.toLowerCase().trim()
    if (!ALLOWED_STATUSES.includes(statusLower)) {
      return NextResponse.json(
        { error: `Invalid order_status. Allowed: ${ALLOWED_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data: byWooId } = await supabase
      .from('orders')
      .select('order_number, order_status, woo_order_id')
      .eq('woo_order_id', orderId)
      .maybeSingle()

    let order = byWooId
    if (!order) {
      const { data: byOrderNumber } = await supabase
        .from('orders')
        .select('order_number, order_status, woo_order_id')
        .eq('order_number', `Order #${orderId}`)
        .maybeSingle()
      order = byOrderNumber ?? null
    }

    if (!order) {
      return NextResponse.json(
        {
          error: 'Order not found',
          order_id: orderId,
          message: `No order with ID ${orderId}. Ensure the order exists in the dashboard.`,
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
    revalidatePath(`/orders/${orderId}`)

    return NextResponse.json({
      success: true,
      message: `Order ${updated.order_number} status updated to "${updated.order_status}".`,
      order_number: updated.order_number,
      woo_order_id: updated.woo_order_id,
      order_status: updated.order_status,
    })
  } catch (e) {
    console.error('POST/PATCH /api/orders/update-status:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update order status' },
      { status: 500 }
    )
  }
}
