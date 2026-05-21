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
    const errorLog: string[] = []

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
          if (e2) { const m = `Product ${product.name}: ${e2.message}`; errorLog.push(m); console.error(m); errors++; continue }
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

            // Lookup: woo_product_id → product_id → sku_code (in that priority)
            type ExistingRow = { product_id: number; our_cost: number | null; stock_status_override: string | null }
            let existingRow: ExistingRow | null = null
            const { data: byWooId } = await supabase.from('products').select('product_id, our_cost, stock_status_override').eq('woo_product_id', variation.id).maybeSingle()
            if (byWooId) {
              existingRow = byWooId
            } else {
              const { data: byPk } = await supabase.from('products').select('product_id, our_cost, stock_status_override').eq('product_id', variation.id).maybeSingle()
              if (byPk) {
                existingRow = byPk
              } else if (varSku) {
                // SKU already exists in DB from CSV import — use case-insensitive match
                const { data: bySku } = await supabase.from('products').select('product_id, our_cost, stock_status_override').ilike('sku_code', varSku).maybeSingle()
                if (bySku) existingRow = bySku
              }
            }

            const varOurCost = varCost ?? existingRow?.our_cost ?? ourCost ?? null

            if (existingRow) {
              // UPDATE existing row — don't overwrite sku_code if already set (avoids unique conflicts)
              const updateFields: Record<string, unknown> = {
                product_name: varName,
                retail_price: varRetailPrice,
                our_cost: varOurCost,
                qty_sold: varQtySold,
                woo_product_id: variation.id,
              }
              // Only set sku_code if the row doesn't already have one
              const { data: currentRow } = await supabase.from('products').select('sku_code').eq('product_id', existingRow.product_id).maybeSingle()
              if (!currentRow?.sku_code && varSku) updateFields.sku_code = varSku
              if (!existingRow?.stock_status_override) updateFields.stock_status = varStockStatus
              if (varStockQty !== null) updateFields.current_stock = varStockQty
              const { error: upErr } = await supabase.from('products').update(updateFields).eq('product_id', existingRow.product_id)
              if (!upErr) {
                variations++
              } else if (upErr.message.includes('sku_code')) {
                // SKU taken by another row — retry without touching sku_code
                const { sku_code: _sk, ...noSkuFields } = updateFields as any
                const { error: upErr2 } = await supabase.from('products').update(noSkuFields).eq('product_id', existingRow.product_id)
                if (!upErr2) variations++
                else { const m = `Update ${varName} (no-sku): ${upErr2.message}`; errorLog.push(m); errors++ }
              } else {
                const m = `Update ${varName}: ${upErr.message}`; errorLog.push(m); errors++
              }
            } else {
              // INSERT new row — try with SKU, fall back to null SKU if conflict
              const insertFields: Record<string, unknown> = {
                product_id: variation.id,
                product_name: varName,
                sku_code: varSku,
                retail_price: varRetailPrice,
                our_cost: varOurCost,
                qty_sold: varQtySold,
                woo_product_id: variation.id,
              }
              if (varStockQty !== null) insertFields.current_stock = varStockQty
              insertFields.stock_status = varStockStatus

              const { error: insErr } = await supabase.from('products').insert(insertFields)
              if (!insErr) {
                variations++
              } else if (insErr.message.includes('sku_code')) {
                const { error: insErr2 } = await supabase.from('products').insert({ ...insertFields, sku_code: null })
                if (!insErr2) variations++
                else { const m = `Insert ${varName}: ${insErr2.message}`; errorLog.push(m); errors++ }
              } else {
                const m = `Insert ${varName}: ${insErr.message}`; errorLog.push(m); errors++
              }
            }
          }
        } catch (e) {
          errors++
          const m = `Variations for ${product.name}: ${e instanceof Error ? e.message : String(e)}`; errorLog.push(m)
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
      error_sample: errorLog.slice(0, 5),
    })
  } catch (error) {
    console.error('Product sync failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Product sync failed' },
      { status: 500 }
    )
  }
}
