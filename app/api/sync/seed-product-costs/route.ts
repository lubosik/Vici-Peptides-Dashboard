/**
 * One-shot endpoint: seeds our_cost and retail_price into products table
 * from the Tiered Pricing CSV data. Matches by product name + strength.
 * Safe to call multiple times (idempotent upsert by name match).
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

// Source: Vici_Order_Tracker_with_Expenses_v2 - Tiered_Pricing (2).csv
// cost = Cost_Per_Unit, retail = Price_1_Unit, msrp = MSRP_Slashed
const COST_DATA = [
  { id: 108,  name: 'MOTS-C',                              strength: '10mg',        cost: 7,  retail: 49,  msrp: 63  },
  { id: 109,  name: 'MOTS-C',                              strength: '40mg',        cost: 23, retail: 155, msrp: 189 },
  { id: 110,  name: 'NAD+',                                strength: '100mg',       cost: 5,  retail: 35,  msrp: 45  },
  { id: 111,  name: 'NAD+',                                strength: '500mg',       cost: 9,  retail: 89,  msrp: 111 },
  { id: 112,  name: 'NAD+',                                strength: '1000mg',      cost: 17, retail: 155, msrp: 189 },
  { id: 114,  name: 'Glutathione',                         strength: '600mg',       cost: 6,  retail: 39,  msrp: 50  },
  { id: 115,  name: 'Glutathione',                         strength: '1500mg',      cost: 16, retail: 89,  msrp: 111 },
  { id: 121,  name: 'Retatrutide',                         strength: '10mg',        cost: 13, retail: 85,  msrp: 106 },
  { id: 122,  name: 'Retatrutide',                         strength: '20mg',        cost: 21, retail: 145, msrp: 177 },
  { id: 123,  name: 'Retatrutide',                         strength: '30mg',        cost: 27, retail: 195, msrp: 238 },
  { id: 125,  name: 'Semaglutide',                         strength: '10mg',        cost: 6,  retail: 49,  msrp: 63  },
  { id: 127,  name: 'Semaglutide',                         strength: '20mg',        cost: 9,  retail: 95,  msrp: 119 },
  { id: 129,  name: 'Tirzepatide',                         strength: '10mg',        cost: 7,  retail: 59,  msrp: 74  },
  { id: 131,  name: 'Tirzepatide',                         strength: '20mg',        cost: 11, retail: 99,  msrp: 124 },
  { id: 132,  name: 'Tirzepatide',                         strength: '30mg',        cost: 16, retail: 139, msrp: 170 },
  { id: 133,  name: 'Tirzepatide',                         strength: '60mg',        cost: 23, retail: 225, msrp: 270 },
  { id: 139,  name: 'L-carnitine',                         strength: '600mg',       cost: 6,  retail: 25,  msrp: 32  },
  { id: 140,  name: 'L-carnitine',                         strength: '1200mg',      cost: 12, retail: 39,  msrp: 50  },
  { id: 143,  name: 'BPC-157',                             strength: '10mg',        cost: 5,  retail: 59,  msrp: 74  },
  { id: 145,  name: 'BPC-157 + TB-500',                   strength: '10mg',        cost: 20, retail: 109, msrp: 133 },
  { id: 146,  name: 'GHK-Cu',                              strength: '50mg',        cost: 5,  retail: 39,  msrp: 50  },
  { id: 147,  name: 'GHK-Cu',                              strength: '100mg',       cost: 9,  retail: 79,  msrp: 99  },
  { id: 150,  name: 'GLOW',                                strength: '70mg',        cost: 23, retail: 135, msrp: 165 },
  { id: 151,  name: 'KLOW',                                strength: '80mg',        cost: 24, retail: 159, msrp: 194 },
  { id: 157,  name: 'TB-500',                              strength: '10mg',        cost: 8,  retail: 95,  msrp: 119 },
  { id: 159,  name: 'CJC-1295 without DAC',               strength: '10mg',        cost: 19, retail: 89,  msrp: 111 },
  { id: 161,  name: 'CJC-1295 (without DAC) + IPA',       strength: '10mg',        cost: 12, retail: 89,  msrp: 111 },
  { id: 163,  name: 'IGF-1LR3',                            strength: '1mg',         cost: 20, retail: 85,  msrp: 106 },
  { id: 165,  name: 'Tesamorelin',                         strength: '10mg',        cost: 19, retail: 89,  msrp: 111 },
  { id: 169,  name: 'HCG',                                 strength: '5000iu',      cost: 5,  retail: 39,  msrp: 50  },
  { id: 170,  name: 'HCG',                                 strength: '10000iu',     cost: 8,  retail: 69,  msrp: 86  },
  { id: 172,  name: 'Ipamorelin',                          strength: '10mg',        cost: 8,  retail: 59,  msrp: 74  },
  { id: 190,  name: 'Semax',                               strength: '10mg',        cost: 8,  retail: 49,  msrp: 63  },
  { id: 192,  name: 'Selank',                              strength: '10mg',        cost: 8,  retail: 49,  msrp: 63  },
  { id: 196,  name: 'Melanotan I',                         strength: '10mg',        cost: 6,  retail: 45,  msrp: 58  },
  { id: 197,  name: 'Melanotan II',                        strength: '10mg',        cost: 6,  retail: 45,  msrp: 58  },
  { id: 198,  name: 'Bac Water',                           strength: '3ml',         cost: 2,  retail: 10,  msrp: 13  },
  { id: 199,  name: 'Bac Water',                           strength: '10ml',        cost: 3,  retail: 20,  msrp: 26  },
]

// Aliases: WooCommerce/old-dashboard names that may differ from CSV
const NAME_ALIASES: Record<string, string> = {
  'retatrutide':                       'Retatrutide',
  'glp-3-ret':                         'Retatrutide',
  'glp3ret':                           'Retatrutide',
  'semaglutide':                       'Semaglutide',
  'glp-sem':                           'Semaglutide',
  'glpsem':                            'Semaglutide',
  'tirzepatide':                       'Tirzepatide',
  'glp-tir':                           'Tirzepatide',
  'ghk-cu':                            'GHK-Cu',
  'ghk-cop':                           'GHK-Cu',
  'ghk cu':                            'GHK-Cu',
  'bpc-157 + tb-500':                  'BPC-157 + TB-500',
  'bpc157 + tb500':                    'BPC-157 + TB-500',
  'bb10':                              'BPC-157 + TB-500',
  'cjc-1295 (without dac) + ipa':      'CJC-1295 (without DAC) + IPA',
  'cjc-1295 without dac + ipa':        'CJC-1295 (without DAC) + IPA',
  'cjc1295 + ipa':                     'CJC-1295 (without DAC) + IPA',
  'glow':                              'GLOW',
  'tb + bpc-157 + ghk':                'GLOW',
  'klow':                              'KLOW',
  'tb + bpc-157 + ghk + kpv':          'KLOW',
  'igf-1 lr3':                         'IGF-1LR3',
  'igf1lr3':                           'IGF-1LR3',
  'l-carnitine':                       'L-carnitine',
  'l carnitine':                       'L-carnitine',
  'lc600':                             'L-carnitine',
  'bac water':                         'Bac Water',
  'bacteriostatic water':              'Bac Water',
}

function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9+]/g, ' ').replace(/\s+/g, ' ').trim()
}

function resolveName(raw: string): string | null {
  const n = normalise(raw)
  if (NAME_ALIASES[n]) return NAME_ALIASES[n]
  // Check if raw contains any known canonical name
  for (const entry of COST_DATA) {
    if (n.includes(normalise(entry.name))) return entry.name
  }
  return null
}

export async function POST() {
  const supabase = createAdminClient()

  // Fetch all products
  const { data: allProducts, error } = await supabase
    .from('products')
    .select('product_id, woo_product_id, product_name, sku_code, our_cost, retail_price')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const updated: string[] = []
  const skipped: string[] = []
  const notFound: string[] = []

  for (const entry of COST_DATA) {
    const nameNorm = normalise(entry.name)
    const strengthNorm = normalise(entry.strength)

    // Find all DB products whose name contains both the compound name and strength
    const matches = (allProducts || []).filter((p) => {
      const pNorm = normalise(p.product_name || '')
      // Try resolving aliases in DB product name
      const resolved = resolveName(p.product_name || '')
      const resolvedNorm = resolved ? normalise(resolved) : ''

      const nameMatch = pNorm.includes(nameNorm) || resolvedNorm.includes(nameNorm) ||
        (Object.entries(NAME_ALIASES).some(([alias, canonical]) =>
          normalise(canonical) === nameNorm && pNorm.includes(alias)))

      const strengthMatch = pNorm.includes(strengthNorm)
      return nameMatch && strengthMatch
    })

    // Also try matching by original product_id (may match old CSV-imported rows)
    const byId = (allProducts || []).filter(
      (p) => Number(p.product_id) === entry.id || Number(p.woo_product_id) === entry.id
    )
    const combined = [...new Map([...matches, ...byId].map((p) => [p.product_id, p])).values()]

    if (combined.length === 0) {
      notFound.push(`${entry.name} ${entry.strength}`)
      continue
    }

    for (const product of combined) {
      const updates: Record<string, unknown> = { our_cost: entry.cost }
      // Only set retail_price if not already populated from WooCommerce (avoid overwriting live prices)
      if (!product.retail_price || Number(product.retail_price) === 0) {
        updates.retail_price = entry.retail
      }

      const { error: upErr } = await supabase
        .from('products')
        .update(updates)
        .eq('product_id', product.product_id)

      if (upErr) {
        skipped.push(`${product.product_name} (${upErr.message})`)
      } else {
        updated.push(`${product.product_name} → cost=$${entry.cost}`)
      }
    }
  }

  // Trigger full recalculation
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  let recalcResult: any = null
  try {
    const r = await fetch(`${baseUrl}/api/sync/recalculate-costs`, { method: 'POST' })
    recalcResult = await r.json()
  } catch {
    recalcResult = { error: 'Could not auto-trigger recalculate — call it manually' }
  }

  revalidatePath('/products')
  revalidatePath('/')
  revalidatePath('/orders')

  return NextResponse.json({
    success: true,
    updated_products: updated.length,
    not_found: notFound.length,
    updated,
    not_found_list: notFound,
    skipped,
    recalculate: recalcResult,
  })
}
