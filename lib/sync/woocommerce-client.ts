/**
 * WooCommerce REST API Client
 * Server-side only - never expose credentials to browser
 */

interface WooCommerceConfig {
  storeUrl: string
  consumerKey: string
  consumerSecret: string
}

interface WooCommerceRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  params?: Record<string, string | number>
  body?: any
  retries?: number
  retryDelay?: number
}

export class WooCommerceClient {
  private config: WooCommerceConfig
  private baseUrl: string

  constructor(config: WooCommerceConfig) {
    this.config = config
    // Ensure store URL doesn't end with slash
    const cleanUrl = config.storeUrl.replace(/\/$/, '')
    this.baseUrl = `${cleanUrl}/wp-json/wc/v3`
  }

  /**
   * Make authenticated request to WooCommerce API
   */
  private async request<T>(
    endpoint: string,
    options: WooCommerceRequestOptions = {}
  ): Promise<T> {
    const {
      method = 'GET',
      params = {},
      body,
      retries = 3,
      retryDelay = 1000,
    } = options

    // Build URL with authentication
    const url = new URL(`${this.baseUrl}/${endpoint}`)
    
    // Add auth params (Basic Auth via query params for WooCommerce)
    url.searchParams.append('consumer_key', this.config.consumerKey)
    url.searchParams.append('consumer_secret', this.config.consumerSecret)
    
    // Add other query params
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value))
    })

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          const error = new Error(
            `WooCommerce API error: ${response.status} ${response.statusText} - ${errorText}`
          )
          ;(error as any).status = response.status
          throw error
        }

        return await response.json()
      } catch (error) {
        lastError = error as Error
        
        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && 'status' in error) {
          const status = (error as any).status
          if (status >= 400 && status < 500) {
            throw error
          }
        }

        // Retry with exponential backoff
        if (attempt < retries) {
          const delay = retryDelay * Math.pow(2, attempt)
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }
      }
    }

    throw lastError || new Error('Request failed after retries')
  }

  /**
   * Get a single order by ID
   */
  async getOrder(orderId: number): Promise<any> {
    return this.request(`orders/${orderId}`)
  }

  /**
   * Fetch all orders with pagination
   */
  async fetchOrders(options: {
    page?: number
    perPage?: number
    after?: string // ISO date string for modified_after
    before?: string // ISO date string for modified_before
  } = {}): Promise<{
    orders: any[]
    totalPages: number
    total: number
  }> {
    const { page = 1, perPage = 100, after, before } = options

    const params: Record<string, string | number> = {
      page,
      per_page: perPage,
      orderby: 'modified',
      order: 'asc',
    }

    if (after) {
      params.after = after
    }
    if (before) {
      params.before = before
    }

    const orders = await this.request<any[]>('orders', { params })

    // Get total pages from response headers (if available) or estimate
    // WooCommerce returns X-WP-TotalPages header, but we'll handle pagination manually
    const hasMore = orders.length === perPage

    return {
      orders,
      totalPages: hasMore ? page + 1 : page, // Will be updated as we paginate
      total: orders.length,
    }
  }

  /**
   * Fetch all products with pagination
   */
  async fetchProducts(options: {
    page?: number
    perPage?: number
    after?: string
    before?: string
  } = {}): Promise<{
    products: any[]
    totalPages: number
    total: number
  }> {
    const { page = 1, perPage = 100, after, before } = options

    const params: Record<string, string | number> = {
      page,
      per_page: perPage,
      orderby: 'modified',
      order: 'asc',
    }

    if (after) {
      params.after = after
    }
    if (before) {
      params.before = before
    }

    const products = await this.request<any[]>('products', { params })

    const hasMore = products.length === perPage

    return {
      products,
      totalPages: hasMore ? page + 1 : page,
      total: products.length,
    }
  }

  /**
   * Fetch all coupons with pagination
   */
  async fetchCoupons(options: {
    page?: number
    perPage?: number
    after?: string
    before?: string
  } = {}): Promise<{
    coupons: any[]
    totalPages: number
    total: number
  }> {
    const { page = 1, perPage = 100, after, before } = options

    const params: Record<string, string | number> = {
      page,
      per_page: perPage,
      orderby: 'modified',
      order: 'asc',
    }

    if (after) {
      params.after = after
    }
    if (before) {
      params.before = before
    }

    const coupons = await this.request<any[]>('coupons', { params })

    const hasMore = coupons.length === perPage

    return {
      coupons,
      totalPages: hasMore ? page + 1 : page,
      total: coupons.length,
    }
  }

  /**
   * WooCommerce Reports API - list available reports
   */
  async getReports(): Promise<any[]> {
    return this.request('reports')
  }

  /**
   * Sales report - total_sales, net_sales, total_orders, total_items, etc.
   * Params: period (week|month|last_month|year), date_min, date_max (YYYY-MM-DD)
   */
  async getSalesReport(params?: {
    period?: string
    date_min?: string
    date_max?: string
  }): Promise<any[]> {
    const query: Record<string, string> = {}
    if (params?.period) query.period = params.period
    if (params?.date_min) query.date_min = params.date_min
    if (params?.date_max) query.date_max = params.date_max
    return this.request('reports/sales', { params: query })
  }

  /**
   * Top sellers report - product_id, title, quantity
   * Params: period (week|month|last_month|year), date_min, date_max
   */
  async getTopSellersReport(params?: {
    period?: string
    date_min?: string
    date_max?: string
  }): Promise<Array<{ title: string; product_id: number; quantity: number }>> {
    const query: Record<string, string> = {}
    if (params?.period) query.period = params.period
    if (params?.date_min) query.date_min = params.date_min
    if (params?.date_max) query.date_max = params.date_max
    return this.request('reports/top_sellers', { params: query })
  }

  /**
   * Orders totals by status (pending, processing, completed, etc.)
   */
  async getOrdersTotalsReport(): Promise<Array<{ slug: string; name: string; total: number }>> {
    return this.request('reports/orders/totals')
  }

  /**
   * Products totals by type (simple, variable, etc.)
   */
  async getProductsTotalsReport(): Promise<Array<{ slug: string; name: string; total: number }>> {
    return this.request('reports/products/totals')
  }

  /**
   * Customers totals (paying, non_paying)
   */
  async getCustomersTotalsReport(): Promise<Array<{ slug: string; name: string; total: number }>> {
    return this.request('reports/customers/totals')
  }

  /**
   * Coupons totals by type
   */
  async getCouponsTotalsReport(): Promise<Array<{ slug: string; name: string; total: number }>> {
    return this.request('reports/coupons/totals')
  }

  /**
   * Reviews totals by rating
   */
  async getReviewsTotalsReport(): Promise<Array<{ slug: string; name: string; total: number }>> {
    return this.request('reports/reviews/totals')
  }

  /**
   * Fetch all pages of a resource (handles pagination automatically)
   */
  async fetchAllPages<T>(
    fetchFn: (page: number) => Promise<{ [key: string]: T[] | number; totalPages: number }>,
    resourceName: string
  ): Promise<T[]> {
    const allItems: T[] = []
    let currentPage = 1
    let hasMore = true

    while (hasMore) {
      const result = await fetchFn(currentPage)
      const items = result[resourceName] as T[]
      
      if (items.length === 0) {
        hasMore = false
        break
      }

      allItems.push(...items)

      // Check if we've reached the last page
      if (items.length < 100 || currentPage >= result.totalPages) {
        hasMore = false
      } else {
        currentPage++
      }

      // Safety limit to prevent infinite loops
      if (currentPage > 1000) {
        console.warn(`Reached safety limit of 1000 pages for ${resourceName}`)
        break
      }
    }

    return allItems
  }
}
