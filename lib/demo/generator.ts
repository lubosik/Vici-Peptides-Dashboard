/**
 * Demo data generator - creates realistic fake e-commerce data
 */

import type { DemoOrder, DemoOrderLine, DemoProduct, DemoExpense, DemoData } from './types'

// Demo product names (generic, not real inventory)
const DEMO_PRODUCT_NAMES = [
  'Neon Pre-Workout',
  'Performance Stack',
  'Energy Boost',
  'Recovery Formula',
  'Strength Builder',
  'Endurance Plus',
  'Focus Enhancer',
  'Vitality Blend',
  'Power Complex',
  'Elite Formula',
  'Pro Performance',
  'Ultra Boost',
  'Max Strength',
  'Peak Performance',
  'Advanced Stack',
]

const DEMO_VARIANTS = ['10mg', '20mg', '30mg', '50mg', '100mg', '5ml', '10ml']

const DEMO_CUSTOMER_NAMES = [
  'Alex Johnson',
  'Sarah Williams',
  'Michael Brown',
  'Emily Davis',
  'David Miller',
  'Jessica Wilson',
  'James Moore',
  'Amanda Taylor',
  'Robert Anderson',
  'Lisa Thomas',
]

const DEMO_EXPENSE_CATEGORIES = [
  'Marketing',
  'Shipping',
  'Packaging',
  'Software',
  'Office Supplies',
  'Utilities',
  'Professional Services',
  'Equipment',
  'Travel',
  'Training',
]

const DEMO_VENDORS = [
  'Supply Co',
  'Packaging Solutions',
  'Marketing Pro',
  'Tech Services',
  'Office Depot',
]

const ORDER_STATUSES = ['completed', 'processing', 'pending', 'on-hold', 'cancelled', 'refunded']
const PAYMENT_METHODS = ['credit_card', 'paypal', 'stripe', 'bank_transfer']

let productIdCounter = 1
let orderNumberCounter = 1000
let expenseIdCounter = 1
let lineIdCounter = 1

function generateProduct(): DemoProduct {
  const name = DEMO_PRODUCT_NAMES[Math.floor(Math.random() * DEMO_PRODUCT_NAMES.length)]
  const variant = Math.random() > 0.5 ? DEMO_VARIANTS[Math.floor(Math.random() * DEMO_VARIANTS.length)] : null
  const ourCost = Math.random() * 50 + 10 // $10-$60
  const retailPrice = ourCost * (1.5 + Math.random() * 1.5) // 1.5x to 3x markup
  const margin = retailPrice - ourCost
  const marginPercent = (margin / retailPrice) * 100
  const startingQty = Math.floor(Math.random() * 200) + 50
  const qtySold = Math.floor(Math.random() * startingQty * 0.7)
  const currentStock = startingQty - qtySold
  const stockStatus = 
    currentStock === 0 ? 'OUT OF STOCK' :
    currentStock < 20 ? 'LOW STOCK' :
    'In Stock'

  return {
    product_id: productIdCounter++,
    product_name: variant ? `${name} ${variant}` : name,
    variant_strength: variant,
    sku_code: `DEMO-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    lot_number: `LOT-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    starting_qty: startingQty,
    qty_sold: qtySold,
    current_stock: currentStock,
    reorder_level: Math.floor(startingQty * 0.2),
    stock_status: stockStatus,
    our_cost: Math.round(ourCost * 100) / 100,
    retail_price: Math.round(retailPrice * 100) / 100,
    unit_margin: Math.round(margin * 100) / 100,
    margin_percent: Math.round(marginPercent * 100) / 100,
    woo_product_id: null,
  }
}

function generateOrder(date: Date): DemoOrder {
  const orderNumber = `Order #${orderNumberCounter++}`
  const customer = DEMO_CUSTOMER_NAMES[Math.floor(Math.random() * DEMO_CUSTOMER_NAMES.length)]
  const customerEmail = `demo.user${Math.floor(Math.random() * 1000)}@example.com`
  const status = ORDER_STATUSES[Math.floor(Math.random() * ORDER_STATUSES.length)]
  const paymentMethod = PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)]
  const hasCoupon = Math.random() > 0.7
  const couponCode = hasCoupon ? `SAVE${Math.floor(Math.random() * 20)}` : null
  const couponDiscount = hasCoupon ? Math.random() * 50 + 10 : 0
  const freeShipping = Math.random() > 0.6
  const shippingCharged = freeShipping ? 0 : Math.random() * 15 + 5
  const shippingCost = freeShipping ? 0 : shippingCharged * 0.6

  // Subtotal will be calculated from line items
  const orderSubtotal = 0 // Will be set after line items are created
  const orderCost = 0 // Will be set after line items are created
  const orderTotal = orderSubtotal - couponDiscount + shippingCharged
  const orderProfit = orderTotal - orderCost - shippingCost

  return {
    order_number: orderNumber,
    order_date: date.toISOString().split('T')[0],
    customer_name: customer,
    customer_email: customerEmail,
    order_status: status,
    order_subtotal: orderSubtotal,
    order_total: orderTotal,
    order_profit: orderProfit,
    order_cost: orderCost,
    shipping_charged: Math.round(shippingCharged * 100) / 100,
    shipping_cost: Math.round(shippingCost * 100) / 100,
    coupon_code: couponCode,
    coupon_discount: Math.round(couponDiscount * 100) / 100,
    free_shipping: freeShipping,
    payment_method: paymentMethod,
    created_at: date.toISOString(),
    updated_at: null,
  }
}

