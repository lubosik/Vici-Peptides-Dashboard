import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createExpense, updateExpense, deleteExpense } from '@/lib/queries/expenses'

// GET - List expenses (for compatibility)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const supabase = await createClient()

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
    const supabase = await createClient()
    const body = await request.json()

    const expense = await createExpense(supabase, {
      expense_date: body.expense_date,
      category: body.category,
      description: body.description,
      amount: Number(body.amount),
      vendor: body.vendor || null,
      notes: body.notes || null,
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('Error creating expense:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create expense' },
      { status: 500 }
    )
  }
}

// PUT - Update expense
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
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
    const supabase = await createClient()
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
