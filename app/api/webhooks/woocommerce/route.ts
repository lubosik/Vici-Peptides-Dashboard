/**
 * Direct WooCommerce Webhook Handler
 * POST /api/webhooks/woocommerce
 *
 * WordPress webhook delivery URL: https://dashboard.vicipeptides.com/api/webhooks/woocommerce
 * Handles: order.created, order.updated, order.deleted
 *
 * WooCommerce sends:
 *   X-WC-Webhook-Topic: order.created | order.updated | order.deleted
 *   X-WC-Webhook-Signature: base64(HMAC-SHA256(WOOCOMMERCE_WEBHOOK_SECRET, rawBody))
 *   Body: full WooCommerce order JSON
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { upsertAffiliateExpenseForOrder } from '@/lib/expenses/affiliate-expense'
import { matchProductToCatalog } from '@/lib/catalog/vici-products'
import type { SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// ─── Helpers (mirrors /api/webhooks/order logic) ─────────────────────────────

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
    const unitPrice = qty > 0 ? total / qty : 0
    return {
      id: 1000000 + (i + 1),
      name,
      quantity: qty,
      qty,
      sku: skus[i] || '',
      total,
      subtotal,
      price: unitPrice,
      product_id: parseInt(productIds[i] || '0', 10) || 0,
      productId: parseInt(productIds[i] || '0', 10) || 0,
    }
  })
}

async function lookupCost(
  supabase: SupabaseClient,
  productName: string
): Promise<{ cost_per_unit: number; matched_name: string; matched_strength: string }> {
  const defaultResult = { cost_per_unit: 0, matched_name: '', matched_strength: '' }
  if (!productName?.trim()) return defaultResult

  let baseName = productName.trim()
  let strength = ''
  if (productName.includes(' - ')) {
    const parts = productName.split(' - ')
    baseName = parts[0].trim()
    strength = parts.slice(1).join(' - ').trim()
  }

  const { data: exact } = await supabase
    .from('product_cost_lookup')
    .select('*')
    .ilike('product_name', baseName)
    .ilike('strength', strength || '%')
    .limit(1)
    .maybeSingle()

  if (exact) return { cost_per_unit: Number(exact.cost_per_unit) || 0, matched_name: exact.product_name, matched_strength: exact.strength || '' }

  const { data: partial } = await supabase.from('product_cost_lookup').select('*').ilike('product_name', `%${baseName}%`)
  if (partial?.length) {
    if (strength) {
      const sm = partial.find((p) => strength.toLowerCase().includes((p.strength || '').toLowerCase()) || (p.strength || '').toLowerCase().includes(strength.toLowerCase()))
      if (sm) return { cost_per_unit: Number(sm.cost_per_unit) || 0, matched_name: sm.product_name, matched_strength: sm.strength || '' }
    }
    return { cost_per_unit: Number(partial[0].cost_per_unit) || 0, matched_name: partial[0].product_name, matched_strength: partial[0].strength || '' }
  }

  const keywords = baseName.split(/[\s\-+]+/).filter((w) => w.length > 2)
  for (const keyword of keywords) {
    const { data: km } = await supabase.from('product_cost_lookup').select('*').ilike('product_name', `%${keyword}%`)
    if (km?.length) {
      if (strength) {
        const sm = km.find((p) => strength.toLowerCase().includes((p.strength || '').toLowerCase()))
        if (sm) return { cost_per_unit: Number(sm.cost_per_unit) || 0, matched_name: sm.product_name, matched_strength: sm.strength || '' }
      }
      return { cost_per_unit: Number(km[0].cost_per_unit) || 0, matched_name: km[0].product_name, matched_strength: km[0].strength || '' }
    }
  }

  return defaultResult
}

// ─── Signature validation ─────────────────────────────────────────────────────

function validateWooSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

// ─── Core order ingestion ─────────────────────────────────────────────────────

async function ingestOrder(body: Record<string, unknown>): Promise<{
  order_number: string
  woo_order_id: unknown
  total: number
  cost: number
  profit: number
  line_items_processed: number
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
    (typeof body.Coupon === 'string' ? body.Coupon : '') ||
    (typeof body.coupon_code === 'string' ? body.coupon_code : '') ||
    null

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
      if (!unitPrice || unitPrice <= 0 || !lineTotal || lineTotal <= 0) {
        unitPrice = catalogMatch.price
        lineTotal = Math.round(catalogMatch.price * qty * 100) / 100
      }
      if (!sku) sku = catalogMatch.sku
    }

    const costInfo = await lookupCost(supabase, productName)
    const costPerUnit = costInfo.cost_per_unit
    const lineCost = costPerUnit * qty
    const lineProfit = lineTotal - lineCost
    totalCost += lineCost

    let dbProductId = productId
    const { data: existingProduct } = await supabase.from('products').select('product_id').eq('woo_product_id', productId).maybeSingle()
    if (!existingProduct) {
      const { data: inserted } = await supabase.from('products').upsert({ product_id: productId, woo_product_id: productId, product_name: productName, our_cost: costPerUnit, retail_price: unitPrice, current_stock: null, stock_status: 'In Stock', strength: costInfo.matched_strength || null }, { onConflict: 'woo_product_id' }).select('product_id').single()
      dbProductId = inserted?.product_id ?? productId
    } else {
      dbProductId = existingProduct.product_id
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
    order_number: orderNumberFormatted,
    woo_order_id: wooOrderId != null ? Number(wooOrderId) : null,
    order_date: orderDate,
    order_status: orderStatus,
    order_subtotal: Math.round(orderSubtotalFromLines * 100) / 100,
    order_total: effectiveOrderTotal,
    order_product_cost: totalCost,
    order_cost: totalCost,
    order_profit: orderProfit,
    shipping_charged: shippingTotal,
    coupon_discount: discountTotal,
    customer_name: customerName || null,
    customer_email: customerEmail || null,
    currency,
    notes: customerNote || null,
    coupon_code: couponCode,
  }

  const { error: orderError } = await supabase.from('orders').upsert(orderData, { onConflict: 'order_number' })
  if (orderError) {
    const { error: e2 } = await supabase.from('orders').upsert({ ...orderData }, { onConflict: 'woo_order_id' })
    if (e2) {
      const { error: e3 } = await supabase.from('orders').insert(orderData)
      if (e3) throw new Error(`Order save failed: ${e3.message}`)
    }
  }

  if (wooOrderId != null) await supabase.from('order_lines').delete().eq('order_id', Number(wooOrderId))
  for (const line of processedLines) {
    const { error: le } = await supabase.from('order_lines').upsert(line, { onConflict: 'order_id,id' })
    if (le) await supabase.from('order_lines').insert(line)
  }

  await upsertAffiliateExpenseForOrder(supabase, {
    order_number: orderNumberFormatted,
    woo_order_id: wooOrderId != null ? Number(wooOrderId) : null,
    order_total: orderTotal,
    coupon_discount: discountTotal,
    coupon_code: (orderData.coupon_code as string | null) ?? null,
  })

  revalidatePath('/')
  revalidatePath('/orders')
  revalidatePath('/products')
  revalidatePath('/analytics')

  return { order_number: orderNumberFormatted, woo_order_id: wooOrderId, total: effectiveOrderTotal, cost: totalCost, profit: orderProfit, line_items_processed: processedLines.length }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const topic = request.headers.get('x-wc-webhook-topic') || 'order.created'

    // Validate HMAC signature if secret is configured
    const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET
    if (secret) {
      const signature = request.headers.get('x-wc-webhook-signature')
      if (!validateWooSignature(rawBody, signature, secret)) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
      }
    }

    let body: Record<string, unknown>
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // order.deleted — remove from DB
    if (topic === 'order.deleted') {
      const supabase = createAdminClient()
      const wooOrderId = body.id ?? body.order_id
      if (wooOrderId != null) {
        await supabase.from('orders').delete().eq('woo_order_id', Number(wooOrderId))
      }
      revalidatePath('/')
      revalidatePath('/orders')
      return NextResponse.json({ status: 'deleted', woo_order_id: wooOrderId })
    }

    // order.created or order.updated — full ingestion (upsert is idempotent)
    if (topic === 'order.created' || topic === 'order.updated') {
      // For updates, if the order already exists just patch the status too
      if (topic === 'order.updated') {
        const supabase = createAdminClient()
        const wooOrderId = body.id ?? body.order_id
        const newStatus = body.status as string | undefined
        if (wooOrderId && newStatus) {
          const orderNumberFormatted = `Order #${body.number ?? wooOrderId}`
          await supabase.from('orders')
            .update({ order_status: newStatus, updated_at: new Date().toISOString() })
            .eq('order_number', orderNumberFormatted)
          // Still fall through to full ingest to keep line items in sync
        }
      }

      const result = await ingestOrder(body)
      return NextResponse.json({ status: 'ok', topic, ...result })
    }

    // Unsupported topic — acknowledge gracefully so WooCommerce doesn't retry
    return NextResponse.json({ status: 'ignored', topic })
  } catch (error: unknown) {
    console.error('[WC WEBHOOK]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Vici WooCommerce Webhook',
    url: 'POST /api/webhooks/woocommerce',
    topics: ['order.created', 'order.updated', 'order.deleted'],
    note: 'Add WOOCOMMERCE_WEBHOOK_SECRET env var and set the same secret in WordPress webhook settings for HMAC validation.',
  })
}
