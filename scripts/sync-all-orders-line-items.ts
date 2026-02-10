/**
 * Sync ALL orders and their line items from WooCommerce into the dashboard.
 *
 * For each order:
 *  1. GET https://vicipeptides.com/wp-json/wc/v3/orders/<id> (exact API response, no made-up data)
 *  2. Upsert the order into `orders` so the order exists (order_number = "Order #<id>", woo_order_id = id)
 *  3. Upsert each line item into `order_lines` with order_id = Woo order id and order_number matching the order
 *
 * Result:
 *  - Order detail page (/orders/<id>) shows that order's line items
 *  - Orders list "Items" column shows the count of line items per order
 *
 * Usage: npm run sync-line-items
 * Or:    npx tsx scripts/sync-all-orders-line-items.ts
 *
 * If you see "trigger functions can only be called as triggers", apply
 * supabase/migrations/20260210000001_fix_trigger_call_order_totals.sql in Supabase SQL Editor first.
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { createAdminClient } from '../lib/supabase/admin'
import { WooCommerceClient } from '../lib/sync/woocommerce-client'
import { normalizeOrder } from '../lib/sync/woocommerce-normalizer'
import { syncOrderLineItemsFromWooOrder } from '../lib/sync/sync-order-line-items'

const DELAY_MS = 350

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const storeUrl = process.env.WOOCOMMERCE_STORE_URL
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET
  if (!storeUrl || !consumerKey || !consumerSecret) {
    console.error('Missing WooCommerce env: WOOCOMMERCE_STORE_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET')
    process.exit(1)
  }

  const supabase = createAdminClient()
  const wooClient = new WooCommerceClient({ storeUrl, consumerKey, consumerSecret })

  console.log('Fetching all order IDs from WooCommerce...')
  const orderIds: number[] = []
  let page = 1
  while (true) {
    const result = await wooClient.fetchOrders({ page, perPage: 100 })
    if (!result.orders?.length) break
    for (const o of result.orders) {
      const id = Number(o.id)
      if (id > 0) orderIds.push(id)
    }
    if (result.orders.length < 100) break
    page++
  }

  const total = orderIds.length
  const startFrom = Math.max(0, parseInt(process.env.SYNC_START_FROM ?? '0', 10))
  if (startFrom > 0) {
    console.log(`Resuming from order index ${startFrom} (skipping first ${startFrom} orders).\n`)
  }
  console.log(`Found ${total} orders. For each order we will:\n  1) GET orders/<id>\n  2) Upsert order into dashboard\n  3) Upsert line items into order_lines (so order page + Items column show them)\n`)
  console.log(`Running one request per order, ${DELAY_MS}ms delay between requests.\n`)

  let synced = 0
  let errors = 0
  let totalLineItemsWritten = 0

  for (let i = startFrom; i < orderIds.length; i++) {
    const orderId = orderIds[i]
    try {
      const wooOrder = await wooClient.getOrder(orderId)
      const { order } = normalizeOrder(wooOrder)

      // Ensure order exists so the order detail page and FK for order_lines work
      const { error: orderErr } = await supabase
        .from('orders')
        .upsert(order, { onConflict: 'order_number' })

      if (orderErr) {
        console.error(`[${i + 1}/${total}] Order ${orderId} upsert failed:`, orderErr.message)
        errors++
        await sleep(DELAY_MS)
        continue
      }

      // Write line items for this order into order_lines (order_id + order_number so detail page and Items count work)
      const { line_items_synced } = await syncOrderLineItemsFromWooOrder(
        supabase,
        wooClient,
        wooOrder,
        order.order_number
      )

      totalLineItemsWritten += line_items_synced
      synced++

      if ((i + 1) % 25 === 0 || i === orderIds.length - 1) {
        console.log(`[${i + 1}/${total}] Order ${orderId} → ${line_items_synced} line items (total lines written: ${totalLineItemsWritten})`)
      }
    } catch (e) {
      console.error(`[${i + 1}/${total}] Order ${orderId} error:`, e instanceof Error ? e.message : e)
      errors++
    }
    await sleep(DELAY_MS)
  }

  console.log(`\nDone. Orders synced: ${synced}/${total}. Line items written: ${totalLineItemsWritten}. Errors: ${errors}.`)
  console.log('Order detail pages (/orders/<id>) and the Orders list "Items" column will now show this data.')
  process.exit(errors > 0 ? 1 : 0)
}

main()
