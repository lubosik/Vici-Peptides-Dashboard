import { Sidebar } from '@/components/sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getProducts, getStockSummary } from '@/lib/queries/products'
import { formatCurrency, formatPercent } from '@/lib/metrics/calculations'
import Link from 'next/link'
import { Search, Package, AlertTriangle, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { AddProductDialog } from '@/components/products/add-product-dialog'
import { DeleteProductButton } from '@/components/products/delete-product-button'
import { StockStatusToggle } from '@/components/products/stock-status-toggle'
import { ProductStockQtyInputs } from '@/components/products/product-stock-qty-inputs'
import { EditableRetailPrice, EditableSalePrice } from '@/components/products/editable-product-price'
import { SyncProductsButton } from '@/components/products/sync-products-button'

// Force dynamic rendering to prevent build-time errors when env vars aren't available
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

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const supabase = await createClient()
  
  const page = parseInt(searchParams.page || '1')
  const filters = {
    search: searchParams.search,
    stockStatus: searchParams.stockStatus,
  }
  const sortBy = searchParams.sortBy || 'qty_sold'
  const sortOrder = (searchParams.sortOrder as 'asc' | 'desc') || 'desc'

  let productsData: any = {
    products: [],
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 0,
  }
  let stockSummary: any = {
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    total: 0,
  }
  let hasError = false
  let errorMessage = ''

  try {
    [productsData, stockSummary] = await Promise.all([
      getProducts(supabase, filters, page, 50, sortBy, sortOrder),
      getStockSummary(supabase),
    ])
  } catch (error) {
    console.error('Error fetching products:', error)
    hasError = true
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
    // Provide fallback values
    productsData = {
      products: [],
      total: 0,
      page: 1,
      pageSize: 50,
      totalPages: 0,
    }
    stockSummary = {
      inStock: 0,
      lowStock: 0,
      outOfStock: 0,
      total: 0,
    }
  }

  const getStockStatusIcon = (status: string) => {
    switch (status) {
      case 'In Stock':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'LOW STOCK':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'OUT OF STOCK':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'In Stock':
        return 'bg-green-100 text-green-800'
      case 'LOW STOCK':
        return 'bg-yellow-100 text-yellow-800'
      case 'OUT OF STOCK':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto lg:ml-0">
        <div className="container mx-auto p-3 sm:p-4 lg:p-6 xl:p-8">
          <div className="mb-6 sm:mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Products</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-2">
                Product inventory and sales (all-time). Values are saved when you leave each field (tab or click away).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SyncProductsButton />
              <AddProductDialog />
            </div>
            {hasError && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Error loading products: {errorMessage}
                </p>
              </div>
            )}
          </div>

          {/* Stock Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stockSummary.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  In catalog
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">In Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stockSummary.inStock}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Available
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stockSummary.lowStock}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Needs reorder
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stockSummary.outOfStock}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Unavailable
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter products by name, SKU, or stock status</CardDescription>
            </CardHeader>
            <CardContent>
              <form method="get" className="grid gap-4 md:grid-cols-3">
                {/* Preserve sort params when filtering */}
                {searchParams.sortBy && (
                  <input type="hidden" name="sortBy" value={searchParams.sortBy} />
                )}
                {searchParams.sortOrder && (
                  <input type="hidden" name="sortOrder" value={searchParams.sortOrder} />
                )}
                <div>
                  <label className="text-sm font-medium mb-2 block">Search</label>
                  <Input
                    name="search"
                    placeholder="Product name, SKU, strength..."
                    defaultValue={searchParams.search}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Stock Status</label>
                  <Select name="stockStatus" defaultValue={searchParams.stockStatus}>
                    <option value="">All Statuses</option>
                    <option value="In Stock">In Stock</option>
                    <option value="LOW STOCK">Low Stock</option>
                    <option value="OUT OF STOCK">Out of Stock</option>
                  </Select>
                </div>
                <div className="md:col-span-3 flex gap-2">
                  <Button type="submit">Apply Filters</Button>
                  <Button type="button" variant="outline" asChild>
                    <Link href="/products">Clear</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                Products ({productsData.total})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productsData.products.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No products found. {productsData.total === 0 ? 'Import products to get started.' : 'Try adjusting your filters.'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Link href={`/products?${new URLSearchParams({ ...searchParams, sortBy: 'product_name', sortOrder: sortBy === 'product_name' && sortOrder === 'asc' ? 'desc' : 'asc' }).toString()}`}>
                          Product
                        </Link>
                      </TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Stock Status</TableHead>
                      <TableHead className="text-right">Current stock / Qty sold</TableHead>
                      <TableHead className="text-right">Retail Price</TableHead>
                      <TableHead className="text-right">Sale Price</TableHead>
                      <TableHead className="text-right">Our Cost</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productsData.products.map((product: any) => (
                      <TableRow key={product.product_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{product.product_name}</div>
                            {product.variant_strength && (
                              <div className="text-sm text-muted-foreground">
                                {product.variant_strength}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {product.sku_code || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const displayStatus = product.stock_status_override ?? product.stock_status
                              return (
                                <>
                                  {getStockStatusIcon(displayStatus)}
                                  <span className={`px-2 py-1 rounded text-xs ${getStockStatusColor(displayStatus)}`}>
                                    {displayStatus || '—'}
                                  </span>
                                  <StockStatusToggle
                                    productId={product.product_id}
                                    currentStatus={displayStatus || 'OUT OF STOCK'}
                                  />
                                </>
                              )
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <ProductStockQtyInputs
                            key={`stock-${product.product_id}`}
                            productId={product.product_id}
                            startingQty={product.starting_qty ?? 0}
                            qtySold={product.qty_sold ?? 0}
                          />
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            Stock = on hand now. Qty sold = total sold (can be higher).
                          </span>
                          {product.reorder_level != null && (product.current_stock ?? 0) <= product.reorder_level && (
                            <span className="text-xs text-yellow-600 block mt-0.5">reorder: {product.reorder_level}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <EditableRetailPrice
                            key={`retail-${product.product_id}`}
                            productId={product.product_id}
                            value={product.retail_price != null ? product.retail_price : null}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <EditableSalePrice
                            key={`sale-${product.product_id}`}
                            productId={product.product_id}
                            value={product.sale_price != null && product.sale_price > 0 ? product.sale_price : null}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {product.our_cost != null ? formatCurrency(product.our_cost) : '$0.00'}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.margin_percent != null ? formatPercent(product.margin_percent) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DeleteProductButton
                            productId={product.product_id}
                            productName={product.product_name}
                            wooProductId={product.woo_product_id}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination Controls */}
              {productsData.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {((page - 1) * productsData.pageSize) + 1} to {Math.min(page * productsData.pageSize, productsData.total)} of {productsData.total} products
                  </div>
                  <div className="flex items-center gap-2">
                    {page > 1 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link
                          href={`/products?${new URLSearchParams({
                            ...searchParams,
                            page: String(page - 1),
                          }).toString()}`}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                    )}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, productsData.totalPages) }, (_, i) => {
                        let pageNum: number
                        if (productsData.totalPages <= 5) {
                          pageNum = i + 1
                        } else if (page <= 3) {
                          pageNum = i + 1
                        } else if (page >= productsData.totalPages - 2) {
                          pageNum = productsData.totalPages - 4 + i
                        } else {
                          pageNum = page - 2 + i
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={page === pageNum ? "default" : "outline"}
                            size="sm"
                            asChild
                          >
                            <Link
                              href={`/products?${new URLSearchParams({
                                ...searchParams,
                                page: String(pageNum),
                              }).toString()}`}
                            >
                              {pageNum}
                            </Link>
                          </Button>
                        )
                      })}
                    </div>
                    {page < productsData.totalPages ? (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link
                          href={`/products?${new URLSearchParams({
                            ...searchParams,
                            page: String(page + 1),
                          }).toString()}`}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
