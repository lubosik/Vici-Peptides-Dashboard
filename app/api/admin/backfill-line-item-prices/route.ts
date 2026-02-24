/**
 * One-time backfill: set correct prices and SKUs on order_lines for orders 2874–2948
 * (WooCommerce→Zapier didn't send price/SKU). Uses Vici product catalog to match
 * line item names to price + SKU, then recalculates order totals.
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { matchProductToCatalog } from '@/lib/catalog/vici-products'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const WOO_ORDER_ID_MIN = 2874
const WOO_ORDER_ID_MAX = 2948

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()

    // Orders in range 2874–2948 (by woo_order_id)
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('order_number, woo_order_id, order_subtotal, order_total, order_cost, order_profit, coupon_discount, shipping_charged, shipping_cost')
      .gte('woo_order_id', WOO_ORDER_ID_MIN)
      .lte('woo_order_id', WOO_ORDER_ID_MAX)

    if (ordersErr) {
      console.error('backfill-line-item-prices: failed to fetch orders', ordersErr)
      return NextResponse.json(
        { error: 'Failed to fetch orders', details: ordersErr.message },
        { status: 500 }
      )
    }

    const orderMap = new Map<number, (typeof orders)[0]>()
    const orderNumbersInRange = new Set<string>()
    orders?.forEach((o) => {
      const id = o.woo_order_id as number
      if (id != null) orderMap.set(id, o)
      if (o.order_number) orderNumbersInRange.add(o.order_number)
    })

    // All order_lines for these orders (by order_id = woo_order_id)
    const { data: linesById, error: linesErr } = await supabase
      .from('order_lines')
      .select('line_id, order_id, order_number, name, qty_ordered, customer_paid_per_unit, line_total, line_cost, line_profit, sku, price, our_cost_per_unit')
      .gte('order_id', WOO_ORDER_ID_MIN)
      .lte('order_id', WOO_ORDER_ID_MAX)

    if (linesErr) {
      console.error('backfill-line-item-prices: failed to fetch order_lines', linesErr)
      return NextResponse.json(
        { error: 'Failed to fetch order lines', details: linesErr.message },
        { status: 500 }
      )
    }

    // If any orders have lines only by order_number (e.g. order_id null), fetch those too
    let lines = linesById || []
    if (orderNumbersInRange.size > 0) {
      const { data: linesByNumber } = await supabase
        .from('order_lines')
        .select('line_id, order_id, order_number, name, qty_ordered, customer_paid_per_unit, line_total, line_cost, line_profit, sku, price, our_cost_per_unit')
        .in('order_number', [...orderNumbersInRange])
      if (linesByNumber?.length) {
        const seen = new Set((lines || []).map((l) => l.line_id))
        for (const l of linesByNumber) {
          if (!seen.has(l.line_id)) {
            lines.push(l)
            seen.add(l.line_id)
          }
        }
      }
    }

    /** Parse "Order #2874" or "2874" to woo_order_id number */
    function parseOrderId(line: { order_id?: number | null; order_number?: string | null }): number | null {
      if (line.order_id != null) return Number(line.order_id)
      const nn = line.order_number?.replace(/^Order\s*#?\s*/i, '').trim()
      const n = parseInt(nn || '', 10)
      return Number.isNaN(n) ? null : n
    }

    let linesUpdated = 0

    for (const line of lines) {
      const orderId = parseOrderId(line)
      if (orderId == null || orderId < WOO_ORDER_ID_MIN || orderId > WOO_ORDER_ID_MAX) continue

      const match = matchProductToCatalog(line.name || '')
      if (!match) continue

      const qty = Number(line.qty_ordered) || 1
      const lineTotal = Math.round(match.price * qty * 100) / 100
      const lineCost = Number(line.line_cost) ?? (Number(line.our_cost_per_unit) || 0) * qty
      const lineProfit = Math.round((lineTotal - lineCost) * 100) / 100

      const { error: updateErr } = await supabase
        .from('order_lines')
        .update({
          customer_paid_per_unit: match.price,
          line_total: lineTotal,
          line_profit: lineProfit,
          sku: match.sku,
          price: String(match.price),
        })
        .eq('line_id', line.line_id)

      if (!updateErr) linesUpdated++
    }

    // Recalculate order totals from summed line_totals (all lines for each order in range)
    const { data: sumsById } = await supabase
      .from('order_lines')
      .select('order_id, line_total')
      .gte('order_id', WOO_ORDER_ID_MIN)
      .lte('order_id', WOO_ORDER_ID_MAX)

    const orderSubtotalByOrderId = new Map<number, number>()
    for (const row of sumsById || []) {
      const id = row.order_id as number
      if (id == null) continue
      const prev = orderSubtotalByOrderId.get(id) ?? 0
      orderSubtotalByOrderId.set(id, prev + (Number(row.line_total) || 0))
    }
    if (orderNumbersInRange.size > 0) {
      const { data: sumsByNumber } = await supabase
        .from('order_lines')
        .select('order_number, line_total')
        .in('order_number', [...orderNumbersInRange])
        .is('order_id', null)
      for (const row of sumsByNumber || []) {
        const id = parseInt(String(row.order_number).replace(/^Order\s*#?\s*/i, '').trim(), 10)
        if (Number.isNaN(id) || id < WOO_ORDER_ID_MIN || id > WOO_ORDER_ID_MAX) continue
        const prev = orderSubtotalByOrderId.get(id) ?? 0
        orderSubtotalByOrderId.set(id, prev + (Number(row.line_total) || 0))
      }
    }

    let ordersUpdated = 0
    for (const [orderId, newSubtotal] of orderSubtotalByOrderId) {
      const order = orderMap.get(orderId)
      if (!order) continue

      const couponDiscount = Number(order.coupon_discount) || 0
      const shippingCharged = Number(order.shipping_charged) || 0
      const orderCost = Number(order.order_cost) || 0
      const shippingCost = Number(order.shipping_cost) || 0

      const orderTotal = Math.round((newSubtotal - couponDiscount + shippingCharged) * 100) / 100
      const orderProfit = Math.round((orderTotal - orderCost - shippingCost) * 100) / 100

      const { error: orderUpdateErr } = await supabase
        .from('orders')
        .update({
          order_subtotal: Math.round(newSubtotal * 100) / 100,
          order_total: orderTotal,
          order_profit: orderProfit,
        })
        .eq('woo_order_id', orderId)

      if (!orderUpdateErr) ordersUpdated++
    }

    revalidatePath('/orders')
    revalidatePath('/revenue')
    revalidatePath('/')
    revalidatePath('/analytics')
    revalidatePath('/products')

    return NextResponse.json({
      success: true,
      lines_updated: linesUpdated,
      orders_updated: ordersUpdated,
      order_id_range: [WOO_ORDER_ID_MIN, WOO_ORDER_ID_MAX],
      message: `Backfill complete: ${linesUpdated} line items and ${ordersUpdated} orders updated with catalog prices/SKUs.`,
    })
  } catch (error) {
    console.error('Error in backfill-line-item-prices:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Backfill failed', message },
      { status: 500 }
    )
  }
}
