import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createShippoClient } from '@/lib/shippo/client'
import { syncShippingCostsFromShippoOrders } from '@/lib/shippo/sync-shipping-from-orders-api'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/sync-shipping-from-shippo
 * Sync shipping costs from Shippo Orders API into expenses.
 * Matches Shippo order_number (e.g. "#1068") to WooCommerce order_number ("Order #1068")
 * and creates/updates shipping expenses so they appear in the Expenses tab.
 *
 * Query params:
 * - maxPages: max pagination pages to fetch (default 10)
 * - resultsPerPage: results per page (default 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const maxPages = parseInt(searchParams.get('maxPages') || '10', 10)
    const resultsPerPage = parseInt(searchParams.get('resultsPerPage') || '100', 10)

    const supabase = createAdminClient()
    const shippoClient = createShippoClient()

    const result = await syncShippingCostsFromShippoOrders(supabase, shippoClient, {
      maxPages,
      resultsPerPage,
    })

    return NextResponse.json({
      success: result.success,
      processed: result.processed,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
      details: result.details.slice(0, 50),
    })
  } catch (error) {
    console.error('Error syncing shipping from Shippo Orders API:', error)
    return NextResponse.json(
      {
        error: 'Failed to sync shipping from Shippo',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
