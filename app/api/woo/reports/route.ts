import { NextRequest, NextResponse } from 'next/server'
import { WooCommerceClient } from '@/lib/sync/woocommerce-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSalesReportFromDb, getTopSellersFromDb, getOrdersTotalsFromDb } from '@/lib/queries/reports'

export const dynamic = 'force-dynamic'

function getWooClient(): WooCommerceClient | null {
  const storeUrl = process.env.WOOCOMMERCE_STORE_URL
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET
  if (!storeUrl || !consumerKey || !consumerSecret) return null
  return new WooCommerceClient({ storeUrl, consumerKey, consumerSecret })
}

function isEmptyOrZeros(data: any, type: string): boolean {
  if (!data) return true
  if (type === 'sales' && Array.isArray(data)) {
    const first = data[0]
    return !first || (Number(first?.total_sales || 0) === 0 && Number(first?.total_orders || 0) === 0)
  }
  if (type === 'top_sellers') return !Array.isArray(data) || data.length === 0
  if (type === 'orders_totals') return !Array.isArray(data) || data.length === 0
  return false
}

/**
 * GET /api/woo/reports
 * Query params:
 * - type: sales | top_sellers | orders_totals | products_totals | customers_totals | coupons_totals | reviews_totals | list
 * - period: week | month | last_month | year (for sales, top_sellers)
 * - date_min, date_max: YYYY-MM-DD (for sales, top_sellers)
 * - useDbFallback: if true, use Supabase fallback when WooCommerce fails or returns empty
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'list'
    const period = searchParams.get('period') || 'month'
    const date_min = searchParams.get('date_min') || undefined
    const date_max = searchParams.get('date_max') || undefined
    const useDbFallback = searchParams.get('useDbFallback') !== 'false'

    const client = getWooClient()
    const supabase = createAdminClient()

    const tryWooOrFallback = async <T>(
      wooFn: () => Promise<T>,
      dbFn: () => Promise<T>,
      isEmpty: (d: T) => boolean
    ): Promise<T> => {
      if (client && useDbFallback !== false) {
        try {
          const wooData = await wooFn()
          if (!isEmpty(wooData)) return wooData
        } catch (e) {
          console.warn('WooCommerce reports failed, using DB fallback:', e)
        }
      }
      return dbFn()
    }

    switch (type) {
      case 'list': {
        if (client) {
          try {
            const reports = await client.getReports()
            return NextResponse.json(reports)
          } catch (e) {
            console.warn('WooCommerce list failed:', e)
          }
        }
        return NextResponse.json([])
      }
      case 'sales': {
        const data = await tryWooOrFallback(
          () => client!.getSalesReport({ period, date_min, date_max }),
          async () => [await getSalesReportFromDb(supabase, period)],
          (d) => isEmptyOrZeros(Array.isArray(d) ? d : [d], 'sales')
        )
        return NextResponse.json(data)
      }
      case 'top_sellers': {
        const data = await tryWooOrFallback(
          () => client!.getTopSellersReport({ period, date_min, date_max }),
          () => getTopSellersFromDb(supabase, period),
          (d) => isEmptyOrZeros(d, 'top_sellers')
        )
        return NextResponse.json(data)
      }
      case 'orders_totals': {
        const data = await tryWooOrFallback(
          () => client!.getOrdersTotalsReport(),
          () => getOrdersTotalsFromDb(supabase),
          (d) => isEmptyOrZeros(d, 'orders_totals')
        )
        return NextResponse.json(data)
      }
      case 'products_totals': {
        if (!client) throw new Error('WooCommerce credentials not configured')
        const data = await client.getProductsTotalsReport()
        return NextResponse.json(data)
      }
      case 'customers_totals': {
        if (!client) throw new Error('WooCommerce credentials not configured')
        const data = await client.getCustomersTotalsReport()
        return NextResponse.json(data)
      }
      case 'coupons_totals': {
        if (!client) throw new Error('WooCommerce credentials not configured')
        const data = await client.getCouponsTotalsReport()
        return NextResponse.json(data)
      }
      case 'reviews_totals': {
        if (!client) throw new Error('WooCommerce credentials not configured')
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
