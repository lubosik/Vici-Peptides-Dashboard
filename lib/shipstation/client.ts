/**
 * ShipStation API Client
 * Auth: Basic auth — API key as username, secret as password
 * Base URL: https://ssapi.shipstation.com
 */

const SHIPSTATION_BASE = 'https://ssapi.shipstation.com'

export interface ShipStationShipment {
  shipmentId: number
  orderId: number
  orderKey: string
  orderNumber: string
  createDate: string
  shipDate: string
  shipmentCost: number
  trackingNumber: string
  voided: boolean
  carrierCode: string
  serviceCode: string
  warehouseId: number | null
}

export interface ShipStationShipmentsResponse {
  shipments: ShipStationShipment[]
  total: number
  page: number
  pages: number
}

export interface ShipStationWebhook {
  WebHookID: number
  Name: string
  ServiceAttribute: string
  SellerID: number
  StoreID: number | null
  HookURL: string
  Active: boolean
  UIPropertyName: string | null
}

export class ShipStationClient {
  private authHeader: string

  constructor(apiKey: string, apiSecret: string) {
    this.authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  }

  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`ShipStation API error ${response.status} ${response.statusText}: ${body}`)
    }

    return response.json() as Promise<T>
  }

  /** Fetch the resource_url from a SHIP_NOTIFY webhook payload */
  async fetchResourceUrl(url: string): Promise<ShipStationShipmentsResponse> {
    return this.request<ShipStationShipmentsResponse>(url)
  }

  /** List all registered webhooks */
  async listWebhooks(): Promise<{ webhooks: ShipStationWebhook[] }> {
    return this.request<{ webhooks: ShipStationWebhook[] }>(
      `${SHIPSTATION_BASE}/webhooks`
    )
  }

  /** Register a new SHIP_NOTIFY webhook */
  async registerWebhook(
    targetUrl: string,
    friendlyName = 'Vici Dashboard – Ship Notify'
  ): Promise<{ id: number }> {
    return this.request<{ id: number }>(`${SHIPSTATION_BASE}/webhooks/subscribe`, {
      method: 'POST',
      body: JSON.stringify({
        target_url: targetUrl,
        event: 'SHIP_NOTIFY',
        friendly_name: friendlyName,
      }),
    })
  }

  /** Delete a registered webhook by ID */
  async deleteWebhook(webhookId: number): Promise<void> {
    await fetch(`${SHIPSTATION_BASE}/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: { Authorization: this.authHeader },
    })
  }
}

export function createShipStationClient(): ShipStationClient {
  const apiKey = process.env.SHIPSTATION_API_KEY
  const apiSecret = process.env.SHIPSTATION_API_SECRET
  if (!apiKey || !apiSecret) {
    throw new Error(
      'SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET environment variables are required'
    )
  }
  return new ShipStationClient(apiKey, apiSecret)
}
