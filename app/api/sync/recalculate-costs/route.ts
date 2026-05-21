/**
 * Recalculate order line costs and profits from products.our_cost.
 * Run this after updating product costs to keep all order P&L accurate.
 * Falls back to name-based matching for lines whose product_id points to a placeholder.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

const BATCH = 50

// Same cost data as seed-product-costs — used for name-based fallback matching
const COST_DATA = [
  { name: 'MOTS-C',                              strength: '10mg',    cost: 7  },
  { name: 'MOTS-C',                              strength: '40mg',    cost: 23 },
  { name: 'NAD+',                                strength: '100mg',   cost: 5  },
  { name: 'NAD+',                                strength: '500mg',   cost: 9  },
  { name: 'NAD+',                                strength: '1000mg',  cost: 17 },
  { name: 'Glutathione',                         strength: '600mg',   cost: 6  },
  { name: 'Glutathione',                         strength: '1500mg',  cost: 16 },
  { name: 'Retatrutide',                         strength: '10mg',    cost: 13 },
  { name: 'Retatrutide',                         strength: '20mg',    cost: 21 },
  { name: 'Retatrutide',                         strength: '30mg',    cost: 27 },
  { name: 'Semaglutide',                         strength: '10mg',    cost: 6  },
  { name: 'Semaglutide',                         strength: '20mg',    cost: 9  },
  { name: 'Tirzepatide',                         strength: '10mg',    cost: 7  },
  { name: 'Tirzepatide',                         strength: '20mg',    cost: 11 },
  { name: 'Tirzepatide',                         strength: '30mg',    cost: 16 },
  { name: 'Tirzepatide',                         strength: '60mg',    cost: 23 },
  { name: 'L-carnitine',                         strength: '600mg',   cost: 6  },
  { name: 'L-carnitine',                         strength: '1200mg',  cost: 12 },
  { name: 'BPC-157',                             strength: '10mg',    cost: 5  },
  { name: 'BPC-157 + TB-500',                   strength: '10mg',    cost: 20 },
  { name: 'GHK-Cu',                              strength: '50mg',    cost: 5  },
  { name: 'GHK-Cu',                              strength: '100mg',   cost: 9  },
  { name: 'GLOW',                                strength: '70mg',    cost: 23 },
  { name: 'KLOW',                                strength: '80mg',    cost: 24 },
  { name: 'TB-500',                              strength: '10mg',    cost: 8  },
  { name: 'CJC-1295 without DAC',               strength: '10mg',    cost: 19 },
  { name: 'CJC-1295 (without DAC) + IPA',       strength: '10mg',    cost: 12 },
  { name: 'IGF-1LR3',                            strength: '1mg',     cost: 20 },
  { name: 'Tesamorelin',                         strength: '10mg',    cost: 19 },
  { name: 'HCG',                                 strength: '5000iu',  cost: 5  },
  { name: 'HCG',                                 strength: '10000iu', cost: 8  },
  { name: 'Ipamorelin',                          strength: '10mg',    cost: 8  },
  { name: 'Semax',                               strength: '10mg',    cost: 8  },
  { name: 'Selank',                              strength: '10mg',    cost: 8  },
  { name: 'Melanotan I',                         strength: '10mg',    cost: 6  },
  { name: 'Melanotan II',                        strength: '10mg',    cost: 6  },
  { name: 'Bac Water',                           strength: '3ml',     cost: 2  },
  { name: 'Bac Water',                           strength: '10ml',    cost: 3  },
  { name: 'Gonadorelin',                         strength: '10mg',    cost: 8  },
  { name: 'Sermorelin',                          strength: '10mg',    cost: 8  },
  { name: 'GHRP-2',                              strength: '10mg',    cost: 6  },
  { name: 'GHRP-6',                              strength: '10mg',    cost: 6  },
  { name: 'Oxytocin',                            strength: '10mg',    cost: 7  },
]

const ALIASES: Record<string, string> = {
  'glp3 ret':             'Retatrutide',
  'glp3ret':              'Retatrutide',
  'glp 3 ret':            'Retatrutide',
  'glp1 sema':            'Semaglutide',
  'glp1sema':             'Semaglutide',
  'glp 1 sema':           'Semaglutide',
  'glp2 tirz':            'Tirzepatide',
  'glp2tirz':             'Tirzepatide',
  'ghk cop':              'GHK-Cu',
  'ghk cu':               'GHK-Cu',
  'bac water':            'Bac Water',
  'bacteriostatic water': 'Bac Water',
  'igf 1lr3':             'IGF-1LR3',
  'igf1lr3':              'IGF-1LR3',
  'igf 1 lr3':            'IGF-1LR3',
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9+]/g, ' ').replace(/\s+/g, ' ').trim()
}

function findCostByName(productName: string): number | null {
  if (!productName) return null
  const pNorm = norm(productName)

  let best: typeof COST_DATA[0] | null = null
  let bestScore = 0

  for (const entry of COST_DATA) {
    const nameNorm = norm(entry.name)
    const strengthNorm = norm(entry.strength)

    const directMatch = pNorm.includes(nameNorm)
    const aliasMatch = !directMatch && Object.entries(ALIASES).some(
      ([alias, canonical]) => norm(canonical) === nameNorm && pNorm.includes(alias)
    )
    if (!directMatch && !aliasMatch) continue
    if (!pNorm.includes(strengthNorm)) continue

    const score = nameNorm.length + strengthNorm.length
    if (score > bestScore) {
      bestScore = score
      best = entry
    }
  }

  return best?.cost ?? null
}

export async function POST() {
  const supabase = createAdminClient()

  // 1. Build cost map: product_id / woo_product_id → our_cost
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

  // 2. Fetch all order_lines (paginated) — include `name` for fallback matching
  const allLines: any[] = []
  let pg = 0
  while (true) {
    const { data } = await supabase
      .from('order_lines')
      .select('line_id, product_id, qty_ordered, line_total, order_id, name')
      .range(pg * 1000, (pg + 1) * 1000 - 1)
    if (!data || data.length === 0) break
    allLines.push(...data)
    if (data.length < 1000) break
    pg++
  }

  // 3. Calculate updates — use name-based fallback when product_id has no cost
  type LineUpdate = { line_id: number; our_cost_per_unit: number; line_cost: number; line_profit: number }
  const lineUpdates: LineUpdate[] = []
  const orderCosts = new Map<number, { cost: number; revenue: number }>()
  let nameMatchCount = 0

  for (const line of allLines) {
    const productId = Number(line.product_id)
    let cost = costMap.get(productId)

    // Fallback: match by the WooCommerce line item name stored on the order line
    if (cost == null && line.name) {
      const nameCost = findCostByName(String(line.name))
      if (nameCost != null) {
        cost = nameCost
        nameMatchCount++
      }
    }

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
  const orderUpdateList: Array<{ woo_order_id: number; order_cost: number; order_product_cost: number; order_profit: number }> = []

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
    name_matched_lines: nameMatchCount,
    products_with_cost: costMap.size,
    message: `Updated ${updatedLines} line items across ${updatedOrders} orders (${nameMatchCount} matched by product name)`,
  })
}
