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
      const wooCost = extractCostFromMeta(product.meta_data)
      const { data: existing } = await supabase
        .from('products')
        .select('our_cost')
        .eq('woo_product_id', product.id)
        .maybeSingle()
      const ourCost = wooCost ?? existing?.our_cost ?? null

      const stockQty = product.stock_quantity != null ? Math.max(0, parseInt(String(product.stock_quantity), 10) || 0) : null
      const { error } = await supabase
        .from('products')
        .upsert(
          {
            product_id: product.id,
            woo_product_id: product.id,
            product_name: product.name || `Product ${product.id}`,
            sku_code: product.sku || null,
            retail_price: parseFloat(product.regular_price || product.price || '0') || null,
            our_cost: ourCost,
            current_stock: stockQty,
            stock_status:
              product.stock_status === 'instock'
                ? 'In Stock'
                : product.stock_status === 'onbackorder'
                  ? 'LOW STOCK'
                  : 'OUT OF STOCK',
            qty_sold: Math.max(0, parseInt(product.total_sales || '0', 10) || 0),
          },
          { onConflict: 'woo_product_id' }
        )

      if (error) {
        console.error(`Product sync error for ${product.name}:`, error.message)
        errors++
        continue
      }
      synced++

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
            const { data: existingVar } = await supabase
              .from('products')
              .select('our_cost')
              .eq('woo_product_id', variation.id)
              .maybeSingle()
            const varOurCost = varCost ?? existingVar?.our_cost ?? ourCost ?? null

            const varStockQty = variation.stock_quantity != null ? Math.max(0, parseInt(String(variation.stock_quantity), 10) || 0) : null
            const { error: varErr } = await supabase
              .from('products')
              .upsert(
                {
                  product_id: variation.id,
                  woo_product_id: variation.id,
                  product_name: varName,
                  sku_code: variation.sku || null,
                  retail_price:
                    parseFloat(variation.regular_price || variation.price || '0') || null,
                  our_cost: varOurCost,
                  current_stock: varStockQty,
                  stock_status:
                    variation.stock_status === 'instock'
                      ? 'In Stock'
                      : variation.stock_status === 'onbackorder'
                        ? 'LOW STOCK'
                        : 'OUT OF STOCK',
                  qty_sold: Math.max(0, parseInt(variation.total_sales || '0', 10) || 0),
                },
                { onConflict: 'woo_product_id' }
              )
            if (!varErr) variations++
            else console.error(`Variation sync error for ${varName}:`, varErr.message)
          }
        } catch (e) {
          console.warn(`Could not fetch variations for product ${product.id}:`, e)
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
