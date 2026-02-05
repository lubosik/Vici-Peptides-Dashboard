import { NextRequest, NextResponse } from 'next/server'
import { WooCommerceClient } from '@/lib/sync/woocommerce-client'

export const dynamic = 'force-dynamic'

function getWooClient(): WooCommerceClient {
  const storeUrl = process.env.WOOCOMMERCE_STORE_URL
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET
  if (!storeUrl || !consumerKey || !consumerSecret) {
    throw new Error('WooCommerce credentials not configured')
  }
  return new WooCommerceClient({ storeUrl, consumerKey, consumerSecret })
}

/**
 * GET /api/woo/reports
 * Query params:
 * - type: sales | top_sellers | orders_totals | products_totals | customers_totals | coupons_totals | reviews_totals | list
 * - period: week | month | last_month | year (for sales, top_sellers)
 * - date_min, date_max: YYYY-MM-DD (for sales, top_sellers)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'list'
    const period = searchParams.get('period') || undefined
    const date_min = searchParams.get('date_min') || undefined
    const date_max = searchParams.get('date_max') || undefined

    const client = getWooClient()

    switch (type) {
      case 'list': {
        const reports = await client.getReports()
        return NextResponse.json(reports)
      }
      case 'sales': {
        const data = await client.getSalesReport({ period, date_min, date_max })
        return NextResponse.json(data)
      }
      case 'top_sellers': {
        const data = await client.getTopSellersReport({ period, date_min, date_max })
        return NextResponse.json(data)
      }
      case 'orders_totals': {
        const data = await client.getOrdersTotalsReport()
        return NextResponse.json(data)
      }
      case 'products_totals': {
        const data = await client.getProductsTotalsReport()
        return NextResponse.json(data)
      }
      case 'customers_totals': {
        const data = await client.getCustomersTotalsReport()
        return NextResponse.json(data)
      }
      case 'coupons_totals': {
        const data = await client.getCouponsTotalsReport()
        return NextResponse.json(data)
      }
      case 'reviews_totals': {
        const data = await client.getReviewsTotalsReport()
        return NextResponse.json(data)
      }
      default:
        return NextResponse.json(
          { error: `Unknown report type: ${type}. Use: list, sales, top_sellers, orders_totals, products_totals, customers_totals, coupons_totals, reviews_totals` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('WooCommerce reports API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}
