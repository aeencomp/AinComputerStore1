ALTER TABLE sales_users
  ADD COLUMN IF NOT EXISTS can_transfer_to_loc1 INTEGER NOT NULL DEFAULT 0;

UPDATE sales_users
SET can_transfer_to_loc1 = 1
WHERE role = 'sales_admin' AND can_transfer_to_loc1 = 0;

UPDATE sales_users
SET can_transfer_to_loc1 = 1
WHERE can_inventory_location2 = 1 AND can_transfer_to_loc1 = 0;
