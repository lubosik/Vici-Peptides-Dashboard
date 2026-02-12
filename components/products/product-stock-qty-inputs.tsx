'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'

interface ProductStockQtyInputsProps {
  productId: number
  startingQty: number
  qtySold: number
  className?: string
}

export function ProductStockQtyInputs({
  productId,
  startingQty,
  qtySold,
  className = '',
}: ProductStockQtyInputsProps) {
  const router = useRouter()
  const [stock, setStock] = useState(String(startingQty))
  const [sold, setSold] = useState(String(qtySold))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setStock(String(startingQty))
    setSold(String(qtySold))
  }, [productId, startingQty, qtySold])

  const save = async (newStartingQty: number, newQtySold: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          starting_qty: newStartingQty,
          qty_sold: newQtySold,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update')
      }
      router.refresh()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setLoading(false)
    }
  }

  const onStockBlur = () => {
    const n = Math.max(0, parseInt(stock, 10) || 0)
    const s = Math.max(0, parseInt(sold, 10) || 0)
    if (n !== startingQty || s !== qtySold) save(n, s)
  }

  const onSoldBlur = () => {
    const n = Math.max(0, parseInt(stock, 10) || 0)
    const s = Math.max(0, parseInt(sold, 10) || 0)
    if (n !== startingQty || s !== qtySold) save(n, s)
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-muted-foreground">Stock</label>
        <Input
          type="number"
          min={0}
          className="h-8 w-16 text-right"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          onBlur={onStockBlur}
          disabled={loading}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-muted-foreground">Sold</label>
        <Input
          type="number"
          min={0}
          className="h-8 w-16 text-right"
          value={sold}
          onChange={(e) => setSold(e.target.value)}
          onBlur={onSoldBlur}
          disabled={loading}
        />
      </div>
    </div>
  )
}
