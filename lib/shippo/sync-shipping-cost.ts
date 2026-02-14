/**
 * Shipping Cost Sync - Syncs shipping costs from Shippo for WooCommerce orders
 * Server-side only
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { getTodayInMiami } from '@/lib/datetime'
import { createShippoClient, ShippoClient, ShippoError } from './client'
import { buildShippoAddress, buildShippoParcels, fetchWooCommerceProducts } from './parcel-builder'

interface SyncShippingCostParams {
  orderId: number // WooCommerce order ID
  orderNumber: string // Our order number
  supabase: SupabaseClient
  shippoClient: ShippoClient
  wooCommerceConfig?: {
    storeUrl: string
    consumerKey: string
    consumerSecret: string
  }
  forceResync?: boolean // Force re-sync even if shipping cost already exists
}

interface SyncShippingCostResult {
  success: boolean
  shippingCost?: number
  shippingCostCurrency?: string
  shippingCostSource?: string
  shippoShipmentId?: string
  shippoRateId?: string
  shippoTransactionId?: string
  expenseId?: number
  error?: string
}

/**
 * Sync shipping cost for a single order
 * Idempotent: won't create duplicate expenses
 */
export async function syncShippingCostForOrder(
  params: SyncShippingCostParams
): Promise<SyncShippingCostResult> {
  const {
    orderId,
    orderNumber,
    supabase,
    shippoClient,
    wooCommerceConfig,
    forceResync = false,
  } = params

  try {
    // Check if order already has shipping cost (unless force resync)
    if (!forceResync) {
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('shipping_cost, shipping_cost_source, shipping_cost_last_synced_at, woo_order_id')
        .eq('order_number', orderNumber)
        .maybeSingle()

      if (existingOrder?.shipping_cost && existingOrder.shipping_cost_source) {
        // Check if synced recently (within last hour)
        const lastSynced = existingOrder.shipping_cost_last_synced_at
          ? new Date(existingOrder.shipping_cost_last_synced_at)
          : null
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

        if (lastSynced && lastSynced > oneHourAgo) {
          return {
            success: true,
            shippingCost: Number(existingOrder.shipping_cost),
            shippingCostSource: existingOrder.shipping_cost_source,
          }
        }
      }
    }

    // Fetch order from Supabase to get shipping address
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .maybeSingle()

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderNumber}`)
    }

    // Fetch line items
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('order_lines')
      .select('product_id, qty_ordered')
      .eq('order_number', orderNumber)

    if (lineItemsError) {
      throw new Error(`Failed to fetch line items: ${lineItemsError.message}`)
    }

    if (!lineItems || lineItems.length === 0) {
      // Try to fetch from WooCommerce if not in Supabase
      if (wooCommerceConfig && order.woo_order_id) {
        const url = `${wooCommerceConfig.storeUrl.replace(/\/$/, '')}/wp-json/wc/v3/orders/${order.woo_order_id}`
        const basicAuth = Buffer.from(
          `${wooCommerceConfig.consumerKey}:${wooCommerceConfig.consumerSecret}`,
          'utf8'
        ).toString('base64')
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${basicAuth}`,
          },
        })

        if (response.ok) {
          const wooOrder = await response.json()
          // Use WooCommerce order data directly
          return await syncFromWooCommerceOrder({
            wooOrder,
            orderNumber,
            supabase,
            shippoClient,
            wooCommerceConfig,
          })
        }
      }

      throw new Error(`No line items found for order ${orderNumber}`)
    }

    // Build shipping address from order (we need to get this from WooCommerce)
    // For now, we'll need WooCommerce order data to get shipping address
    if (!wooCommerceConfig || !order.woo_order_id) {
      throw new Error('WooCommerce config and order ID required to fetch shipping address')
    }

    // Fetch full order from WooCommerce to get shipping address (Basic Auth)
    const url = `${wooCommerceConfig.storeUrl.replace(/\/$/, '')}/wp-json/wc/v3/orders/${order.woo_order_id}`
    const basicAuth = Buffer.from(
      `${wooCommerceConfig.consumerKey}:${wooCommerceConfig.consumerSecret}`,
      'utf8'
    ).toString('base64')
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch WooCommerce order: ${response.status}`)
    }

    const wooOrder = await response.json()

    return await syncFromWooCommerceOrder({
      wooOrder,
      orderNumber,
      supabase,
      shippoClient,
      wooCommerceConfig,
    })
  } catch (error) {
    console.error(`❌ Error syncing shipping cost for order ${orderNumber}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Sync shipping cost from WooCommerce order data
 */
