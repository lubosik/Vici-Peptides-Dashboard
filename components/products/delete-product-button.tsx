'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useDemoStore } from '@/lib/demo/store'
import { isDemoMode } from '@/lib/demo/mode'

interface DeleteProductButtonProps {
  productId: number
  productName: string
  wooProductId?: number | null
}

export function DeleteProductButton({ productId, productName, wooProductId }: DeleteProductButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const demoStore = useDemoStore()

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${productName}"?`)) {
      return
    }

    setLoading(true)

    try {
      if (isDemoMode()) {
        // Demo mode: use local store
        demoStore.deleteProduct(productId)
        router.refresh()
      } else {
        // Production mode: call API
        const params = new URLSearchParams()
        if (wooProductId) {
          params.set('woo_product_id', String(wooProductId))
        } else {
          params.set('product_id', String(productId))
        }

        const response = await fetch(`/api/products?${params.toString()}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to delete product')
        }

        router.refresh()
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete product')
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
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}
