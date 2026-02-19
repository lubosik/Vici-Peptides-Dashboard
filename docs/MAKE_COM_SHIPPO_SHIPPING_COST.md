# Make.com + Shippo: Fetch label cost and sync to dashboard

This doc describes how to build the Make.com scenario that receives an order from the dashboard, fetches the Shippo label cost (without needing a transaction object ID), and writes it back to the Orders tab and Expenses tab (one expense per order, no duplicates).

## 1. When the dashboard sends an order to Make.com

- You **click "Fetch from Shippo"** on the order detail page when you’re ready (e.g. after the label has been purchased). The dashboard then POSTs that order to the Make.com webhook. Labels are bought shortly after orders come in, so triggering manually avoids calling before the label exists in Shippo.

**Webhook URL:** `https://hook.us2.make.com/9l9y4ysr3hcvak6rpf29oej4bi5fuvko` (or set `MAKE_COM_SHIPPO_WEBHOOK_URL` in env)

**Payload (JSON):**
```json
{
  "order_number": "#2654",
  "woo_order_id": 2654,
  "shippo_transaction_object_id": null
}
```

- **`order_number`** is always sent with a hashtag first then the numeric ID (e.g. `#2654`), never `Order #2654`. Use this when matching in Shippo (e.g. Shippo order_number `#2654`).
- **We do not have** `shippo_transaction_object_id` from order details. Use the **Shippo Orders API** flow below to get the label cost by matching on `order_number` / WooCommerce order ID.

---

## 2. Make.com scenario: get label cost without transaction ID

### Step 1: Webhook trigger

- **Module:** Webhooks → **Custom webhook**.
- **Output:** `order_number` (e.g. `Order #2654`), `woo_order_id` (e.g. `2654`). Ignore `shippo_transaction_object_id` for this flow.

### Step 2: Get label cost from Shippo (Orders API – no transaction ID needed)

Shippo’s **Orders API** returns orders with an `order_number` (e.g. `#2654`) that you can match to the dashboard’s `order_number` (`Order #2654`). Each Shippo order has a `transactions` array (transaction object IDs). The **actual label cost** is the `rate.amount` from each transaction (what you pay Shippo), not the order’s `shipping_cost` (what the buyer pays).

**Steps in Make.com:**

1. **Shippo – List orders**
   - Optional: use `start_date` / `end_date` to limit results (e.g. last 30 days).
   - Page size: e.g. 100. You’ll iterate to find the matching order.

2. **Find the order that matches this WooCommerce order**
   - Normalize for comparison: dashboard sends `Order #2654`, Shippo may have `#2654` or `2654`.
   - From dashboard `order_number` extract the number: e.g. `Order #2654` → `2654`.
   - From each Shippo order’s `order_number` extract the number: e.g. `#2654` → `2654`.
   - Match when these numeric parts are equal (and optionally same `woo_order_id` if Shippo stores it in metadata).

3. **Get the label cost from that order’s transactions**
   - The matching Shippo order has a **`transactions`** array (list of transaction object IDs).
   - For **each** transaction ID in `transactions`:
     - **Shippo – Get a transaction** with that ID.
     - The response has a **`rate`** field (either a rate object ID string or an object with `amount`).
     - If `rate` is a string (ID): use **Shippo – Get a rate** with that ID and read **`amount`**.
     - If `rate` is an object with `amount`: use that **`amount`**.
   - **Sum** the amounts for all transactions (one order can have multiple labels). That sum is the **shipping cost** (what you pay Shippo) for this order.

4. **If no matching Shippo order is found**
   - You can skip calling the dashboard (no cost to set), or call with `shipping_cost: 0` and no expense. Your choice.

**Important:** Use the transaction’s **rate amount** (label cost), not the Shippo order’s `shipping_cost` field (that’s the storefront rate the buyer pays).

### Step 3: Call dashboard back (set shipping cost and expense)

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
  "shipping_cost": "{{sum of Shippo transaction rate amounts}}",
  "create_expense": true
}
```

- **`order_id`:** numeric WooCommerce order ID (e.g. `2654`).
- **`order_number`:** string (e.g. `Order #2654`). Send at least one of `order_id` or `order_number`.
- **`shipping_cost`:** number (label cost from Shippo – sum of rate amounts for that order’s transactions).
- **`create_expense`:** Send **`true`** so the dashboard adds a shipping expense for this order if one doesn’t exist. Each order gets **one** expense row (no duplicates). Default in the dashboard is `true` if omitted.

---

## 3. Dashboard callback API

**POST** `https://dashboard.vicipeptides.com/api/webhooks/order-shipping-cost`

- **Auth:** Header `x-api-key` = your `WEBHOOK_API_KEY`.
- **Body:** `order_id` (number) and/or `order_number` (string), `shipping_cost` (number), optional `create_expense` (boolean; **default true**).

**Behavior:**

- Finds the order by `woo_order_id` or `order_number`.
- Updates **Orders** tab: sets `shipping_cost`, `shipping_cost_source`, `shipping_cost_last_synced_at` on that order.
- **Expenses tab:** If there is no existing expense for this order with `category: 'shipping'`, the dashboard creates one (one expense per order). So as Shippo costs come in, the Expenses tab stays in sync without duplicates.

---

## 4. Flow summary

1. When you’re ready (e.g. after the label is purchased), you open the order and click **Fetch from Shippo**.
2. Dashboard POSTs the order (`order_number`, `woo_order_id`) to your Make.com webhook.
3. Make.com uses **Shippo Orders API**: list orders, find order matching `order_number`, get each transaction’s rate amount, sum them.
4. Make.com POSTs to `.../api/webhooks/order-shipping-cost` with `order_id`/`order_number`, `shipping_cost`, and `create_expense: true`.
5. Dashboard updates the order’s shipping cost and ensures the Expenses tab has one shipping expense for that order (creates only if missing).

---

## 5. Env (optional)

- **Note:** The "Fetch from Shippo" button has been removed. Use Zapier (or Make.com) to trigger the flow.
