/**
 * ShipStation Webhook Handler
 * POST /api/webhooks/shipstation
 *
 * ShipStation webhook delivery URL: https://dashboard.vicipeptides.com/api/webhooks/shipstation
 * Event type to subscribe to: SHIP_NOTIFY
 *
 * ShipStation sends: { resource_url: string, resource_type: "SHIP_NOTIFY" }
 * We fetch the resource_url to get shipment details, then update the order.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { createShipStationClient } from '@/lib/shipstation/client'

export const dynamic = 'force-dynamic'

function authenticate(request: NextRequest): boolean {
  const key = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('api_key')
  if (!process.env.WEBHOOK_API_KEY) return true
  return key === process.env.WEBHOOK_API_KEY
}

export async function POST(request: NextRequest) {
  try {
    if (!authenticate(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const resourceUrl = body.resource_url as string | undefined
    const resourceType = body.resource_type as string | undefined

    if (!resourceUrl) {
      return NextResponse.json({ error: 'Missing resource_url in payload' }, { status: 400 })
    }

    // Only handle SHIP_NOTIFY — acknowledge other events without error
    if (resourceType && resourceType !== 'SHIP_NOTIFY') {
      return NextResponse.json({ status: 'ignored', reason: `Unsupported event type: ${resourceType}` })
    }

    // Create ShipStation client — fail clearly if creds missing
    let client
    try {
      client = createShipStationClient()
    } catch {
      console.error('[SHIPSTATION WEBHOOK] Missing credentials')
      return NextResponse.json({ error: 'ShipStation credentials not configured. Set SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET.' }, { status: 500 })
    }

    // Fetch shipment data from ShipStation
    const shipmentsData = await client.fetchResourceUrl(resourceUrl)
    const shipments = shipmentsData.shipments ?? []

    const supabase = createAdminClient()
    const processed: Array<{ orderNumber: string; trackingNumber: string; found: boolean }> = []

    for (const shipment of shipments) {
      if (shipment.voided) continue

      const { orderNumber, trackingNumber, shipDate, shipmentId } = shipment
      if (!orderNumber) continue

      // Try multiple formats to find the order:
      // 1. "Order #3024" (our stored format)
      // 2. Raw numeric woo_order_id
      const formattedOrderNumber = `Order #${orderNumber}`
      const numericId = parseInt(orderNumber, 10)

      let order: { order_number: string } | null = null

      const { data: byOrderNumber } = await supabase
        .from('orders')
        .select('order_number')
        .eq('order_number', formattedOrderNumber)
        .maybeSingle()

      if (byOrderNumber) {
        order = byOrderNumber
      } else if (!isNaN(numericId)) {
        const { data: byWooId } = await supabase
          .from('orders')
          .select('order_number')
          .eq('woo_order_id', numericId)
          .maybeSingle()
        if (byWooId) order = byWooId
      }

      if (!order) {
        console.warn(`[SHIPSTATION WEBHOOK] Order not found for orderNumber: ${orderNumber}`)
        processed.push({ orderNumber, trackingNumber, found: false })
        continue
      }

      // Update order: set shipped status and tracking info
      const updateData: Record<string, unknown> = {
        order_status: 'shipped',
        shipped_at: shipDate ? new Date(shipDate).toISOString() : new Date().toISOString(),
        shipstation_shipment_id: String(shipmentId),
      }
      // Only set tracking_number if not already populated
      if (trackingNumber) {
        const { data: existing } = await supabase
          .from('orders')
          .select('tracking_number')
          .eq('order_number', order.order_number)
          .maybeSingle()
        if (!existing?.tracking_number) {
          updateData.tracking_number = trackingNumber
        }
      }

      await supabase
        .from('orders')
        .update(updateData)
        .eq('order_number', order.order_number)

      processed.push({ orderNumber: order.order_number, trackingNumber, found: true })
    }

    revalidatePath('/')
    revalidatePath('/orders')

    return NextResponse.json({
      status: 'ok',
      resource_type: resourceType,
      processed: processed.filter((p) => p.found).length,
      skipped: processed.filter((p) => !p.found).length,
      shipments: processed,
    })
  } catch (error: unknown) {
    console.error('[SHIPSTATION WEBHOOK] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Vici ShipStation Webhook',
    url: 'POST /api/webhooks/shipstation',
    events: ['SHIP_NOTIFY'],
    note: 'Register in ShipStation: Account Settings → Webhooks → Subscribe → SHIP_NOTIFY. Target URL: https://dashboard.vicipeptides.com/api/webhooks/shipstation',
  })
}
