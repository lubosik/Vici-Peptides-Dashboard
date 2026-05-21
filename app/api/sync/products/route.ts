/**
 * Full product sync from WooCommerce API.
 * Syncs all products and variations into Supabase products table.
 * Includes total_sales (stored as qty_sold), retail_price, our_cost from meta.
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { WooCommerceClient } from '@/lib/sync/woocommerce-client'

export const dynamic = 'force-dynamic'

const COST_KEYS = ['_cost', 'cost_price', '_our_cost', 'our_cost', '_wc_cog_cost', '_wc_cog_item_cost']

function extractCostFromMeta(metaData: any[] | undefined): number | null {
  if (!metaData || !Array.isArray(metaData)) return null
  for (const meta of metaData) {
    const key = (meta?.key || '').toLowerCase()
    if (COST_KEYS.some((k) => key === k.toLowerCase())) {
      const val = parseFloat(meta?.value)
      if (!isNaN(val) && val >= 0) return val
    }
  }
  return null
}

export async function POST(request: NextRequest) {
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

    const allProducts: any[] = []
    let page = 1
    while (true) {
      const result = await wooClient.fetchProducts({
        page,
        perPage: 100,
      })
      if (result.products.length === 0) break
      allProducts.push(...result.products)
      if (result.products.length < 100) break
      page++
    }

    let synced = 0
    let variations = 0
    let errors = 0

    for (const product of allProducts) {
      // Skip variable parent products — stock lives on variations, not the parent
      const isVariable = product.type === 'variable'

      const wooCost = extractCostFromMeta(product.meta_data)
      const { data: existing } = await supabase
        .from('products')
        .select('product_id, our_cost, starting_qty, reorder_level, stock_status_override')
        .eq('woo_product_id', product.id)
        .maybeSingle()
      const ourCost = wooCost ?? existing?.our_cost ?? null

      // For variable products, don't store at parent level — go straight to variations
      if (!isVariable) {
        const stockQty = product.stock_quantity != null ? Math.max(0, parseInt(String(product.stock_quantity), 10) || 0) : null
        const wooStockStatus = product.stock_status === 'instock' ? 'In Stock' : product.stock_status === 'onbackorder' ? 'LOW STOCK' : 'OUT OF STOCK'
        const upsertRow: Record<string, unknown> = {
          product_id: product.id,
          woo_product_id: product.id,
          product_name: product.name || `Product ${product.id}`,
          sku_code: product.sku || null,
          retail_price: parseFloat(product.regular_price || product.price || '0') || null,
          our_cost: ourCost,
          qty_sold: Math.max(0, parseInt(product.total_sales || '0', 10) || 0),
        }
        // Only set stock fields if no manual override
        if (!existing?.stock_status_override) upsertRow.stock_status = wooStockStatus
        if (stockQty !== null) upsertRow.current_stock = stockQty

        const { error } = await supabase.from('products').upsert(upsertRow, { onConflict: 'woo_product_id' })
        if (error) {
          // Fallback: try upsert on product_id in case woo_product_id not yet set
          const { error: e2 } = await supabase.from('products').upsert({ ...upsertRow }, { onConflict: 'product_id' })
          if (e2) { console.error(`Product sync error for ${product.name}:`, e2.message); errors++; continue }
        }
        synced++
      }

      // Always sync variations for variable products (this is where real stock/prices live)
      if (product.type === 'variable') {
        try {
          const variationList = await wooClient.fetchAllVariations(product.id)
          for (const variation of variationList) {
            const attrStr = variation.attributes
              ?.map((a: any) => a.option)
              .filter(Boolean)
              .join(' / ') || ''
            const varName = `${product.name}${attrStr ? ` - ${attrStr}` : ''}`.trim()
            const varCost = extractCostFromMeta(variation.meta_data)
            const varStockQty = variation.stock_quantity != null ? Math.max(0, parseInt(String(variation.stock_quantity), 10) || 0) : null
            const varStockStatus = variation.stock_status === 'instock'
              ? (varStockQty !== null && varStockQty <= 5 && varStockQty > 0 ? 'LOW STOCK' : 'In Stock')
              : variation.stock_status === 'onbackorder' ? 'LOW STOCK' : 'OUT OF STOCK'
            const varRetailPrice = parseFloat(variation.regular_price || variation.price || '0') || null
            const varQtySold = Math.max(0, parseInt(variation.total_sales || '0', 10) || 0)
            const varSku = variation.sku || null

            // Explicit lookup: find by woo_product_id first, then by product_id
            let existingRow: { product_id: number; our_cost: number | null; stock_status_override: string | null } | null = null
            const { data: byWooId } = await supabase.from('products').select('product_id, our_cost, stock_status_override').eq('woo_product_id', variation.id).maybeSingle()
            if (byWooId) {
              existingRow = byWooId
            } else {
              const { data: byPk } = await supabase.from('products').select('product_id, our_cost, stock_status_override').eq('product_id', variation.id).maybeSingle()
              if (byPk) existingRow = byPk
            }

            const varOurCost = varCost ?? existingRow?.our_cost ?? ourCost ?? null
            const updateFields: Record<string, unknown> = {
              product_name: varName,
              sku_code: varSku,
              retail_price: varRetailPrice,
              our_cost: varOurCost,
              qty_sold: varQtySold,
              woo_product_id: variation.id,
            }
            if (!existingRow?.stock_status_override) updateFields.stock_status = varStockStatus
            if (varStockQty !== null) updateFields.current_stock = varStockQty

            if (existingRow) {
              // UPDATE existing row — use its known product_id as the key
              const { error: upErr } = await supabase.from('products').update(updateFields).eq('product_id', existingRow.product_id)
              if (!upErr) variations++
              else { errors++; console.error(`Variation update error for ${varName} (product_id=${existingRow.product_id}):`, upErr.message) }
            } else {
              // INSERT new row — variation.id as product_id (safe since it doesn't exist)
              const { error: insErr } = await supabase.from('products').insert({ product_id: variation.id, ...updateFields })
              if (!insErr) variations++
              else { errors++; console.error(`Variation insert error for ${varName}:`, insErr.message) }
            }
          }
        } catch (e) {
          errors++
          console.warn(`Could not sync variations for product ${product.id}:`, e)
        }
      }
    }

    revalidatePath('/products')
    revalidatePath('/')
    revalidatePath('/analytics')

    return NextResponse.json({
      success: true,
      synced,
      variations,
      errors,
      total: allProducts.length,
      message: `Synced ${synced} products and ${variations} variations`,
    })
  } catch (error) {
    console.error('Product sync failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Product sync failed' },
      { status: 500 }
    )
  }
}
