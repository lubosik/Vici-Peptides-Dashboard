'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function CleanupProductsButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  const handleCleanup = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/sync/cleanup-products', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'error', text: data?.error || 'Cleanup failed' })
        return
      }
      setMessage({
        type: 'success',
        text: data.deleted > 0
          ? `Removed ${data.deleted} old CSV products${data.kept > 0 ? ` · kept ${data.kept} with order history` : ''}`
          : 'Nothing to clean up',
      })
      router.refresh()
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleCleanup} disabled={loading}>
        <Trash2 className={`h-4 w-4 mr-2 ${loading ? 'animate-pulse' : ''}`} />
        {loading ? 'Cleaning…' : 'Remove old products'}
      </Button>
      {message && (
        <span className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </span>
      )}
    </div>
  )
}
