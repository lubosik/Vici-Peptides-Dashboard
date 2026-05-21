/**
 * Direct WooCommerce Webhook Handler
 * POST /api/webhooks/woocommerce
 *
 * WordPress webhook delivery URL: https://dashboard.vicipeptides.com/api/webhooks/woocommerce
 * Topics handled: order.created, order.updated, order.deleted, product.created, product.updated
 *
 * Auth: no secret required — the URL itself is the security layer.
 *       Optionally protect with x-api-key header matching WEBHOOK_API_KEY env var.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { upsertAffiliateExpenseForOrder } from '@/lib/expenses/affiliate-expense'
import { matchProductToCatalog } from '@/lib/catalog/vici-products'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// ─── Stock status mapping ─────────────────────────────────────────────────────

function mapWooStockStatus(wooStatus: string, qty: number | null): string {
  switch (wooStatus) {
    case 'instock':
      if (qty !== null && qty <= 5 && qty > 0) return 'LOW STOCK'
      return 'In Stock'
    case 'outofstock':
      return 'OUT OF STOCK'
    case 'onbackorder':
      return 'On Backorder'
    default:
      return 'In Stock'
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBodyValue(body: Record<string, unknown>, ...keys: string[]): unknown {
  const keySet = new Set(keys.map((k) => k.toLowerCase()))
  for (const [k, v] of Object.entries(body)) {
    if (v != null && keySet.has(k.toLowerCase())) return v
  }
  return undefined
}

function buildLineItemsFromCommaSeparated(body: Record<string, unknown>): Record<string, unknown>[] {
  const getStr = (...keys: string[]) => {
    const v = getBodyValue(body, ...keys)
    if (v == null) return ''
    return String(v).trim()
  }
  const names = getStr('Line Items Name', 'line_items_name').split(',').map((s) => s.trim()).filter(Boolean)
  const quantities = getStr('Line Items Quantity', 'line_items_quantity').split(',').map((s) => s.trim()).filter(Boolean)
  const skus = getStr('Line Items Sku', 'line_items_sku').split(',').map((s) => s.trim()).filter(Boolean)
  const totals = getStr('Line Items Total', 'line_items_total').split(',').map((s) => s.trim()).filter(Boolean)
  const subtotals = getStr('Line Items Subtotal', 'line_items_subtotal').split(',').map((s) => s.trim()).filter(Boolean)
  const productIds = getStr('Line Items Product Id', 'line_items_product_id').split(',').map((s) => s.trim()).filter(Boolean)
  if (names.length === 0) return []

  return names.map((name, i) => {
    const qty = parseInt(quantities[i] || '1', 10) || 1
    const total = parseFloat(totals[i] || subtotals[i] || '0') || 0
    const subtotal = parseFloat(subtotals[i] || totals[i] || '0') || total
    return {
      id: 1000000 + (i + 1),
      name,
      quantity: qty,
      qty,
      sku: skus[i] || '',
      total,
      subtotal,
      price: qty > 0 ? total / qty : 0,
      product_id: parseInt(productIds[i] || '0', 10) || 0,
    }
  })
}

async function lookupCost(
  supabase: SupabaseClient,
  productName: string
): Promise<{ cost_per_unit: number; matched_strength: string }> {
  const def = { cost_per_unit: 0, matched_strength: '' }
  if (!productName?.trim()) return def

  let baseName = productName.trim()
  let strength = ''
  if (productName.includes(' - ')) {
    const parts = productName.split(' - ')
    baseName = parts[0].trim()
    strength = parts.slice(1).join(' - ').trim()
  }

  const { data: exact } = await supabase.from('product_cost_lookup').select('*').ilike('product_name', baseName).ilike('strength', strength || '%').limit(1).maybeSingle()
  if (exact) return { cost_per_unit: Number(exact.cost_per_unit) || 0, matched_strength: exact.strength || '' }

  const { data: partial } = await supabase.from('product_cost_lookup').select('*').ilike('product_name', `%${baseName}%`)
  if (partial?.length) {
    if (strength) {
      const sm = partial.find((p) => strength.toLowerCase().includes((p.strength || '').toLowerCase()))
      if (sm) return { cost_per_unit: Number(sm.cost_per_unit) || 0, matched_strength: sm.strength || '' }
    }
    return { cost_per_unit: Number(partial[0].cost_per_unit) || 0, matched_strength: partial[0].strength || '' }
  }

  for (const keyword of baseName.split(/[\s\-+]+/).filter((w) => w.length > 2)) {
    const { data: km } = await supabase.from('product_cost_lookup').select('*').ilike('product_name', `%${keyword}%`)
    if (km?.length) return { cost_per_unit: Number(km[0].cost_per_unit) || 0, matched_strength: km[0].strength || '' }
  }

  return def
}

// ─── Product upsert ───────────────────────────────────────────────────────────

async function ingestProduct(body: Record<string, unknown>): Promise<{ product_id: number; name: string; stock_status: string }> {
  const supabase = createAdminClient()

  const wooId = Number(body.id ?? 0)
  const name = String(body.name ?? '').trim()
  const sku = String(body.sku ?? '').trim() || null
  const status = String(body.status ?? 'publish')
  const manageStock = Boolean(body.manage_stock)
  const stockQty = body.stock_quantity != null ? Number(body.stock_quantity) : null
  const wooStockStatus = String(body.stock_status ?? 'instock')
  const retailPrice = parseFloat(String(body.regular_price ?? body.price ?? '0')) || null
  const salePrice = parseFloat(String(body.sale_price ?? '0')) || null
  const images = Array.isArray(body.images) ? body.images : null

  const mappedStock = mapWooStockStatus(wooStockStatus, stockQty)

  // Only update stock_status if product is published; draft/private = OUT OF STOCK
  const finalStockStatus = status === 'publish' ? mappedStock : 'OUT OF STOCK'

  const upsertData: Record<string, unknown> = {
    woo_product_id: wooId,
    product_id: wooId,
    product_name: name,
    sku_code: sku,
    retail_price: retailPrice,
    sale_price: salePrice && salePrice > 0 ? salePrice : null,
    stock_status: finalStockStatus,
    images: images ? JSON.stringify(images) : null,
  }

  // Only update current_stock if WooCommerce manages stock quantity
  if (manageStock && stockQty !== null) {
    upsertData.current_stock = stockQty
  }

  const { data: existing } = await supabase.from('products').select('product_id, our_cost, starting_qty, reorder_level, stock_status_override').eq('woo_product_id', wooId).maybeSingle()

  if (existing) {
    // Preserve manually set fields
    if (existing.our_cost != null) upsertData.our_cost = existing.our_cost
    // Only override stock_status if there's no manual override set
    if (existing.stock_status_override) delete upsertData.stock_status
  }

  await supabase.from('products').upsert(upsertData, { onConflict: 'woo_product_id' })

  revalidatePath('/products')
  revalidatePath('/')

  return { product_id: wooId, name, stock_status: finalStockStatus }
}

// ─── Order ingestion ──────────────────────────────────────────────────────────

async function ingestOrder(body: Record<string, unknown>): Promise<{
  order_number: string; woo_order_id: unknown; total: number; cost: number; profit: number; line_items_processed: number
}> {
  const supabase = createAdminClient()

  const wooOrderId = body.id ?? body.order_id ?? body.woo_order_id
  const orderNumber = String(body.number ?? body.order_number ?? wooOrderId ?? '')
  const orderStatus = (body.status as string) || 'processing'
  const orderTotal = parseFloat(String(body.total ?? 0)) || 0
  const shippingTotal = parseFloat(String(body.shipping_total ?? 0)) || 0
  const discountTotal = parseFloat(String(body.discount_total ?? 0)) || 0
  const currency = (body.currency as string) || 'USD'
  const customerNote = (body.customer_note as string) || ''

  let orderDate: string
  if (body.date_created_gmt) orderDate = new Date(String(body.date_created_gmt)).toISOString()
  else if (body.date_created) orderDate = new Date(String(body.date_created)).toISOString()
  else orderDate = new Date().toISOString()

  const billing = (body.billing as Record<string, unknown>) || {}
  const customerName = `${billing.first_name || getBodyValue(body, 'Billing_first_name', 'billing_first_name') || ''} ${billing.last_name || getBodyValue(body, 'Billing_last_name', 'billing_last_name') || ''}`.trim()
  const customerEmail = String(billing.email || getBodyValue(body, 'Billing_email', 'billing_email') || '').trim()

  const couponCode =
    (Array.isArray(body.coupon_lines) && (body.coupon_lines as Array<{ code?: string }>)[0]?.code
      ? String((body.coupon_lines as Array<{ code?: string }>)[0].code)
      : '') ||
    (typeof body.coupon_code === 'string' ? body.coupon_code : '') || null

  let lineItems: Record<string, unknown>[] = []
  if (Array.isArray(body.line_items)) {
    lineItems = (body.line_items as unknown[]).filter((x) => x != null && typeof x === 'object').map((x) => x as Record<string, unknown>)
  } else if (typeof body.line_items === 'string') {
    try { const p = JSON.parse(body.line_items as string); lineItems = Array.isArray(p) ? p : [p] } catch { lineItems = [] }
  }
  if (lineItems.length === 0) lineItems = buildLineItemsFromCommaSeparated(body)

  let totalCost = 0
  const orderNumberFormatted = `Order #${orderNumber}`
  const usedLineIds = new Set<number>()
  const processedLines: Array<{
    order_number: string; order_id: number; id: number; product_id: number
    woo_product_id?: number; qty_ordered: number; customer_paid_per_unit: number
    our_cost_per_unit: number; line_total: number; line_cost: number
    line_profit: number; name: string; sku: string
  }> = []

  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i]
    const qty = Number(item.quantity ?? item.qty) || 1
    let unitPrice = parseFloat(String(item.price ?? 0)) || 0
    let lineTotal = parseFloat(String(item.total ?? item.subtotal ?? 0)) || unitPrice * qty
    const productName = String(item.name ?? '').trim()
    const productId = Number(item.product_id ?? item.productId ?? 0) || 0
    let lineItemId = Number(item.id ?? item.line_item_id ?? 0)
    if (lineItemId <= 0 || usedLineIds.has(lineItemId)) lineItemId = 1000000 + (i + 1)
    usedLineIds.add(lineItemId)
    let sku = String(item.sku ?? '').trim()

    const catalogMatch = productName ? matchProductToCatalog(productName) : null
    if (catalogMatch) {
      if (!unitPrice || unitPrice <= 0 || !lineTotal || lineTotal <= 0) { unitPrice = catalogMatch.price; lineTotal = Math.round(catalogMatch.price * qty * 100) / 100 }
      if (!sku) sku = catalogMatch.sku
    }

    const costInfo = await lookupCost(supabase, productName)
    const costPerUnit = costInfo.cost_per_unit
    const lineCost = costPerUnit * qty
    const lineProfit = lineTotal - lineCost
    totalCost += lineCost

    let dbProductId = productId
    const { data: ep } = await supabase.from('products').select('product_id').eq('woo_product_id', productId).maybeSingle()
    if (!ep) {
      const { data: ins } = await supabase.from('products').upsert({ product_id: productId, woo_product_id: productId, product_name: productName, our_cost: costPerUnit, retail_price: unitPrice, current_stock: null, stock_status: 'In Stock', strength: costInfo.matched_strength || null }, { onConflict: 'woo_product_id' }).select('product_id').single()
      dbProductId = ins?.product_id ?? productId
    } else {
      dbProductId = ep.product_id
      const { data: prod } = await supabase.from('products').select('our_cost').eq('product_id', dbProductId).maybeSingle()
      if (prod && (prod.our_cost == null || Number(prod.our_cost) === 0) && costPerUnit > 0) {
        await supabase.from('products').update({ our_cost: costPerUnit }).eq('product_id', dbProductId)
      }
    }

    processedLines.push({ order_number: orderNumberFormatted, order_id: Number(wooOrderId), id: lineItemId, product_id: dbProductId, woo_product_id: productId, qty_ordered: qty, customer_paid_per_unit: unitPrice, our_cost_per_unit: costPerUnit, line_total: lineTotal, line_cost: lineCost, line_profit: lineProfit, name: productName, sku })
  }

  const orderSubtotalFromLines = processedLines.reduce((s, l) => s + (Number(l.line_total) || 0), 0)
  const effectiveOrderTotal = Math.round((orderSubtotalFromLines - discountTotal + shippingTotal) * 100) / 100 || orderTotal
  const orderProfit = effectiveOrderTotal - totalCost

  const orderData: Record<string, unknown> = {
    order_number: orderNumberFormatted, woo_order_id: wooOrderId != null ? Number(wooOrderId) : null,
    order_date: orderDate, order_status: orderStatus,
    order_subtotal: Math.round(orderSubtotalFromLines * 100) / 100, order_total: effectiveOrderTotal,
    order_product_cost: totalCost, order_cost: totalCost, order_profit: orderProfit,
    shipping_charged: shippingTotal, coupon_discount: discountTotal,
    customer_name: customerName || null, customer_email: customerEmail || null,
    currency, notes: customerNote || null, coupon_code: couponCode,
  }

  const { error: oe } = await supabase.from('orders').upsert(orderData, { onConflict: 'order_number' })
  if (oe) {
    const { error: oe2 } = await supabase.from('orders').upsert(orderData, { onConflict: 'woo_order_id' })
    if (oe2) await supabase.from('orders').insert(orderData)
  }

  if (wooOrderId != null) await supabase.from('order_lines').delete().eq('order_id', Number(wooOrderId))
  for (const line of processedLines) {
    const { error: le } = await supabase.from('order_lines').upsert(line, { onConflict: 'order_id,id' })
    if (le) await supabase.from('order_lines').insert(line)
  }

  await upsertAffiliateExpenseForOrder(supabase, {
    order_number: orderNumberFormatted, woo_order_id: wooOrderId != null ? Number(wooOrderId) : null,
    order_total: orderTotal, coupon_discount: discountTotal, coupon_code: (orderData.coupon_code as string | null) ?? null,
  })

  revalidatePath('/')
  revalidatePath('/orders')
  revalidatePath('/products')

  return { order_number: orderNumberFormatted, woo_order_id: wooOrderId, total: effectiveOrderTotal, cost: totalCost, profit: orderProfit, line_items_processed: processedLines.length }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const topic = request.headers.get('x-wc-webhook-topic') || ''

    let body: Record<string, unknown>
    try {
      body = rawBody ? JSON.parse(rawBody) as Record<string, unknown> : {}
    } catch {
      // WooCommerce test pings may send non-JSON — acknowledge and ignore
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    // product.created / product.updated
    if (topic === 'product.created' || topic === 'product.updated') {
      const result = await ingestProduct(body)
      return NextResponse.json({ status: 'ok', topic, ...result })
    }

    // product.deleted
    if (topic === 'product.deleted') {
      const supabase = createAdminClient()
      const wooId = Number(body.id ?? 0)
      if (wooId) await supabase.from('products').delete().eq('woo_product_id', wooId)
      revalidatePath('/products')
      return NextResponse.json({ status: 'deleted', topic, woo_product_id: wooId })
    }

    // order.deleted
    if (topic === 'order.deleted') {
      const supabase = createAdminClient()
      const wooOrderId = body.id ?? body.order_id
      if (wooOrderId != null) await supabase.from('orders').delete().eq('woo_order_id', Number(wooOrderId))
      revalidatePath('/')
      revalidatePath('/orders')
      return NextResponse.json({ status: 'deleted', topic, woo_order_id: wooOrderId })
    }

    // order.created / order.updated — full upsert (idempotent)
    if (topic === 'order.created' || topic === 'order.updated' || topic === '') {
      // For status-only updates patch first, then fall through to full ingest
      if (topic === 'order.updated') {
        const supabase = createAdminClient()
        const wooOrderId = body.id ?? body.order_id
        const newStatus = body.status as string | undefined
        if (wooOrderId && newStatus) {
          await supabase.from('orders')
            .update({ order_status: newStatus, updated_at: new Date().toISOString() })
            .eq('order_number', `Order #${body.number ?? wooOrderId}`)
        }
      }
      const result = await ingestOrder(body)
      return NextResponse.json({ status: 'ok', topic: topic || 'order.created', ...result })
    }

    // Unknown topic — acknowledge so WooCommerce doesn't retry forever
    return NextResponse.json({ status: 'ignored', topic })
  } catch (error: unknown) {
    console.error('[WC WEBHOOK]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Vici WooCommerce Webhook',
    url: 'POST /api/webhooks/woocommerce',
    topics: ['order.created', 'order.updated', 'order.deleted', 'product.created', 'product.updated', 'product.deleted'],
  })
}
