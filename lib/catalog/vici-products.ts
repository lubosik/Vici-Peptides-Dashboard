/**
 * Vici Peptides product catalog: product name + strength → price and SKU.
 * Used for one-time backfill of order line item prices/SKUs when Zapier didn't send them.
 */

export interface CatalogEntry {
  /** Product name (normalized for matching; can be partial) */
  productName: string
  /** Strength/variant string (e.g. "10mg", "5000iu", "10ml") */
  strength: string
  price: number
  sku: string
}

/** All product variants with price and SKU */
export const VICI_PRODUCT_CATALOG: CatalogEntry[] = [
  { productName: 'Retatrutide', strength: '10mg', price: 85, sku: 'RT10' },
  { productName: 'Retatrutide', strength: '20mg', price: 145, sku: 'RT20' },
  { productName: 'Retatrutide', strength: '30mg', price: 195, sku: 'RT30' },
  { productName: 'GHK-cu', strength: '50mg', price: 49, sku: 'P-CU50' },
  { productName: 'GHK-cu', strength: '100mg', price: 79, sku: 'P-CU100' },
  { productName: 'Tirzepatide', strength: '10mg', price: 59, sku: 'TR10' },
  { productName: 'Tirzepatide', strength: '20mg', price: 99, sku: 'TR20' },
  { productName: 'Tirzepatide', strength: '30mg', price: 139, sku: 'TR30' },
  { productName: 'Tirzepatide', strength: '60mg', price: 225, sku: 'TR60' },
  { productName: 'KLOW', strength: '80mg', price: 159, sku: 'KLOW' },
  { productName: 'TB + BPC-157 + GHK + KPV', strength: '80mg', price: 159, sku: 'KLOW' },
  { productName: 'GLOW', strength: '70mg', price: 135, sku: 'BBG70' },
  { productName: 'TB + BPC-157 + GHK', strength: '70mg', price: 135, sku: 'BBG70' },
  { productName: 'Tesamorelin', strength: '10mg', price: 89, sku: 'TSM10' },
  { productName: 'Melanotan I', strength: '10mg', price: 45, sku: 'MT1' },
  { productName: 'Melanotan II', strength: '10mg', price: 45, sku: 'ML10' },
  { productName: 'CJC-1295 (without DAC) + IPA', strength: '10mg', price: 89, sku: 'CP10' },
  { productName: 'CJC-1295 without DAC + IPA', strength: '10mg', price: 89, sku: 'CP10' },
  { productName: 'Selank', strength: '10mg', price: 49, sku: 'SK10' },
  { productName: 'Semax', strength: '10mg', price: 49, sku: 'XA10' },
  { productName: 'Bac Water', strength: '10ml', price: 20, sku: 'P-WA10' },
  { productName: 'Ipamorelin', strength: '10mg', price: 59, sku: 'IP10' },
  { productName: 'BPC-157 + TB-500', strength: '10mg +10mg', price: 109, sku: 'BB10' },
  { productName: 'BPC-157 + TB-500', strength: '10mg', price: 109, sku: 'BB10' },
  { productName: 'MOTS-C', strength: '10mg', price: 49, sku: 'MS10' },
  { productName: 'MOTS-C', strength: '40mg', price: 155, sku: 'MS40' },
  { productName: 'Glutathione', strength: '600mg', price: 39, sku: 'GTT600' },
  { productName: 'Glutathione', strength: '1500mg', price: 89, sku: 'GTT1500' },
  { productName: 'IGF-1LR3', strength: '1mg', price: 85, sku: 'IG1' },
  { productName: 'HCG', strength: '5000iu', price: 39, sku: 'G5K' },
  { productName: 'HCG', strength: '10000iu', price: 69, sku: 'G10K' },
  { productName: 'TB-500', strength: '10mg', price: 84, sku: 'BT10' },
  { productName: 'CJC-1295 without DAC', strength: '10mg', price: 89, sku: 'CND10' },
  { productName: 'BPC-157', strength: '10mg', price: 59, sku: 'BC10' },
  { productName: 'NAD+', strength: '100mg', price: 35, sku: 'NJ100' },
  { productName: 'NAD+', strength: '500mg', price: 89, sku: 'NJ500' },
  { productName: 'NAD+', strength: '1000mg', price: 155, sku: 'NJ1000' },
  { productName: 'Semaglutide', strength: '10mg', price: 49, sku: 'SM10' },
  { productName: 'Semaglutide', strength: '20mg', price: 95, sku: 'SM20' },
  { productName: 'L-carnitine', strength: '600mg + 10ml', price: 32, sku: 'LC600' },
  { productName: 'L-carnitine', strength: '1200mg + 10ml', price: 50, sku: 'LC1200' },
]

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, '')
    .trim()
}

/**
 * Match a line item name (e.g. "Retatrutide - 10mg" or "Semaglutide 10mg") to catalog.
 * Returns { price, sku } or null if no match.
 */
export function matchProductToCatalog(lineName: string): { price: number; sku: string } | null {
  if (!lineName || typeof lineName !== 'string') return null
  const normalized = normalize(lineName)

  // Sort by longest productName first so "BPC-157 + TB-500" matches before "BPC-157"
  const sorted = [...VICI_PRODUCT_CATALOG].sort(
    (a, b) => normalize(b.productName).length - normalize(a.productName).length
  )

  for (const entry of sorted) {
    const productNorm = normalize(entry.productName)
    const strengthNorm = normalize(entry.strength)
    if (!normalized.includes(productNorm)) continue
    if (!normalized.includes(strengthNorm)) continue
    return { price: entry.price, sku: entry.sku }
  }

  return null
}
