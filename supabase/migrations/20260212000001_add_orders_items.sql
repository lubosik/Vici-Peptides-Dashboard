-- Items column: number of line items per order (set by webhook)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items INTEGER DEFAULT 0;
COMMENT ON COLUMN orders.items IS 'Number of line items; set by webhook';
