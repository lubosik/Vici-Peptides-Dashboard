-- Manual stock status override (dashboard only; no API calls).
-- When set, UI uses this instead of trigger-computed stock_status.
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_status_override TEXT;
COMMENT ON COLUMN products.stock_status_override IS 'Manual In Stock / OUT OF STOCK from dashboard; NULL = use computed stock_status';
