import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getTodayInMiami } from '@/lib/datetime'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  try {
    const { importId } = await params
    const body = await request.json().catch(() => ({}))
    const lineIds = body.lineIds ?? body.line_ids

    const supabase = createAdminClient()

    let query = supabase
      .from('expense_import_lines')
      .select('*')
      .eq('import_id', importId)
      .eq('rejected', false)
      .eq('approved', false)
      .not('category', 'is', null)

    if (lineIds && lineIds !== 'all') {
      query = query.in('id', Array.isArray(lineIds) ? lineIds : [lineIds])
    }

    const { data: lines } = await query

    if (!lines?.length) {
      return NextResponse.json(
        { error: 'No approvable lines found (must have category)' },
        { status: 400 }
      )
    }

    const results: Array<{ lineId: number; expenseId?: number; status: string; error?: string }> = []

    for (const line of lines) {
      const expenseDate = line.expense_date || getTodayInMiami()
      const amount = typeof line.amount === 'string' ? parseFloat(line.amount) : Number(line.amount)
      if (isNaN(amount) || amount <= 0) {
        results.push({ lineId: line.id, status: 'error', error: 'Invalid amount' })
        continue
      }

      const expensePayload = {
        expense_date: expenseDate,
        category: line.category,
        description: line.description || 'Imported expense',
        vendor: line.vendor || 'Unknown',
        amount: Number(line.amount) || amount,
        source: 'import',
        external_ref: `import_${importId}_line_${line.id}`,
      }

      console.log('=== APPROVAL DEBUG ===')
      console.log('Line to approve:', JSON.stringify(line, null, 2))
      console.log('Expense payload:', JSON.stringify(expensePayload, null, 2))
      console.log('Amount type:', typeof expensePayload.amount, 'Value:', expensePayload.amount)
      console.log('Date value:', expensePayload.expense_date, 'Type:', typeof expensePayload.expense_date)

      const { data: expense, error } = await supabase
        .from('expenses')
        .insert(expensePayload)
        .select()
        .single()

      if (error) {
        console.error('=== EXPENSE INSERT FAILED ===')
        console.error('Error code:', error.code)
        console.error('Error message:', error.message)
        console.error('Error details:', error.details)
        console.error('Error hint:', error.hint)
        return NextResponse.json(
          {
            error: 'Failed to create expense',
            details: error.message,
            code: error.code,
          },
          { status: 500 }
        )
      }

      console.log('=== EXPENSE CREATED ===', expense)

      const { error: updateErr } = await supabase
        .from('expense_import_lines')
        .update({ approved: true, expense_id: expense.expense_id })
        .eq('id', line.id)

      if (updateErr) {
        console.error(`Failed to mark line ${line.id} approved:`, updateErr)
        results.push({ lineId: line.id, status: 'error', error: updateErr.message })
      } else {
        results.push({ lineId: line.id, expenseId: expense.expense_id, status: 'approved' })
      }
    }

    const { data: stats } = await supabase
      .from('expense_import_lines')
      .select('approved, rejected')
      .eq('import_id', importId)

    const approvedCount = stats?.filter((s) => s.approved).length || 0
    const total = stats?.length || 0
    const status = approvedCount === total ? 'approved' : approvedCount > 0 ? 'partial' : 'pending'

    await supabase
      .from('expense_imports')
      .update({ approved_lines: approvedCount, status })
      .eq('id', importId)

    revalidatePath('/expenses')
    revalidatePath('/expenses/import')
    revalidatePath('/')
    revalidatePath('/analytics')

    return NextResponse.json({
      approved: results.filter((r) => r.status === 'approved').length,
      results,
    })
  } catch (error) {
    console.error('Error approving import:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve' },
      { status: 500 }
    )
  }
}
