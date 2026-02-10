/**
 * Server-side sync of order line items from WooCommerce.
 * Used by API route and order detail page so line items always have product_id that exists.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { WooCommerceClient } from '@/lib/sync/woocommerce-client'

/** Get cost from WooCommerce line item meta_data */
function getCostFromMeta(lineItem: any): number | null {
  if (lineItem?.meta_data && Array.isArray(lineItem.meta_data)) {
    for (const meta of lineItem.meta_data) {
      const key = (meta?.key || '').toLowerCase()
      if (['our_cost', '_our_cost', 'cost_price', '_cost', 'cost', '_wc_cog_item_cost'].includes(key)) {
        const val = parseFloat(meta?.value)
        if (!isNaN(val) && val > 0) return val
      }
    }
  }
  return null
}

/** Get product cost from products table */
async function getProductCost(supabase: SupabaseClient, productId: number): Promise<number> {
  const { data } = await supabase
    .from('products')
    .select('our_cost')
    .eq('product_id', productId)
    .maybeSingle()
  const cost = data?.our_cost
  return cost != null && !isNaN(Number(cost)) ? Number(cost) : 0
}

async function ensureProduct(
  supabase: SupabaseClient,
  wooProductId: number,
  name: string,
  price: string | number
): Promise<number> {
  const pid = Number(wooProductId) || 0
  if (pid <= 0) return 0
  const { data: byWoo } = await supabase
    .from('products')
    .select('product_id')
    .eq('woo_product_id', pid)
    .maybeSingle()
  if (byWoo) return Number(byWoo.product_id)
  const { data: byId } = await supabase
    .from('products')
    .select('product_id')
    .eq('product_id', pid)
    .maybeSingle()
  if (byId) return Number(byId.product_id)
  const { data: created } = await supabase
    .from('products')
    .upsert(
      {
        product_id: pid,
        woo_product_id: pid,
        product_name: name || `Product ${pid}`,
        our_cost: null,
        retail_price: parseFloat(String(price || '0')) || null,
        current_stock: null,
        stock_status: 'OUT OF STOCK',
      },
      { onConflict: 'woo_product_id' }
    )
    .select('product_id')
    .single()
  return created?.product_id ? Number(created.product_id) : pid
}

export interface SyncOrderLineItemsResult {
  success: boolean
  order_number: string
  line_items_synced: number
  error?: string
}

/**
 * Sync line items for one order from WooCommerce into order_lines.
 * Ensures products exist (creates placeholder if needed) so FK is satisfied.
 */
