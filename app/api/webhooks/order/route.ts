/**
 * Make.com → POST WooCommerce order to this endpoint.
 * Writes to Supabase (orders + order_lines). Cost lookup from product_cost_lookup table.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { upsertAffiliateExpenseForOrder } from '@/lib/expenses/affiliate-expense'

function authenticate(request: NextRequest): boolean {
  const key = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('api_key')
  if (!process.env.WEBHOOK_API_KEY) return true
  return key === process.env.WEBHOOK_API_KEY
}

/** Get value from object by key or common aliases (case-insensitive) */
function getBodyValue(body: Record<string, unknown>, ...keys: string[]): unknown {
  const keySet = new Set(keys.map((k) => k.toLowerCase()))
  for (const [k, v] of Object.entries(body)) {
    if (v != null && keySet.has(k.toLowerCase())) return v
  }
  return undefined
}

/** Build line_items array from comma-separated Zapier fields */
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

  const count = names.length
  const items: Record<string, unknown>[] = []
  for (let i = 0; i < count; i++) {
    const qty = parseInt(quantities[i] || '1', 10) || 1
    const total = parseFloat(totals[i] || subtotals[i] || '0') || 0
    const subtotal = parseFloat(subtotals[i] || totals[i] || '0') || total
    const unitPrice = qty > 0 ? total / qty : 0
    items.push({
      id: 1000000 + (i + 1),
      name: names[i] || '',
      quantity: qty,
      qty,
      sku: skus[i] || '',
      total,
      subtotal,
      price: unitPrice,
      product_id: parseInt(productIds[i] || '0', 10) || 0,
      productId: parseInt(productIds[i] || '0', 10) || 0,
    })
  }
  return items
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

  if (exact) {
    return {
      cost_per_unit: Number(exact.cost_per_unit) || 0,
      matched_name: exact.product_name,
      matched_strength: exact.strength || '',
    }
  }

  const { data: partial } = await supabase
    .from('product_cost_lookup')
    .select('*')
    .ilike('product_name', `%${baseName}%`)

  if (partial && partial.length > 0) {
    if (strength) {
      const strengthMatch = partial.find(
        (p) =>
          strength.toLowerCase().includes((p.strength || '').toLowerCase()) ||
          (p.strength || '').toLowerCase().includes(strength.toLowerCase())
      )
      if (strengthMatch) {
        return {
          cost_per_unit: Number(strengthMatch.cost_per_unit) || 0,
          matched_name: strengthMatch.product_name,
          matched_strength: strengthMatch.strength || '',
        }
      }
    }
    const first = partial[0]
    return {
      cost_per_unit: Number(first.cost_per_unit) || 0,
      matched_name: first.product_name,
      matched_strength: first.strength || '',
    }
  }

  const keywords = baseName.split(/[\s\-+]+/).filter((w) => w.length > 2)
  for (const keyword of keywords) {
    const { data: keywordMatch } = await supabase
      .from('product_cost_lookup')
      .select('*')
      .ilike('product_name', `%${keyword}%`)

    if (keywordMatch?.length) {
      if (strength) {
        const sm = keywordMatch.find((p) =>
          strength.toLowerCase().includes((p.strength || '').toLowerCase())
        )
        if (sm) {
          return {
            cost_per_unit: Number(sm.cost_per_unit) || 0,
            matched_name: sm.product_name,
            matched_strength: sm.strength || '',
          }
        }
      }
      const first = keywordMatch[0]
      return {
        cost_per_unit: Number(first.cost_per_unit) || 0,
        matched_name: first.product_name,
        matched_strength: first.strength || '',
      }
    }
  }

  return defaultResult
}

