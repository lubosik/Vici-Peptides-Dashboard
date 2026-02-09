import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getExpenses } from '@/lib/queries/expenses'

export const dynamic = 'force-dynamic'

/**
 * GET /api/expenses/export?category=&search=&dateFrom=&dateTo=
 * Returns all expenses matching the current list filters as a CSV download.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const supabase = createAdminClient()

    const filters = {
      category: searchParams.get('category') || undefined,
      search: searchParams.get('search') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    }

    const { expenses } = await getExpenses(
      supabase,
      filters,
      1,
      50000,
      'expense_date',
      'desc'
    )

    const headers = [
      'Date',
      'Category',
      'Description',
      'Vendor',
      'Amount',
      'Source',
      'Order',
      'Notes',
    ]

    const escape = (v: unknown): string => {
      if (v == null) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : `"${s}"`
    }

    const rows = expenses.map((e: any) => [
      e.expense_date || '',
      e.category || '',
      e.description || '',
      e.vendor || '',
      Number(e.amount) ?? '',
      e.source || 'manual',
      e.order_number || '',
      e.notes || '',
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map(escape).join(',')),
    ].join('\r\n')

    const filename = `expenses-${new Date().toISOString().split('T')[0]}.csv`
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting expenses:', error)
    return NextResponse.json(
      { error: 'Failed to export expenses' },
      { status: 500 }
    )
  }
}
