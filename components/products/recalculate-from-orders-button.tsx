'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Calculator } from 'lucide-react'

export function RecalculateFromOrdersButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/products/recalculate-from-orders', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Recalculate failed')
      }
      router.refresh()
      alert(data.message || 'Recalculated. Revenue and profit are now updated from orders.')
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Recalculate failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={run}
      disabled={loading}
      className="flex items-center gap-2"
    >
      <Calculator className="h-4 w-4" />
      {loading ? 'Calculating…' : 'Recalculate from orders'}
    </Button>
  )
}
