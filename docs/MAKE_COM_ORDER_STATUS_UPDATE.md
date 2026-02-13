# Make.com → Dashboard: Update order status (real time)

When an order is updated in WooCommerce, you can push **only the new status** to the dashboard so the Orders tab and Dashboard KPIs stay in sync.

## Recommended: single URL (no order ID in path)

**POST** or **PATCH** `https://dashboard.vicipeptides.com/api/orders/update-status`

- **URL:** One fixed URL; no dynamic segments.
- **Body:** `{ "order_id": 2654, "order_status": "completed" }` — pass the numeric order ID and status in the body.

Use this if you get 404 on the path-based endpoint (e.g. after a new deploy or to avoid dynamic URL issues in Make.com).

## Alternative: order ID in path

**PATCH** `https://dashboard.vicipeptides.com/api/orders/{orderNumber}/status`

- **orderNumber** = numeric WooCommerce order ID (e.g. `2539`) in the URL path.

## Auth

Same API key as the order webhook:

- **Header:** `x-api-key: YOUR_WEBHOOK_API_KEY`
- **Or query:** `?api_key=YOUR_WEBHOOK_API_KEY`

## Request

- **Method:** PATCH  
- **URL:** `https://dashboard.vicipeptides.com/api/orders/2539/status` (replace `2539` with the order ID)  
- **Headers:**
  - `Content-Type: application/json`
  - `x-api-key: YOUR_WEBHOOK_API_KEY`
- **Body (JSON):**

```json
{
  "order_status": "completed"
}
```

You can use `"status"` instead of `"order_status"` if you prefer; both are accepted.

## Allowed statuses

- `pending`
- `processing`
- `completed`
- `on-hold`
- `cancelled`
- `refunded`
- `failed`
- `checkout-draft`
- `draft`

## Example (Make.com HTTP module) — recommended

1. **URL:** `https://dashboard.vicipeptides.com/api/orders/update-status`  
   (Single static URL; no order ID in the path.)
2. **Method:** **POST** or **PATCH**
3. **Headers:**
   - `Content-Type`: `application/json`
   - `x-api-key`: your `WEBHOOK_API_KEY` (from Make.com credentials, e.g. "Dashboard API key")
4. **Body:**

```json
{
  "order_id": "{{2.ID}}",
  "order_status": "{{6.Status}}"
}
```

Map:
- `order_id` from your WooCommerce module (e.g. **2. ID** — the numeric order ID).
- `order_status` from the status field (e.g. **6. Status**). Use lowercase values: `completed`, `processing`, `cancelled`, etc.

This avoids 404s from dynamic URLs and works as soon as the dashboard is deployed.

## Troubleshooting (404 Not Found)

- **Use the static URL:** Prefer **POST** `https://dashboard.vicipeptides.com/api/orders/update-status` with body `{ "order_id": ..., "order_status": ... }`. No order ID in the path, so no 404 from wrong or unmapped path.
- **If you use the path-based URL** (`/api/orders/2654/status`): Remove any spaces; use the **mapped** numeric order ID, not the label "Object ID". Ensure the latest dashboard code is **deployed** (the route was added recently).
- **API key:** Add header `x-api-key` with your `WEBHOOK_API_KEY` (e.g. "Dashboard API key" in Make.com); otherwise you get 401.

## Response

- **200:**  
  `{ "success": true, "message": "Order Order #2539 status updated to \"completed\".", "order_number": "Order #2539", "woo_order_id": 2539, "order_status": "completed" }`  
- **400:** Invalid body or status (see `error` in response).  
- **401:** Missing or wrong API key.  
- **404:** No order with that ID in the dashboard.

After a successful PATCH, the dashboard invalidates the Orders list and the home Dashboard, so the next load shows the updated status and KPIs.

## Manual update in the dashboard

You can also change an order’s status from the dashboard: open the order detail page, choose a new status in the dropdown, and click **Update Status**. The same revalidation runs so the Orders tab and Dashboard stay in sync.
