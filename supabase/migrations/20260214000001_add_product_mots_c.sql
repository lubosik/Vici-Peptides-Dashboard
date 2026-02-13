-- Add MOTS-C 10mg and MOTS-C 40mg to the products catalog
INSERT INTO products (
  product_id,
  product_name,
  stock_status,
  qty_sold,
  current_stock,
  starting_qty
)
SELECT 185, 'MOTS-C 10mg', 'In Stock', 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_id = 185);

INSERT INTO products (
  product_id,
  product_name,
  stock_status,
  qty_sold,
  current_stock,
  starting_qty
)
SELECT 186, 'MOTS-C 40mg', 'In Stock', 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_id = 186);