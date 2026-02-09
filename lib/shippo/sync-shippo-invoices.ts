/**
 * Sync Shippo Invoices API → expenses.
 * No Make.com needed: Shippo Invoices API (beta) provides paid invoice data.
 * Run periodically (cron) or via Settings "Sync Shippo Invoices" button.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { ShippoClient } from './client'

export interface SyncShippoInvoicesResult {
  success: boolean
  created: number
  skipped: number
  errors: number
  details: Array<{ invoice_number: string; status: 'created' | 'skipped' | 'error'; error?: string }>
}

export async function syncShippoInvoicesFromApi(
  supabase: SupabaseClient,
  shippoClient: ShippoClient
): Promise<SyncShippoInvoicesResult> {
  const details: SyncShippoInvoicesResult['details'] = []
  let created = 0
  let skipped = 0
  let errors = 0

  try {
    const { results } = await shippoClient.listInvoices({
      status: 'PAID',
      results: 50,
    })

    if (!results?.length) {
      return { success: true, created: 0, skipped: 0, errors: 0, details: [] }
    }

    for (const inv of results) {
      const invoiceNumber = String(inv.invoice_number || inv.object_id)
      const externalRef = `shippo_invoice_${invoiceNumber}`

      const { data: existing } = await supabase
        .from('expenses')
        .select('expense_id')
        .eq('external_ref', externalRef)
        .single()

      if (existing) {
        skipped++
        details.push({ invoice_number: invoiceNumber, status: 'skipped' })
        continue
      }

      const amount = parseFloat(
        inv.total_charged?.amount ?? inv.total_invoiced?.amount ?? '0'
      )
      const expenseDate = inv.invoice_paid_date
        ? inv.invoice_paid_date.split('T')[0]
        : new Date().toISOString().split('T')[0]

      const { error } = await supabase.from('expenses').insert({
        expense_date: expenseDate,
        category: 'Shipping',
        description: `Shippo Invoice #${invoiceNumber}`,
        vendor: 'Shippo',
        amount,
        source: 'shippo_invoice',
        external_ref: externalRef,
        metadata: JSON.stringify({
          invoice_number: invoiceNumber,
          shippo_object_id: inv.object_id,
        }),
      })

      if (error) {
        errors++
        details.push({
          invoice_number: invoiceNumber,
          status: 'error',
          error: error.message,
        })
      } else {
        created++
        details.push({ invoice_number: invoiceNumber, status: 'created' })
      }
    }
  } catch (err) {
    return {
      success: false,
      created: 0,
      skipped: 0,
      errors: 1,
      details: [
        {
          invoice_number: '',
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to fetch Shippo invoices',
        },
      ],
    }
  }

  return {
    success: errors === 0,
    created,
    skipped,
    errors,
    details,
  }
}
