import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, active } = body
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('expense_categorization_rules')
      .update({ active: !!active })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('expense_categorization_rules')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data: rules, error } = await supabase
      .from('expense_categorization_rules')
      .select('*')
      .order('priority', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ rules: rules || [] })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pattern, pattern_type = 'contains', category } = body

    if (!pattern?.trim() || !category) {
      return NextResponse.json({ error: 'pattern and category are required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: maxPrior } = await supabase
      .from('expense_categorization_rules')
      .select('priority')
      .order('priority', { ascending: false })
      .limit(1)
      .single()

    const priority = (maxPrior?.priority ?? 0) + 1

    const { data: rule, error } = await supabase
      .from('expense_categorization_rules')
      .insert({
        pattern: pattern.trim(),
        pattern_type: pattern_type,
        category,
        priority,
        active: true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(rule)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  }
}
