/**
 * Backfill products.our_cost from CSV: Vici_Order_Tracker_with_Expenses_v2 - Tiered_Pricing.csv
 * Uses Cost_Per_Unit column; matches by Product_ID.
 * Run: npx tsx scripts/backfill-product-costs-from-csv.ts
 */

import { readCSV, getCSVPath } from './utils/csv-reader'
import { supabase } from './utils/supabase-client'
import { parseIntSafe, parseMoney } from './utils/parsers'

async function main() {
  console.log('Backfilling products.our_cost from Tiered_Pricing CSV...\n')

  const csvPath = getCSVPath('Vici_Order_Tracker_with_Expenses_v2 - Tiered_Pricing.csv')
  let rows: Record<string, string>[]
  try {
    rows = readCSV(csvPath) as Record<string, string>[]
  } catch (e) {
    console.error('Failed to read CSV. Place the file at Downloads or Downloads/Vici Dashboard CSVs')
    throw e
  }

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const row of rows) {
    const productId = parseIntSafe(row.Product_ID || row.product_id)
    if (!productId) {
      skipped++
      continue
    }

    const costPerUnit = row.Cost_Per_Unit || row.cost_per_unit
    if (costPerUnit == null || String(costPerUnit).trim() === '') {
      skipped++
      continue
    }

    const cost = parseMoney(costPerUnit)
    const { error } = await supabase
      .from('products')
      .update({ our_cost: cost })
      .eq('product_id', productId)

    if (error) {
      console.error('Product ' + productId + ': ' + error.message)
      errors++
    } else {
      updated++
    }
  }

  console.log('Done. Updated: ' + updated + ', skipped: ' + skipped + ', errors: ' + errors)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
