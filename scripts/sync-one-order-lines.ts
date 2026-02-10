/**
 * Sync ONE order from WooCommerce: GET order, show response, then upsert order + line items.
 * Usage: npx tsx scripts/sync-one-order-lines.ts [wooOrderId]
 * Example: npx tsx scripts/sync-one-order-lines.ts 2540
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { createAdminClient } from '../lib/supabase/admin'
import { WooCommerceClient } from '../lib/sync/woocommerce-client'
import { normalizeOrder } from '../lib/sync/woocommerce-normalizer'
import { syncOrderLineItemsFromWooOrder } from '../lib/sync/sync-order-line-items'

async function main() {
  const storeUrl = process.env.WOOCOMMERCE_STORE_URL
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET
  if (!storeUrl || !consumerKey || !consumerSecret) {
    console.error('Missing WooCommerce env. Set WOOCOMMERCE_STORE_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET in .env.local')
    process.exit(1)
  }

  const wooOrderId = process.argv[2] ? parseInt(process.argv[2], 10) : null
  if (!wooOrderId || wooOrderId < 1) {
    console.error('Usage: npx tsx scripts/sync-one-order-lines.ts <wooOrderId>')
    console.error('Example: npx tsx scripts/sync-one-order-lines.ts 2540')
    process.exit(1)
  }

  const supabase = createAdminClient()
  const wooClient = new WooCommerceClient({ storeUrl, consumerKey, consumerSecret })

  console.log('--- API REQUEST ---')
  console.log(`GET ${storeUrl.replace(/\/$/, '')}/wp-json/wc/v3/orders/${wooOrderId}`)
  console.log('')

  let wooOrder: any
  try {
    wooOrder = await wooClient.getOrder(wooOrderId)
  } catch (e) {
    console.error('WooCommerce API error:', e instanceof Error ? e.message : e)
    process.exit(1)
  }

  console.log('--- WHAT WE GOT FROM WOOCOMMERCE ---')
  console.log('Order id:', wooOrder?.id)
  console.log('Order number:', wooOrder?.number)
  console.log('Status:', wooOrder?.status)
  console.log('Customer:', wooOrder?.billing?.first_name, wooOrder?.billing?.last_name)
  console.log('Email:', wooOrder?.billing?.email)
  console.log('Total:', wooOrder?.total)
  console.log('Line items count:', Array.isArray(wooOrder?.line_items) ? wooOrder.line_items.length : 0)
  if (Array.isArray(wooOrder?.line_items) && wooOrder.line_items.length > 0) {
    console.log('')
    console.log('Line items:')
    wooOrder.line_items.forEach((item: any, i: number) => {
      console.log(`  ${i + 1}. ${item.name} | qty: ${item.quantity} | price: ${item.price} | total: ${item.total} | sku: ${item.sku || '—'}`)
    })
  }
  console.log('')

  const { order } = normalizeOrder(wooOrder)

  console.log('--- PUTTING INTO DASHBOARD ---')
  const { error: orderErr } = await supabase
    .from('orders')
    .upsert(order, { onConflict: 'order_number' })

  if (orderErr) {
    console.error('Order upsert failed:', orderErr.message)
    process.exit(1)
  }
  console.log('Order upserted:', order.order_number)

  const { line_items_synced } = await syncOrderLineItemsFromWooOrder(
    supabase,
    wooClient,
    wooOrder,
    order.order_number
  )
  console.log('Line items written:', line_items_synced)
  console.log('')
  console.log('Done. View this order at: /orders/' + wooOrderId + ' (or /orders/' + order.order_number + ')')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
