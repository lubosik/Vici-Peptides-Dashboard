/**
 * Removes products that came from the old CSV import and do not exist in WooCommerce.
 * Criteria: woo_product_id IS NULL and no order_lines referencing the product.
 * Products with order history are kept (FK constraint + data integrity).
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = createAdminClient()

  // Find products with no WooCommerce ID
  const { data: csvProducts, error: fetchErr } = await supabase
    .from('products')
    .select('product_id, product_name')
    .is('woo_product_id', null)

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!csvProducts || csvProducts.length === 0) {
    return NextResponse.json({ success: true, deleted: 0, kept: 0, message: 'Nothing to clean up' })
  }

  const candidateIds = csvProducts.map((p) => p.product_id)

  // Find which of those have order lines (can't delete these — FK constraint)
  const { data: referenced } = await supabase
    .from('order_lines')
    .select('product_id')
    .in('product_id', candidateIds)

  const referencedSet = new Set((referenced || []).map((r) => Number(r.product_id)))

  const toDelete = csvProducts.filter((p) => !referencedSet.has(Number(p.product_id)))
  const toKeep = csvProducts.filter((p) => referencedSet.has(Number(p.product_id)))

  let deleted = 0
  const deletedNames: string[] = []

  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('products')
      .delete()
      .in('product_id', toDelete.map((p) => p.product_id))

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    deleted = toDelete.length
    deletedNames.push(...toDelete.map((p) => p.product_name || `ID ${p.product_id}`))
  }

  revalidatePath('/products')
  revalidatePath('/')

  return NextResponse.json({
    success: true,
    deleted,
    kept: toKeep.length,
    kept_reason: 'Products with order history are kept for data integrity',
    deleted_names: deletedNames,
    kept_names: toKeep.map((p) => p.product_name || `ID ${p.product_id}`),
  })
}

export async function GET() {
  const supabase = createAdminClient()

  const { data: csvProducts } = await supabase
    .from('products')
    .select('product_id, product_name')
    .is('woo_product_id', null)

  const candidateIds = (csvProducts || []).map((p) => p.product_id)

  const { data: referenced } = candidateIds.length
    ? await supabase.from('order_lines').select('product_id').in('product_id', candidateIds)
    : { data: [] }

  const referencedSet = new Set((referenced || []).map((r) => Number(r.product_id)))
  const toDelete = (csvProducts || []).filter((p) => !referencedSet.has(Number(p.product_id)))
  const toKeep = (csvProducts || []).filter((p) => referencedSet.has(Number(p.product_id)))

  return NextResponse.json({
    csv_only_products: (csvProducts || []).length,
    can_delete: toDelete.length,
    must_keep: toKeep.length,
    preview_delete: toDelete.slice(0, 20).map((p) => p.product_name),
    preview_keep: toKeep.slice(0, 10).map((p) => p.product_name),
  })
}
