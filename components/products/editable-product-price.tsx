'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Check } from 'lucide-react'

function parsePriceInput(value: string): number | null {
  const n = parseFloat(value.replace(/[$,]/g, ''))
  if (Number.isNaN(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

interface EditableRetailPriceProps {
  productId: number
  value: number | null
  className?: string
}

export function EditableRetailPrice({ productId, value, className = '' }: EditableRetailPriceProps) {
  const router = useRouter()
  const [input, setInput] = useState(value != null ? String(value) : '')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setInput(value != null ? String(value) : '')
  }, [productId, value])

  const save = async (raw: string) => {
    const parsed = parsePriceInput(raw)
    if (parsed === null && value === null) return
    if (parsed !== null && value !== null && Math.abs(parsed - value) < 0.01) return
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retail_price: parsed ?? 0 }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="text"
        inputMode="decimal"
        className={`h-8 w-20 text-right ${className}`}
        placeholder="0"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={() => save(input)}
        disabled={loading}
      />
      {saved && <span className="flex items-center gap-0.5 text-[10px] text-green-600" title="Saved"><Check className="h-3 w-3" /> Saved</span>}
    </div>
  )
}

interface EditableSalePriceProps {
  productId: number
  value: number | null
  className?: string
}

export function EditableSalePrice({ productId, value, className = '' }: EditableSalePriceProps) {
  const router = useRouter()
  const [input, setInput] = useState(value != null && value > 0 ? String(value) : '')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setInput(value != null && value > 0 ? String(value) : '')
  }, [productId, value])

  const save = async (raw: string) => {
    const trimmed = raw.trim()
    const parsed = trimmed === '' ? null : parsePriceInput(raw)
    if (parsed === null && (value === null || value === 0)) return
    if (parsed !== null && value !== null && value > 0 && Math.abs(parsed - value) < 0.01) return
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sale_price: parsed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="text"
        inputMode="decimal"
        className={`h-8 w-20 text-right ${className}`}
        placeholder="N/A"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={() => save(input)}
        disabled={loading}
      />
      {saved && <span className="flex items-center gap-0.5 text-[10px] text-green-600" title="Saved"><Check className="h-3 w-3" /> Saved</span>}
    </div>
  )
}
