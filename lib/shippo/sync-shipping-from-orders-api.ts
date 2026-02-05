/**
 * Sync shipping costs from Shippo Orders API into expenses
 * Matches Shippo order_number (e.g. "#1068") to our WooCommerce order_number ("Order #1068")
 * and creates/updates a shipping expense for each.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { ShippoClient, ShippoOrdersListResponse } from './client'

/** Normalize Shippo order_number to match our DB format. We use "Order #1068", Shippo uses "#1068". */
export function normalizeShippoOrderNumberForMatch(shippoOrderNumber: string): string {
  const trimmed = (shippoOrderNumber || '').trim()
  if (!trimmed) return trimmed
  if (/^Order\s+#/i.test(trimmed)) return trimmed
  if (trimmed.startsWith('#')) return `Order ${trimmed}`
  return `Order #${trimmed}`
}

export interface SyncFromShippoOrdersResult {
  success: boolean
  processed: number
  created: number
  updated: number
  skipped: number
  errors: number
  details: Array<{
    shippoOrderNumber: string
    ourOrderNumber: string | null
    action: 'created' | 'updated' | 'skipped' | 'error'
    error?: string
  }>
}

/**
 * Sync shipping costs from Shippo Orders API into expenses table.
 * Fetches paginated orders from Shippo, matches each to our orders by order_number,
 * and upserts a shipping expense so it appears in the Expenses tab.
 */
export async function syncShippingCostsFromShippoOrders(
  supabase: SupabaseClient,
  shippoClient: ShippoClient,
  options?: {
    maxPages?: number
    resultsPerPage?: number
  }
): Promise<SyncFromShippoOrdersResult> {
  const maxPages = options?.maxPages ?? 10
  const resultsPerPage = options?.resultsPerPage ?? 100
  const details: SyncFromShippoOrdersResult['details'] = []
  let processed = 0
  let created = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  let nextUrl: string | null = null
  let pageCount = 0

  do {
    const response: ShippoOrdersListResponse = nextUrl
      ? await shippoClient.listOrdersNext(nextUrl)
      : await shippoClient.listOrders({ page: 1, results: resultsPerPage })

    const orders = response.results || []
    nextUrl = response.next || null
    pageCount++

    for (const order of orders) {
      const shippoOrderNumber = (order.order_number || '').trim()
      if (!shippoOrderNumber) {
        skipped++
        details.push({ shippoOrderNumber: '', ourOrderNumber: null, action: 'skipped' })
        continue
      }

      const shippingCost = parseFloat(order.shipping_cost || '0')
      if (!Number.isFinite(shippingCost) || shippingCost <= 0) {
        skipped++
        details.push({ shippoOrderNumber, ourOrderNumber: null, action: 'skipped' })
        continue
      }

      const ourOrderNumber = normalizeShippoOrderNumberForMatch(shippoOrderNumber)

      try {
        const { data: ourOrder, error: orderError } = await supabase
          .from('orders')
          .select('order_number, woo_order_id, order_date')
          .eq('order_number', ourOrderNumber)
          .maybeSingle()

        if (orderError) {
          errors++
          details.push({
            shippoOrderNumber,
            ourOrderNumber: ourOrderNumber,
            action: 'error',
            error: orderError.message,
          })
          continue
        }

        if (!ourOrder) {
          skipped++
          details.push({ shippoOrderNumber, ourOrderNumber, action: 'skipped' })
          continue
        }

        const expenseDate = order.placed_at
          ? new Date(order.placed_at).toISOString().split('T')[0]
          : ourOrder.order_date
            ? new Date(ourOrder.order_date).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0]

        const expenseData = {
          expense_date: expenseDate,
          category: 'shipping',
          description: `Shipping cost for ${ourOrder.order_number} (${order.shipping_method || 'Shippo'})`,
          vendor: 'Shippo',
          amount: shippingCost,
          order_id: ourOrder.woo_order_id ?? null,
          order_number: ourOrder.order_number,
          source: 'shippo',
          external_ref: order.object_id,
          metadata:
            order.shipping_method || order.shipping_cost_currency
              ? {
                  shipping_method: order.shipping_method,
                  shipping_cost_currency: order.shipping_cost_currency,
                  shippo_order_id: order.object_id,
                }
              : null,
        }

        const { data: existingExpense } = await supabase
          .from('expenses')
          .select('expense_id')
          .eq('order_number', ourOrder.order_number)
          .eq('category', 'shipping')
          .maybeSingle()

        // Only sync expenses that are NOT already on the dashboard (insert only, no updates)
        if (existingExpense) {
          skipped++
          details.push({
            shippoOrderNumber,
            ourOrderNumber: ourOrder.order_number,
            action: 'skipped',
          })
        } else {
          const { error: insertErr } = await supabase
            .from('expenses')
            .insert(expenseData)
            .select()
            .single()

          if (insertErr) {
            errors++
            details.push({
              shippoOrderNumber,
              ourOrderNumber: ourOrder.order_number,
              action: 'error',
              error: insertErr.message,
            })
          } else {
            created++
            processed++
            details.push({
              shippoOrderNumber,
              ourOrderNumber: ourOrder.order_number,
              action: 'created',
            })
          }
        }
      } catch (err) {
        errors++
        details.push({
          shippoOrderNumber,
          ourOrderNumber: ourOrderNumber,
          action: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
  } while (nextUrl && pageCount < maxPages)

  return {
    success: errors === 0,
    processed,
    created,
    updated,
    skipped,
    errors,
    details,
  }
}
