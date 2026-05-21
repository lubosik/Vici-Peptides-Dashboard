import { formatCurrency } from '@/lib/metrics/calculations'

interface PriceDisplayProps {
  value: number | null
  className?: string
}

export function EditableRetailPrice({ value }: PriceDisplayProps) {
  return (
    <span className="text-sm tabular-nums">
      {value != null && value > 0 ? formatCurrency(value) : <span className="text-muted-foreground">—</span>}
    </span>
  )
}

export function EditableSalePrice({ value }: PriceDisplayProps) {
  return (
    <span className="text-sm tabular-nums">
      {value != null && value > 0 ? formatCurrency(value) : <span className="text-muted-foreground">—</span>}
    </span>
  )
}

export function EditableCost({ value }: PriceDisplayProps) {
  return (
    <span className="text-sm tabular-nums">
      {value != null && value > 0 ? formatCurrency(value) : <span className="text-muted-foreground">—</span>}
    </span>
  )
}
