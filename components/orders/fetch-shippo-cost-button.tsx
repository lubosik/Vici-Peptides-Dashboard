'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Package } from 'lucide-react'

interface FetchShippoCostButtonProps {
  orderNumber: string
  className?: string
}

/**
 * Sends order to Make.com webhook to fetch Shippo label cost; scenario will call back to set shipping_cost.
 * Dropdown: Default (auto-fetch scenario) or Manual Push (manual workflow webhook).
 */
export function FetchShippoCostButton({ orderNumber, className = '' }: FetchShippoCostButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [webhook, setWebhook] = useState<'default' | 'manual'>('default')

  const handleClick = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/fetch-shippo-cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook }),
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
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Select
        value={webhook}
        onChange={(e) => setWebhook(e.target.value as 'default' | 'manual')}
        className="h-8 w-[120px] text-xs"
        title="Which webhook to send order to"
      >
        <option value="default">Default</option>
        <option value="manual">Manual Push</option>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={loading}
        title="Send order to Make.com to fetch Shippo label cost"
      >
        <Package className="h-4 w-4 mr-1.5" />
        {loading ? 'Sending…' : 'Fetch from Shippo'}
      </Button>
    </div>
  )
}
