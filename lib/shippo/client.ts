/**
 * Shippo API Client
 * Server-side only - never expose API token to browser
 */

interface ShippoConfig {
  apiToken: string
  addressFrom: {
    name: string
    company?: string
    street1: string
    city: string
    state: string
    zip: string
    country: string
    phone?: string
    email?: string
  }
  parcelDefaults: {
    distanceUnit: string // 'in' or 'cm'
    massUnit: string // 'lb' or 'kg'
    defaultLength: number
    defaultWidth: number
    defaultHeight: number
    defaultWeight: number // Fallback weight per item if product weight missing
  }
}

export interface ShippoAddress {
  name: string
  company?: string
  street1: string
  street2?: string
  city: string
  state: string
  zip: string
  country: string
  phone?: string
  email?: string
}

export interface ShippoParcel {
  length: string
  width: string
  height: string
  distance_unit: string
  weight: string
  mass_unit: string
}

export interface ShippoShipment {
  object_id: string
  address_from: ShippoAddress
  address_to: ShippoAddress
  parcels: ShippoParcel[]
  rates: ShippoRate[]
  status: string
}

export interface ShippoRate {
  object_id: string
  amount: string
  currency: string
  provider: string
  servicelevel: {
    name: string
    token: string
  }
  estimated_days?: number
}

export interface ShippoTransaction {
  object_id: string
  rate: string
  label_url?: string
  tracking_number?: string
  status: string
  commercial_invoice_url?: string
}

/** Shippo Order (from GET /orders/ list or single order) */
export interface ShippoOrder {
  object_id: string
  order_number: string
  order_status: string
  placed_at: string
  shipping_cost: string
  shipping_cost_currency: string
  shipping_method?: string
  subtotal_price: string
  total_price: string
  total_tax: string
  currency: string
  weight?: string
  weight_unit?: string
  to_address?: Record<string, unknown>
  line_items?: Array<Record<string, unknown>>
  transactions?: unknown[]
}

export interface ShippoOrdersListResponse {
  count: number
  next: string | null
  previous: string | null
  results: ShippoOrder[]
}

export class ShippoError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: any
  ) {
    super(message)
    this.name = 'ShippoError'
  }
}

export class ShippoClient {
  private config: ShippoConfig
  private baseUrl = 'https://api.goshippo.com'

  constructor(config: ShippoConfig) {
    this.config = config
  }

