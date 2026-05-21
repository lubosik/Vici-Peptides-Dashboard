-- Add ShipStation / tracking fields to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS shipstation_shipment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number)
  WHERE tracking_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shipped_at ON orders(shipped_at)
  WHERE shipped_at IS NOT NULL;
