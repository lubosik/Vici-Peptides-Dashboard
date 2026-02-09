import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const DATE_COLUMNS = ['date', 'transaction date', 'trans date', 'posting date', 'posted date']
const DESC_COLUMNS = ['description', 'memo', 'details', 'transaction', 'merchant name', 'name']
const AMOUNT_COLUMNS = ['amount', 'debit', 'charge', 'transaction amount']
const VENDOR_COLUMNS = ['vendor', 'merchant', 'payee', 'merchant name']

function findColumn(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim())
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate)
    if (idx !== -1) return idx
  }
  for (const candidate of candidates) {
    const idx = lower.findIndex((h) => h.includes(candidate))
    if (idx !== -1) return idx
  }
  return -1
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let inQuotes = false
  let row: string[] = []

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim())
      current = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (current || row.length > 0) {
        row.push(current.trim())
        rows.push(row)
        row = []
        current = ''
      }
      if (char === '\r' && text[i + 1] === '\n') i++
    } else {
      current += char
    }
  }
  if (current || row.length > 0) {
    row.push(current.trim())
    rows.push(row)
  }
  return rows
}

async function applyCategorization(
  description: string,
  vendor: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<{ category: string | null; auto: boolean }> {
  const { data: rules } = await supabase
    .from('expense_categorization_rules')
    .select('*')
    .eq('active', true)
    .order('priority', { ascending: false })

  if (!rules?.length) return { category: null, auto: false }

  const searchText = `${description} ${vendor}`.toUpperCase()

  for (const rule of rules) {
    let matches = false
    switch (rule.pattern_type) {
      case 'contains':
        matches = searchText.includes(rule.pattern.toUpperCase())
        break
      case 'exact':
        matches = searchText === rule.pattern.toUpperCase()
        break
      case 'regex':
        try {
          matches = new RegExp(rule.pattern, 'i').test(searchText)
        } catch {
          matches = false
        }
        break
    }
    if (matches) return { category: rule.category, auto: true }
  }

  return { category: null, auto: false }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length < 2)
      return NextResponse.json({ error: 'CSV has no data rows' }, { status: 400 })

    const headers = rows[0]
    const dateCol = findColumn(headers, DATE_COLUMNS)
    const descCol = findColumn(headers, DESC_COLUMNS)
    const amountCol = findColumn(headers, AMOUNT_COLUMNS)
    const vendorCol = findColumn(headers, VENDOR_COLUMNS)

    if (dateCol === -1 || amountCol === -1) {
      return NextResponse.json(
        {
          error: 'Could not identify required columns (date, amount)',
          headers,
          hint: 'CSV must have columns for date and amount. Common names: Date, Transaction Date, Amount, Debit',
        },
        { status: 400 }
      )
    }

    const { data: importBatch, error: batchError } = await supabase
      .from('expense_imports')
      .insert({ source_file: file.name, total_lines: rows.length - 1 })
      .select()
      .single()

    if (batchError) return NextResponse.json({ error: batchError.message }, { status: 500 })

    const lineItems: any[] = []
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (row.length < 2) continue

      const rawAmount = row[amountCol]?.replace(/[^0-9.\-]/g, '')
      const amount = parseFloat(rawAmount)
      if (isNaN(amount) || amount === 0) continue

      const description = descCol !== -1 ? row[descCol] || '' : ''
      const vendor = vendorCol !== -1 ? row[vendorCol] || '' : ''
      const dateStr = row[dateCol]

      let expenseDate: string | null = null
      if (dateStr) {
        const d = new Date(dateStr)
        if (!isNaN(d.getTime())) expenseDate = d.toISOString().split('T')[0]
      }

      const { category, auto } = await applyCategorization(description, vendor, supabase)

      lineItems.push({
        import_id: importBatch.id,
        expense_date: expenseDate,
        description: description.substring(0, 500),
        vendor: (vendor || description.split(/\s+/).slice(0, 3).join(' ')).substring(0, 200),
        amount: Math.abs(amount),
        category,
        auto_categorized: auto,
      })
    }

    if (lineItems.length === 0) {
      return NextResponse.json({ error: 'No valid line items found in CSV' }, { status: 400 })
    }

    const { error: insertError } = await supabase.from('expense_import_lines').insert(lineItems)

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    await supabase
      .from('expense_imports')
      .update({ total_lines: lineItems.length })
      .eq('id', importBatch.id)

    revalidatePath('/expenses')
    revalidatePath('/expenses/import')

    return NextResponse.json({
      import_id: importBatch.id,
      total_lines: lineItems.length,
      auto_categorized: lineItems.filter((l) => l.auto_categorized).length,
      uncategorized: lineItems.filter((l) => !l.category).length,
    })
  } catch (error) {
    console.error('Expense import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import' },
      { status: 500 }
    )
  }
}