export async function POST(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const supabase = createAdminClient()

    const wooOrderId = body.id ?? body.order_id ?? body.woo_order_id
    const orderNumber = String(body.number ?? body.order_number ?? wooOrderId ?? '')
    const orderStatus = body.status || 'processing'
    const orderTotal = parseFloat(body.total) || 0
    const shippingTotal = parseFloat(body.shipping_total) || 0
    const discountTotal = parseFloat(body.discount_total) || 0
    const currency = body.currency || 'USD'
    const customerNote = body.customer_note || ''

    let orderDate: string
    if (body.date_created_gmt) {
      orderDate = new Date(body.date_created_gmt).toISOString()
    } else if (body.date_created) {
      orderDate = new Date(body.date_created).toISOString()
    } else {
      orderDate = new Date().toISOString()
    }

    // Billing: object (billing.first_name) or flattened (Billing_first_name, Billing_last_name, Billing_email)
    const billing = (body.billing as Record<string, unknown>) || {}
    const customerName =
      `${billing.first_name || getBodyValue(body, 'Billing_first_name', 'billing_first_name') || ''} ${billing.last_name || getBodyValue(body, 'Billing_last_name', 'billing_last_name') || ''}`.trim()
    const customerEmail =
      String(billing.email || getBodyValue(body, 'Billing_email', 'billing_email') || '').trim() || ''

    // Coupon code: WooCommerce coupon_lines, or top-level Coupon/coupon_code
    const couponCode =
      (Array.isArray(body.coupon_lines) && body.coupon_lines[0]?.code ? String((body.coupon_lines[0] as { code?: string }).code) : '') ||
      (typeof body.Coupon === 'string' ? body.Coupon : '') ||
      (typeof body.coupon_code === 'string' ? body.coupon_code : '') ||
      null

    // line_items: JSON array, OR comma-separated Zapier fields (Line Items Name, Line Items Quantity, etc.)
    let lineItems: Record<string, unknown>[] = []
    if (Array.isArray(body.line_items)) {
      lineItems = body.line_items.filter((x: unknown) => x != null && typeof x === 'object').map((x: unknown) => x as Record<string, unknown>)
    } else if (body.line_items != null && typeof body.line_items === 'object' && !Array.isArray(body.line_items)) {
      lineItems = [body.line_items as Record<string, unknown>]
    } else if (typeof body.line_items === 'string') {
      try {
        const parsed = JSON.parse(body.line_items) as unknown
        lineItems = Array.isArray(parsed) ? parsed.filter((x: unknown) => x != null && typeof x === 'object').map((x: unknown) => x as Record<string, unknown>) : [parsed as Record<string, unknown>]
      } catch {
        lineItems = []
      }
    }
    if (lineItems.length === 0) {
      lineItems = buildLineItemsFromCommaSeparated(body)
    }

    let totalCost = 0
    const processedLines: Array<{
      order_number: string
      order_id: number
      id: number
      product_id: number
      woo_product_id?: number
      qty_ordered: number
      customer_paid_per_unit: number
      our_cost_per_unit: number
      line_total: number
      line_cost: number
      line_profit: number
      name: string
      sku: string
    }> = []

    const orderNumberFormatted = orderNumber ? `Order #${orderNumber}` : `Order #${wooOrderId}`

    const usedLineIds = new Set<number>()

    for (let index = 0; index < lineItems.length; index++) {
      const item = lineItems[index]
      const qty = Number(item.quantity ?? item.qty) || 1
      const unitPrice =
        typeof item.price === 'number' ? item.price : parseFloat(String(item.price ?? 0)) || 0
      const lineTotal = parseFloat(String(item.total ?? item.subtotal ?? 0)) || unitPrice * qty
      const productName = String(item.name ?? item.parentName ?? '').trim()
      const productId = Number(item.product_id ?? item.productId ?? 0) || 0
      let lineItemId = Number(item.id ?? item.line_item_id ?? 0)
      if (lineItemId <= 0 || usedLineIds.has(lineItemId)) {
        lineItemId = 1000000 + (index + 1)
      }
      usedLineIds.add(lineItemId)
      const sku = String(item.sku ?? '')

      const costInfo = await lookupCost(supabase, productName)
      const costPerUnit = costInfo.cost_per_unit
      const lineCost = costPerUnit * qty
      const lineProfit = lineTotal - lineCost
      totalCost += lineCost

      let dbProductId = productId
      const { data: existingProduct } = await supabase
        .from('products')
        .select('product_id')
        .eq('woo_product_id', productId)
        .maybeSingle()

      if (!existingProduct) {
        const { data: inserted } = await supabase
          .from('products')
          .upsert(
            {
              product_id: productId,
              woo_product_id: productId,
              product_name: productName,
              our_cost: costPerUnit,
              retail_price: unitPrice,
              current_stock: null,
              stock_status: 'In Stock',
              strength: costInfo.matched_strength || null,
            },
            { onConflict: 'woo_product_id' }
          )
          .select('product_id')
          .single()
        dbProductId = inserted?.product_id ?? productId
      } else {
        dbProductId = existingProduct.product_id
        const { data: prod } = await supabase
          .from('products')
          .select('our_cost')
          .eq('product_id', dbProductId)
          .maybeSingle()
        if (prod && (prod.our_cost == null || Number(prod.our_cost) === 0) && costPerUnit > 0) {
          await supabase.from('products').update({ our_cost: costPerUnit }).eq('product_id', dbProductId)
        }
      }

      processedLines.push({
        order_number: orderNumberFormatted,
        order_id: Number(wooOrderId),
        id: lineItemId,
        product_id: dbProductId,
        woo_product_id: productId,
        qty_ordered: qty,
        customer_paid_per_unit: unitPrice,
        our_cost_per_unit: costPerUnit,
        line_total: lineTotal,
        line_cost: lineCost,
        line_profit: lineProfit,
        name: productName,
        sku,
      })
    }

    const orderProfit = orderTotal - totalCost
    const orderMargin = orderTotal > 0 ? (orderProfit / orderTotal) * 100 : 0

    const orderData: Record<string, unknown> = {
      order_number: orderNumberFormatted,
      woo_order_id: wooOrderId != null ? Number(wooOrderId) : null,
      order_date: orderDate,
      order_status: orderStatus,
      order_subtotal: orderTotal - (parseFloat(body.shipping_total) || 0) + (parseFloat(body.discount_total) || 0),
      order_total: orderTotal,
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

    const { error: orderError } = await supabase
      .from('orders')
      .upsert(orderData, { onConflict: 'order_number' })

    if (orderError) {
      const { error: orderError2 } = await supabase
        .from('orders')
        .upsert({ ...orderData, woo_order_id: orderData.woo_order_id }, { onConflict: 'woo_order_id' })
      if (orderError2) {
        const { error: insertErr } = await supabase.from('orders').insert(orderData)
        if (insertErr) {
          console.error('[ORDER WEBHOOK] Order insert failed:', insertErr)
          return NextResponse.json(
            { error: 'Failed to save order', details: insertErr.message },
            { status: 500 }
          )
        }
      }
    }

    // Replace all line items for this order so payload is source of truth (no stale rows)
    if (wooOrderId != null) {
      await supabase.from('order_lines').delete().eq('order_id', Number(wooOrderId))
    }
    for (const line of processedLines) {
      const { error: lineError } = await supabase
        .from('order_lines')
        .upsert(line, { onConflict: 'order_id,id' })

      if (lineError) {
        const { error: lineInsertErr } = await supabase.from('order_lines').insert(line)
        if (lineInsertErr) {
          console.error('[ORDER WEBHOOK] Line insert failed:', lineInsertErr.message)
        }
      }
    }

    // Affiliate expense: if order used a coupon, create/update a 10% affiliate payment expense
    await upsertAffiliateExpenseForOrder(supabase, {
      order_number: orderNumberFormatted,
      woo_order_id: wooOrderId != null ? Number(wooOrderId) : null,
      order_total: orderTotal,
      coupon_discount: discountTotal,
      coupon_code: (orderData.coupon_code as string | null) ?? null,
    })

    try {
      revalidatePath('/')
      revalidatePath('/orders')
      revalidatePath('/products')
      revalidatePath('/analytics')
      revalidatePath('/revenue')
    } catch {
      // ignore
    }

    return NextResponse.json({
      status: 'success',
      order_number: orderNumberFormatted,
      woo_order_id: wooOrderId,
      total: orderTotal,
      cost: totalCost,
      profit: orderProfit,
      margin: orderMargin.toFixed(1) + '%',
      line_items_processed: processedLines.length,
      items: processedLines.length,
      line_items: processedLines.map((l) => ({
        id: l.id,
        name: l.name,
        product_id: l.product_id,
        woo_product_id: l.woo_product_id,
        quantity: l.qty_ordered,
        unit_price: l.customer_paid_per_unit,
        total: l.line_total,
        cost: l.line_cost,
        profit: l.line_profit,
        sku: l.sku || undefined,
      })),
    })
  } catch (error: unknown) {
    console.error('[ORDER WEBHOOK] Fatal error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    status: 'ok',
    endpoint: 'Vici Order Webhook',
    usage: 'POST a WooCommerce order object to this endpoint',
    required_fields: ['id', 'number', 'total', 'line_items', 'date_created'],
  })
}