function generateOrderLine(orderNumber: string, product: DemoProduct): DemoOrderLine {
  const qty = Math.floor(Math.random() * 5) + 1
  const customerPaidPerUnit = product.retail_price || 0
  const ourCostPerUnit = product.our_cost || 0
  const lineTotal = customerPaidPerUnit * qty
  const lineCost = ourCostPerUnit * qty
  const lineProfit = lineTotal - lineCost

  return {
    line_id: lineIdCounter++,
    order_number: orderNumber,
    product_id: product.product_id,
    qty_ordered: qty,
    our_cost_per_unit: ourCostPerUnit,
    customer_paid_per_unit: customerPaidPerUnit,
    line_total: Math.round(lineTotal * 100) / 100,
    line_cost: Math.round(lineCost * 100) / 100,
    line_profit: Math.round(lineProfit * 100) / 100,
    woo_line_item_id: null,
  }
}

function generateExpense(date: Date): DemoExpense {
  const category = DEMO_EXPENSE_CATEGORIES[Math.floor(Math.random() * DEMO_EXPENSE_CATEGORIES.length)]
  const vendor = Math.random() > 0.3 ? DEMO_VENDORS[Math.floor(Math.random() * DEMO_VENDORS.length)] : null
  const descriptions: Record<string, string[]> = {
    Marketing: ['Social media ads', 'Google Ads campaign', 'Email marketing', 'Influencer partnership'],
    Shipping: ['Shipping supplies', 'Postage costs', 'Courier service', 'Packaging materials'],
    Packaging: ['Boxes', 'Bubble wrap', 'Labels', 'Tape'],
    Software: ['Subscription renewal', 'License fee', 'Cloud hosting', 'API access'],
    'Office Supplies': ['Paper', 'Pens', 'Printer ink', 'Notebooks'],
    Utilities: ['Electricity', 'Internet', 'Phone', 'Water'],
    'Professional Services': ['Legal consultation', 'Accounting', 'Design work', 'Consulting'],
    Equipment: ['Computer', 'Printer', 'Desk', 'Chair'],
    Travel: ['Flight', 'Hotel', 'Meals', 'Transportation'],
    Training: ['Course fee', 'Workshop', 'Certification', 'Conference'],
  }
  const descList = descriptions[category] || ['Miscellaneous expense']
  const description = descList[Math.floor(Math.random() * descList.length)]
  const amount = Math.random() * 500 + 20 // $20-$520

  return {
    expense_id: expenseIdCounter++,
    expense_date: date.toISOString().split('T')[0],
    category,
    description,
    amount: Math.round(amount * 100) / 100,
    vendor,
    notes: Math.random() > 0.7 ? 'Important expense' : null,
    created_at: date.toISOString(),
    updated_at: null,
  }
}

export function generateDemoData(): DemoData {
  // Reset counters
  productIdCounter = 1
  orderNumberCounter = 1000
  expenseIdCounter = 1
  lineIdCounter = 1

  // Generate 25 products
  const products: DemoProduct[] = []
  for (let i = 0; i < 25; i++) {
    products.push(generateProduct())
  }

  // Generate orders over the last 90 days
  const orders: DemoOrder[] = []
  const orderLines: DemoOrderLine[] = []
  const today = new Date()
  
  for (let i = 0; i < 90; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    
    // Generate 0-3 orders per day
    const ordersPerDay = Math.floor(Math.random() * 4)
    for (let j = 0; j < ordersPerDay; j++) {
      const order = generateOrder(date)
      
      // Add 1-4 line items per order
      const lineItemCount = Math.floor(Math.random() * 4) + 1
      let orderSubtotal = 0
      let orderCost = 0
      
      for (let k = 0; k < lineItemCount; k++) {
        const product = products[Math.floor(Math.random() * products.length)]
        const line = generateOrderLine(order.order_number, product)
        orderLines.push(line)
        orderSubtotal += line.line_total
        orderCost += line.line_cost
      }
      
      // Update order totals
      order.order_subtotal = Math.round(orderSubtotal * 100) / 100
      order.order_cost = Math.round(orderCost * 100) / 100
      order.order_total = Math.round((orderSubtotal - order.coupon_discount + order.shipping_charged) * 100) / 100
      order.order_profit = Math.round((order.order_total - orderCost - order.shipping_cost) * 100) / 100
      
      orders.push(order)
    }
  }

  // Generate expenses over the last 60 days
  const expenses: DemoExpense[] = []
  for (let i = 0; i < 60; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    
    // Generate 0-2 expenses per day
    const expensesPerDay = Math.floor(Math.random() * 3)
    for (let j = 0; j < expensesPerDay; j++) {
      expenses.push(generateExpense(date))
    }
  }

  return {
    orders: orders.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()),
    orderLines,
    products: products.sort((a, b) => a.product_name.localeCompare(b.product_name)),
    expenses: expenses.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()),
  }
}
