# Make.com → Dashboard: Update order status (real time)

When an order is updated in WooCommerce, you can push **only the new status** to the dashboard so the Orders tab and Dashboard KPIs stay in sync.

## Endpoint

**PATCH** `https://dashboard.vicipeptides.com/api/orders/{orderId}/status`

- **orderId** = numeric WooCommerce order ID (e.g. `2539`), in the URL path.

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

## Example (Make.com HTTP module)

1. **URL:** `https://dashboard.vicipeptides.com/api/orders/{{woo_order_id}}/status`  
   (Map `woo_order_id` from “WooCommerce – Get an order” or your trigger.)
2. **Method:** PATCH  
3. **Headers:**
   - `Content-Type`: `application/json`
   - `x-api-key`: your `WEBHOOK_API_KEY` (from Make.com secrets or env)
4. **Body:**

```json
{
  "order_status": "{{woo_order_status}}"
}
```

Map `woo_order_status` from WooCommerce (e.g. `completed`, `processing`, `cancelled`). Use lowercase.

## Response

- **200:**  
  `{ "success": true, "message": "Order Order #2539 status updated to \"completed\".", "order_number": "Order #2539", "woo_order_id": 2539, "order_status": "completed" }`  
- **400:** Invalid body or status (see `error` in response).  
- **401:** Missing or wrong API key.  
- **404:** No order with that ID in the dashboard.

After a successful PATCH, the dashboard invalidates the Orders list and the home Dashboard, so the next load shows the updated status and KPIs.

## Manual update in the dashboard

You can also change an order’s status from the dashboard: open the order detail page, choose a new status in the dropdown, and click **Update Status**. The same revalidation runs so the Orders tab and Dashboard stay in sync.
