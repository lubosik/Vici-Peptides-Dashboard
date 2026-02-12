-- Sale price: when set, used for revenue/margin/profit instead of retail_price.
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2);
COMMENT ON COLUMN products.sale_price IS 'When set, used for display and calculations instead of retail_price; else N/A and use retail_price';
