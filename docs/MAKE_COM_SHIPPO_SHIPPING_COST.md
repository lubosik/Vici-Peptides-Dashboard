# Make.com + Shippo: Fetch label cost and sync to dashboard

This doc describes how to build the Make.com scenario that receives an order from the dashboard, fetches the Shippo label cost, and writes it back to the Orders tab (and optionally to Expenses without duplicates).

## 1. Dashboard → Make.com (when you click "Fetch from Shippo")

- **Where:** Order detail page → **Fetch from Shippo** button.
- **What happens:** The dashboard sends a **POST** to your Make.com webhook with the order details.

**Webhook URL:** `https://hook.us2.make.com/9l9y4ysr3hcvak6rpf29oej4bi5fuvko`

**Payload (JSON):**
```json
{
  "order_number": "Order #2654",
  "woo_order_id": 2654,
  "shippo_transaction_object_id": "abc123..."
}
```

- `shippo_transaction_object_id` may be missing if the order was not created via Shippo or the ID was not stored.

---

## 2. Make.com scenario (recommended flow)

### Step 1: Webhook trigger

- **Module:** Webhooks → **Custom webhook**.
- **URL:** Use the same URL as above (or create one in Make.com and put that URL in dashboard env `MAKE_COM_SHIPPO_WEBHOOK_URL`).
- **Output:** `order_number`, `woo_order_id`, `shippo_transaction_object_id`.

### Step 2: Get label cost from Shippo

You need the **label cost** (what Shippo charges you) for this order.

**Option A – You have `shippo_transaction_object_id` (recommended)**

1. **Shippo – Get a transaction**
   - **Transaction ID:** `{{shippo_transaction_object_id}}` from the webhook.
   - Shippo returns the transaction object.

2. **Get the rate (for amount)**
   - The transaction object has a **`rate`** field (the rate object ID).
   - Use **Shippo – Get a rate** with that rate ID, or read the amount from the transaction if your Shippo app returns it (e.g. under `billing` or a nested rate).
   - The **amount** (and currency) of that rate is the label cost.

**Option B – No transaction ID (e.g. label created outside dashboard)**

1. **Shippo – List transactions**
   - Use filters (e.g. date range, metadata/reference if you store `order_number` or `woo_order_id`).
2. **Iterator** over the list and **find** the transaction that matches this order (e.g. by metadata or a custom reference).
3. From the matching transaction, get the **rate** and then the **amount** as in Option A.

(If your WooCommerce/Shippo integration stores the Shippo transaction ID on the order, prefer storing it in the dashboard so Option A is always used.)

### Step 3: Call dashboard back (set shipping cost)

- **Module:** HTTP – **Make a request**.
- **URL:** `https://dashboard.vicipeptides.com/api/webhooks/order-shipping-cost`
- **Method:** POST  
- **Headers:**
  - `Content-Type: application/json`
  - `x-api-key: YOUR_WEBHOOK_API_KEY` (same as other dashboard webhooks)
- **Body (JSON):**
```json
{
  "order_id": "{{woo_order_id}}",
  "order_number": "{{order_number}}",
  "shipping_cost": "{{amount from Shippo rate}}",
  "create_expense": true
}
```

- **`order_id`:** numeric WooCommerce order ID (e.g. `2654`).
- **`order_number`:** string (e.g. `Order #2654`). Send at least one of `order_id` or `order_number`.
- **`shipping_cost`:** number (label cost from Shippo).
- **`create_expense`:** `true` = also create an expense row if there isn’t already one for this order + shipping (no duplicates). `false` = only update the order.

---

## 3. Dashboard callback API

**POST** `https://dashboard.vicipeptides.com/api/webhooks/order-shipping-cost`

- **Auth:** Header `x-api-key` = your `WEBHOOK_API_KEY`.
- **Body:** `order_id` (number) and/or `order_number` (string), `shipping_cost` (number), optional `create_expense` (boolean, default false).

**Behavior:**

- Finds the order by `woo_order_id` or `order_number`.
- Updates **Orders** tab: sets `shipping_cost`, `shipping_cost_source`, `shipping_cost_last_synced_at` on that order.
- If `create_expense: true`: checks for an existing expense with same `order_number` and `category: 'shipping'`; if none, inserts one (so no duplicates). New expenses appear on the **Expenses** tab.

---

## 4. Flow summary

1. User opens an order in the dashboard and clicks **Fetch from Shippo**.
2. Dashboard POSTs the order (order_number, woo_order_id, shippo_transaction_object_id) to your Make.com webhook.
3. Make.com gets the Shippo transaction (and rate if needed) and reads the label cost.
4. Make.com POSTs to `.../api/webhooks/order-shipping-cost` with `order_id`/`order_number`, `shipping_cost`, and optionally `create_expense: true`.
5. Dashboard updates the order’s shipping cost and, if requested, adds one expense when there wasn’t one already.

---

## 5. Optional: env for webhook URL

In Vercel (or `.env.local`), you can set:

- `MAKE_COM_SHIPPO_WEBHOOK_URL=https://hook.us2.make.com/9l9y4ysr3hcvak6rpf29oej4bi5fuvko`

If set, the **Fetch from Shippo** button uses this URL instead of the default. Useful if you create a new webhook in Make.com.
