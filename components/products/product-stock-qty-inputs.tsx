'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'

interface ProductStockQtyInputsProps {
  productId: number
  /** DB: starting_qty (used to derive current stock for display) */
  startingQty: number
  /** Total quantity sold (can be higher than current stock) */
  qtySold: number
  className?: string
}

/** Current stock = on hand now. Qty sold = total sold (often higher than current stock). */
export function ProductStockQtyInputs({
  productId,
  startingQty,
  qtySold,
  className = '',
}: ProductStockQtyInputsProps) {
  const router = useRouter()
  const currentStockFromDb = Math.max(0, startingQty - qtySold)
  const [currentStock, setCurrentStock] = useState(String(currentStockFromDb))
  const [sold, setSold] = useState(String(qtySold))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setCurrentStock(String(Math.max(0, startingQty - qtySold)))
    setSold(String(qtySold))
  }, [productId, startingQty, qtySold])

  const save = async (newCurrentStock: number, newQtySold: number) => {
    setLoading(true)
    try {
      const startingQtyToSend = newCurrentStock + newQtySold
      const res = await fetch(`/api/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          starting_qty: startingQtyToSend,
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

  const onCurrentStockBlur = () => {
    const c = Math.max(0, parseInt(currentStock, 10) || 0)
    const s = Math.max(0, parseInt(sold, 10) || 0)
    if (c !== currentStockFromDb || s !== qtySold) save(c, s)
  }

  const onSoldBlur = () => {
    const c = Math.max(0, parseInt(currentStock, 10) || 0)
    const s = Math.max(0, parseInt(sold, 10) || 0)
    if (c !== currentStockFromDb || s !== qtySold) save(c, s)
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-muted-foreground" title="On hand right now">Current stock</label>
        <Input
          type="number"
          min={0}
          className="h-8 w-16 text-right"
          value={currentStock}
          onChange={(e) => setCurrentStock(e.target.value)}
          onBlur={onCurrentStockBlur}
          disabled={loading}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-muted-foreground" title="Total sold (can be higher than current stock)">Qty sold</label>
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
