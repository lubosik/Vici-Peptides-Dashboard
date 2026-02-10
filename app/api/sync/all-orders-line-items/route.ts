/**
 * Sync ALL orders from WooCommerce using "Retrieve an order" (GET orders/<id>) one by one,
 * then insert each order's line items into the dashboard.
 *
 * Uses GET /wp-json/wc/v3/orders/<id> for each order so line_items are complete.
 * Processes in batches to avoid serverless timeout; call repeatedly with nextOffset until hasMore is false.
 *
 * POST body or query: offset (default 0), limit (default 10)
 * Returns: { success, synced, errors, total, hasMore, nextOffset, message }
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { WooCommerceClient } from '@/lib/sync/woocommerce-client'
import { normalizeOrder } from '@/lib/sync/woocommerce-normalizer'
import { syncOrderLineItemsFromWooOrder } from '@/lib/sync/sync-order-line-items'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const storeUrl = process.env.WOOCOMMERCE_STORE_URL
    const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY
    const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET
    if (!storeUrl || !consumerKey || !consumerSecret) {
      return NextResponse.json(
        { error: 'WooCommerce credentials not configured' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const offset = Math.max(0, Number(body.offset ?? request.nextUrl.searchParams.get('offset') ?? 0))
    const limit = Math.min(25, Math.max(1, Number(body.limit ?? request.nextUrl.searchParams.get('limit') ?? 10)))

    const supabase = createAdminClient()
    const wooClient = new WooCommerceClient({ storeUrl, consumerKey, consumerSecret })

    // 1) Fetch all order IDs from WooCommerce (list orders, paginate)
    const allOrderIds: { id: number; number: string }[] = []
    let page = 1
    while (true) {
      const result = await wooClient.fetchOrders({ page, perPage: 100 })
      if (!result.orders?.length) break
      for (const o of result.orders) {
        allOrderIds.push({
          id: Number(o.id) || 0,
          number: o.number != null ? String(o.number) : String(o.id),
        })
      }
      if (result.orders.length < 100) break
      page++
    }

    const total = allOrderIds.length
    const batch = allOrderIds.slice(offset, offset + limit)
    let synced = 0
    let errors = 0
    const errorMessages: string[] = []

    // 2) For each order in batch: GET orders/<id>, upsert order, then sync line items
    for (const { id: orderId } of batch) {
      if (orderId <= 0) continue
      try {
        const wooOrder = await wooClient.getOrder(orderId)
        const { order } = normalizeOrder(wooOrder)

        const { error: orderErr } = await supabase
          .from('orders')
          .upsert(order, { onConflict: 'order_number' })

        if (orderErr) {
          errors++
          errorMessages.push(`Order ${orderId}: ${orderErr.message}`)
          continue
        }

        const { line_items_synced } = await syncOrderLineItemsFromWooOrder(
          supabase,
          wooClient,
          wooOrder,
          order.order_number
        )
        synced++
      } catch (e) {
        errors++
        const msg = e instanceof Error ? e.message : String(e)
        errorMessages.push(`Order ${orderId}: ${msg}`)
      }
    }

    const hasMore = offset + limit < total
    const nextOffset = offset + batch.length

    revalidatePath('/orders')
    revalidatePath('/products')
    revalidatePath('/analytics')
    revalidatePath('/')

    return NextResponse.json({
      success: true,
      synced,
      errors,
      total,
      hasMore,
      nextOffset: hasMore ? nextOffset : undefined,
      message:
        errors > 0
          ? `Processed ${batch.length} orders: ${synced} synced, ${errors} errors. ${errorMessages.slice(0, 3).join('; ')}`
          : `Synced ${synced} orders (${nextOffset}/${total}). ${hasMore ? `Call again with offset=${nextOffset} to continue.` : 'All done.'}`,
    })
  } catch (error) {
    console.error('All-orders-line-items sync failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}

/** GET with ?offset=0&limit=10 - same as POST, for easy triggering from browser or Make.com */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const offset = searchParams.get('offset') ?? '0'
  const limit = searchParams.get('limit') ?? '10'
  return POST(
    new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ offset: Number(offset), limit: Number(limit) }),
    })
  )
}
