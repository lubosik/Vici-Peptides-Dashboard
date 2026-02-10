'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface RetrieveLineItemsButtonProps {
  orderNumber: string
  wooOrderId?: number | null
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function RetrieveLineItemsButton({
  orderNumber,
  wooOrderId,
  variant = 'outline',
  size = 'sm',
}: RetrieveLineItemsButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (wooOrderId == null) return null

  const handleClick = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/orders/sync-line-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_number: orderNumber, woo_order_id: wooOrderId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMessage(`Synced ${data.line_items_synced ?? 0} line items`)
        router.refresh()
      } else {
        setMessage(data.error || 'Failed to sync')
      }
    } catch {
      setMessage('Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-1"
      >
        {loading ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {loading ? 'Syncing...' : 'Line items'}
      </Button>
      {message && (
        <span className="text-xs text-muted-foreground max-w-[120px] truncate" title={message}>
          {message}
        </span>
      )}
    </div>
  )
}