  /**
   * List orders from Shippo (GET /orders/)
   * Returns paginated orders with shipping_cost, order_number, etc.
   */
  async listOrders(params?: {
    page?: number
    results?: number
    start_date?: string
    end_date?: string
  }): Promise<ShippoOrdersListResponse> {
    const url = new URL(`${this.baseUrl}/orders/`)
    if (params?.page != null) url.searchParams.set('page', String(params.page))
    if (params?.results != null) url.searchParams.set('results', String(params.results))
    if (params?.start_date) url.searchParams.set('start_date', params.start_date)
    if (params?.end_date) url.searchParams.set('end_date', params.end_date)

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `ShippoToken ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new ShippoError(
          `Shippo API error: ${response.status} ${response.statusText}`,
          response.status,
          data
        )
      }

      return data as ShippoOrdersListResponse
    } catch (error) {
      if (error instanceof ShippoError) throw error
      throw new ShippoError(
        `Failed to list Shippo orders: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      )
    }
  }

  /**
   * Get single order by object_id (for re-sync)
   * GET /orders/<id>
   */
  async getOrder(orderId: string): Promise<ShippoOrder> {
    const url = `${this.baseUrl}/orders/${orderId}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `ShippoToken ${this.config.apiToken}`,
        'Content-Type': 'application/json',
      },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new ShippoError(
        `Shippo API error: ${response.status} ${response.statusText}`,
        response.status,
        data
      )
    }
    return data
  }

  /**
   * Get transaction by ID (for actual label cost)
   * GET /transactions/<id>
   */
  async getTransaction(transactionId: string): Promise<{
    object_id: string
    rate: { object_id: string; amount: string; currency: string } | string
    tracking_number?: string
    status: string
  }> {
    const url = `${this.baseUrl}/transactions/${transactionId}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `ShippoToken ${this.config.apiToken}`,
        'Content-Type': 'application/json',
      },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new ShippoError(
        `Shippo API error: ${response.status} ${response.statusText}`,
        response.status,
        data
      )
    }
    return data
  }

  /**
   * Get rate by ID (when transaction.rate is a reference)
   * GET /rates/<id>
   */
  async getRate(rateId: string): Promise<{ object_id: string; amount: string; currency: string }> {
    const url = `${this.baseUrl}/rates/${rateId}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `ShippoToken ${this.config.apiToken}`,
        'Content-Type': 'application/json',
      },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new ShippoError(
        `Shippo API error: ${response.status} ${response.statusText}`,
        response.status,
        data
      )
    }
    return data
  }

  /**
   * List invoices from Shippo Billing API (beta).
   * GET /invoices - use status=PAID to get paid invoices.
   * No Make.com needed - Shippo dashboard config is enough.
   */
  async listInvoices(params?: {
    page?: number
    results?: number
    status?: string
  }): Promise<{
    next: string | null
    previous: string | null
    results: Array<{
      object_id: string
      invoice_number: string
      status: string
      invoice_paid_date: string | null
      total_invoiced?: { amount: string; currency: string }
      total_charged?: { amount: string; currency: string }
    }>
  }> {
    const url = new URL(`${this.baseUrl}/invoices`)
    if (params?.page != null) url.searchParams.set('page', String(params.page))
    if (params?.results != null) url.searchParams.set('results', String(params.results))
    if (params?.status) url.searchParams.set('status', params.status)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `ShippoToken ${this.config.apiToken}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    if (!response.ok) {
      throw new ShippoError(
        `Shippo Invoices API error: ${response.status}`,
        response.status,
        data
      )
    }
    return data
  }

  /**
   * Fetch next page of orders using the URL returned in response.next
   */
  async listOrdersNext(nextUrl: string): Promise<ShippoOrdersListResponse> {
    try {
      const response = await fetch(nextUrl, {
        method: 'GET',
        headers: {
          Authorization: `ShippoToken ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new ShippoError(
          `Shippo API error: ${response.status} ${response.statusText}`,
          response.status,
          data
        )
      }

      return data as ShippoOrdersListResponse
    } catch (error) {
      if (error instanceof ShippoError) throw error
      throw new ShippoError(
        `Failed to fetch next Shippo orders: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      )
    }
  }

  /**
   * Create a shipment and get rates
   * POST /shipments/
   */
  async createShipment(params: {
    addressFrom: ShippoAddress
    addressTo: ShippoAddress
    parcels: ShippoParcel[]
    async?: boolean
  }): Promise<ShippoShipment> {
    const url = `${this.baseUrl}/shipments/`
    
    const payload = {
      address_from: this.normalizeAddress(params.addressFrom),
      address_to: this.normalizeAddress(params.addressTo),
      parcels: params.parcels,
      async: params.async ?? false,
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `ShippoToken ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new ShippoError(
          `Shippo API error: ${response.status} ${response.statusText}`,
          response.status,
          data
        )
      }

      return data as ShippoShipment
    } catch (error) {
      if (error instanceof ShippoError) {
        throw error
      }
      throw new ShippoError(
        `Failed to create shipment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      )
    }
  }

  /**
   * Select a rate from available rates
   * Default strategy: choose cheapest rate in correct currency
   */
  selectRate(
    rates: ShippoRate[],
    currency: string = 'USD',
    strategy: 'cheapest' | 'fastest' = 'cheapest'
  ): ShippoRate | null {
    if (!rates || rates.length === 0) {
      return null
    }

    // Filter to correct currency
    const currencyRates = rates.filter(r => r.currency === currency)
    if (currencyRates.length === 0) {
      // Fallback to any currency if none match
      return rates[0]
    }

    if (strategy === 'cheapest') {
      // Sort by amount (lowest first)
      return currencyRates.sort((a, b) => 
        parseFloat(a.amount) - parseFloat(b.amount)
      )[0]
    } else {
      // Fastest: sort by estimated_days (lowest first), then by amount
      return currencyRates.sort((a, b) => {
        const daysA = a.estimated_days ?? 999
        const daysB = b.estimated_days ?? 999
        if (daysA !== daysB) {
          return daysA - daysB
        }
        return parseFloat(a.amount) - parseFloat(b.amount)
      })[0]
    }
  }

  /**
   * Create a transaction (purchase label) from a rate
   * POST /transactions/
   */
  async createTransaction(params: {
    rateObjectId: string
    labelFileType?: 'PNG' | 'PDF'
    async?: boolean
  }): Promise<ShippoTransaction> {
    const url = `${this.baseUrl}/transactions/`
    
    const payload = {
      rate: params.rateObjectId,
      label_file_type: params.labelFileType || 'PDF',
      async: params.async ?? false,
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `ShippoToken ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new ShippoError(
          `Shippo API error: ${response.status} ${response.statusText}`,
          response.status,
          data
        )
      }

      return data as ShippoTransaction
    } catch (error) {
      if (error instanceof ShippoError) {
        throw error
      }
      throw new ShippoError(
        `Failed to create transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      )
    }
  }

  /**
   * Normalize address to Shippo format (supports both v2 and legacy field names)
   */
  private normalizeAddress(address: ShippoAddress): any {
    return {
      name: address.name,
      company: address.company,
      street1: address.street1,
      street2: address.street2,
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      phone: address.phone,
      email: address.email,
      // Also include v2 field names for compatibility
      address_line_1: address.street1,
      address_line_2: address.street2,
      city_locality: address.city,
      state_province: address.state,
      postal_code: address.zip,
      country_code: address.country,
    }
  }

  /**
   * Get configured origin address
   */
  getAddressFrom(): ShippoAddress {
    return {
      name: this.config.addressFrom.name,
      company: this.config.addressFrom.company,
      street1: this.config.addressFrom.street1,
      city: this.config.addressFrom.city,
      state: this.config.addressFrom.state,
      zip: this.config.addressFrom.zip,
      country: this.config.addressFrom.country,
      phone: this.config.addressFrom.phone,
      email: this.config.addressFrom.email,
    }
  }

  /**
   * Get parcel defaults
   */
  getParcelDefaults() {
    return this.config.parcelDefaults
  }
}

