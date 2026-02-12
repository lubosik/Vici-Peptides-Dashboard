/**
 * Backfill products.retail_price from order_lines (max customer_paid_per_unit per product).
 * Run: npx tsx scripts/backfill-retail-price-from-orders.ts
 */

import { supabase } from './utils/supabase-client'

async function main() {
  console.log('Fetching max customer_paid_per_unit per product from order_lines...\n')

  const { data: lines, error: linesError } = await supabase
    .from('order_lines')
    .select('product_id, customer_paid_per_unit')

  if (linesError) {
    throw new Error(linesError.message)
  }

  const maxPriceByProduct = new Map<number, number>()
  for (const line of lines ?? []) {
    const pid = line.product_id
    const price = Number(line.customer_paid_per_unit) || 0
    if (price <= 0) continue
    const existing = maxPriceByProduct.get(pid)
    if (existing == null || price > existing) {
      maxPriceByProduct.set(pid, price)
    }
  }

  let updated = 0
  let errors = 0

  for (const [productId, retailPrice] of maxPriceByProduct) {
    const { error } = await supabase
      .from('products')
      .update({ retail_price: retailPrice })
      .eq('product_id', productId)

    if (error) {
      console.error(`Product ${productId}: ${error.message}`)
      errors++
    } else {
      updated++
    }
  }

  console.log(`Done. Updated retail_price for ${updated} products, errors: ${errors}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
