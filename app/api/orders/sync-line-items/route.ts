import { NextRequest, NextResponse } from 'next/server'
import { syncOrderLineItemsFromWoo } from '@/lib/sync/sync-order-line-items'

/**
 * Sync line items for a single order from WooCommerce.
 * POST body: { order_number: string } or query: order_number=
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const orderNumber = body.order_number ?? request.nextUrl.searchParams.get('order_number')
    if (!orderNumber || typeof orderNumber !== 'string') {
      return NextResponse.json(
        { error: 'Missing order_number' },
        { status: 400 }
      )
    }

    const result = await syncOrderLineItemsFromWoo(orderNumber)
    if (!result.success && result.error) {
      const status = result.error === 'Order not found' ? 404 : result.error === 'Order has no WooCommerce ID' || result.error === 'WooCommerce credentials not configured' ? 400 : 500
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json({
      success: true,
      order_number: result.order_number,
      line_items_synced: result.line_items_synced,
    })
  } catch (error) {
    console.error('Error syncing line items for order:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync line items' },
      { status: 500 }
    )
  }
}
