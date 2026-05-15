-- Add جملة الجملة (bulk wholesale) price to in-store products
ALTER TABLE in_store_products
  ADD COLUMN IF NOT EXISTS bulk_wholesale_price NUMERIC(10, 2);
