/**
 * Recalculate order line costs and profits from products.our_cost.
 * Run this after updating product costs to keep all order P&L accurate.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

const BATCH = 50

export async function POST() {
  const supabase = createAdminClient()

  // 1. Build cost map: product_id → our_cost
  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('product_id, woo_product_id, our_cost')
    .not('our_cost', 'is', null)
    .gt('our_cost', 0)

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const costMap = new Map<number, number>()
  for (const p of products || []) {
    const cost = Number(p.our_cost)
    if (p.product_id) costMap.set(Number(p.product_id), cost)
    if (p.woo_product_id) costMap.set(Number(p.woo_product_id), cost)
  }

  if (costMap.size === 0) {
    return NextResponse.json({ success: true, message: 'No product costs configured', updated_lines: 0, updated_orders: 0 })
  }

  // 2. Fetch all order_lines (paginated)
  const allLines: any[] = []
  let page = 0
  while (true) {
    const { data } = await supabase
      .from('order_lines')
      .select('line_id, product_id, qty_ordered, line_total, order_id')
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (!data || data.length === 0) break
    allLines.push(...data)
    if (data.length < 1000) break
    page++
  }

  // 3. Calculate updates
  type LineUpdate = { line_id: number; our_cost_per_unit: number; line_cost: number; line_profit: number }
  const lineUpdates: LineUpdate[] = []
  const orderCosts = new Map<number, { cost: number; revenue: number }>()

  for (const line of allLines) {
    const productId = Number(line.product_id)
    const cost = costMap.get(productId)
    if (cost == null) continue

    const qty = Number(line.qty_ordered) || 1
    const lineCost = Math.round(cost * qty * 100) / 100
    const lineTotal = Number(line.line_total) || 0
    const lineProfit = Math.round((lineTotal - lineCost) * 100) / 100

    lineUpdates.push({ line_id: line.line_id, our_cost_per_unit: cost, line_cost: lineCost, line_profit: lineProfit })

    const orderId = Number(line.order_id)
    if (orderId) {
      const existing = orderCosts.get(orderId) || { cost: 0, revenue: 0 }
      existing.cost += lineCost
      existing.revenue += lineTotal
      orderCosts.set(orderId, existing)
    }
  }

  // 4. Batch update order_lines
  let updatedLines = 0
  for (let i = 0; i < lineUpdates.length; i += BATCH) {
    const chunk = lineUpdates.slice(i, i + BATCH)
    await Promise.all(
      chunk.map((u) =>
        supabase
          .from('order_lines')
          .update({ our_cost_per_unit: u.our_cost_per_unit, line_cost: u.line_cost, line_profit: u.line_profit })
          .eq('line_id', u.line_id)
      )
    )
    updatedLines += chunk.length
  }

  // 5. Recalculate order-level profit and cost
  const orderIds = Array.from(orderCosts.keys())
  const { data: orders } = await supabase
    .from('orders')
    .select('woo_order_id, order_total, shipping_cost')
    .in('woo_order_id', orderIds)

  const orderMap = new Map<number, { order_total: number; shipping_cost: number }>()
  for (const o of orders || []) {
    orderMap.set(Number(o.woo_order_id), {
      order_total: Number(o.order_total) || 0,
      shipping_cost: Number(o.shipping_cost) || 0,
    })
  }

  let updatedOrders = 0
  const orderUpdateChunks: Array<{ woo_order_id: number; order_cost: number; order_product_cost: number; order_profit: number }>[] = []
  const orderUpdateList = []

  for (const [orderId, totals] of orderCosts) {
    const order = orderMap.get(orderId)
    const orderTotal = order?.order_total ?? totals.revenue
    const profit = Math.round((orderTotal - totals.cost) * 100) / 100
    orderUpdateList.push({ woo_order_id: orderId, order_cost: totals.cost, order_product_cost: totals.cost, order_profit: profit })
  }

  for (let i = 0; i < orderUpdateList.length; i += BATCH) {
    const chunk = orderUpdateList.slice(i, i + BATCH)
    await Promise.all(
      chunk.map((u) =>
        supabase
          .from('orders')
          .update({ order_cost: u.order_cost, order_product_cost: u.order_product_cost, order_profit: u.order_profit })
          .eq('woo_order_id', u.woo_order_id)
      )
    )
    updatedOrders += chunk.length
  }

  revalidatePath('/')
  revalidatePath('/orders')
  revalidatePath('/products')

  return NextResponse.json({
    success: true,
    updated_lines: updatedLines,
    updated_orders: updatedOrders,
    products_with_cost: costMap.size,
    message: `Updated ${updatedLines} line items across ${updatedOrders} orders`,
  })
}
