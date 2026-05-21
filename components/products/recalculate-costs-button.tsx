'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calculator } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function RecalculateCostsButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  const handleRecalculate = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/sync/recalculate-costs', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'error', text: data?.error || 'Recalculation failed' })
        return
      }
      setMessage({ type: 'success', text: data?.message || 'Costs recalculated' })
      router.refresh()
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" onClick={handleRecalculate} disabled={loading}>
        <Calculator className={`h-4 w-4 mr-2 ${loading ? 'animate-pulse' : ''}`} />
        {loading ? 'Recalculating…' : 'Recalculate Costs'}
      </Button>
      {message && (
        <span className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </span>
      )}
    </div>
  )
}
