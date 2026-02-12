-- Clean Slate: product_cost_lookup table + missing columns for Make.com webhook
-- Run WIPE (DELETE orders/order_lines) separately in SQL Editor if desired — not included here.

-- 1) Product cost lookup — SOURCE OF TRUTH for cost by product name + strength
CREATE TABLE IF NOT EXISTS product_cost_lookup (
  id SERIAL PRIMARY KEY,
  product_name TEXT NOT NULL,
  strength TEXT NOT NULL,
  cost_per_unit NUMERIC(10,2) NOT NULL,
  base_price NUMERIC(10,2),
  UNIQUE(product_name, strength)
);

-- Clear and seed (idempotent: delete then insert)
DELETE FROM product_cost_lookup;

INSERT INTO product_cost_lookup (product_name, strength, cost_per_unit, base_price) VALUES
  ('MOTS-C', '10mg', 7, 49),
  ('MOTS-C', '40mg', 23, 155),
  ('NAD+', '100mg', 5, 35),
  ('NAD+', '500mg', 9, 89),
  ('NAD+', '1000mg', 17, 155),
  ('Glutathione', '600mg', 6, 39),
  ('Glutathione', '1500mg', 16, 89),
  ('Retatrutide', '10mg', 13, 85),
  ('Retatrutide', '20mg', 21, 145),
  ('Retatrutide', '30mg', 27, 195),
  ('Semaglutide', '10mg', 6, 49),
  ('Semaglutide', '20mg', 9, 95),
  ('Tirzepatide', '10mg', 7, 59),
  ('Tirzepatide', '20mg', 11, 99),
  ('Tirzepatide', '30mg', 16, 139),
  ('Tirzepatide', '60mg', 23, 225),
  ('L-carnitine', '600mg 10ml', 6, 25),
  ('L-carnitine', '1200mg 10ml', 12, 39),
  ('BPC-157', '10mg', 5, 59),
  ('BPC-157 + TB-500', '10mg + 10mg', 20, 109),
  ('GHK-Cu', '50mg', 5, 39),
  ('GHK-Cu', '100mg', 9, 79),
  ('GLOW', '70mg', 23, 135),
  ('KLOW', '80mg', 24, 159),
  ('TB-500', '10mg', 8, 95),
  ('CJC-1295 without DAC', '10mg', 19, 89),
  ('CJC-1295 (without DAC) + IPA', '10mg', 12, 89),
  ('IGF-1LR3', '1mg', 20, 85),
  ('Tesamorelin', '10mg', 19, 89),
  ('HCG', '5000iu', 5, 39),
  ('HCG', '10000iu', 8, 69),
  ('Ipamorelin', '10mg', 8, 59),
  ('Semax', '10mg', 8, 49),
  ('Selank', '10mg', 8, 49),
  ('Melanotan I', '10mg', 6, 45),
  ('Melanotan II', '10mg', 6, 45),
  ('Bac Water', '3ml', 2, 10),
  ('Bac Water', '10ml', 3, 20);

-- 2) Orders: add currency if missing
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- 3) Order lines: ensure woo_product_id and name/sku exist (from earlier migration; safe to repeat with IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_lines' AND column_name = 'woo_product_id') THEN
    ALTER TABLE order_lines ADD COLUMN woo_product_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_lines' AND column_name = 'product_name') THEN
    ALTER TABLE order_lines ADD COLUMN product_name TEXT;
  END IF;
END $$;

-- 4) Products: ensure strength column (variant_strength exists; add strength as alias or use variant_strength in app)
ALTER TABLE products ADD COLUMN IF NOT EXISTS strength TEXT;

-- 5) Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_products_woo_id ON products(woo_product_id);
CREATE INDEX IF NOT EXISTS idx_orders_woo_id ON orders(woo_order_id);
CREATE INDEX IF NOT EXISTS idx_product_cost_lookup_name ON product_cost_lookup(product_name);
CREATE INDEX IF NOT EXISTS idx_product_cost_lookup_strength ON product_cost_lookup(strength);