async function syncFromWooCommerceOrder(params: {
  wooOrder: any
  orderNumber: string
  supabase: SupabaseClient
  shippoClient: ShippoClient
  wooCommerceConfig: {
    storeUrl: string
    consumerKey: string
    consumerSecret: string
  }
}): Promise<SyncShippingCostResult> {
  const { wooOrder, orderNumber, supabase, shippoClient, wooCommerceConfig } = params

  try {
    // Build shipping address
    if (!wooOrder.shipping || !wooOrder.shipping.address_1) {
      throw new Error('Order missing shipping address')
    }

    const addressTo = buildShippoAddress(wooOrder.shipping)
    const addressFrom = shippoClient.getAddressFrom()

    // Fetch products to get weights
    const products = await fetchWooCommerceProducts(
      wooOrder.line_items || [],
      wooCommerceConfig
    )

    // Build parcels
    const { parcels, snapshot } = await buildShippoParcels(
      {
        id: wooOrder.id,
        shipping: wooOrder.shipping,
        line_items: wooOrder.line_items || [],
      },
      products,
      shippoClient.getParcelDefaults()
    )

    // Create shipment in Shippo
    const shipment = await shippoClient.createShipment({
      addressFrom,
      addressTo,
      parcels,
      async: false,
    })

    if (!shipment.rates || shipment.rates.length === 0) {
      throw new Error('No shipping rates available from Shippo')
    }

    // Select cheapest rate
    const selectedRate = shippoClient.selectRate(shipment.rates, 'USD', 'cheapest')
    if (!selectedRate) {
      throw new Error('Failed to select shipping rate')
    }

    const shippingCost = parseFloat(selectedRate.amount)
    const shippingCurrency = selectedRate.currency || 'USD'

    // Update order with Shippo data
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        shippo_shipment_object_id: shipment.object_id,
        shippo_selected_rate_object_id: selectedRate.object_id,
        shipping_cost: shippingCost,
        shipping_cost_currency: shippingCurrency,
        shipping_cost_source: 'shippo_rate_estimate',
        shipping_cost_last_synced_at: new Date().toISOString(),
        shipping_parcel_snapshot: snapshot,
      })
      .eq('order_number', orderNumber)

    if (updateError) {
      throw new Error(`Failed to update order: ${updateError.message}`)
    }

    // Upsert shipping expense (idempotent)
    const expenseDate = wooOrder.date_created 
      ? new Date(wooOrder.date_created).toISOString().split('T')[0]
      : getTodayInMiami()

    const expenseData = {
      expense_date: expenseDate,
      category: 'shipping',
      description: `Shipping cost for ${orderNumber}`,
      vendor: 'Shippo',
      amount: shippingCost,
      order_id: wooOrder.id,
      order_number: orderNumber,
      source: 'shippo',
      external_ref: shipment.object_id,
      metadata: {
        carrier: selectedRate.provider,
        servicelevel: selectedRate.servicelevel?.name,
        rate_id: selectedRate.object_id,
        shipment_id: shipment.object_id,
        estimated_days: selectedRate.estimated_days,
      },
    }

    // Upsert expense (use unique constraint to prevent duplicates)
    // First try to find existing shipping expense for this order
    const { data: existingExpense } = await supabase
      .from('expenses')
      .select('expense_id')
      .eq('order_number', orderNumber)
      .eq('category', 'shipping')
      .maybeSingle()

    let expense
    if (existingExpense) {
      // Update existing expense
      const { data: updatedExpense, error: updateError } = await supabase
        .from('expenses')
        .update(expenseData)
        .eq('expense_id', existingExpense.expense_id)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update expense: ${updateError.message}`)
      }

      expense = updatedExpense
    } else {
      // Insert new expense
      const { data: newExpense, error: insertError } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select()
        .single()

      if (insertError) {
        // Check if it's a unique constraint violation (race condition)
        if (insertError.code === '23505') {
          // Try to fetch the existing one
          const { data: raceExpense } = await supabase
            .from('expenses')
            .select('expense_id')
            .eq('order_number', orderNumber)
            .eq('category', 'shipping')
            .maybeSingle()

          if (raceExpense) {
            expense = raceExpense
          } else {
            throw new Error(`Failed to insert expense: ${insertError.message}`)
          }
        } else {
          throw new Error(`Failed to insert expense: ${insertError.message}`)
        }
      } else {
        expense = newExpense
      }
    }

    return {
      success: true,
      shippingCost,
      shippingCostCurrency: shippingCurrency,
      shippingCostSource: 'shippo_rate_estimate',
      shippoShipmentId: shipment.object_id,
      shippoRateId: selectedRate.object_id,
      expenseId: expense?.expense_id,
    }
  } catch (error) {
    if (error instanceof ShippoError) {
      console.error(`❌ Shippo API error:`, error.responseBody)
    }
    throw error
  }
}