export async function syncOrderLineItemsFromWoo(
  orderNumber: string,
  options?: { supabase?: SupabaseClient; wooClient?: WooCommerceClient }
): Promise<SyncOrderLineItemsResult> {
  const supabase = options?.supabase ?? createAdminClient()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('order_number, woo_order_id')
    .eq('order_number', orderNumber)
    .maybeSingle()

  if (orderError || !order) {
    return { success: false, order_number: orderNumber, line_items_synced: 0, error: orderError?.message ?? 'Order not found' }
  }

  const wooOrderId = order.woo_order_id
  if (wooOrderId == null) {
    return { success: true, order_number: orderNumber, line_items_synced: 0, error: 'Order has no WooCommerce ID' }
  }

  console.log(`[LINE SYNC] order_number value: "${orderNumber}" (type: ${typeof orderNumber})`)
  console.log(`[LINE SYNC] Starting sync for order ${orderNumber} (Woo ID: ${wooOrderId})`)

  const storeUrl = process.env.WOOCOMMERCE_STORE_URL
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET
  if (!storeUrl || !consumerKey || !consumerSecret) {
    return { success: false, order_number: orderNumber, line_items_synced: 0, error: 'WooCommerce credentials not configured' }
  }

  const wooClient = options?.wooClient ?? new WooCommerceClient({ storeUrl, consumerKey, consumerSecret })
  let wooOrder: any
  try {
    wooOrder = await wooClient.getOrder(Number(wooOrderId))
  } catch (e) {
    return { success: false, order_number: orderNumber, line_items_synced: 0, error: e instanceof Error ? e.message : 'Failed to fetch order from WooCommerce' }
  }

  if (!wooOrder?.line_items || !Array.isArray(wooOrder.line_items) || wooOrder.line_items.length === 0) {
    console.log(`[LINE SYNC] No line items in WooCommerce order ${wooOrderId}`)
    return { success: true, order_number: orderNumber, line_items_synced: 0 }
  }

  console.log(`[LINE SYNC] Found ${wooOrder.line_items.length} line items`)
  let lineItemsSynced = 0

  for (const item of wooOrder.line_items) {
    // WooCommerce: use variation_id when > 0 so variant-level sales (e.g. Retatrutide 10mg) are correct
    const effectiveWooId =
      (Number(item.variation_id) || 0) > 0
        ? Number(item.variation_id)
        : Number(item.product_id) || 0
    const qty = parseInt(String(item.quantity || '1'), 10) || 1
    const customerPaidPerUnit =
      typeof item.price === 'number' ? item.price : parseFloat(String(item.price)) || 0
    const lineTotal = parseFloat(item.total) || 0
    const costFromMeta = getCostFromMeta(item)
    const productId = await ensureProduct(supabase, effectiveWooId, item.name || '', item.price ?? '0')
    const ourCostPerUnit =
      costFromMeta ?? (productId > 0 ? await getProductCost(supabase, productId) : 0)
    const lineCost = ourCostPerUnit * qty
    const lineProfit = lineTotal - lineCost

    console.log(
      `[LINE SYNC] Item: ${item.name} | qty=${qty} | unitPrice=${customerPaidPerUnit} | total=${lineTotal} | cost=${ourCostPerUnit}`
    )

    if (productId <= 0) continue

    const lineItemData = {
      order_id: wooOrder.id,
      id: item.id,
      order_number: order.order_number,
      product_id: productId,
      variation_id: item.variation_id || null,
      name: item.name || '',
      tax_class: item.tax_class || null,
      subtotal: String(item.subtotal ?? '0'),
      subtotal_tax: String(item.subtotal_tax ?? '0'),
      total: String(item.total ?? '0'),
      total_tax: String(item.total_tax ?? '0'),
      sku: item.sku || null,
      price: String(item.price ?? '0'),
      taxes: item.taxes || null,
      meta_data: item.meta_data || null,
      raw_json: item,
      qty_ordered: qty,
      customer_paid_per_unit: customerPaidPerUnit,
      our_cost_per_unit: ourCostPerUnit,
      line_total: lineTotal,
      line_cost: lineCost,
      line_profit: lineProfit,
    }

    const { error: upsertError } = await supabase
      .from('order_lines')
      .upsert(lineItemData, { onConflict: 'order_id,id', ignoreDuplicates: false })

    if (upsertError) {
      console.error(
        `[LINE SYNC] Upsert failed for item ${item.id}:`,
        upsertError.message,
        upsertError.code,
        upsertError.details
      )
      if (
        upsertError.code === '42P10' ||
        String(upsertError.message).includes('could not determine')
      ) {
        const { data: existing } = await supabase
          .from('order_lines')
          .select('*')
          .match({ order_id: wooOrder.id, id: item.id })
          .maybeSingle()
        if (existing) {
          const { error: upErr } = await supabase
            .from('order_lines')
            .update(lineItemData)
            .match({ order_id: wooOrder.id, id: item.id })
          if (!upErr) lineItemsSynced++
        } else {
          const { error: inErr } = await supabase.from('order_lines').insert(lineItemData)
          if (!inErr) lineItemsSynced++
          else console.error('[LINE SYNC] Insert failed:', inErr.message, JSON.stringify(lineItemData))
        }
      }
    } else {
      lineItemsSynced++
    }
  }

  console.log(`[LINE SYNC] Done. Synced ${lineItemsSynced}/${wooOrder.line_items.length}`)
  return { success: true, order_number: orderNumber, line_items_synced: lineItemsSynced }
}
