/**
 * WooCommerce Data Normalizer
 * Converts WooCommerce API responses to Supabase schema format
 */

export interface NormalizedOrder {
  woo_order_id: number
  order_number: string
  order_date: string
  customer_name: string | null
  customer_email: string | null
  order_status: string
  payment_method: string | null
  shipping_charged: number
  shipping_cost: number
  free_shipping: boolean
  coupon_code: string | null
  coupon_discount: number
  notes: string | null
  // These will be computed by triggers, but we set initial values
  order_subtotal: number
  order_total: number
  order_product_cost: number
  shipping_net_cost_absorbed: number
  order_cost: number
  order_profit: number
}

export interface NormalizedOrderLine {
  order_number: string
  woo_line_item_id: number | null
  product_id: number
  qty_ordered: number
  our_cost_per_unit: number
  customer_paid_per_unit: number
}

export interface NormalizedProduct {
  woo_product_id: number
  product_id: number // Use WooCommerce ID as primary key
  product_name: string
  variant_strength: string | null
  sku_code: string | null
  retail_price: number | null
  our_cost: number | null
  // Stock fields
  starting_qty: number | null
  current_stock: number | null
  stock_status: string | null
  // Images (store as JSONB)
  images: any[] | null
}

export interface NormalizedCoupon {
  woo_coupon_id: number
  coupon_code: string
  discount_type: string
  discount_amount: number
  usage_count: number
  date_created: string
  date_modified: string
}

/**
 * Normalize WooCommerce order to Supabase schema
 */
export function normalizeOrder(wooOrder: any): {
  order: NormalizedOrder
  lineItems: NormalizedOrderLine[]
} {
  // Extract customer info
  const billing = wooOrder.billing || {}
  const shipping = wooOrder.shipping || {}
  const customerName = billing.first_name && billing.last_name
    ? `${billing.first_name} ${billing.last_name}`.trim()
    : billing.first_name || billing.last_name || shipping.first_name || shipping.last_name || null

  // Calculate shipping
  const shippingTotal = parseFloat(wooOrder.shipping_total || '0')
  const shippingTax = parseFloat(wooOrder.shipping_tax || '0')
  const shippingCharged = shippingTotal + shippingTax
  const shippingCost = 0 // We don't have this from WooCommerce, will need to be set separately
  const freeShipping = shippingCharged === 0

  // Extract coupon info
  const couponLines = wooOrder.coupon_lines || []
  const couponCode = couponLines.length > 0 ? couponLines[0].code : null
  const couponDiscount = parseFloat(wooOrder.discount_total || '0')

  // Calculate totals (WooCommerce Retrieve order may not have top-level subtotal)
  let subtotal = parseFloat(wooOrder.subtotal || '0')
  if (subtotal === 0 && wooOrder.line_items?.length) {
    subtotal = (wooOrder.line_items as any[]).reduce(
      (sum, item) => sum + parseFloat(item.total || '0'),
      0
    )
  }
  const total = parseFloat(wooOrder.total || '0')

  // Normalize order
  // WooCommerce order number format: use number if available, otherwise id
  const orderNumber = wooOrder.number 
    ? `Order #${wooOrder.number}` 
    : `Order #${wooOrder.id}`

  // Ensure order_date is a valid ISO string
  let orderDate: string
  if (wooOrder.date_created) {
    try {
      orderDate = new Date(wooOrder.date_created).toISOString()
    } catch {
      orderDate = new Date().toISOString()
    }
  } else {
    orderDate = new Date().toISOString()
  }

  const order: NormalizedOrder = {
    woo_order_id: Number(wooOrder.id) || 0,
    order_number: String(orderNumber),
    order_date: orderDate,
    customer_name: customerName ? String(customerName) : null,
    customer_email: billing.email ? String(billing.email) : null,
    order_status: String(wooOrder.status || 'pending'),
    payment_method: (wooOrder.payment_method_title || wooOrder.payment_method) ? String(wooOrder.payment_method_title || wooOrder.payment_method) : null,
    shipping_charged: Number(shippingCharged) || 0,
    shipping_cost: Number(shippingCost) || 0,
    free_shipping: Boolean(freeShipping),
    coupon_code: couponCode,
    coupon_discount: couponDiscount,
    notes: wooOrder.customer_note || null,
    order_subtotal: Number(subtotal) || 0,
    order_total: Number(total) || 0,
    order_product_cost: 0, // Will be calculated from line items
    shipping_net_cost_absorbed: freeShipping ? Number(shippingCost) : Math.max(0, Number(shippingCost) - Number(shippingCharged)),
    order_cost: 0, // Will be calculated
    order_profit: 0, // Will be calculated
  }

  // Normalize line items
  // WooCommerce line_items include: id, name, product_id, variation_id, quantity, price, subtotal, total, sku, etc.
  const rawLineItems = wooOrder.line_items || []
  
  if (!Array.isArray(rawLineItems)) {
    console.warn(`⚠️  Order ${wooOrder.id} has non-array line_items:`, typeof rawLineItems, rawLineItems)
  }
  
  const lineItems: NormalizedOrderLine[] = (Array.isArray(rawLineItems) ? rawLineItems : []).map((item: any, index: number) => {
    // Extract unit price - WooCommerce provides 'price' which is the unit price
    // If not available, calculate from subtotal / quantity
    let unitPrice = parseFloat(String(item.price || '0')) || 0
    if (unitPrice === 0 && item.subtotal && item.quantity) {
      unitPrice = parseFloat(String(item.subtotal)) / parseInt(String(item.quantity), 10)
    }
    
    const quantity = parseInt(String(item.quantity || '1'), 10) || 1
    const productId = parseInt(String(item.product_id || '0'), 10) || 0
    const lineItemId = item.id ? parseInt(String(item.id), 10) : null

    // Validate required fields
    if (productId === 0) {
      console.warn(`⚠️  Line item ${index} in order ${wooOrder.id} has invalid product_id:`, item)
    }
    if (quantity <= 0) {
      console.warn(`⚠️  Line item ${index} in order ${wooOrder.id} has invalid quantity:`, item)
    }

    return {
      order_number: String(order.order_number),
      woo_line_item_id: lineItemId,
      product_id: productId, // WooCommerce product_id - will be mapped to our product_id during sync
      qty_ordered: quantity,
      our_cost_per_unit: 0, // We don't have this from WooCommerce, will be set from products table during sync
      customer_paid_per_unit: unitPrice,
    }
  }).filter(item => item.product_id > 0 && item.qty_ordered > 0) // Filter out invalid items

  return { order, lineItems }
}

