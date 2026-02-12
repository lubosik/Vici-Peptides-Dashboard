import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['In Stock', 'OUT OF STOCK']

const SELECT_FIELDS = 'product_id, product_name, sku_code, variant_strength, stock_status, stock_status_override, starting_qty, current_stock, qty_sold, retail_price, sale_price, our_cost'

function parsePrice(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return Math.max(0, Number(Number(value).toFixed(2)))
  if (typeof value === 'string') return Math.max(0, parseFloat(value) || 0)
  return null
}

/** Allow either API key (Make.com) or dashboard session cookie. */
async function authenticate(request: NextRequest): Promise<boolean> {
  const key = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('api_key')
  if (process.env.WEBHOOK_API_KEY && key === process.env.WEBHOOK_API_KEY) return true
  const cookieStore = await cookies()
  if (cookieStore.get('auth_session')?.value) return true
  return false
}

/**
 * PATCH /api/products/[productId]/stock
 * Auth: same as orders webhook – send x-api-key header (or api_key query) with your WEBHOOK_API_KEY.
 * Body (all optional; at least one required):
 *   - stockStatus: "In Stock" | "OUT OF STOCK"
 *   - starting_qty: number  (inventory on hand; current_stock = starting_qty - qty_sold)
 *   - qty_sold: number  (override quantity sold; current_stock recalculated)
 *   - retail_price: number  (regular price)
 *   - sale_price: number | null  (when set, used for revenue/margin/profit; null = N/A, use retail)
 * Response always includes product_id, product_name, sku_code so you can confirm the right product was updated.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  try {
    if (!(await authenticate(request))) {
      return NextResponse.json(
        { error: 'Unauthorized. Send x-api-key header with your WEBHOOK_API_KEY (same as orders webhook), or log in to the dashboard.' },
        { status: 401 }
      )
    }

    const { productId } = await context.params
    const id = parseInt(productId, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const stockStatus = typeof body.stockStatus === 'string' ? body.stockStatus.trim() : null
    const startingQty = typeof body.starting_qty === 'number' && !Number.isNaN(body.starting_qty)
      ? Math.max(0, Math.floor(body.starting_qty))
      : null
    const qtySold =
      typeof body.qty_sold === 'number' && !Number.isNaN(body.qty_sold)
        ? Math.max(0, Math.floor(body.qty_sold))
        : null
    const retailPrice = parsePrice(body.retail_price)
    const hasSalePrice = 'sale_price' in body
    const salePrice = !hasSalePrice
      ? undefined
      : body.sale_price === null || body.sale_price === undefined
        ? null
        : (parsePrice(body.sale_price) ?? 0)
    if (!stockStatus && startingQty === null && qtySold === null && retailPrice === null && !hasSalePrice) {
      return NextResponse.json(
        {
          error:
            'Provide at least one of: stockStatus, starting_qty, qty_sold, retail_price, sale_price',
        },
        { status: 400 }
      )
    }

    if (stockStatus && !VALID_STATUSES.includes(stockStatus)) {
      return NextResponse.json(
        { error: 'stockStatus must be "In Stock" or "OUT OF STOCK"' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data: existing, error: fetchError } = await supabase
      .from('products')
      .select(SELECT_FIELDS)
      .eq('product_id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        {
          error: 'Product not found',
          product_id: id,
          message: `No product with product_id ${id}. Check the ID and try again.`,
        },
        { status: 404 }
      )
    }

    const updates: Record<string, unknown> = {}
    if (stockStatus) updates.stock_status_override = stockStatus
    if (retailPrice !== null) updates.retail_price = retailPrice
    if (hasSalePrice) updates.sale_price = salePrice === null ? null : salePrice

    const startQty = startingQty !== null ? startingQty : (Number(existing.starting_qty) ?? 0)
    const soldQty = qtySold !== null ? qtySold : (Number(existing.qty_sold) ?? 0)
    if (startingQty !== null) updates.starting_qty = startingQty
    if (qtySold !== null) updates.qty_sold = qtySold
    if (startingQty !== null || qtySold !== null) {
      updates.current_stock = Math.max(0, startQty - soldQty)
    }

    const { data: updated, error } = await supabase
      .from('products')
      .update(updates)
      .eq('product_id', id)
      .select(SELECT_FIELDS)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath('/')
    revalidatePath('/products')

    return NextResponse.json({
      success: true,
      message: `Updated product: ${updated.product_name}${updated.sku_code ? ` (SKU: ${updated.sku_code})` : ''}`,
      product_id: updated.product_id,
      product_name: updated.product_name,
      sku_code: updated.sku_code ?? null,
      variant_strength: updated.variant_strength ?? null,
      stock_status_override: updated.stock_status_override,
      display_status: updated.stock_status_override ?? updated.stock_status,
      starting_qty: updated.starting_qty,
      current_stock: updated.current_stock,
      qty_sold: updated.qty_sold,
      retail_price: updated.retail_price != null ? Number(updated.retail_price) : null,
      sale_price: updated.sale_price != null ? Number(updated.sale_price) : null,
      our_cost: updated.our_cost != null ? Number(updated.our_cost) : null,
    })
  } catch (e) {
    console.error('PATCH /api/products/[productId]/stock:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update stock' },
      { status: 500 }
    )
  }
}
