import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateExpense } from '@/lib/queries/expenses'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET - List expenses (for compatibility)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const supabase = createAdminClient()

    const category = searchParams.get('category')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    let query = supabase.from('expenses').select('*')

    if (category) {
      query = query.eq('category', category)
    }
    if (dateFrom) {
      query = query.gte('expense_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('expense_date', dateTo)
    }

    const { data, error } = await query.order('expense_date', { ascending: false })

    if (error) throw error

    return NextResponse.json({ expenses: data })
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    )
  }
}

// POST - Create expense
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a JSON object' },
        { status: 400 }
      )
    }

    // Validate required fields; treat empty category as "Uncategorized"
    if (!body.expense_date || !body.description || body.amount == null) {
      return NextResponse.json(
        { error: 'Missing required fields: expense_date, description, amount' },
        { status: 400 }
      )
    }
    const category = (body.category && String(body.category).trim()) || 'Uncategorized'

    // Validate amount - MUST be number for NUMERIC column
    const amount = Number(body.amount) ?? parseFloat(String(body.amount)) ?? 0
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    const insertPayload = {
      expense_date: String(body.expense_date).trim(),
      category,
      description: String(body.description).trim(),
      amount,
      vendor: body.vendor != null ? String(body.vendor).trim() || null : null,
      notes: body.notes != null ? String(body.notes).trim() || null : null,
      source: 'manual',
    }

    const { data: expense, error } = await supabase
      .from('expenses')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      console.error('INSERT EXPENSE FAILED:', error.message, error.details, error.hint)
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: 500 }
      )
    }

    revalidatePath('/expenses')
    revalidatePath('/')
    revalidatePath('/analytics')
    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('Error creating expense:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create expense'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// PUT - Update expense
export async function PUT(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()
    const { expense_id, ...updates } = body

    if (!expense_id) {
      return NextResponse.json({ error: 'expense_id is required' }, { status: 400 })
    }

    const expense = await updateExpense(supabase, expense_id, updates)
    return NextResponse.json(expense)
  } catch (error) {
    console.error('Error updating expense:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update expense' },
      { status: 500 }
    )
  }
}

// DELETE - Delete expense
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const expense_id = searchParams.get('expense_id') || searchParams.get('id')

    if (!expense_id) {
      return NextResponse.json({ error: 'expense_id is required' }, { status: 400 })
    }

    const id = parseInt(expense_id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid expense_id' }, { status: 400 })
    }

    // Unlink any import lines that reference this expense so the delete can succeed
    await supabase
      .from('expense_import_lines')
      .update({ expense_id: null })
      .eq('expense_id', id)

    const { error } = await supabase.from('expenses').delete().eq('expense_id', id)

    if (error) {
      console.error('Delete expense failed:', error.code, error.message, error.details)
      const message =
        error.code === '23503'
          ? 'Cannot delete: this expense is linked elsewhere.'
          : error.message || 'Failed to delete expense'
      return NextResponse.json({ error: message, code: error.code }, { status: 500 })
    }

    revalidatePath('/expenses')
    revalidatePath('/')
    revalidatePath('/analytics')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting expense:', error)
    const message = error instanceof Error ? error.message : 'Failed to delete expense'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