/**
 * Normalize WooCommerce product to Supabase schema
 */
export function normalizeProduct(wooProduct: any): NormalizedProduct {
  // Extract variant/strength from name or attributes
  let variantStrength: string | null = null
  const attributes = wooProduct.attributes || []
  const strengthAttr = attributes.find((attr: any) => 
    attr.name?.toLowerCase().includes('strength') || 
    attr.name?.toLowerCase().includes('mg')
  )
  if (strengthAttr) {
    variantStrength = strengthAttr.options?.join(', ') || null
  }

  // Extract SKU
  const sku = wooProduct.sku || null

  // Extract prices
  const regularPrice = wooProduct.regular_price ? parseFloat(wooProduct.regular_price) : null
  const salePrice = wooProduct.sale_price ? parseFloat(wooProduct.sale_price) : null
  const retailPrice = salePrice || regularPrice

  // Extract stock info
  const stockStatus = wooProduct.stock_status || 'outofstock'
  const stockQuantity = wooProduct.stock_quantity !== null && wooProduct.stock_quantity !== undefined
    ? parseInt(wooProduct.stock_quantity, 10)
    : null
  const manageStock = wooProduct.manage_stock === true

  // Extract images and normalize them
  const images = wooProduct.images || []
  const normalizedImages = images.length > 0 
    ? images.map((img: any) => ({
        id: img.id ? Number(img.id) : null,
        src: img.src ? String(img.src) : '',
        alt: img.alt ? String(img.alt) : '',
        name: img.name ? String(img.name) : '',
      }))
    : null

  return {
    woo_product_id: Number(wooProduct.id) || 0,
    product_id: Number(wooProduct.id) || 0, // Use WooCommerce ID as primary key (will be updated if product already exists with different ID)
    product_name: String(wooProduct.name || 'Unnamed Product'),
    variant_strength: variantStrength ? String(variantStrength) : null,
    sku_code: sku ? String(sku) : null,
    retail_price: retailPrice,
    our_cost: null, // We don't have this from WooCommerce, will need to be set separately or preserved from existing product
    starting_qty: manageStock && stockQuantity !== null ? Number(stockQuantity) : null,
    current_stock: manageStock && stockQuantity !== null ? Number(stockQuantity) : null,
    stock_status: stockStatus === 'instock' ? 'In Stock' : 
                  stockStatus === 'onbackorder' ? 'LOW STOCK' : 
                  'OUT OF STOCK',
    images: normalizedImages,
  }
}

/**
 * Normalize WooCommerce coupon to Supabase schema
 */
export function normalizeCoupon(wooCoupon: any): NormalizedCoupon {
  // Ensure dates are valid ISO strings
  let dateCreated: string
  let dateModified: string
  
  try {
    dateCreated = wooCoupon.date_created 
      ? new Date(wooCoupon.date_created).toISOString()
      : new Date().toISOString()
  } catch {
    dateCreated = new Date().toISOString()
  }
  
  try {
    dateModified = wooCoupon.date_modified
      ? new Date(wooCoupon.date_modified).toISOString()
      : new Date().toISOString()
  } catch {
    dateModified = new Date().toISOString()
  }

  return {
    woo_coupon_id: Number(wooCoupon.id) || 0,
    coupon_code: String(wooCoupon.code || ''),
    discount_type: String(wooCoupon.discount_type || 'fixed_cart'),
    discount_amount: parseFloat(String(wooCoupon.amount || '0')) || 0,
    usage_count: parseInt(String(wooCoupon.usage_count || '0'), 10) || 0,
    date_created: dateCreated,
    date_modified: dateModified,
  }
}
