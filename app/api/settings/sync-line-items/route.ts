import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WooCommerceClient } from '@/lib/sync/woocommerce-client'
import { syncOrderLineItemsFromWoo } from '@/lib/sync/sync-order-line-items'

export const dynamic = 'force-dynamic'

/** Max orders to sync per request to avoid 504 (Vercel ~10–60s timeout) */
const BATCH_SIZE = 15

/**
 * POST /api/settings/sync-line-items
 * Sync line items from WooCommerce for orders that are missing them.
 * Processes in batches so the request finishes within serverless timeout.
 * Client can call again while hasMore is true to sync more.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await request.json().catch(() => ({}))
    const force = body.force === true

    const storeUrl = process.env.WOOCOMMERCE_STORE_URL
    const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY
    const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET

    if (!storeUrl || !consumerKey || !consumerSecret) {
      return NextResponse.json(
        { error: 'WooCommerce credentials not configured' },
        { status: 500 }
      )
    }

    const wooClient = new WooCommerceClient({
      storeUrl,
      consumerKey,
      consumerSecret,
    })

    // Orders that already have line items (so we skip them unless force)
    let ordersWithLines = new Set<string>()
    if (!force) {
      const { data: lines } = await supabase
        .from('order_lines')
        .select('order_number')
      lines?.forEach((r) => ordersWithLines.add(String(r.order_number)))
    }

    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('order_number, woo_order_id')
      .not('woo_order_id', 'is', null)
      .limit(500)

    if (ordersError) {
      return NextResponse.json(
        { error: ordersError.message || 'Failed to load orders' },
        { status: 500 }
      )
    }

    const needSync = (allOrders || []).filter(
      (o) => force || !ordersWithLines.has(String(o.order_number))
    )
    const batch = needSync.slice(0, BATCH_SIZE)
    const hasMore = needSync.length > BATCH_SIZE

    let synced = 0
    let errors = 0
    const messages: string[] = []

    for (const order of batch) {
      try {
        const result = await syncOrderLineItemsFromWoo(order.order_number, {
          supabase,
          wooClient,
        })
        if (result.success && result.line_items_synced > 0) {
          synced++
        } else if (!result.success && result.error) {
          errors++
          messages.push(`Order ${order.order_number}: ${result.error}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`Error syncing line items for order ${order.order_number}:`, err)
        errors++
        messages.push(`Order ${order.order_number}: ${msg}`)
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      errors,
      total: batch.length,
      hasMore,
      remaining: Math.max(0, needSync.length - BATCH_SIZE),
      message:
        messages.length > 0 ? messages.slice(0, 5).join('; ') : undefined,
    })
  } catch (error) {
    console.error('Error syncing line items:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync line items',
      },
      { status: 500 }
    )
  }
}
