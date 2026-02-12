# Make.com: Adjust product stock and retail price

Use this API to set **starting quantity**, **retail price**, and/or **stock status** for a product. The response **always includes `product_id`, `product_name`, and `sku_code`** so you can confirm you’re updating the right product.

## Endpoint

- **Method:** `PATCH`
- **URL:** `https://dashboard.vicipeptides.com/api/products/{productId}/stock`
- **Headers:** `Content-Type: application/json`, `x-api-key: YOUR_WEBHOOK_API_KEY`
- **Body (JSON):** at least one of:
  - `starting_qty` (number) – inventory on hand; `current_stock` = `starting_qty` - `qty_sold`
  - `qty_sold` (number) – override quantity sold (e.g. after manual correction)
  - `retail_price` (number) – regular price
  - `sale_price` (number or `null`) – when set, used for revenue/margin/profit; `null` = N/A (use retail)
  - `stockStatus` (string) – `"In Stock"` or `"OUT OF STOCK"`

Replace `{productId}` with the product’s **product_id** (from the dashboard Products table).

## Confirming the right product

Every successful response includes:

- **product_id** – ID you sent in the URL
- **product_name** – full name (e.g. "NAD+ 500mg")
- **sku_code** – SKU (e.g. "NJ500")

Check these in the response to ensure you updated the correct product. If the ID is wrong, you get **404** with a clear message:

```json
{
  "error": "Product not found",
  "product_id": 999,
  "message": "No product with product_id 999. Check the ID and try again."
}
```

## Example: set stock level

**URL:**  
`https://dashboard.vicipeptides.com/api/products/123/stock`

**Request:** PATCH, Body:
```json
{
  "starting_qty": 50
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Updated product: NAD+ 500mg (SKU: NJ500)",
  "product_id": 123,
  "product_name": "NAD+ 500mg",
  "sku_code": "NJ500",
  "variant_strength": "500mg",
  "stock_status_override": null,
  "display_status": "In Stock",
  "starting_qty": 50,
  "current_stock": 50,
  "qty_sold": 0,
  "retail_price": 89,
  "our_cost": 9
}
```

## Example: set retail price (and optionally stock)

**Request:** PATCH, Body:
```json
{
  "retail_price": 89.00
}
```

Or set several fields at once:
```json
{
  "starting_qty": 20,
  "retail_price": 89,
  "stockStatus": "In Stock"
}
```

## Full request: send everything for one product

To set all fields in one call (e.g. from Make.com after syncing from WooCommerce):

**URL:** `https://dashboard.vicipeptides.com/api/products/{productId}/stock`

**Method:** `PATCH`

**Headers:**
- `Content-Type: application/json`
- `x-api-key: YOUR_WEBHOOK_API_KEY`

**Body (example):**
```json
{
  "starting_qty": 50,
  "qty_sold": 0,
  "retail_price": 89,
  "sale_price": 79,
  "stockStatus": "In Stock"
}
```

- Use **sale_price** when the product is on sale (revenue/margin/profit use this). Use **sale_price: null** or omit it when there is no sale (then retail_price is used).
- **starting_qty** = inventory on hand; **qty_sold** = total sold (current_stock is computed as starting_qty - qty_sold).

**Response (200):** includes `product_id`, `product_name`, `sku_code`, `starting_qty`, `current_stock`, `qty_sold`, `retail_price`, `sale_price`, `our_cost`, etc.

## Authentication (same as orders webhook)

Use the **same API key** as your orders webhook. In Vercel you have this set as **WEBHOOK_API_KEY**.

- **Header (recommended):** `x-api-key: YOUR_WEBHOOK_API_KEY`
- **Or query param:** `?api_key=YOUR_WEBHOOK_API_KEY`

In Make.com, add a header to your HTTP request:
- Name: `x-api-key`
- Value: your API key (the same value as in Vercel → Environment Variables → WEBHOOK_API_KEY)

Without a valid key, the API returns **401 Unauthorized**.

## When an order comes in

Orders are ingested via your webhook (e.g. Make.com or Supabase Edge). When line items are inserted into `order_lines`, the database trigger recalculates for each product:

- `qty_sold` = sum of `qty_ordered` for that product
- `current_stock` = `starting_qty` - `qty_sold`

So stock levels decrease automatically per order line; no extra API call is needed for that.
