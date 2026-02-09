import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
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
      const { data: expense, error } = await supabase
        .from('expenses')
        .insert({
          expense_date: line.expense_date,
          category: line.category,
          description: line.description,
          vendor: line.vendor,
          amount: line.amount,
          source: 'import',
          external_ref: `import_${importId}_line_${line.id}`,
        })
        .select()
        .single()

      if (!error && expense) {
        await supabase
          .from('expense_import_lines')
          .update({ approved: true, expense_id: expense.expense_id })
          .eq('id', line.id)
        results.push({ lineId: line.id, expenseId: expense.expense_id, status: 'approved' })
      } else {
        results.push({ lineId: line.id, status: 'error', error: error?.message })
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
