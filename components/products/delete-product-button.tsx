'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DeleteProductButtonProps {
  productId: number
  productName: string
  wooProductId?: number | null
}

export function DeleteProductButton({ productId, productName, wooProductId }: DeleteProductButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${productName}"? This will delete it from both WooCommerce and the dashboard.`)) {
      return
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal
    let wasAborted = false

    setLoading(true)

    try {
      const params = new URLSearchParams()
      if (wooProductId) {
        params.set('woo_product_id', String(wooProductId))
      } else {
        params.set('product_id', String(productId))
      }

      // Make the fetch request with abort signal
      const response = await fetch(`/api/products?${params.toString()}`, {
        method: 'DELETE',
        signal, // Add abort signal to prevent channel closing issues
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Check if request was aborted
      if (signal.aborted) {
        wasAborted = true
        return
      }

      // Ensure response is fully read before proceeding
      if (!response.ok) {
        let errorMessage = 'Failed to delete product'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }

      // Read the response body to ensure request completes
      const result = await response.json()
      
      // Only refresh if request wasn't aborted
      if (!signal.aborted && !wasAborted) {
        // Use router.refresh() with a small delay to ensure response is fully processed
        await new Promise(resolve => setTimeout(resolve, 100))
        // Refresh the page to update product counts
        router.refresh()
        // Force a hard navigation to ensure counts update everywhere
        if (typeof window !== 'undefined') {
          window.location.href = window.location.href
        }
      }
    } catch (error) {
      // Don't show error if request was aborted (user cancelled or component unmounted)
      if (error instanceof Error && (error.name === 'AbortError' || signal.aborted)) {
        wasAborted = true
        return
      }
      
      console.error('Error deleting product:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete product')
    } finally {
      // Only reset loading if request wasn't aborted
      if (!wasAborted && !signal.aborted) {
        setLoading(false)
      }
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={loading}
      className="text-red-600 hover:text-red-700 hover:bg-red-50"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}
