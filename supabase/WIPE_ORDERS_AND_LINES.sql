-- One-time wipe: orders and order_lines. Expenses are kept.
-- Run this in Supabase SQL Editor when you want a clean slate for orders.

-- Delete line items first (FK to orders)
DELETE FROM order_lines;

-- Delete orders
DELETE FROM orders;

-- Optional: reset sequences if your table uses them for surrogate keys
-- ALTER SEQUENCE orders_id_seq RESTART WITH 1;
-- ALTER SEQUENCE order_lines_line_id_seq RESTART WITH 1;
