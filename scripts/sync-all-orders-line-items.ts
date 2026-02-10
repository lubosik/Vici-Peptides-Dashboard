/**
 * One-by-one sync of ALL orders and line items from WooCommerce API into the dashboard.
 * Uses GET /wp-json/wc/v3/orders/<id> for each order — exact API results, no made-up data.
 * Run from terminal to avoid browser timeouts ("message port closed").
 *
 * Usage: npx tsx scripts/sync-all-orders-line-items.ts
 * Or:    npm run sync-line-items
 *
 * If you see "trigger functions can only be called as triggers" on order upsert:
 * Apply the migration in supabase/migrations/20260210000001_fix_trigger_call_order_totals.sql
 * via Supabase Dashboard → SQL Editor (paste and run), then re-run this script.
 *
 * Console errors like "content.js", "inject.bundle.js" come from browser extensions, not this app.
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { createAdminClient } from '../lib/supabase/admin'
import { WooCommerceClient } from '../lib/sync/woocommerce-client'
import { normalizeOrder } from '../lib/sync/woocommerce-normalizer'
import { syncOrderLineItemsFromWooOrder } from '../lib/sync/sync-order-line-items'

const DELAY_MS = 550

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

  console.log('Fetching order IDs from WooCommerce...')
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
  console.log(`Found ${total} orders. Syncing one by one (GET orders/<id>), ${DELAY_MS}ms between requests.\n`)

  let synced = 0
  let errors = 0
  for (let i = 0; i < orderIds.length; i++) {
    const orderId = orderIds[i]
    try {
      const wooOrder = await wooClient.getOrder(orderId)
      const { order } = normalizeOrder(wooOrder)

      const { error: orderErr } = await supabase
        .from('orders')
        .upsert(order, { onConflict: 'order_number' })

      if (orderErr) {
        console.error(`[${i + 1}/${total}] Order ${orderId} upsert failed:`, orderErr.message)
        errors++
        await sleep(DELAY_MS)
        continue
      }

      const { line_items_synced } = await syncOrderLineItemsFromWooOrder(
        supabase,
        wooClient,
        wooOrder,
        order.order_number
      )
      synced++
      if ((i + 1) % 20 === 0 || i === orderIds.length - 1) {
        console.log(`[${i + 1}/${total}] Order ${orderId} — ${line_items_synced} line items`)
      }
    } catch (e) {
      console.error(`[${i + 1}/${total}] Order ${orderId} error:`, e instanceof Error ? e.message : e)
      errors++
    }
    await sleep(DELAY_MS)
  }

  console.log(`\nDone. Synced ${synced}/${total} orders, ${errors} errors. Line items are in the dashboard.`)
  process.exit(errors > 0 ? 1 : 0)
}

main()
