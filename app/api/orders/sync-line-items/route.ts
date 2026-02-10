import { NextRequest, NextResponse } from 'next/server'
import { syncOrderLineItemsFromWoo } from '@/lib/sync/sync-order-line-items'
import { syncOrderAndLineItemsByWooId } from '@/lib/sync/sync-order-line-items'

/**
 * Sync line items for a single order from WooCommerce.
 * POST body: { order_number?: string, woo_order_id?: number } (each order's button sends its own ids)
 * If woo_order_id is provided we GET orders/<id>, upsert order, then sync line items.
 * Otherwise we look up by order_number and do the same.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const orderNumber = body.order_number ?? request.nextUrl.searchParams.get('order_number')
    const wooOrderId = body.woo_order_id != null ? Number(body.woo_order_id) : NaN

    if (wooOrderId > 0) {
      const result = await syncOrderAndLineItemsByWooId(wooOrderId)
      if (!result.success && result.error) {
        const status = result.error === 'Order not found' ? 404 : 500
        return NextResponse.json({ error: result.error }, { status })
      }
      return NextResponse.json({
        success: true,
        order_number: result.order_number,
        line_items_synced: result.line_items_synced,
      })
    }

    if (!orderNumber || typeof orderNumber !== 'string') {
      return NextResponse.json(
        { error: 'Missing order_number or woo_order_id' },
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
