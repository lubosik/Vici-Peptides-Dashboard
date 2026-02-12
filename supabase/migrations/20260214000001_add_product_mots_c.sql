-- Add MOTS-C to the products catalog
INSERT INTO products (
  product_id,
  product_name,
  stock_status,
  qty_sold,
  current_stock,
  starting_qty
)
SELECT
  COALESCE((SELECT MAX(product_id) FROM products), 0) + 1,
  'MOTS-C',
  'In Stock',
  0,
  0,
  0
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'MOTS-C');
