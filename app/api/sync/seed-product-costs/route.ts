/**
 * Seeds our_cost and retail_price into products table from Tiered Pricing CSV data.
 * Matches each DB product to the most specific (longest name) cost entry.
 * Safe to re-run — idempotent.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

// Source: Vici_Order_Tracker_with_Expenses_v2 - Tiered_Pricing (2).csv
const COST_DATA = [
  { id: 108,  name: 'MOTS-C',                              strength: '10mg',        cost: 7,  retail: 49  },
  { id: 109,  name: 'MOTS-C',                              strength: '40mg',        cost: 23, retail: 155 },
  { id: 110,  name: 'NAD+',                                strength: '100mg',       cost: 5,  retail: 35  },
  { id: 111,  name: 'NAD+',                                strength: '500mg',       cost: 9,  retail: 89  },
  { id: 112,  name: 'NAD+',                                strength: '1000mg',      cost: 17, retail: 155 },
  { id: 114,  name: 'Glutathione',                         strength: '600mg',       cost: 6,  retail: 39  },
  { id: 115,  name: 'Glutathione',                         strength: '1500mg',      cost: 16, retail: 89  },
  { id: 121,  name: 'Retatrutide',                         strength: '10mg',        cost: 13, retail: 85  },
  { id: 122,  name: 'Retatrutide',                         strength: '20mg',        cost: 21, retail: 145 },
  { id: 123,  name: 'Retatrutide',                         strength: '30mg',        cost: 27, retail: 195 },
  { id: 125,  name: 'Semaglutide',                         strength: '10mg',        cost: 6,  retail: 49  },
  { id: 127,  name: 'Semaglutide',                         strength: '20mg',        cost: 9,  retail: 95  },
  { id: 129,  name: 'Tirzepatide',                         strength: '10mg',        cost: 7,  retail: 59  },
  { id: 131,  name: 'Tirzepatide',                         strength: '20mg',        cost: 11, retail: 99  },
  { id: 132,  name: 'Tirzepatide',                         strength: '30mg',        cost: 16, retail: 139 },
  { id: 133,  name: 'Tirzepatide',                         strength: '60mg',        cost: 23, retail: 225 },
  { id: 139,  name: 'L-carnitine',                         strength: '600mg',       cost: 6,  retail: 25  },
  { id: 140,  name: 'L-carnitine',                         strength: '1200mg',      cost: 12, retail: 39  },
  { id: 143,  name: 'BPC-157',                             strength: '10mg',        cost: 5,  retail: 59  },
  { id: 145,  name: 'BPC-157 + TB-500',                   strength: '10mg',        cost: 20, retail: 109 },
  { id: 146,  name: 'GHK-Cu',                              strength: '50mg',        cost: 5,  retail: 39  },
  { id: 147,  name: 'GHK-Cu',                              strength: '100mg',       cost: 9,  retail: 79  },
  { id: 150,  name: 'GLOW',                                strength: '70mg',        cost: 23, retail: 135 },
  { id: 151,  name: 'KLOW',                                strength: '80mg',        cost: 24, retail: 159 },
  { id: 157,  name: 'TB-500',                              strength: '10mg',        cost: 8,  retail: 95  },
  { id: 159,  name: 'CJC-1295 without DAC',               strength: '10mg',        cost: 19, retail: 89  },
  { id: 161,  name: 'CJC-1295 (without DAC) + IPA',       strength: '10mg',        cost: 12, retail: 89  },
  { id: 163,  name: 'IGF-1LR3',                            strength: '1mg',         cost: 20, retail: 85  },
  { id: 165,  name: 'Tesamorelin',                         strength: '10mg',        cost: 19, retail: 89  },
  { id: 169,  name: 'HCG',                                 strength: '5000iu',      cost: 5,  retail: 39  },
  { id: 170,  name: 'HCG',                                 strength: '10000iu',     cost: 8,  retail: 69  },
  { id: 172,  name: 'Ipamorelin',                          strength: '10mg',        cost: 8,  retail: 59  },
  { id: 190,  name: 'Semax',                               strength: '10mg',        cost: 8,  retail: 49  },
  { id: 192,  name: 'Selank',                              strength: '10mg',        cost: 8,  retail: 49  },
  { id: 196,  name: 'Melanotan I',                         strength: '10mg',        cost: 6,  retail: 45  },
  { id: 197,  name: 'Melanotan II',                        strength: '10mg',        cost: 6,  retail: 45  },
  { id: 198,  name: 'Bac Water',                           strength: '3ml',         cost: 2,  retail: 10  },
  { id: 199,  name: 'Bac Water',                           strength: '10ml',        cost: 3,  retail: 20  },
]

// WooCommerce names → canonical CSV names
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

function findBestMatch(productName: string): typeof COST_DATA[0] | null {
  const pNorm = norm(productName)

  let best: typeof COST_DATA[0] | null = null
  let bestScore = 0

  for (const entry of COST_DATA) {
    const nameNorm = norm(entry.name)
    const strengthNorm = norm(entry.strength)

    // Direct name match OR alias match (e.g. "glp1 sema" → "Semaglutide")
    const directMatch = pNorm.includes(nameNorm)
    const aliasMatch = !directMatch && Object.entries(ALIASES).some(
      ([alias, canonical]) => norm(canonical) === nameNorm && pNorm.includes(alias)
    )
    if (!directMatch && !aliasMatch) continue

    // Strength must appear in the original product name
    if (!pNorm.includes(strengthNorm)) continue

    const score = nameNorm.length + strengthNorm.length
    if (score > bestScore) {
      bestScore = score
      best = entry
    }
  }

  return best
}

export async function POST() {
  const supabase = createAdminClient()

  const { data: allProducts, error } = await supabase
    .from('products')
    .select('product_id, woo_product_id, product_name, our_cost, retail_price')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const updated: string[] = []
  const skipped: string[] = []
  const notFound: string[] = []

  for (const product of allProducts || []) {
    const best = findBestMatch(product.product_name || '')

    // Fallback: match by original Product_ID from the CSV
    const byId = !best
      ? COST_DATA.find((e) => e.id === Number(product.product_id) || e.id === Number(product.woo_product_id))
      : null

    const match = best ?? byId ?? null

    if (!match) {
      notFound.push(product.product_name || String(product.product_id))
      continue
    }

    const updates: Record<string, unknown> = { our_cost: match.cost }
    if (!product.retail_price || Number(product.retail_price) === 0) {
      updates.retail_price = match.retail
    }

    const { error: upErr } = await supabase
      .from('products')
      .update(updates)
      .eq('product_id', product.product_id)

    if (upErr) {
      skipped.push(`${product.product_name}: ${upErr.message}`)
    } else {
      updated.push(`${product.product_name} → cost=$${match.cost} [${match.name} ${match.strength}]`)
    }
  }

  revalidatePath('/products')
  revalidatePath('/')

  return NextResponse.json({
    success: true,
    updated_products: updated.length,
    not_found_count: notFound.length,
    updated,
    not_found: notFound,
    skipped,
    next_step: 'Click Recalculate Costs to backfill all order profits with real numbers',
  })
}
