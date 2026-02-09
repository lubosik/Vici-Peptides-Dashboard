'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { ArrowLeft, Upload, Check, X, Loader2 } from 'lucide-react'
import { getExpenseCategoriesFromLists } from '@/lib/utils/expense-categories'

const CATEGORIES = [
  'Shipping',
  'Supplies',
  'Software/SaaS',
  'Marketing',
  'Payment Processing',
  'Inventory/COGS',
  'Office',
  'Meals',
  'Travel',
  'Insurance',
  'Professional Services',
  'Other',
  ...getExpenseCategoriesFromLists(),
]

export default function ExpenseImportPage() {
  const [importId, setImportId] = useState<string | null>(null)
  const [batch, setBatch] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const fetchImport = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/expenses/import/${id}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setBatch(data.batch)
      setLines(data.lines || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
    if (hash) {
      setImportId(hash)
      fetchImport(hash)
    }
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', f)
      const res = await fetch('/api/expenses/import', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setImportId(String(data.import_id))
      window.location.hash = String(data.import_id)
      fetchImport(String(data.import_id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const updateCategory = async (lineId: number, category: string) => {
    try {
      await fetch(`/api/expenses/import/${importId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineId, category }),
      })
      setLines((prev) =>
        prev.map((l) => (l.id === lineId ? { ...l, category } : l))
      )
    } catch (e) {
      console.error('Update failed:', e)
    }
  }

  const approveAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/expenses/import/${importId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineIds: 'all' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Approve failed')
      fetchImport(importId!)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setLoading(false)
    }
  }

  const pending = lines.filter((l) => !l.approved && !l.rejected)
  const approved = lines.filter((l) => l.approved)
  const totalAmount = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const approvable = lines.filter((l) => !l.approved && !l.rejected && l.category)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto lg:ml-0">
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-6">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/expenses">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Expenses
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Import Statement</h1>
            <p className="text-muted-foreground mt-1">
              Upload a credit card statement CSV, categorize, and approve to add to expenses
            </p>
          </div>

          {!importId ? (
            <Card>
              <CardHeader>
                <CardTitle>Upload CSV</CardTitle>
                <CardDescription>
                  Drag and drop or click to upload. CSV must have Date and Amount columns.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? 'Uploading…' : 'Click or drag CSV here'}
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploading}
                  />
                </label>
                {error && (
                  <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{lines.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Auto-categorized</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {lines.filter((l) => l.auto_categorized).length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Pending</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{pending.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Amount</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-2 mb-4">
                <Button onClick={approveAll} disabled={loading || approvable.length === 0}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  Approve All Categorized ({approvable.length})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportId(null)
                    setBatch(null)
                    setLines([])
                    setError(null)
                    window.location.hash = ''
                  }}
                >
                  Start Over
                </Button>
                <label>
                  <Button variant="outline" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-1" />
                      New Upload
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleUpload}
                  />
                </label>
              </div>

              {error && (
                <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Line Items</CardTitle>
                  <CardDescription>
                    Set category for each item, then approve to add to expenses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading && lines.length === 0 ? (
                    <div className="flex items-center gap-2 text-muted-foreground py-8">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell>{line.expense_date || '-'}</TableCell>
                            <TableCell>{line.vendor || '-'}</TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {line.description || '-'}
                              {line.auto_categorized && (
                                <span className="ml-1 text-xs text-blue-600">⚡ Auto</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${Number(line.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              {line.approved ? (
                                <span className="text-green-600">Approved</span>
                              ) : (
                                <Select
                                  value={line.category || ''}
                                  onChange={(e) => updateCategory(line.id, e.target.value)}
                                >
                                  <option value="">Select category</option>
                                  {CATEGORIES.filter((c, i, a) => a.indexOf(c) === i).map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </Select>
                              )}
                            </TableCell>
                            <TableCell>
                              {line.approved && <Check className="h-4 w-4 text-green-600" />}
                              {line.rejected && <X className="h-4 w-4 text-red-600" />}
                              {!line.approved && !line.rejected && (
                                <span className="text-muted-foreground text-sm">Pending</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
