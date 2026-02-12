# Make.com → Dashboard Order Webhook

## 1. Where to get the Webhook API key

**You create it yourself.** It’s a secret string that only your app and Make.com should know.

- **Generate one** (any long random string), for example:
  - In Terminal: `openssl rand -base64 32`
  - Or use a password generator and copy a long string (e.g. 32+ characters).
- **Set it in three places:**
  1. **Dashboard (local):** In the project’s `.env.local`, add:  
     `WEBHOOK_API_KEY=your_generated_key_here`
  2. **Dashboard (production):** In Vercel (or your host) → Project → Settings → Environment Variables, add `WEBHOOK_API_KEY` with the same value.
  3. **Make.com:** In your scenario, in the HTTP module that calls the dashboard, set the header `x-api-key` to this same value.

If `WEBHOOK_API_KEY` is not set in the dashboard, the webhook accepts any request (useful only for local/testing).

---

## 2. How to send the request from Make.com

**Direction of data:** WooCommerce → Make.com → **Make.com sends** an HTTP request **to** the dashboard.

1. In Make.com, create a scenario that runs when a WooCommerce order is created/updated (e.g. **WooCommerce – Watch orders** or **WooCommerce – Get an Order**).
2. Add a module **HTTP – Make a request**:
   - **URL:** `https://dashboard.vicipeptides.com/api/webhooks/order`
   - **Method:** POST
   - **Headers:**
     - `Content-Type`: `application/json`
     - `x-api-key`: `YOUR_WEBHOOK_API_KEY` (the same value you set in the dashboard)
   - **Body type:** Raw / JSON
   - **Request content:** Map the **full WooCommerce order object** from the previous step (e.g. from “WooCommerce – Get an Order”) into the body. You can pass the whole order object; no need to build it field by field if your connector already returns the full order.

So **Make.com sends the API request** to the dashboard; the dashboard does not call Make.com.

---

## 3. Line items: use an array (one row per product)

- **Best approach:** Send **one order per request**, with a **`line_items` array** in the body. Each element in `line_items` is one product line (1 item, 3 items, 5 items—any number). Do **not** bundle line items into a single text string; keep them as separate objects in the array.
- **What the dashboard does:** The webhook reads `body.line_items` and inserts **one row in `order_lines` per array element**. So:
  - 1 product → 1 row  
  - 3 products → 3 rows  
  - 5 products → 5 rows  
  Each row gets its own cost (from `product_cost_lookup` by product name + strength), and margin/profit are computed per line.
- **Required per line item:** `id`, `name`, `product_id`, `quantity`, `price`, `total`, and optionally `sku`. Same shape as WooCommerce’s “Get an Order” response.

**Example body shape** (what Make.com sends):

```json
{
  "id": 12345,
  "number": "12345",
  "status": "processing",
  "total": "299.00",
  "shipping_total": "9.99",
  "discount_total": "0",
  "currency": "USD",
  "date_created": "2026-02-11T20:00:00",
  "billing": { "first_name": "Jane", "last_name": "Doe", "email": "jane@example.com" },
  "line_items": [
    { "id": 1, "name": "Retatrutide - 20mg", "product_id": 180, "quantity": 1, "price": 145, "total": "145.00", "sku": "RT20" },
    { "id": 2, "name": "Tirzepatide - 10mg", "product_id": 181, "quantity": 2, "price": 77, "total": "154.00", "sku": "TZ10" }
  ]
}
```

Two entries in `line_items` → two rows in the dashboard for that order, each with its own cost, profit, and margin.

**Critical – valid JSON:** `line_items` **must be a JSON array** (wrapped in square brackets `[ ... ]`). If you send two objects without brackets, the whole request is invalid and you’ll get “not valid JSON” or “Expected double-quoted property name”.

- **Valid:** `"line_items": [ {"id":538,"name":"Bac Water - 10ml",...}, {"id":539,"name":"Retatrutide - 30mg",...} ]`
- **Invalid:** `"line_items": {"id":538,...}, {"id":539,...}` (no `[ ]`)

In Make.com, map the array from the WooCommerce module (e.g. “Line items” as an array), or ensure your JSON string uses `[ ]` around the list of line items. The webhook accepts both `product_id` and `productId` for each line item.

---

## 4. Margin and profit per line item

- **Already supported.** For each line the webhook:
  - Looks up cost from `product_cost_lookup` (by product name + strength).
  - Computes **line cost** (cost × quantity), **line total** (revenue), and **line profit** (total − cost).
  - Writes one `order_lines` row per item with those values. The order detail page shows each line with **Cost**, **Total**, **Profit**, and **Margin %**.
- Order-level totals (order profit, order margin) are derived from the sum of all line items for that order.

No extra step is needed: send the `line_items` array as above and each product appears as its own row with correct margin and profit.

---

## Quick reference

| Item | Value |
|------|--------|
| **URL** | `https://dashboard.vicipeptides.com/api/webhooks/order` |
| **Method** | POST |
| **Headers** | `Content-Type: application/json`, `x-api-key: YOUR_WEBHOOK_API_KEY` (required; dashboard only checks this header or `api_key` query) |
| **Body** | Full WooCommerce order object including **`line_items` array** |
| **Line items** | One object per product; dashboard creates one row per object. |

**Make.com gotcha:** Map `number` to the **order number** (or order ID), not Billing Phone. Otherwise the dashboard shows "Order #+1555123456" etc.

**Test (replace YOUR_KEY):**

```bash
curl -X POST https://dashboard.vicipeptides.com/api/webhooks/order \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_KEY" \
  -d '{"id":9999,"number":"9999","status":"processing","total":"145.00","shipping_total":"9.99","discount_total":"0","date_created":"2026-02-11T23:00:00","billing":{"first_name":"Test","last_name":"User","email":"test@test.com"},"line_items":[{"id":1,"name":"Retatrutide - 20mg","product_id":180,"quantity":1,"price":145,"total":"145.00","sku":"RT20"}]}'
```

**Wipe orders (one-time, in Supabase SQL Editor):**  
Run `supabase/WIPE_ORDERS_AND_LINES.sql` to delete all orders and order_lines (expenses are kept).
