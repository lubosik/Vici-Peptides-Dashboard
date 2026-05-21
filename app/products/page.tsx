import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getProducts, getStockSummary } from '@/lib/queries/products'
import { formatCurrency, formatPercent } from '@/lib/metrics/calculations'
import Link from 'next/link'
import { AlertTriangle, CheckCircle, XCircle, Package, ChevronLeft, ChevronRight } from 'lucide-react'
import { DeleteProductButton } from '@/components/products/delete-product-button'
import { StockStatusToggle } from '@/components/products/stock-status-toggle'
import { EditableRetailPrice, EditableSalePrice, EditableCost } from '@/components/products/editable-product-price'
import { SyncProductsButton } from '@/components/products/sync-products-button'
import { RecalculateCostsButton } from '@/components/products/recalculate-costs-button'
import { CleanupProductsButton } from '@/components/products/cleanup-products-button'

export const dynamic = 'force-dynamic'

interface ProductsPageProps {
  searchParams: {
    page?: string
    search?: string
    stockStatus?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }
}

const STOCK_CFG: Record<string, { dot: string; bg: string; text: string; icon: typeof CheckCircle }> = {
  'In Stock':     { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40',  text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle },
  'LOW STOCK':    { dot: 'bg-amber-500',   bg: 'bg-amber-50 dark:bg-amber-950/40',      text: 'text-amber-700 dark:text-amber-400',     icon: AlertTriangle },
  'OUT OF STOCK': { dot: 'bg-red-500',     bg: 'bg-red-50 dark:bg-red-950/40',          text: 'text-red-700 dark:text-red-400',         icon: XCircle },
  'On Backorder': { dot: 'bg-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/40',        text: 'text-blue-700 dark:text-blue-400',       icon: Package },
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const supabase = await createClient()

  const page = parseInt(searchParams.page || '1')
  const filters = {
    search: searchParams.search,
    stockStatus: searchParams.stockStatus,
  }
  const sortBy = searchParams.sortBy || 'qty_sold'
  const sortOrder = (searchParams.sortOrder as 'asc' | 'desc') || 'desc'

  let productsData: any = { products: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }
  let stockSummary: any = { inStock: 0, lowStock: 0, outOfStock: 0, total: 0 }
  let hasError = false
  let errorMessage = ''

  try {
    ;[productsData, stockSummary] = await Promise.all([
      getProducts(supabase, filters, page, 50, sortBy, sortOrder),
      getStockSummary(supabase),
    ])
  } catch (error) {
    console.error('Error fetching products:', error)
    hasError = true
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
  }

  const sortLink = (col: string) => {
    const newOrder = sortBy === col && sortOrder === 'asc' ? 'desc' : 'asc'
    return `/products?${new URLSearchParams({ ...searchParams, sortBy: col, sortOrder: newOrder }).toString()}`
  }

  const sortArrow = (col: string) =>
    sortBy === col ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-3 sm:p-4 lg:p-6 xl:p-8">

            {/* Page header */}
            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 sm:pt-0">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Products</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {productsData.total > 0 ? `${productsData.total} products` : 'Synced from WooCommerce'} · stock and prices update automatically
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SyncProductsButton />
                <RecalculateCostsButton />
                <CleanupProductsButton />
              </div>
            </div>

            {hasError && (
              <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Error loading products: {errorMessage}
                </p>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-6">
              {[
                { label: 'Total Products', value: stockSummary.total, color: '' },
                { label: 'In Stock', value: stockSummary.inStock, color: 'text-emerald-600' },
                { label: 'Low Stock', value: stockSummary.lowStock, color: 'text-amber-600' },
                { label: 'Out of Stock', value: stockSummary.outOfStock, color: 'text-red-600' },
              ].map(({ label, value, color }) => (
                <Card key={label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filters */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <form method="get" className="grid gap-4 sm:grid-cols-3">
                  {searchParams.sortBy && <input type="hidden" name="sortBy" value={searchParams.sortBy} />}
                  {searchParams.sortOrder && <input type="hidden" name="sortOrder" value={searchParams.sortOrder} />}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Search</label>
                    <Input name="search" placeholder="Name, SKU…" defaultValue={searchParams.search} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Stock Status</label>
                    <Select name="stockStatus" defaultValue={searchParams.stockStatus}>
                      <option value="">All Statuses</option>
                      <option value="In Stock">In Stock</option>
                      <option value="LOW STOCK">Low Stock</option>
                      <option value="OUT OF STOCK">Out of Stock</option>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button type="submit" size="sm">Apply</Button>
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link href="/products">Clear</Link>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Products table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Products <span className="text-muted-foreground font-normal">({productsData.total})</span>
                </CardTitle>
                <CardDescription>Live from WooCommerce · edit cost to calculate profit margins</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {productsData.products.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground px-6">
                    {productsData.total === 0
                      ? 'No products yet. Click "Sync products" to pull from WooCommerce.'
                      : 'No products match your filters.'}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-b border-border/50">
                            <TableHead className="text-xs">
                              <Link href={sortLink('product_name')}>Product{sortArrow('product_name')}</Link>
                            </TableHead>
                            <TableHead className="text-xs">SKU</TableHead>
                            <TableHead className="text-xs">Stock Status</TableHead>
                            <TableHead className="text-xs text-right">
                              <Link href={sortLink('current_stock')}>Stock{sortArrow('current_stock')}</Link>
                            </TableHead>
                            <TableHead className="text-xs text-right">
                              <Link href={sortLink('qty_sold')}>Qty Sold{sortArrow('qty_sold')}</Link>
                            </TableHead>
                            <TableHead className="text-xs text-right">Retail Price</TableHead>
                            <TableHead className="text-xs text-right">Sale Price</TableHead>
                            <TableHead className="text-xs text-right">Our Cost</TableHead>
                            <TableHead className="text-xs text-right">Margin</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productsData.products.map((product: any) => {
                            const displayStatus = product.stock_status_override ?? product.stock_status
                            const cfg = STOCK_CFG[displayStatus]
                            return (
                              <TableRow key={product.product_id} className="hover:bg-muted/30 transition-colors">
                                <TableCell>
                                  <div className="font-medium text-sm">{product.product_name}</div>
                                  {product.variant_strength && (
                                    <div className="text-xs text-muted-foreground">{product.variant_strength}</div>
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {product.sku_code || '—'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg ? `${cfg.bg} ${cfg.text}` : 'bg-slate-100 text-slate-600'}`}>
                                      {cfg && <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />}
                                      {displayStatus || '—'}
                                    </span>
                                    <StockStatusToggle
                                      productId={product.product_id}
                                      currentStatus={displayStatus || 'OUT OF STOCK'}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium">
                                  {product.current_stock != null ? product.current_stock : '—'}
                                </TableCell>
                                <TableCell className="text-right text-sm text-muted-foreground">
                                  {product.qty_sold ?? 0}
                                </TableCell>
                                <TableCell className="text-right">
                                  <EditableRetailPrice value={product.retail_price} />
                                </TableCell>
                                <TableCell className="text-right">
                                  <EditableSalePrice value={product.sale_price != null && product.sale_price > 0 ? product.sale_price : null} />
                                </TableCell>
                                <TableCell className="text-right">
                                  <EditableCost value={product.our_cost} />
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {product.margin_percent != null
                                    ? <span className={product.margin_percent >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>{formatPercent(product.margin_percent)}</span>
                                    : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell>
                                  <DeleteProductButton
                                    productId={product.product_id}
                                    productName={product.product_name}
                                    wooProductId={product.woo_product_id}
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {productsData.totalPages > 1 && (
                      <div className="flex items-center justify-between px-6 py-4 border-t border-border/50">
                        <div className="text-sm text-muted-foreground">
                          Page {page} of {productsData.totalPages} · {productsData.total} products
                        </div>
                        <div className="flex items-center gap-2">
                          {page > 1 ? (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/products?${new URLSearchParams({ ...searchParams, page: String(page - 1) })}`}>
                                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                              </Link>
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled>
                              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                            </Button>
                          )}
                          {page < productsData.totalPages ? (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/products?${new URLSearchParams({ ...searchParams, page: String(page + 1) })}`}>
                                Next <ChevronRight className="h-4 w-4 ml-1" />
                              </Link>
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled>
                              Next <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
