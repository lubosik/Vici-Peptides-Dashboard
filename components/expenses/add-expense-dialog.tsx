'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useDemoStore } from '@/lib/demo/store'
import { isDemoMode } from '@/lib/demo/mode'

interface AddExpenseDialogProps {
  categories: string[]
}

export function AddExpenseDialog({ categories }: AddExpenseDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const demoStore = useDemoStore()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const expense = {
      expense_date: formData.get('expense_date') as string,
      category: formData.get('category') as string,
      description: formData.get('description') as string,
      amount: parseFloat(formData.get('amount') as string),
      vendor: (formData.get('vendor') as string) || null,
      notes: (formData.get('notes') as string) || null,
    }

    try {
      if (isDemoMode()) {
        // Demo mode: use local store
        demoStore.addExpense(expense)
        setOpen(false)
        router.refresh()
      } else {
        // Production mode: call API — wait for full response before closing/navigating
        const response = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expense),
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error((data && data.error) || 'Failed to create expense')
        }

        setOpen(false)
        // Navigate to page 1 so the new expense (at top of list) is visible
        const params = new URLSearchParams({ page: '1' })
        params.set('r', String(Date.now()))
        router.push(`/expenses?${params.toString()}`)
        router.refresh()
      }
    } catch (error) {
      console.error('Error creating expense:', error)
      alert(error instanceof Error ? error.message : 'Failed to create expense')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto glass-card border-border/30">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>
              Add a new business expense to track.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="expense_date">Date *</Label>
              <Input
                id="expense_date"
                name="expense_date"
                type="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="bg-input/50 border-border/50"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category *</Label>
              <Select name="category" id="category" required>
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                name="description"
                placeholder="Expense description"
                required
                className="bg-input/50 border-border/50"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
                className="bg-input/50 border-border/50"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendor">Vendor (optional)</Label>
              <Input
                id="vendor"
                name="vendor"
                placeholder="Vendor name"
                className="bg-input/50 border-border/50"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                name="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-input/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Additional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
