# Make.com: Adjust product stock levels

Use this API to set **starting quantity** (inventory level) for a product. After you set it, **current stock** is computed as `starting_qty - qty_sold`. When new orders come in, line items are added to `order_lines`, and the dashboard automatically decreases **current stock** by the quantity ordered for each product.

## Endpoint

- **Method:** `PATCH`
- **URL:** `https://dashboard.vicipeptides.com/api/products/{productId}/stock`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):** at least one of:
  - `starting_qty` (number) – set inventory level for this product
  - `stockStatus` (string) – `"In Stock"` or `"OUT OF STOCK"` (dashboard toggle)

Replace `{productId}` with the product’s `product_id` (e.g. from the Products table or your mapping).

## Example: set stock level from Make.com

**URL:**  
`https://dashboard.vicipeptides.com/api/products/123/stock`

**Request:**
- Method: **PATCH**
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "starting_qty": 50
}
```

**Response (200):**
```json
{
  "success": true,
  "product_id": 123,
  "stock_status_override": null,
  "display_status": "In Stock",
  "starting_qty": 50,
  "current_stock": 50,
  "qty_sold": 0
}
```

If the product already has `qty_sold` (e.g. 10), then `current_stock` will be `starting_qty - qty_sold` (e.g. 40).

## Optional: set both stock level and status

```json
{
  "starting_qty": 20,
  "stockStatus": "In Stock"
}
```

## Authentication

If your dashboard is behind login, you must send the same session cookie or auth header that the browser uses. If you use Vercel / basic auth, configure the HTTP module in Make.com with the required auth (e.g. Basic Auth or cookie).

## When an order comes in

Orders are ingested via your webhook (e.g. Make.com or Supabase Edge). When line items are inserted into `order_lines`, the database trigger recalculates for each product:

- `qty_sold` = sum of `qty_ordered` for that product
- `current_stock` = `starting_qty` - `qty_sold`

So stock levels decrease automatically per order line; no extra API call is needed for that.
