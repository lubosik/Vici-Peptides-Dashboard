/**
 * Sync shipping costs from Shippo Orders API into expenses
 * Matches Shippo order_number (e.g. "#1068") to our WooCommerce order_number ("Order #1068")
 * and creates/updates a shipping expense for each.
 *
 * Uses ONLY the Retrieve a shipping label API (GET /transactions/{id}) → rate.amount.
 * That is the ACTUAL cost the client pays to Shippo per label (not what the buyer pays).
 * order.shipping_cost is the storefront rate (what buyer pays) - we never use it.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { getTodayInMiami } from '@/lib/datetime'
import { ShippoClient, ShippoOrdersListResponse } from './client'

/** Normalize Shippo order_number to match our DB format. We use "Order #1068", Shippo uses "#1068". */
export function normalizeShippoOrderNumberForMatch(shippoOrderNumber: string): string {
  const trimmed = (shippoOrderNumber || '').trim()
  if (!trimmed) return trimmed
  if (/^Order\s+#/i.test(trimmed)) return trimmed
  if (trimmed.startsWith('#')) return `Order ${trimmed}`
  return `Order #${trimmed}`
}

/** Extract numeric part for matching: "1068" from "#1068" or "Order #1068" */
function normalizeOrderNumberForMatch(num: string): string {
  return num.replace(/^[#\s]*(?:Order\s*#?\s*)?/i, '').trim()
}

/**
 * Get actual label cost from Shippo (what the client pays per label).
 * Uses Retrieve a shipping label API: GET /transactions/{id} → rate.amount.
 * Sums rate.amount for all transactions on the order.
 * Never uses order.shipping_cost (that's what the buyer pays).
 */
async function getActualShippingCost(
  order: any,
  shippoClient: ShippoClient
): Promise<number> {
  const transactions = order.transactions
  if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
    return 0
  }

  let totalCost = 0
  for (const txnRef of transactions) {
    const txnId = typeof txnRef === 'string' ? txnRef : txnRef?.object_id || txnRef
    if (!txnId) continue
    try {
      const txn = await shippoClient.getTransaction(txnId)
      if (txn.rate) {
        if (typeof txn.rate === 'object' && txn.rate.amount) {
          totalCost += parseFloat(txn.rate.amount)
        } else if (typeof txn.rate === 'string') {
          const rate = await shippoClient.getRate(txn.rate)
          totalCost += parseFloat(rate.amount || '0')
        }
      }
    } catch (err) {
      console.error(`Failed to fetch Shippo transaction ${txnId}:`, err)
    }
  }
  return totalCost
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

      const ourOrderNumber = normalizeShippoOrderNumberForMatch(shippoOrderNumber)
      const shippoNumNormalized = normalizeOrderNumberForMatch(shippoOrderNumber)

      try {
        let { data: ourOrder, error: orderError } = await supabase
          .from('orders')
          .select('order_number, woo_order_id, order_date')
          .eq('order_number', ourOrderNumber)
          .maybeSingle()

        if (!ourOrder && shippoNumNormalized) {
          const { data: byNumber } = await supabase
            .from('orders')
            .select('order_number, woo_order_id, order_date')
            .ilike('order_number', `%${shippoNumNormalized}%`)
            .limit(1)
            .maybeSingle()
          ourOrder = byNumber
        }

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

        const actualCost = await getActualShippingCost(order, shippoClient)
        if (!Number.isFinite(actualCost) || actualCost <= 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log(
              `Shippo order ${order.order_number}: shipping_cost=${order.shipping_cost}, transactions=${JSON.stringify(order.transactions)}, actualCost=${actualCost}`
            )
          }
          skipped++
          details.push({ shippoOrderNumber, ourOrderNumber: ourOrder.order_number, action: 'skipped' })
          continue
        }

        const expenseDate = order.placed_at
          ? new Date(order.placed_at).toISOString().split('T')[0]
          : ourOrder.order_date
            ? new Date(ourOrder.order_date).toISOString().split('T')[0]
            : getTodayInMiami()

        const expenseData = {
          expense_date: expenseDate,
          category: 'Shipping',
          description: `Shipping cost for ${ourOrder.order_number} (${order.shipping_method || 'Shippo'})`,
          vendor: 'Shippo',
          amount: actualCost,
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
          .eq('source', 'shippo')
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

export interface ResyncShippoExpensesResult {
  success: boolean
  updated: number
  errors: number
  details: Array<{ expense_id: number; order_number: string; old_amount: number; new_amount: number; status: 'updated' | 'error'; error?: string }>
}

/**
 * Re-sync existing Shippo expenses: fetch actual label cost from Transactions API (rate.amount) and update amount.
 * @param force - when true, update every expense with API value regardless of current amount
 */
export async function resyncShippoExpenseAmounts(
  supabase: SupabaseClient,
  shippoClient: ShippoClient,
  options?: { force?: boolean }
): Promise<ResyncShippoExpensesResult> {
  const force = options?.force ?? false
  const details: ResyncShippoExpensesResult['details'] = []
  let updated = 0
  let errors = 0

  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('expense_id, order_number, amount, external_ref')
    .eq('source', 'shippo')

  if (error || !expenses?.length) {
    return { success: !error, updated: 0, errors: error ? 1 : 0, details: [] }
  }

  for (const exp of expenses) {
    const shippoOrderId = exp.external_ref
    if (!shippoOrderId) {
      details.push({
        expense_id: exp.expense_id,
        order_number: exp.order_number || '',
        old_amount: Number(exp.amount) || 0,
        new_amount: 0,
        status: 'error',
        error: 'No external_ref (Shippo order ID)',
      })
      errors++
      continue
    }

    try {
      const order = await shippoClient.getOrder(shippoOrderId)
      const actualCost = await getActualShippingCost(order, shippoClient)
      const oldAmount = Number(exp.amount) || 0

      const shouldUpdate =
        force
          ? Number.isFinite(actualCost) && actualCost > 0
          : Number.isFinite(actualCost) && actualCost > 0 && Math.abs(actualCost - oldAmount) > 0.001

      if (shouldUpdate) {
        const { error: updateErr } = await supabase
          .from('expenses')
          .update({ amount: actualCost })
          .eq('expense_id', exp.expense_id)

        if (updateErr) {
          details.push({
            expense_id: exp.expense_id,
            order_number: exp.order_number || '',
            old_amount: oldAmount,
            new_amount: actualCost,
            status: 'error',
            error: updateErr.message,
          })
          errors++
        } else {
          updated++
          details.push({
            expense_id: exp.expense_id,
            order_number: exp.order_number || '',
            old_amount: oldAmount,
            new_amount: actualCost,
            status: 'updated',
          })
        }
      }
    } catch (err) {
      details.push({
        expense_id: exp.expense_id,
        order_number: exp.order_number || '',
        old_amount: Number(exp.amount) || 0,
        new_amount: 0,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      errors++
    }
  }

  return { success: errors === 0, updated, errors, details }
}
