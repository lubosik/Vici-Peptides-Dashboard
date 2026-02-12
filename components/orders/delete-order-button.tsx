'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DeleteOrderButtonProps {
  orderNumber: string
  /** WooCommerce order ID for URL (e.g. 1281). Used for API path. */
  wooOrderId?: number | null
  /** Short label for confirm message, e.g. "Order #1281" */
  label?: string
}

export function DeleteOrderButton({
  orderNumber,
  wooOrderId,
  label = orderNumber,
}: DeleteOrderButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm(`Delete ${label}? This will remove the order and all its line items from the dashboard. This cannot be undone.`)) {
      return
    }

    setLoading(true)
    try {
      const path = wooOrderId != null ? String(wooOrderId) : encodeURIComponent(orderNumber)
      const res = await fetch(`/api/orders/${path}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || res.statusText || 'Failed to delete order')
      }
      if (typeof window !== 'undefined' && window.location.pathname.match(/^\/orders\/[^/]+$/)) {
        router.push('/orders')
      } else {
        router.refresh()
      }
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Failed to delete order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={loading}
      className="text-red-600 hover:text-red-700 hover:bg-red-50"
      title="Delete order"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}
