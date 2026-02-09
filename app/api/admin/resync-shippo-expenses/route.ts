import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createShippoClient } from '@/lib/shippo/client'
import { resyncShippoExpenseAmounts } from '@/lib/shippo/sync-shipping-from-orders-api'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/resync-shippo-expenses
 * Re-fetch actual shipping costs from Shippo Transactions API and update existing Shippo expenses.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const shippoClient = createShippoClient()

    const result = await resyncShippoExpenseAmounts(supabase, shippoClient)

    revalidatePath('/expenses')
    revalidatePath('/')
    revalidatePath('/analytics')

    return NextResponse.json({
      success: result.success,
      updated: result.updated,
      errors: result.errors,
      details: result.details.slice(0, 100),
    })
  } catch (error) {
    console.error('Error re-syncing Shippo expenses:', error)
    return NextResponse.json(
      {
        error: 'Failed to re-sync Shippo expenses',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
