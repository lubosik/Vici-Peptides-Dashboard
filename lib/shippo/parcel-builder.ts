/**
 * Parcel Builder - Converts WooCommerce order data to Shippo parcels
 */

import { ShippoParcel, ShippoAddress } from './client'

interface WooCommerceOrder {
  id: number
  shipping: {
    first_name: string
    last_name: string
    company?: string
    address_1: string
    address_2?: string
    city: string
    state: string
    postcode: string
    country: string
    phone?: string
    email?: string
  }
  line_items: Array<{
    product_id: number
    quantity: number
    name: string
  }>
}

interface WooCommerceProduct {
  id: number
  weight?: string
  dimensions?: {
    length?: string
    width?: string
    height?: string
  }
}

interface ParcelDefaults {
  distanceUnit: string
  massUnit: string
  defaultLength: number
  defaultWidth: number
  defaultHeight: number
  defaultWeight: number
}

export interface ParcelSnapshot {
  parcels: Array<{
    length: number
    width: number
    height: number
    weight: number
    distance_unit: string
    mass_unit: string
    items: Array<{
      product_id: number
      quantity: number
      product_weight?: number
    }>
  }>
  total_weight: number
  total_items: number
  fallback_used: boolean
}

/**
 * Build Shippo address from WooCommerce shipping object
 */
export function buildShippoAddress(wooShipping: WooCommerceOrder['shipping']): ShippoAddress {
  // Normalize country code (WooCommerce might return "United States" but Shippo needs "US")
  let countryCode = wooShipping.country || 'US'
  if (countryCode.length > 2) {
    // Map common country names to ISO codes
    const countryMap: Record<string, string> = {
      'united states': 'US',
      'united states of america': 'US',
      'usa': 'US',
      'united kingdom': 'GB',
      'uk': 'GB',
      'canada': 'CA',
    }
    countryCode = countryMap[countryCode.toLowerCase()] || countryCode
  }

  return {
    name: `${wooShipping.first_name} ${wooShipping.last_name}`.trim(),
    company: wooShipping.company,
    street1: wooShipping.address_1,
    street2: wooShipping.address_2,
    city: wooShipping.city,
    state: wooShipping.state,
    zip: wooShipping.postcode,
    country: countryCode,
    phone: wooShipping.phone,
    email: wooShipping.email,
  }
}

/**
 * Build Shippo parcel(s) from WooCommerce order
 * Fetches product weights/dimensions and calculates total parcel
 */
export async function buildShippoParcels(
  order: WooCommerceOrder,
  products: Map<number, WooCommerceProduct>,
  defaults: ParcelDefaults
): Promise<{
  parcels: ShippoParcel[]
  snapshot: ParcelSnapshot
}> {
  let totalWeight = 0
  let totalItems = 0
  let fallbackUsed = false

  // Calculate total weight from line items
  const itemWeights: Array<{ product_id: number; quantity: number; weight: number }> = []
  
  for (const lineItem of order.line_items) {
    const product = products.get(lineItem.product_id)
    let itemWeight = defaults.defaultWeight
    
    if (product?.weight) {
      // Parse weight (could be "1.5" or "1.5 lb" etc.)
      const weightStr = String(product.weight).replace(/[^0-9.]/g, '')
      const parsedWeight = parseFloat(weightStr)
      if (!isNaN(parsedWeight) && parsedWeight > 0) {
        itemWeight = parsedWeight
      } else {
        fallbackUsed = true
        console.warn(`⚠️  Product ${lineItem.product_id} has invalid weight "${product.weight}", using fallback ${defaults.defaultWeight} ${defaults.massUnit}`)
      }
    } else {
      fallbackUsed = true
      console.warn(`⚠️  Product ${lineItem.product_id} missing weight, using fallback ${defaults.defaultWeight} ${defaults.massUnit}`)
    }

    const lineWeight = itemWeight * lineItem.quantity
    totalWeight += lineWeight
    totalItems += lineItem.quantity

    itemWeights.push({
      product_id: lineItem.product_id,
      quantity: lineItem.quantity,
      weight: itemWeight,
    })
  }

  // Use default dimensions (single box for now)
  // In future, could calculate optimal box size based on items
  const parcel: ShippoParcel = {
    length: String(defaults.defaultLength),
    width: String(defaults.defaultWidth),
    height: String(defaults.defaultHeight),
    distance_unit: defaults.distanceUnit,
    weight: String(totalWeight),
    mass_unit: defaults.massUnit,
  }

  const snapshot: ParcelSnapshot = {
    parcels: [{
      length: defaults.defaultLength,
      width: defaults.defaultWidth,
      height: defaults.defaultHeight,
      weight: totalWeight,
      distance_unit: defaults.distanceUnit,
      mass_unit: defaults.massUnit,
      items: itemWeights,
    }],
    total_weight: totalWeight,
    total_items: totalItems,
    fallback_used: fallbackUsed,
  }

  return {
    parcels: [parcel],
    snapshot,
  }
}

/**
 * Fetch WooCommerce products for an order's line items
 * Returns a Map of product_id -> product data
 */
export async function fetchWooCommerceProducts(
  lineItems: Array<{ product_id: number }>,
  wooCommerceConfig: {
    storeUrl: string
    consumerKey: string
    consumerSecret: string
  }
): Promise<Map<number, WooCommerceProduct>> {
  const productMap = new Map<number, WooCommerceProduct>()
  const uniqueProductIds = [...new Set(lineItems.map(li => li.product_id))]

  // Fetch products in batches (WooCommerce allows up to 100 per request)
  for (let i = 0; i < uniqueProductIds.length; i += 100) {
    const batch = uniqueProductIds.slice(i, i + 100)
    const ids = batch.join(',')
    
    const url = `${wooCommerceConfig.storeUrl.replace(/\/$/, '')}/wp-json/wc/v3/products?include=${ids}`
    const basicAuth = Buffer.from(
      `${wooCommerceConfig.consumerKey}:${wooCommerceConfig.consumerSecret}`,
      'utf8'
    ).toString('base64')
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${basicAuth}`,
        },
      })

      if (response.ok) {
        const products: WooCommerceProduct[] = await response.json()
        products.forEach(product => {
          productMap.set(product.id, product)
        })
      } else {
        console.warn(`⚠️  Failed to fetch products batch: ${response.status}`)
      }
    } catch (error) {
      console.error(`❌ Error fetching products batch:`, error)
    }
  }

  return productMap
}
