'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export function SyncOrdersButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleSync() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/sync/woocommerce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'incremental' }),
      })
      const data = await res.json()
      if (data.success) {
        const orders = data.results?.orders?.synced ?? 0
        setResult(`Synced ${orders} new order${orders !== 1 ? 's' : ''}`)
        setTimeout(() => window.location.reload(), 1200)
      } else {
        setResult(data.error || 'Sync failed')
      }
    } catch {
      setResult('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={loading}
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Syncing…' : 'Sync Orders'}
      </Button>
      {result && (
        <span className="text-xs text-muted-foreground">{result}</span>
      )}
    </div>
  )
}
