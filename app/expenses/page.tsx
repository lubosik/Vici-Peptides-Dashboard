import { Sidebar } from '@/components/sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { createAdminClient } from '@/lib/supabase/admin'
import { getExpenses, getExpenseCategories, getExpenseSummary, getExpenseGrandTotal, getThisMonthExpenseTotal } from '@/lib/queries/expenses'
import { getExpenseCategoriesFromLists } from '@/lib/utils/expense-categories'
import { formatCurrency } from '@/lib/metrics/calculations'
import Link from 'next/link'
import { Plus, Search, Download, ChevronLeft, ChevronRight, Upload } from 'lucide-react'
import { ExpensesChart } from '@/components/charts/expenses-chart'
import { AddExpenseDialog } from '@/components/expenses/add-expense-dialog'
import { DeleteExpenseButton } from '@/components/expenses/delete-expense-button'

// Force dynamic rendering to prevent build-time errors when env vars aren't available
export const dynamic = 'force-dynamic'

interface ExpensesPageProps {
  searchParams: {
    page?: string
    category?: string
    search?: string
    dateFrom?: string
    dateTo?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  let supabase
  try {
    supabase = createAdminClient()
  } catch (e) {
    console.error('Supabase init error:', e)
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="font-medium text-destructive">Unable to connect to database</p>
            <p className="text-sm text-muted-foreground mt-1">
              {e instanceof Error ? e.message : 'Missing Supabase configuration. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel/env.'}
            </p>
          </div>
        </main>
      </div>
    )
  }

  const page = parseInt(searchParams.page || '1')
  const filters = {
    category: searchParams.category,
    search: searchParams.search,
    dateFrom: searchParams.dateFrom,
    dateTo: searchParams.dateTo,
  }
  const sortBy = searchParams.sortBy || 'expense_date'
  const sortOrder = searchParams.sortOrder || 'desc'

  let expensesData: any = {
    expenses: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  }
  let categories: string[] = []
  let expenseSummary: any = {
    total: 0,
    thisMonth: 0,
    average: 0,
    expensesByCategory: [],
  }
  let hasError = false
  let errorMessage = ''
  let grandTotal: { total: number; count: number } = { total: 0, count: 0 }
  let thisMonthTotal = 0

  try {
    const [expensesResult, categoriesFromDb, expenseSummary, grandTotalRes, thisMonthRes] = await Promise.all([
      getExpenses(supabase, filters, page, 20, sortBy, sortOrder),
      getExpenseCategories(supabase),
      getExpenseSummary(supabase, filters.dateFrom, filters.dateTo, filters),
      getExpenseGrandTotal(supabase),
      getThisMonthExpenseTotal(supabase),
    ])
    expensesData = expensesResult
    const defaultCategories = getExpenseCategoriesFromLists()
    const withShipping = defaultCategories.includes('Shipping') ? defaultCategories : ['Shipping', ...defaultCategories]
    categories = categoriesFromDb.length > 0 ? categoriesFromDb : withShipping
    grandTotal = grandTotalRes
    thisMonthTotal = typeof thisMonthRes === 'number' ? thisMonthRes : 0
  } catch (error) {
    console.error('Error fetching expenses:', error)
    hasError = true
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
    // Provide fallback values; keep default categories so Add Expense still works
    expensesData = {
      expenses: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    }
    categories = ['Shipping', ...getExpenseCategoriesFromLists()]
    expenseSummary = {
      total: 0,
      thisMonth: 0,
      average: 0,
      expensesByCategory: [],
    }
  }