/**
 * Create Shippo client from environment variables
 */
export function createShippoClient(): ShippoClient {
  const apiToken = process.env.SHIPPO_API_TOKEN
  if (!apiToken) {
    throw new Error('SHIPPO_API_TOKEN environment variable is required')
  }

  const addressFrom = {
    name: process.env.SHIPPO_ADDRESS_FROM_NAME || 'Vici Peptides',
    company: process.env.SHIPPO_ADDRESS_FROM_COMPANY || 'Vici Peptides',
    street1: process.env.SHIPPO_ADDRESS_FROM_STREET1 || '',
    city: process.env.SHIPPO_ADDRESS_FROM_CITY || '',
    state: process.env.SHIPPO_ADDRESS_FROM_STATE || '',
    zip: process.env.SHIPPO_ADDRESS_FROM_ZIP || '',
    country: process.env.SHIPPO_ADDRESS_FROM_COUNTRY || 'US',
    phone: process.env.SHIPPO_ADDRESS_FROM_PHONE,
    email: process.env.SHIPPO_ADDRESS_FROM_EMAIL,
  }

  // Normalize country code
  if (addressFrom.country.length > 2) {
    const countryMap: Record<string, string> = {
      'united states': 'US',
      'united states of america': 'US',
      'usa': 'US',
    }
    addressFrom.country = countryMap[addressFrom.country.toLowerCase()] || 'US'
  }

  // Validate required address fields
  if (!addressFrom.street1 || !addressFrom.city || !addressFrom.state || !addressFrom.zip) {
    throw new Error('Missing required Shippo address_from environment variables: SHIPPO_ADDRESS_FROM_STREET1, SHIPPO_ADDRESS_FROM_CITY, SHIPPO_ADDRESS_FROM_STATE, SHIPPO_ADDRESS_FROM_ZIP')
  }

  const parcelDefaults = {
    distanceUnit: process.env.SHIPPO_PARCEL_DISTANCE_UNIT || 'in',
    massUnit: process.env.SHIPPO_PARCEL_MASS_UNIT || 'lb',
    defaultLength: parseFloat(process.env.SHIPPO_PARCEL_DEFAULT_LENGTH || '10'),
    defaultWidth: parseFloat(process.env.SHIPPO_PARCEL_DEFAULT_WIDTH || '8'),
    defaultHeight: parseFloat(process.env.SHIPPO_PARCEL_DEFAULT_HEIGHT || '6'),
    defaultWeight: parseFloat(process.env.SHIPPO_PARCEL_DEFAULT_WEIGHT || '1'), // 1 lb per item fallback
  }

  return new ShippoClient({
    apiToken,
    addressFrom,
    parcelDefaults,
  })
}
