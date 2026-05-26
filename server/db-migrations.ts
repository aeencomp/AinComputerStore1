import { pool } from "./db";
import { seedSalesLocations, repairTransferInventoryDuplicates } from "./sales-locations";

/** Idempotent SQL run on startup so deploy does not require manual ALTER TABLE. */
const STARTUP_MIGRATIONS: string[] = [
  `ALTER TABLE in_store_products
     ADD COLUMN IF NOT EXISTS bulk_wholesale_price NUMERIC(10, 2)`,

  `CREATE TABLE IF NOT EXISTS sales_locations (
     id SERIAL PRIMARY KEY,
     code TEXT NOT NULL UNIQUE,
     name_ar TEXT NOT NULL,
     name_en TEXT,
     is_active INTEGER NOT NULL DEFAULT 1,
     created_at TIMESTAMP NOT NULL DEFAULT NOW()
   )`,

  `CREATE TABLE IF NOT EXISTS sales_user_locations (
     sales_user_id VARCHAR NOT NULL,
     sales_location_id INTEGER NOT NULL,
     PRIMARY KEY (sales_user_id, sales_location_id)
   )`,

  `CREATE TABLE IF NOT EXISTS stock_transfers (
     id SERIAL PRIMARY KEY,
     from_location_id INTEGER NOT NULL,
     to_location_id INTEGER NOT NULL,
     product_source TEXT NOT NULL,
     product_id TEXT NOT NULL,
     quantity INTEGER NOT NULL DEFAULT 1,
     serial_number TEXT,
     notes TEXT,
     created_by VARCHAR,
     created_by_name TEXT,
     created_at TIMESTAMP NOT NULL DEFAULT NOW()
   )`,

  `ALTER TABLE in_store_products ADD COLUMN IF NOT EXISTS sales_location_id INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE laptops ADD COLUMN IF NOT EXISTS sales_location_id INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE desktops ADD COLUMN IF NOT EXISTS sales_location_id INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE ac_adapters ADD COLUMN IF NOT EXISTS sales_location_id INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS sales_location_id INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_paid_amount NUMERIC(10, 2)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_paid_amount NUMERIC(10, 2)`,
  `ALTER TABLE sales_shifts ADD COLUMN IF NOT EXISTS sales_location_id INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE cash_withdrawals ADD COLUMN IF NOT EXISTS sales_location_id INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE staff_advances ADD COLUMN IF NOT EXISTS sales_location_id INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE sales_users ADD COLUMN IF NOT EXISTS can_inventory_location2 INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE sales_users ADD COLUMN IF NOT EXISTS can_edit_receipt INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE sales_users ADD COLUMN IF NOT EXISTS can_view_withdrawals INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE sales_users ADD COLUMN IF NOT EXISTS can_transfer_to_loc1 INTEGER NOT NULL DEFAULT 0`,
  `UPDATE sales_users SET can_edit_receipt = 1 WHERE role = 'sales_admin' AND can_edit_receipt = 0`,
  `UPDATE sales_users SET can_view_withdrawals = 1 WHERE role = 'sales_admin' AND can_view_withdrawals = 0`,
  `UPDATE sales_users SET can_view_withdrawals = 1 WHERE can_pos = 1 AND can_view_withdrawals = 0`,
  `UPDATE sales_users SET can_transfer_to_loc1 = 1 WHERE role = 'sales_admin' AND can_transfer_to_loc1 = 0`,
  `UPDATE sales_users SET can_transfer_to_loc1 = 1 WHERE can_inventory_location2 = 1 AND can_transfer_to_loc1 = 0`,

  `UPDATE in_store_products SET sales_location_id = 1 WHERE sales_location_id IS NULL`,
  `UPDATE laptops SET sales_location_id = 1 WHERE sales_location_id IS NULL`,
  `UPDATE desktops SET sales_location_id = 1 WHERE sales_location_id IS NULL`,
  `UPDATE ac_adapters SET sales_location_id = 1 WHERE sales_location_id IS NULL`,
  `UPDATE orders SET sales_location_id = 1 WHERE sales_location_id IS NULL`,
  `UPDATE sales_shifts SET sales_location_id = 1 WHERE sales_location_id IS NULL`,
  `UPDATE cash_withdrawals SET sales_location_id = 1 WHERE sales_location_id IS NULL`,
  `UPDATE staff_advances SET sales_location_id = 1 WHERE sales_location_id IS NULL`,

  `UPDATE orders SET payment_status = 'deferred'
     WHERE payment_method = 'deferred'
       AND COALESCE(payment_status, '') <> 'deferred'`,
];

export async function runDbMigrations(): Promise<void> {
  const started = Date.now();
  for (const statement of STARTUP_MIGRATIONS) {
    await pool.query(statement);
  }
  await seedSalesLocations();
  console.log(`[db-migrations] startup migrations applied in ${Date.now() - started}ms`);

  // Run heavy inventory repair in background so the server accepts requests immediately.
  void repairTransferInventoryDuplicates()
    .then(() => console.log("[db-migrations] background barcode repair finished"))
    .catch((err) => {
      console.error("[db-migrations] background barcode repair failed:", err);
    });
}
