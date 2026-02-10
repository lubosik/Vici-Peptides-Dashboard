/**
 * Refresh product stock from WooCommerce: GET products/<id> for each product and update current_stock, stock_status.
 * Ensures stock levels reflect real-time WooCommerce (no negative stock).
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WooCommerceClient } from '@/lib/sync/woocommerce-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function stockStatusFromWoo(status: string): string {
  if (status === 'instock') return 'In Stock'
  if (status === 'onbackorder') return 'LOW STOCK'
  return 'OUT OF STOCK'
}

export async function POST() {
  try {
    const storeUrl = process.env.WOOCOMMERCE_STORE_URL
    const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY
    const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET
    if (!storeUrl || !consumerKey || !consumerSecret) {
      return NextResponse.json(
        { error: 'WooCommerce credentials not configured' },
        { status: 500 }
      )
    }

    const supabase = createAdminClient()
    const wooClient = new WooCommerceClient({ storeUrl, consumerKey, consumerSecret })

    const { data: products, error: listError } = await supabase
      .from('products')
      .select('product_id, woo_product_id')
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 })
    }
    const ids = (products || []).map((p) => p.woo_product_id ?? p.product_id).filter((id) => id != null && id > 0)
    const uniqueIds = [...new Set(ids)]

    let updated = 0
    let errors = 0
    for (const id of uniqueIds) {
      try {
        const woo = await wooClient.getProduct(Number(id))
        const stockQty = woo.stock_quantity != null ? Math.max(0, parseInt(String(woo.stock_quantity), 10) || 0) : null
        const { error: upErr } = await supabase
          .from('products')
          .update({
            current_stock: stockQty,
            stock_status: stockStatusFromWoo(woo.stock_status || 'outofstock'),
          })
          .eq('woo_product_id', id)
        if (upErr) errors++
        else updated++
      } catch {
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      errors,
      total: uniqueIds.length,
      message: `Updated stock for ${updated} products.${errors > 0 ? ` ${errors} errors.` : ''}`,
    })
  } catch (e) {
    console.error('Product stock sync failed:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Product stock sync failed' },
      { status: 500 }
    )
  }
}
