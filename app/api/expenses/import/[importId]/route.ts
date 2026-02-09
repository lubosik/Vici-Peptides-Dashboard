import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  try {
    const { importId } = await params
    const supabase = createAdminClient()

    const { data: lines } = await supabase
      .from('expense_import_lines')
      .select('*')
      .eq('import_id', importId)
      .order('expense_date', { ascending: true })

    const { data: batch } = await supabase
      .from('expense_imports')
      .select('*')
      .eq('id', importId)
      .single()

    return NextResponse.json({ batch, lines: lines || [] })
  } catch (error) {
    console.error('Error fetching import:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  try {
    const { importId } = await params
    const body = await request.json()
    const { lineId, category, rejected } = body

    if (!lineId) return NextResponse.json({ error: 'lineId required' }, { status: 400 })

    const supabase = createAdminClient()

    const updates: Record<string, unknown> = {}
    if (category !== undefined) updates.category = category
    if (rejected !== undefined) updates.rejected = rejected

    const { error } = await supabase
      .from('expense_import_lines')
      .update(updates)
      .eq('id', lineId)
      .eq('import_id', importId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating line:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update' },
      { status: 500 }
    )
  }
}
