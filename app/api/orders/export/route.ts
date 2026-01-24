import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrders } from '@/lib/queries/orders'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const supabase = await createClient()

    // Get all orders (no pagination for export)
    const filters = {
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    }

    const { orders } = await getOrders(supabase, filters, 1, 10000) // Large limit for export

    // Convert to CSV
    const headers = [
      'Order Number',
      'Date',
      'Customer Name',
      'Customer Email',
      'Status',
      'Total',
      'Profit',
      'Margin %',
      'Payment Method',
      'Items Count',
    ]

    const rows = orders.map((order: any) => [
      order.order_number,
      new Date(order.order_date).toISOString().split('T')[0],
      order.customer_name,
      order.customer_email,
      order.order_status,
      order.order_total.toFixed(2),
      order.order_profit.toFixed(2),
      order.profit_margin.toFixed(2),
      order.payment_method,
      order.line_items_count,
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(',')),
    ].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error exporting orders:', error)
    return NextResponse.json(
      { error: 'Failed to export orders' },
      { status: 500 }
    )
  }
}
