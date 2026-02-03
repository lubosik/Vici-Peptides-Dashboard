import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createExpense, updateExpense, deleteExpense } from '@/lib/queries/expenses'

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
    const body = await request.json()

    // Validate required fields; treat empty category as "Uncategorized"
    if (!body.expense_date || !body.description || body.amount == null) {
      return NextResponse.json(
        { error: 'Missing required fields: expense_date, description, amount' },
        { status: 400 }
      )
    }
    const category = (body.category && String(body.category).trim()) || 'Uncategorized'

    // Validate amount
    const amount = Number(body.amount)
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    const expense = await createExpense(supabase, {
      expense_date: body.expense_date,
      category,
      description: body.description,
      amount: amount,
      vendor: body.vendor || null,
      notes: body.notes || null,
    })

    revalidatePath('/expenses')
    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('Error creating expense:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create expense'
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      },
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

    await deleteExpense(supabase, parseInt(expense_id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting expense:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete expense' },
      { status: 500 }
    )
  }
}
