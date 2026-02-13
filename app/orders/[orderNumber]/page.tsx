import { Sidebar } from '@/components/sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrderWithLines } from '@/lib/queries/orders'
import { formatCurrency, formatPercent } from '@/lib/metrics/calculations'
import Link from 'next/link'
import { ArrowLeft, Package, DollarSign, TrendingUp } from 'lucide-react'
import { DeleteOrderButton } from '@/components/orders/delete-order-button'
import { FetchShippoCostButton } from '@/components/orders/fetch-shippo-cost-button'
import { notFound } from 'next/navigation'

interface OrderDetailPageProps {
  params: Promise<{ orderNumber: string }> | { orderNumber: string }
}

/**
 * Allow dynamic route generation for any order number
 * This ensures ALL orders get pages automatically, even new ones
 */
export const dynamicParams = true
export const dynamic = 'force-dynamic' // Always generate on-demand

/**
 * Generate static params for existing orders (optional - for better performance)
 * Since we're using force-dynamic, this won't be used for static generation,
 * but we keep it to return empty array to avoid build errors
 */
export async function generateStaticParams() {
  // With force-dynamic, pages are generated on-demand at runtime
  // Return empty array to avoid any build-time errors
  return []
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const supabase = createAdminClient()
  
  // Decode the order number from URL
  // Handle both sync and async params (Next.js 14+)
  const resolvedParams = params instanceof Promise ? await params : params
  let orderNumber = resolvedParams.orderNumber
  
  try {
    orderNumber = decodeURIComponent(resolvedParams.orderNumber)
  } catch (e) {
    // If decoding fails, use original
    orderNumber = resolvedParams.orderNumber
  }
  
  console.log(`🔍 Loading order detail page for: ${orderNumber} (original: ${resolvedParams.orderNumber})`)

  try {
    const { order, lineItems } = await getOrderWithLines(supabase, orderNumber)
    // Data comes from Make.com webhook → Supabase. No auto-sync from WooCommerce on page load.

    if (!order) {
      console.error(`Order not found: ${orderNumber}`)
      notFound()
    }

    const profitMargin = order.net_margin ?? (order.order_total > 0 ? (order.order_profit / order.order_total) * 100 : 0)

    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto lg:ml-0">
          <div className="container mx-auto p-3 sm:p-4 lg:p-6 xl:p-8">
            {/* Header */}
            <div className="mb-6">
              <Button variant="ghost" asChild className="mb-4">
                <Link href="/orders">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Orders
                </Link>
              </Button>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                    {order.order_number}
                  </h1>
                  <p className="text-muted-foreground mt-2">
                    {order.order_date 
                      ? new Date(order.order_date).toLocaleString()
                      : 'No date'}
                  </p>
                </div>
                <form action={async (formData) => {
                  'use server'
                  const { createAdminClient } = await import('@/lib/supabase/admin')
                  const supabase = createAdminClient()
                  const newStatus = formData.get('status') as string
                  if (!newStatus) return
                  
                  const { updateOrderStatus } = await import('@/lib/queries/orders')
                  await updateOrderStatus(supabase, order.order_number, newStatus)
                  
                  // Revalidate so Orders list and Dashboard update in real time
                  const { revalidatePath } = await import('next/cache')
                  revalidatePath(`/orders/${orderNumber}`)
                  revalidatePath('/orders')
                  revalidatePath('/')
                }}>
                  <Select name="status" defaultValue={order.order_status} className="w-48">
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="refunded">Refunded</option>
                  </Select>
                  <Button type="submit" className="ml-2">Update Status</Button>
                </form>
                <FetchShippoCostButton orderNumber={orderNumber} />
                <DeleteOrderButton
                  orderNumber={order.order_number}
                  wooOrderId={order.woo_order_id ?? undefined}
                  label={order.order_number}
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Order Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-medium">{order.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{order.customer_email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      order.order_status === 'completed' ? 'bg-green-100 text-green-800' :
                      order.order_status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      order.order_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {order.order_status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Method:</span>
                    <span className="font-medium">{order.payment_method}</span>
                  </div>
                  {order.coupon_code && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Coupon:</span>
                      <span className="font-medium">{order.coupon_code}</span>
                    </div>
                  )}
                  {order.notes && (
                    <div>
                      <span className="text-muted-foreground">Notes:</span>
                      <p className="mt-1 text-sm">{order.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Financial Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(Number(order.order_subtotal) || 0)}</span>
                  </div>
                  {(Number(order.shipping_charged) || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping:</span>
                      <span className="font-medium">{formatCurrency(Number(order.shipping_charged) || 0)}</span>
                    </div>
                  )}
                  {(Number(order.coupon_discount) || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount:</span>
                      <span className="font-medium text-red-600">
                        -{formatCurrency(Number(order.coupon_discount) || 0)}
                      </span>
                    </div>
                  )}
                  <div className="border-t pt-4 flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(Number(order.order_total) || 0)}</span>
                  </div>
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost:</span>
                      <span className="font-medium">{formatCurrency(Number(order.order_cost) || 0)}</span>
                    </div>
                    {(Number(order.shipping_cost) ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shipping cost:</span>
                        <span className="font-medium">{formatCurrency(Number(order.shipping_cost) || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Profit{(Number(order.shipping_cost) ?? 0) > 0 ? ' (after shipping)' : ''}:</span>
                      <span className={`font-medium ${(order.net_profit ?? order.order_profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Number(order.net_profit ?? order.order_profit) || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Margin:</span>
                      <span className="font-medium">{formatPercent(profitMargin)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Line Items */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Line Items ({lineItems.length})</CardTitle>
                <CardDescription>Products in this order</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No line items found for this order. The order may not have been fully synced from WooCommerce.
                        </TableCell>
                      </TableRow>
                    ) : (
                      lineItems.map((line: any) => {
                        const lineMargin = line.line_total > 0 
                          ? (line.line_profit / line.line_total) * 100 
                          : 0
                        return (
                          <TableRow key={line.line_id}>
                            <TableCell className="font-medium">
                              {line.name || line.product?.product_name || `Product ${line.product_id}`}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {line.sku || line.product?.sku_code || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {line.qty_ordered}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(line.customer_paid_per_unit)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {line.our_cost_per_unit > 0 
                                ? formatCurrency(line.our_cost_per_unit * line.qty_ordered)
                                : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(line.line_total)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(line.line_profit)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPercent(lineMargin)}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  } catch (error) {
    console.error('❌ Error fetching order:', error)
    console.error('   Order number attempted:', orderNumber)
    console.error('   Original param:', resolvedParams.orderNumber)
    console.error('   Error details:', error instanceof Error ? error.message : String(error))
    
    // Don't immediately call notFound - try to provide helpful error
    // Only call notFound if it's truly a "not found" error
    if (error instanceof Error && error.message.includes('not found')) {
      notFound()
    } else {
      // For other errors, still show 404 but log the issue
      console.error('   Showing 404 due to error')
      notFound()
    }
  }
}
