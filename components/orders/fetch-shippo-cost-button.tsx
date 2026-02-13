'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Package } from 'lucide-react'

interface FetchShippoCostButtonProps {
  orderNumber: string
  className?: string
}

/**
 * Sends order to Make.com webhook to fetch Shippo label cost; scenario will call back to set shipping_cost.
 */
export function FetchShippoCostButton({ orderNumber, className = '' }: FetchShippoCostButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/fetch-shippo-cost`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Failed to send order to Make.com')
        return
      }
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className={className}
      title="Send order to Make.com to fetch Shippo label cost"
    >
      <Package className="h-4 w-4 mr-1.5" />
      {loading ? 'Sending…' : 'Fetch from Shippo'}
    </Button>
  )
}
