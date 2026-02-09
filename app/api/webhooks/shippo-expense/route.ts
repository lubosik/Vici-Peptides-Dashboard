import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Webhook receiver for Make.com automation.
 * Triggered when Shippo invoice confirmation email is parsed.
 * Expects: x-api-key header and JSON body with invoice_number, amount, date, description, transaction_count
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-api-key')
  const webhookKey = process.env.WEBHOOK_API_KEY

  if (!webhookKey || authHeader !== webhookKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      invoice_number,
      amount,
      date,
      description,
      order_number,
      transaction_count,
    } = body

    if (!invoice_number || amount == null) {
      return NextResponse.json(
        { error: 'invoice_number and amount are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const externalRef = `shippo_invoice_${invoice_number}`

    const { data: existing } = await supabase
      .from('expenses')
      .select('expense_id')
      .eq('external_ref', externalRef)
      .single()

    if (existing) {
      return NextResponse.json({
        status: 'duplicate',
        expense_id: existing.expense_id,
      })
    }

    const expenseDate = date ? (typeof date === 'string' ? date.split('T')[0] : null) : null

    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({
        expense_date: expenseDate || new Date().toISOString().split('T')[0],
        category: 'Shipping',
        description:
          description ||
          `Shippo Invoice #${invoice_number} - ${transaction_count ?? 0} transaction(s)`,
        vendor: 'Shippo',
        amount: parseFloat(String(amount)),
        source: 'shippo_email',
        external_ref: externalRef,
        order_number: order_number || null,
        metadata: JSON.stringify({
          invoice_number,
          transaction_count: transaction_count ?? null,
        }),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      status: 'created',
      expense_id: expense.expense_id,
    })
  } catch (e) {
    console.error('Shippo webhook error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
