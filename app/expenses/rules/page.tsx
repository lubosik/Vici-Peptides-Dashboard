'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import Link from 'next/link'
import { ArrowLeft, Plus, Loader2, Trash2 } from 'lucide-react'

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
]

export default function ExpenseRulesPage() {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pattern, setPattern] = useState('')
  const [patternType, setPatternType] = useState('contains')
  const [category, setCategory] = useState('')

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/expenses/rules')
      if (res.ok) {
        const data = await res.json()
        setRules(data.rules || [])
      }
    } catch (e) {
      console.error('Failed to fetch rules:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRules()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pattern.trim() || !category) return
    setSaving(true)
    try {
      const res = await fetch('/api/expenses/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: pattern.trim(), pattern_type: patternType, category }),
      })
      if (res.ok) {
        setPattern('')
        setCategory('')
        fetchRules()
      }
    } catch (e) {
      console.error('Failed to add rule:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id: number, active: boolean) => {
    try {
      const res = await fetch('/api/expenses/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active }),
      })
      if (res.ok) fetchRules()
    } catch (e) {
      console.error('Failed to toggle rule:', e)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this rule?')) return
    try {
      const res = await fetch(`/api/expenses/rules?id=${id}`, { method: 'DELETE' })
      if (res.ok) fetchRules()
    } catch (e) {
      console.error('Failed to delete rule:', e)
    }
  }

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
            <h1 className="text-2xl font-bold">Categorization Rules</h1>
            <p className="text-muted-foreground mt-1">
              Auto-categorize expenses when description/vendor matches a pattern (e.g. &quot;Shippo&quot; → Shipping)
            </p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Add Rule</CardTitle>
              <CardDescription>Create rules to auto-categorize imported expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-sm font-medium mb-1 block">Pattern</label>
                  <Input
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="e.g. SHIPPO"
                    className="w-48"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <Select value={patternType} onChange={(e) => setPatternType(e.target.value)} className="w-32">
                    <option value="contains">Contains</option>
                    <option value="exact">Exact</option>
                    <option value="regex">Regex</option>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Category</label>
                  <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-40">
                    <option value="">Select...</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" disabled={saving || !pattern.trim() || !category}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add Rule
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rules</CardTitle>
              <CardDescription>Rules are applied in priority order when importing statements</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-8">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : rules.length === 0 ? (
                <p className="text-muted-foreground py-8">No rules yet. Add one above.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pattern</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono">{r.pattern}</TableCell>
                        <TableCell>{r.pattern_type}</TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell>{r.priority}</TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => handleToggle(r.id, !r.active)}
                            className={`text-xs px-2 py-1 rounded ${r.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}
                          >
                            {r.active ? 'On' : 'Off'}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
