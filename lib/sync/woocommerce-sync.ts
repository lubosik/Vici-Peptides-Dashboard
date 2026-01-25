/**
 * WooCommerce Sync Module
 * Main sync logic that can be called from API routes or scheduled jobs
 */

import { WooCommerceClient } from './woocommerce-client'
import {
  normalizeOrder,
  normalizeProduct,
  normalizeCoupon,
  NormalizedOrder,
  NormalizedOrderLine,
  NormalizedProduct,
  NormalizedCoupon,
} from './woocommerce-normalizer'
import { SupabaseClient } from '@supabase/supabase-js'

export interface SyncOptions {
  mode: 'full' | 'incremental'
  syncOrders?: boolean
  syncProducts?: boolean
  syncCoupons?: boolean
}

export interface SyncResult {
  success: boolean
  orders?: {
    synced: number
    errors: number
  }
  products?: {
    synced: number
    errors: number
  }
  coupons?: {
    synced: number
    errors: number
  }
  error?: string
}

export class WooCommerceSync {
  private wooClient: WooCommerceClient
  private supabase: SupabaseClient

  constructor(
    wooConfig: {
      storeUrl: string
      consumerKey: string
      consumerSecret: string
    },
    supabase: SupabaseClient
  ) {
    this.wooClient = new WooCommerceClient(wooConfig)
    this.supabase = supabase
  }

  /**
   * Get last sync timestamp for a sync type
   */
  private async getLastSyncTimestamp(syncType: string): Promise<string | null> {
    const { data } = await this.supabase
      .from('sync_state')
      .select('last_successful_sync')
      .eq('sync_type', syncType)
      .single()

    return data?.last_successful_sync || null
  }

  /**
   * Update sync state after successful sync
   */
  private async updateSyncState(
    syncType: string,
    count: number,
    error?: string
  ): Promise<void> {
    const updateData: any = {
      last_sync_count: count,
      updated_at: new Date().toISOString(),
    }

    if (error) {
      updateData.last_error = error
    } else {
      updateData.last_successful_sync = new Date().toISOString()
      updateData.last_error = null
    }

    await this.supabase
      .from('sync_state')
      .upsert({
        sync_type: syncType,
        ...updateData,
      })
  }

