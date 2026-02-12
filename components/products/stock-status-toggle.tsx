'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle } from 'lucide-react'

interface StockStatusToggleProps {
  productId: number
  currentStatus: string
}

export function StockStatusToggle({ productId, currentStatus }: StockStatusToggleProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const isInStock = currentStatus === 'In Stock'

  const toggle = async () => {
    setLoading(true)
    try {
      const next = isInStock ? 'OUT OF STOCK' : 'In Stock'
      const res = await fetch(`/api/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockStatus: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update stock')
      }
      router.refresh()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Failed to update stock')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={loading}
      className="flex items-center gap-1.5"
      title={isInStock ? 'Set to Out of Stock' : 'Set to In Stock'}
    >
      {loading ? (
        <span className="text-xs">…</span>
      ) : isInStock ? (
        <>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-xs text-green-700">In Stock</span>
        </>
      ) : (
        <>
          <XCircle className="h-4 w-4 text-red-600" />
          <span className="text-xs text-red-700">Out of Stock</span>
        </>
      )}
    </Button>
  )
}
