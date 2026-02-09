import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createShippoClient } from '@/lib/shippo/client'
import { syncShippoInvoicesFromApi } from '@/lib/shippo/sync-shippo-invoices'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/sync-shippo-invoices
 * Sync PAID invoices from Shippo Invoices API → expenses.
 * No Make.com needed - uses Shippo's native API.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const shippoClient = createShippoClient()

    const result = await syncShippoInvoicesFromApi(supabase, shippoClient)

    revalidatePath('/expenses')
    revalidatePath('/')
    revalidatePath('/analytics')

    return NextResponse.json({
      success: result.success,
      created: result.created,
      skipped: result.skipped,
      errors: result.errors,
      message:
        result.created > 0
          ? `Created ${result.created} expense(s) from Shippo invoices.`
          : result.skipped > 0
            ? `All ${result.skipped} invoice(s) already synced.`
            : result.errors > 0
              ? `Errors: ${result.errors}`
              : 'No paid invoices found.',
    })
  } catch (error) {
    console.error('Error syncing Shippo invoices:', error)
    return NextResponse.json(
      {
        error: 'Failed to sync Shippo invoices',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
