/**
 * Demo data types matching the real data structure
 */

export interface DemoOrder {
  order_number: string
  order_date: string
  customer_name: string
  customer_email: string
  order_status: string
  order_subtotal: number
  order_total: number
  order_profit: number
  order_cost: number
  shipping_charged: number
  shipping_cost: number
  coupon_code: string | null
  coupon_discount: number
  free_shipping: boolean
  payment_method: string
  created_at: string
  updated_at: string | null
}

export interface DemoOrderLine {
  line_id: number
  order_number: string
  product_id: number
  qty_ordered: number
  our_cost_per_unit: number
  customer_paid_per_unit: number
  line_total: number
  line_cost: number
  line_profit: number
  woo_line_item_id: number | null
}

export interface DemoProduct {
  product_id: number
  product_name: string
  variant_strength: string | null
  sku_code: string | null
  lot_number: string | null
  starting_qty: number | null
  qty_sold: number
  current_stock: number
  reorder_level: number | null
  stock_status: string
  our_cost: number | null
  retail_price: number | null
  unit_margin: number | null
  margin_percent: number | null
  woo_product_id: number | null
}

export interface DemoExpense {
  expense_id: number
  expense_date: string
  category: string
  description: string
  amount: number
  vendor: string | null
  notes: string | null
  created_at: string
  updated_at: string | null
}

export interface DemoData {
  orders: DemoOrder[]
  orderLines: DemoOrderLine[]
  products: DemoProduct[]
  expenses: DemoExpense[]
}
