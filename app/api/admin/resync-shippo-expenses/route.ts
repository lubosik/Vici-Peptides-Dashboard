import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createShippoClient } from '@/lib/shippo/client'
import { resyncShippoExpenseAmounts } from '@/lib/shippo/sync-shipping-from-orders-api'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/resync-shippo-expenses
 * Re-fetch actual label costs from Shippo Transactions API (rate.amount per label) and update existing Shippo expenses.
 * Query: ?force=true to update all 121 even when amount already matches (verification pass).
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    const supabase = createAdminClient()
    const shippoClient = createShippoClient()

    const result = await resyncShippoExpenseAmounts(supabase, shippoClient, { force })

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