  /**
   * Sync orders from WooCommerce
   */
  async syncOrders(mode: 'full' | 'incremental'): Promise<{
    synced: number
    errors: number
  }> {
    let synced = 0
    let errors = 0

    try {
      // Get last sync timestamp for incremental mode
      const after = mode === 'incremental'
        ? await this.getLastSyncTimestamp('orders')
        : undefined

      // For full mode, get existing order IDs to skip already synced orders
      let existingOrderIds = new Set<number>()
      if (mode === 'full') {
        const { data: existingOrders } = await this.supabase
          .from('orders')
          .select('woo_order_id')
          .not('woo_order_id', 'is', null)
        
        existingOrderIds = new Set(
          (existingOrders || [])
            .map(o => Number(o.woo_order_id))
            .filter(id => !isNaN(id) && id > 0)
        )
        console.log(`📊 Found ${existingOrderIds.size} existing orders in database`)
      }

      // Fetch all orders
      const allOrders = await this.wooClient.fetchAllPages(
        async (page) => {
          const result = await this.wooClient.fetchOrders({
            page,
            perPage: 100,
            after: after || undefined,
          })
          return { orders: result.orders, totalPages: result.totalPages }
        },
        'orders'
      )

      // Filter out orders that already exist in full mode
      const ordersToSync = mode === 'full'
        ? allOrders.filter(order => !existingOrderIds.has(order.id))
        : allOrders

      console.log(`📦 Fetched ${allOrders.length} orders from WooCommerce, ${ordersToSync.length} to sync (${allOrders.length - ordersToSync.length} already exist)`)

      // Process orders sequentially to avoid overwhelming the database
      for (let i = 0; i < ordersToSync.length; i++) {
        const wooOrder = ordersToSync[i]
        if (i % 10 === 0) {
          console.log(`Processing order ${i + 1}/${ordersToSync.length}...`)
        }
        
        try {
          // Log if order has line items for debugging
          const hasLineItems = wooOrder.line_items && Array.isArray(wooOrder.line_items) && wooOrder.line_items.length > 0
          if (!hasLineItems) {
            console.warn(`⚠️  Order ${wooOrder.id} (${wooOrder.number || wooOrder.id}) has no line_items array or empty array`)
          }

          const { order, lineItems } = normalizeOrder(wooOrder)

          // Log normalized line items count
          if (lineItems.length === 0 && hasLineItems) {
            console.warn(`⚠️  Order ${order.order_number} normalized to 0 line items despite WooCommerce having ${wooOrder.line_items?.length || 0} items`)
          }

          // Upsert order - handle both order_number (primary key) and woo_order_id (unique)
          // First check if order exists by woo_order_id
          const { data: existingOrder } = await this.supabase
            .from('orders')
            .select('order_number, woo_order_id')
            .eq('woo_order_id', order.woo_order_id)
            .maybeSingle()

          // If order exists with different order_number, we need to update it
          // Since order_number is the primary key, we'll delete and re-insert
          if (existingOrder && existingOrder.order_number !== order.order_number) {
            // Delete old order (cascade will delete line items)
            await this.supabase
              .from('orders')
              .delete()
              .eq('order_number', existingOrder.order_number)
          }

          // Upsert order by order_number (primary key)
          const { error: orderError } = await this.supabase
            .from('orders')
            .upsert(order, {
              onConflict: 'order_number',
            })

          if (orderError) {
            console.error(`❌ Error upserting order ${order.order_number}:`, orderError)
            errors++
            continue
          }

          // Upsert line items - batch product lookups for efficiency
          if (lineItems.length > 0) {
            // Get all unique product IDs from line items
            const wooProductIds = [...new Set(lineItems.map(li => li.product_id).filter(id => id > 0))]
            
            // Batch fetch all products at once
            // Handle empty array case
            const { data: products } = wooProductIds.length > 0
              ? await this.supabase
                  .from('products')
                  .select('product_id, our_cost, woo_product_id')
                  .in('woo_product_id', wooProductIds)
              : { data: [] }
            
            // Create a map for quick lookup
            const productMap = new Map<number, { product_id: number; our_cost: number | null }>()
            products?.forEach(p => {
              productMap.set(Number(p.woo_product_id), {
                product_id: Number(p.product_id),
                our_cost: p.our_cost ? Number(p.our_cost) : null,
              })
            })

            // Build line items to upsert
            // If product doesn't exist in our DB, we still need to create the line item
            // We'll use the WooCommerce product_id directly and create a placeholder product if needed
            const lineItemsToUpsert = []
            for (const lineItem of lineItems) {
              const product = productMap.get(lineItem.product_id)
              let finalProductId = product?.product_id || lineItem.product_id
              let ourCostPerUnit = product?.our_cost || 0

              // If product doesn't exist, try to create a minimal product record
              if (!product) {
                // Check if product exists by product_id (might have different woo_product_id)
                const { data: existingProductById } = await this.supabase
                  .from('products')
                  .select('product_id, our_cost')
                  .eq('product_id', lineItem.product_id)
                  .maybeSingle()

                if (existingProductById) {
                  finalProductId = existingProductById.product_id
                  ourCostPerUnit = existingProductById.our_cost || 0
                } else {
                  // Product doesn't exist - create minimal product record
                  const { data: newProduct, error: productError } = await this.supabase
                    .from('products')
                    .upsert({
                      product_id: lineItem.product_id,
                      woo_product_id: lineItem.product_id,
                      product_name: `Product ${lineItem.product_id}`,
                      our_cost: null,
                      retail_price: lineItem.customer_paid_per_unit,
                      current_stock: null,
                      stock_status: 'OUT OF STOCK',
                    }, {
                      onConflict: 'product_id',
                    })
                    .select('product_id')
                    .single()

                  if (!productError && newProduct) {
                    finalProductId = newProduct.product_id
                  }
                }
              }

              lineItemsToUpsert.push({
                order_number: String(lineItem.order_number),
                woo_line_item_id: lineItem.woo_line_item_id,
                product_id: Number(finalProductId),
                qty_ordered: Number(lineItem.qty_ordered),
                our_cost_per_unit: Number(ourCostPerUnit),
                customer_paid_per_unit: Number(lineItem.customer_paid_per_unit),
              })
            }

            // Batch upsert line items
            if (lineItemsToUpsert.length > 0) {
              // Ensure all required fields are present and properly formatted
              const validatedLineItems = lineItemsToUpsert.map(item => ({
                order_number: String(item.order_number),
                woo_line_item_id: item.woo_line_item_id || null,
                product_id: Number(item.product_id) || 0,
                qty_ordered: Number(item.qty_ordered) || 1,
                our_cost_per_unit: Number(item.our_cost_per_unit) || 0,
                customer_paid_per_unit: Number(item.customer_paid_per_unit) || 0,
              })).filter(item => item.product_id > 0 && item.qty_ordered > 0)

              if (validatedLineItems.length > 0) {
                // Debug: log first item structure
                if (process.env.NODE_ENV === 'development') {
                  console.log(`📝 Upserting ${validatedLineItems.length} line items for order ${order.order_number}`)
                  console.log(`   First item:`, JSON.stringify(validatedLineItems[0], null, 2))
                }

                // Map to include WooCommerce fields if available
                const lineItemsWithWooFields = validatedLineItems.map((item, idx) => {
                  const wooItem = lineItems[idx]
                  const wooOrderItem = wooOrder.line_items?.[idx]
                  return {
                    ...item,
                    // Add WooCommerce fields if available
                    order_id: wooOrder.id || null,
                    id: wooItem.woo_line_item_id || wooOrderItem?.id || null,
                    name: wooOrderItem?.name || null,
                    sku: wooOrderItem?.sku || null,
                    price: wooOrderItem?.price ? String(wooOrderItem.price) : null,
                    subtotal: wooOrderItem?.subtotal ? String(wooOrderItem.subtotal) : null,
                    total: wooOrderItem?.total ? String(wooOrderItem.total) : null,
                    raw_json: wooOrderItem || null,
                  }
                })

                // Try upsert with WooCommerce constraint first, fallback to original constraint
                let lineError = null
                let insertedLines = null
                
                // Check if we have order_id and id (WooCommerce fields)
                const hasWooFields = lineItemsWithWooFields.some(item => item.order_id && item.id)
                
                if (hasWooFields) {
                  // Use WooCommerce unique constraint
                  const result = await this.supabase
                    .from('order_lines')
                    .upsert(lineItemsWithWooFields, {
                      onConflict: 'order_id,id',
                    })
                    .select()
                  lineError = result.error
                  insertedLines = result.data
                } else {
                  // Fallback to original constraint
                  const result = await this.supabase
                    .from('order_lines')
                    .upsert(validatedLineItems, {
                      onConflict: 'order_number,product_id,our_cost_per_unit,customer_paid_per_unit',
                    })
                    .select()
                  lineError = result.error
                  insertedLines = result.data
                }

                if (lineError) {
                  console.error(`❌ Error upserting line items for order ${order.order_number}:`, lineError)
                  console.error('First line item attempted:', JSON.stringify(validatedLineItems[0], null, 2))
                  console.error('Order number used:', order.order_number)
                  console.error('WooCommerce order ID:', wooOrder.id, 'Number:', wooOrder.number)
                  console.error('Total line items attempted:', validatedLineItems.length)
                  errors += validatedLineItems.length
                } else {
                  const insertedCount = insertedLines?.length || 0
                  console.log(`✅ Upserted ${validatedLineItems.length} line items for order ${order.order_number} (${insertedCount} returned from DB)`)
                  if (insertedCount === 0 && validatedLineItems.length > 0) {
                    console.warn(`⚠️  No line items returned from upsert - may indicate conflict resolution or missing data`)
                    // Try to query what's actually in the DB
                    const { data: existingLines } = await this.supabase
                      .from('order_lines')
                      .select('line_id, product_id, qty_ordered')
                      .eq('order_number', order.order_number)
                      .limit(5)
                    console.log(`   Existing lines in DB for this order:`, existingLines?.length || 0)
                  }
                }
              } else {
                console.warn(`⚠️  All ${lineItemsToUpsert.length} line items for order ${order.order_number} were invalid (missing product_id or qty)`)
                console.warn(`   Original lineItems from normalizeOrder:`, lineItems.length)
                console.warn(`   Sample line item:`, JSON.stringify(lineItemsToUpsert[0], null, 2))
              }
            } else {
              console.warn(`⚠️  No line items to upsert for order ${order.order_number}`)
              console.warn(`   WooCommerce order had ${wooOrder.line_items?.length || 0} line_items`)
              console.warn(`   Normalized to ${lineItems.length} line items`)
              if (lineItems.length === 0 && wooOrder.line_items && Array.isArray(wooOrder.line_items) && wooOrder.line_items.length > 0) {
                console.warn(`   Sample WooCommerce line_item:`, JSON.stringify(wooOrder.line_items[0], null, 2))
              }
            }
          }

          synced++
        } catch (error) {
          console.error(`❌ Error processing order ${wooOrder.id}:`, error)
          errors++
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Update sync state
      await this.updateSyncState('orders', synced, errors > 0 ? `${errors} errors` : undefined)

      return { synced, errors }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.updateSyncState('orders', synced, errorMessage)
      throw error
    }
  }

  /**
   * Sync products from WooCommerce
   */
  async syncProducts(mode: 'full' | 'incremental'): Promise<{
    synced: number
    errors: number
  }> {
    let synced = 0
    let errors = 0

    try {
      const after = mode === 'incremental'
        ? await this.getLastSyncTimestamp('products')
        : undefined

      const allProducts = await this.wooClient.fetchAllPages(
        async (page) => {
          const result = await this.wooClient.fetchProducts({
            page,
            perPage: 100,
            after: after || undefined,
          })
          return { products: result.products, totalPages: result.totalPages }
        },
        'products'
      )

      // For full mode, get existing product IDs to skip already synced products
      let existingProductIds = new Set<number>()
      if (mode === 'full') {
        const { data: existingProducts } = await this.supabase
          .from('products')
          .select('woo_product_id')
          .not('woo_product_id', 'is', null)
        
        existingProductIds = new Set(
          (existingProducts || [])
            .map(p => Number(p.woo_product_id))
            .filter(id => !isNaN(id) && id > 0)
        )
        console.log(`📊 Found ${existingProductIds.size} existing products in database`)
      }

      // Filter out products that already exist in full mode
      const productsToSync = mode === 'full'
        ? allProducts.filter(product => !existingProductIds.has(product.id))
        : allProducts

      console.log(`📦 Fetched ${allProducts.length} products from WooCommerce, ${productsToSync.length} to sync (${allProducts.length - productsToSync.length} already exist)`)

      for (const wooProduct of productsToSync) {
        try {
          const product = normalizeProduct(wooProduct)

          // Check if product already exists with different product_id
          const { data: existingProduct } = await this.supabase
            .from('products')
            .select('product_id, our_cost, starting_qty, reorder_level')
            .eq('woo_product_id', product.woo_product_id)
            .single()

          // Preserve our_cost and other fields that WooCommerce doesn't provide
          // Ensure all values are properly serialized
          const productToInsert: any = {
            woo_product_id: Number(product.woo_product_id),
            product_id: existingProduct?.product_id || Number(product.product_id),
            product_name: String(product.product_name),
            variant_strength: product.variant_strength ? String(product.variant_strength) : null,
            sku_code: product.sku_code ? String(product.sku_code) : null,
            retail_price: product.retail_price !== null ? Number(product.retail_price) : null,
            // Preserve existing our_cost if product exists
            our_cost: existingProduct?.our_cost !== null && existingProduct?.our_cost !== undefined 
              ? Number(existingProduct.our_cost) 
              : null,
            // Preserve starting_qty if it was manually set
            starting_qty: existingProduct?.starting_qty !== null && existingProduct?.starting_qty !== undefined
              ? Number(existingProduct.starting_qty)
              : product.starting_qty,
            // Preserve reorder_level
            reorder_level: existingProduct?.reorder_level !== null && existingProduct?.reorder_level !== undefined
              ? Number(existingProduct.reorder_level)
              : null,
            current_stock: product.current_stock !== null ? Number(product.current_stock) : null,
            stock_status: product.stock_status ? String(product.stock_status) : null,
            // Store images as JSON string for JSONB column
            images: product.images ? JSON.stringify(product.images) : null,
          }

          const { error } = await this.supabase
            .from('products')
            .upsert(productToInsert, {
              onConflict: 'woo_product_id',
            })

          if (error) {
            console.error(`Error upserting product ${product.product_id}:`, error)
            errors++
            } else {
              synced++
            }
          } catch (error) {
            console.error(`Error processing product ${wooProduct.id}:`, error)
            errors++
          }
          
          // Small delay to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 50))
        }

      await this.updateSyncState('products', synced, errors > 0 ? `${errors} errors` : undefined)

      return { synced, errors }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.updateSyncState('products', synced, errorMessage)
      throw error
    }
  }

  /**
   * Sync coupons from WooCommerce
   */
  async syncCoupons(mode: 'full' | 'incremental'): Promise<{
    synced: number
    errors: number
  }> {
    let synced = 0
    let errors = 0

    try {
      const after = mode === 'incremental'
        ? await this.getLastSyncTimestamp('coupons')
        : undefined

      const allCoupons = await this.wooClient.fetchAllPages(
        async (page) => {
          const result = await this.wooClient.fetchCoupons({
            page,
            perPage: 100,
            after: after || undefined,
          })
          return { coupons: result.coupons, totalPages: result.totalPages }
        },
        'coupons'
      )

      console.log(`Fetched ${allCoupons.length} coupons from WooCommerce`)

      // Process coupons sequentially
      for (const wooCoupon of allCoupons) {
        try {
          const coupon = normalizeCoupon(wooCoupon)

          // Map WooCommerce discount types to our schema
          const discountType = coupon.discount_type === 'percent'
            ? 'Percent'
            : 'Fixed'

          const couponToInsert = {
            coupon_code: String(coupon.coupon_code),
            discount_type: String(discountType),
            discount_value: Number(coupon.discount_amount) || 0,
            woo_coupon_id: Number(coupon.woo_coupon_id) || 0,
            active: true, // Assume active if in WooCommerce
          }

          const { error } = await this.supabase
            .from('coupons')
            .upsert(couponToInsert, {
              onConflict: 'coupon_code',
            })

          if (error) {
            console.error(`Error upserting coupon ${coupon.coupon_code}:`, error)
            errors++
            } else {
              synced++
            }
          } catch (error) {
            console.error(`Error processing coupon ${wooCoupon.id}:`, error)
            errors++
          }
          
          // Small delay to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 50))
        }

      await this.updateSyncState('coupons', synced, errors > 0 ? `${errors} errors` : undefined)

      return { synced, errors }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.updateSyncState('coupons', synced, errorMessage)
      throw error
    }
  }

  /**
   * Run full sync
   */
  async sync(options: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
    }

    try {
      if (options.syncOrders !== false) {
        result.orders = await this.syncOrders(options.mode)
      }

      if (options.syncProducts !== false) {
        result.products = await this.syncProducts(options.mode)
      }

      if (options.syncCoupons !== false) {
        result.coupons = await this.syncCoupons(options.mode)
      }

      return result
    } catch (error) {
      result.success = false
      result.error = error instanceof Error ? error.message : 'Unknown error'
      return result
    }
  }
}
