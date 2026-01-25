/**
 * WooCommerce Sync API Route
 * POST /api/sync/woocommerce
 * 
 * Syncs WooCommerce data into Supabase
 * Server-side only - never exposes credentials to browser
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WooCommerceSync } from '@/lib/sync/woocommerce-sync'

export async function POST(request: NextRequest) {
  try {
    // Get mode from query params or body (default to incremental to avoid re-syncing existing data)
    const searchParams = request.nextUrl.searchParams
    const body = await request.json().catch(() => ({}))
    const mode = searchParams.get('mode') || body.mode || 'incremental'
    const syncOrders = searchParams.get('orders') !== 'false' && body.orders !== false
    const syncProducts = searchParams.get('products') !== 'false' && body.products !== false
    const syncCoupons = searchParams.get('coupons') !== 'false' && body.coupons !== false

    // Validate mode
    if (mode !== 'full' && mode !== 'incremental') {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "full" or "incremental"' },
        { status: 400 }
      )
    }

    // Get WooCommerce credentials from environment (server-side only)
    const storeUrl = process.env.WOOCOMMERCE_STORE_URL
    const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY
    const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET

    if (!storeUrl || !consumerKey || !consumerSecret) {
      return NextResponse.json(
        {
          error: 'Missing WooCommerce credentials',
          details: 'Please set WOOCOMMERCE_STORE_URL, WOOCOMMERCE_CONSUMER_KEY, and WOOCOMMERCE_CONSUMER_SECRET in environment variables',
        },
        { status: 500 }
      )
    }

    // Get Supabase admin client
    const supabase = createAdminClient()

    // Create sync instance
    const sync = new WooCommerceSync(
      {
        storeUrl,
        consumerKey,
        consumerSecret,
      },
      supabase
    )

    // Run sync
    const result = await sync.sync({
      mode: mode as 'full' | 'incremental',
      syncOrders,
      syncProducts,
      syncCoupons,
    })

    return NextResponse.json({
      success: result.success,
      mode,
      results: {
        orders: result.orders,
        products: result.products,
        coupons: result.coupons,
      },
      error: result.error,
    })
  } catch (error) {
    console.error('WooCommerce sync error:', error)
    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Also support GET for simple triggering
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
    const mode = searchParams.get('mode') || 'incremental'

  // Convert GET to POST internally
  const body = {
    mode,
    orders: searchParams.get('orders') !== 'false',
    products: searchParams.get('products') !== 'false',
    coupons: searchParams.get('coupons') !== 'false',
  }

  return POST(
    new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(body),
    })
  )
}
