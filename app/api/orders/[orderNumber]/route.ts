import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WooCommerceClient } from '@/lib/sync/woocommerce-client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/orders/[orderNumber]
 * Fetches order details from Supabase, or from WooCommerce if not found/stale
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> | { orderNumber: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params
    let orderNumber = resolvedParams.orderNumber

    // Decode order number
    try {
      orderNumber = decodeURIComponent(orderNumber)
    } catch (e) {
      // Use original if decode fails
    }

    const supabase = createAdminClient()

    // Try to find order in Supabase
    const formatsToTry = [
      orderNumber,
      decodeURIComponent(orderNumber),
      orderNumber.replace(/%20/g, ' ').replace(/%23/g, '#'),
      orderNumber.replace(/\+/g, ' '),
    ]
    const uniqueFormats = Array.from(new Set(formatsToTry))

    let order = null
    for (const format of uniqueFormats) {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('order_number', format)
        .maybeSingle()
      
      if (data) {
        order = data
        break
      }
    }

    // If not found, try extracting number and searching
    if (!order) {
      const numberMatch = orderNumber.match(/\d+/)
      if (numberMatch) {
        const { data: orders } = await supabase
          .from('orders')
          .select('*')
          .ilike('order_number', `%${numberMatch[0]}%`)
          .limit(1)
        if (orders && orders.length > 0) {
          order = orders[0]
        }
      }
    }

    // Check if we need to fetch from WooCommerce
    const shouldFetchFromWoo = !order || 
      !order.last_synced_at || 
      (new Date().getTime() - new Date(order.last_synced_at).getTime()) > 5 * 60 * 1000 // 5 minutes

    let wooOrder = null
    if (shouldFetchFromWoo) {
      // Get WooCommerce credentials
      const storeUrl = process.env.WOOCOMMERCE_STORE_URL
      const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY
      const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET

      if (storeUrl && consumerKey && consumerSecret) {
        try {
          const wooClient = new WooCommerceClient({
            storeUrl,
            consumerKey,
            consumerSecret,
          })

          const orderIdMatch = orderNumber.match(/\d+/)
          if (orderIdMatch) {
            const orderId = parseInt(orderIdMatch[0])
            wooOrder = await wooClient.getOrder(orderId)
          }
        } catch (error) {
          console.error('Error fetching from WooCommerce:', error)
          // Continue with Supabase data if WooCommerce fetch fails
        }
      }
    }

    // If we have WooCommerce data, upsert to Supabase
    if (wooOrder) {
      // Upsert order
      const orderData = {
        woo_order_id: wooOrder.id,
        order_number: `Order #${wooOrder.id}`,
        order_date: wooOrder.date_created,
        customer_name: `${wooOrder.billing.first_name} ${wooOrder.billing.last_name}`,
        customer_email: wooOrder.billing.email,
        order_status: wooOrder.status,
        order_subtotal: parseFloat(wooOrder.subtotal || '0'),
        order_total: parseFloat(wooOrder.total || '0'),
        shipping_charged: parseFloat(wooOrder.shipping_total || '0'),
        payment_method: wooOrder.payment_method || '',
        raw_json: wooOrder,
        last_synced_at: new Date().toISOString(),
      }

      const { data: upsertedOrder } = await supabase
        .from('orders')
        .upsert(orderData, {
          onConflict: 'order_number',
          ignoreDuplicates: false,
        })
        .select()
        .single()

      if (upsertedOrder) {
        order = upsertedOrder
      }

      // Upsert line items
      if (wooOrder.line_items && Array.isArray(wooOrder.line_items)) {
        for (const item of wooOrder.line_items) {
          const lineItemData = {
            order_id: wooOrder.id,
            id: item.id,
            order_number: `Order #${wooOrder.id}`,
            product_id: item.product_id || 0,
            variation_id: item.variation_id || null,
            name: item.name || '',
            quantity: parseInt(item.quantity || '1'),
            tax_class: item.tax_class || null,
            subtotal: String(item.subtotal || '0'),
            subtotal_tax: String(item.subtotal_tax || '0'),
            total: String(item.total || '0'),
            total_tax: String(item.total_tax || '0'),
            sku: item.sku || null,
            price: String(item.price || '0'),
            taxes: item.taxes || null,
            meta_data: item.meta_data || null,
            raw_json: item,
            // Map to existing columns
            qty_ordered: parseInt(item.quantity || '1'),
            customer_paid_per_unit: parseFloat(item.price || '0'),
            our_cost_per_unit: 0, // Will be set from products table
          }

          await supabase
            .from('order_lines')
            .upsert(lineItemData, {
              onConflict: 'order_id,id',
              ignoreDuplicates: false,
            })
        }
      }
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Get line items from Supabase
    const { data: lineItems } = await supabase
      .from('order_lines')
      .select('*')
      .eq('order_number', order.order_number)
      .order('id', { ascending: true })

    // Return response in WooCommerce format
    return NextResponse.json({
      id: order.woo_order_id || null,
      number: order.order_number,
      status: order.order_status,
      date_created: order.order_date,
      billing: {
        first_name: order.customer_name?.split(' ')[0] || '',
        last_name: order.customer_name?.split(' ').slice(1).join(' ') || '',
        email: order.customer_email,
      },
      line_items: (lineItems || []).map((line: any) => ({
        id: line.id || line.woo_line_item_id,
        name: line.name || `Product ${line.product_id}`,
        product_id: line.product_id,
        variation_id: line.variation_id,
        quantity: line.quantity || line.qty_ordered,
        subtotal: line.subtotal || String(line.line_total || '0'),
        subtotal_tax: line.subtotal_tax || '0',
        total: line.total || String(line.line_total || '0'),
        total_tax: line.total_tax || '0',
        sku: line.sku || null,
        price: line.price || String(line.customer_paid_per_unit || '0'),
        taxes: line.taxes || [],
        meta_data: line.meta_data || [],
        raw_json: line.raw_json || line,
      })),
      subtotal: String(order.order_subtotal || '0'),
      total: String(order.order_total || '0'),
      shipping_total: String(order.shipping_charged || '0'),
    })
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch order' },
      { status: 500 }
    )
  }
}