  // Total from grand total; This Month from dedicated current-month query
  const totalExpensesAllPages = grandTotal.total
  const totalCount = grandTotal.count
  const averageExpense = totalCount > 0 ? totalExpensesAllPages / totalCount : 0

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto lg:ml-0">
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Expenses</h1>
                <p className="text-muted-foreground mt-2">
                  Track and manage business expenses
                </p>
                {hasError && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      ⚠️ Error loading expenses: {errorMessage}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" asChild>
                  <Link href="/expenses/import">
                    <Upload className="mr-2 h-4 w-4" />
                    Import Statement
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link
                    href={`/api/expenses/export?${new URLSearchParams({
                      ...(searchParams.category && { category: searchParams.category }),
                      ...(searchParams.dateFrom && { dateFrom: searchParams.dateFrom }),
                      ...(searchParams.dateTo && { dateTo: searchParams.dateTo }),
                      ...(searchParams.search && { search: searchParams.search }),
                    }).toString()}`}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Link>
                </Button>
                <AddExpenseDialog categories={categories} />
              </div>
            </div>
          </div>

          {/* Summary Card */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalExpensesAllPages)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalCount} expenses (all pages)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(thisMonthTotal)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Current month total
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Average Expense</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(averageExpense)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Per expense
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter expenses by category, date, or search</CardDescription>
            </CardHeader>
            <CardContent>
              <form method="get" className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Search</label>
                  <Input
                    name="search"
                    placeholder="Description, vendor..."
                    defaultValue={searchParams.search}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select name="category" defaultValue={searchParams.category}>
                    <option value="">All Categories</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Date From</label>
                  <Input
                    type="date"
                    name="dateFrom"
                    defaultValue={searchParams.dateFrom}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Date To</label>
                  <Input
                    type="date"
                    name="dateTo"
                    defaultValue={searchParams.dateTo}
                  />
                </div>
                <div className="md:col-span-4 flex gap-2">
                  <Button type="submit">Apply Filters</Button>
                  <Button type="button" variant="outline" asChild>
                    <Link href="/expenses">Clear</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Expenses Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                Expenses ({expensesData.total})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expensesData.expenses.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No expenses found. {expensesData.total === 0 ? 'Add expenses to get started.' : 'Try adjusting your filters.'}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Link href={`/expenses?${new URLSearchParams({ ...searchParams, sortBy: 'expense_date', sortOrder: sortBy === 'expense_date' && sortOrder === 'asc' ? 'desc' : 'asc' }).toString()}`}>
                            Date
                          </Link>
                        </TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">
                          <Link href={`/expenses?${new URLSearchParams({ ...searchParams, sortBy: 'amount', sortOrder: sortBy === 'amount' && sortOrder === 'asc' ? 'desc' : 'asc' }).toString()}`}>
                            Amount
                          </Link>
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesData.expenses.map((expense: any) => (
                        <TableRow key={expense.expense_id}>
                          <TableCell>
                            {new Date(expense.expense_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <span className="px-2 py-1 rounded text-xs bg-muted">
                              {expense.category || 'Uncategorized'}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">
                            {expense.description}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {expense.vendor || '-'}
                          </TableCell>
                          <TableCell>
                            {expense.order_number ? (
                              <Link
                                href={`/orders/${encodeURIComponent(expense.order_number)}`}
                                className="text-primary hover:underline font-medium"
                              >
                                {expense.order_number}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {expense.source ? (
                              <span className="px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                                {expense.source === 'shippo' ? 'Shippo' : expense.source === 'shippo_invoice' ? 'Shippo Invoice' : expense.source === 'shippo_email' ? 'Shippo Email' : expense.source === 'import' ? 'Import' : expense.source || 'Manual'}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Manual</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(expense.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DeleteExpenseButton 
                              expenseId={expense.expense_id} 
                              description={expense.description}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {expensesData.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Page {expensesData.page} of {expensesData.totalPages} ({expensesData.total} total)
                      </div>
                      <div className="flex gap-2">
                        {page > 1 && (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/expenses?${new URLSearchParams({ ...searchParams, page: String(page - 1) }).toString()}`}>
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Previous
                            </Link>
                          </Button>
                        )}
                        {page < expensesData.totalPages && (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/expenses?${new URLSearchParams({ ...searchParams, page: String(page + 1) }).toString()}`}>
                              Next
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Expenses Chart */}
          <ExpensesChart data={expenseSummary.expensesByCategory || []} />
        </div>
      </main>
    </div>
  )
}
