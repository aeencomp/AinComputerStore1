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
  `ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS cash_paid_amount NUMERIC(10, 2)`,
  `ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS card_paid_amount NUMERIC(10, 2)`,
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

  `ALTER TABLE cash_withdrawals ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'sales'`,
  `UPDATE cash_withdrawals SET source = 'sales' WHERE source IS NULL OR trim(source) = ''`,

  `ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS repair_payment_source TEXT NOT NULL DEFAULT 'sales'`,
  `UPDATE repair_tickets SET repair_payment_source = 'sales' WHERE repair_payment_source IS NULL OR trim(repair_payment_source) = ''`,

  `UPDATE repair_tickets
     SET repair_payment_source = 'technician'
     WHERE excluded_from_sales_report = 1
       AND repair_payment_source = 'sales'
       AND payment_status IN ('paid', 'deferred')`,
  `UPDATE staff_advances SET sales_location_id = 1 WHERE sales_location_id IS NULL`,

  `UPDATE orders SET payment_status = 'deferred'
     WHERE payment_method = 'deferred'
       AND COALESCE(payment_status, '') <> 'deferred'`,

  `ALTER TABLE in_store_products ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'generic'`,
  `ALTER TABLE in_store_products ADD COLUMN IF NOT EXISTS specs JSONB`,
  `ALTER TABLE in_store_products ADD COLUMN IF NOT EXISTS legacy_source TEXT`,
  `ALTER TABLE in_store_products ADD COLUMN IF NOT EXISTS legacy_id TEXT`,
  `UPDATE in_store_products SET product_type = 'generic' WHERE product_type IS NULL OR product_type = ''`,

  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS daily_revenue_whatsapp_number TEXT DEFAULT ''`,

  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS public_site_url TEXT DEFAULT 'https://aeen-iq.com'`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS facebook_page_id TEXT DEFAULT ''`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS facebook_page_access_token TEXT DEFAULT ''`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS facebook_auto_post_enabled INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS facebook_auto_post_time TEXT DEFAULT '18:00'`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS facebook_auto_post_mode TEXT DEFAULT 'rotate'`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS facebook_auto_post_last_at TIMESTAMP`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS facebook_auto_post_cursor INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS facebook_auto_posts_per_day INTEGER NOT NULL DEFAULT 1`,

  `UPDATE store_settings SET address_ar = 'كربلاء، العراق', address_en = 'Karbala, Iraq'
     WHERE address_ar IS NULL OR address_ar = '' OR address_ar = 'بغداد، العراق'`,

  `ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS excluded_from_sales_report INTEGER NOT NULL DEFAULT 0`,

  `ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`,
  `UPDATE repair_tickets SET paid_at = delivered_at
     WHERE payment_status = 'paid' AND paid_at IS NULL AND status = 'delivered' AND delivered_at IS NOT NULL`,
  `UPDATE repair_tickets SET paid_at = updated_at
     WHERE payment_status = 'paid' AND paid_at IS NULL AND status <> 'delivered'`,

  `UPDATE repair_tickets SET delivered_at = COALESCE(paid_at, updated_at)
     WHERE status = 'delivered' AND delivered_at IS NULL`,

  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS voided_by VARCHAR`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS void_reason TEXT`,

  `ALTER TABLE sales_shifts ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP`,
  `ALTER TABLE sales_shifts ADD COLUMN IF NOT EXISTS original_end_time TIMESTAMP`,

  `UPDATE technicians t
     SET permissions = sub.merged
     FROM (
       SELECT id,
         (SELECT COALESCE(jsonb_agg(DISTINCT elem), '[]'::jsonb)
          FROM (
            SELECT jsonb_array_elements_text(COALESCE(permissions, '[]'::jsonb)) AS elem
            UNION ALL SELECT 'view_daily_report'
          ) x) AS merged
       FROM technicians
       WHERE (
         (lower(trim(display_name)) LIKE '%mustafa%' AND lower(trim(display_name)) LIKE '%adel%')
         OR lower(trim(username)) LIKE '%mustafa%adel%'
         OR lower(trim(username)) = 'mustafa'
       )
       AND NOT (COALESCE(permissions, '[]'::jsonb) @> '["view_daily_report"]'::jsonb)
     ) sub
     WHERE t.id = sub.id`,

  `UPDATE technicians t
     SET permissions = sub.merged
     FROM (
       SELECT id,
         (SELECT COALESCE(jsonb_agg(DISTINCT elem), '[]'::jsonb)
          FROM (
            SELECT jsonb_array_elements_text(COALESCE(permissions, '[]'::jsonb)) AS elem
            UNION ALL SELECT 'view_withdrawals'
          ) x) AS merged
       FROM technicians
       WHERE (
         (lower(trim(display_name)) LIKE '%mustafa%' AND lower(trim(display_name)) LIKE '%adel%')
         OR lower(trim(username)) LIKE '%mustafa%adel%'
         OR lower(trim(username)) = 'mustafa'
       )
       AND NOT (COALESCE(permissions, '[]'::jsonb) @> '["view_withdrawals"]'::jsonb)
     ) sub
     WHERE t.id = sub.id`,

  // Tag repair payments collected during an open technician shift (portal attribution).
  `UPDATE repair_tickets rt
     SET repair_payment_source = 'technician'
     WHERE rt.repair_payment_source = 'sales'
       AND coalesce(rt.excluded_from_sales_report, 0) = 0
       AND rt.payment_status IN ('paid', 'deferred')
       AND EXISTS (
         SELECT 1 FROM sales_shifts ss
         WHERE ss.sales_user_id LIKE 'tech:%'
           AND coalesce(ss.sales_location_id, 1) = 1
           AND coalesce(rt.paid_at, rt.delivered_at, rt.updated_at) >= ss.start_time
           AND coalesce(rt.paid_at, rt.delivered_at, rt.updated_at) <= coalesce(ss.end_time, timezone('Asia/Baghdad', now()))
       )`,

  // 0 IQD delivered during technician shift — tag as technician for repair report.
  `UPDATE repair_tickets rt
     SET repair_payment_source = 'technician'
     WHERE rt.repair_payment_source = 'sales'
       AND rt.status = 'delivered'
       AND coalesce(nullif(trim(rt.final_cost), '')::numeric, nullif(trim(rt.cost_estimate), '')::numeric, 0) = 0
       AND EXISTS (
         SELECT 1 FROM sales_shifts ss
         WHERE ss.sales_user_id LIKE 'tech:%'
           AND coalesce(ss.sales_location_id, 1) = 1
           AND coalesce(rt.delivered_at, rt.updated_at) >= ss.start_time
           AND coalesce(rt.delivered_at, rt.updated_at) <= coalesce(ss.end_time, timezone('Asia/Baghdad', now()))
       )`,

  `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT DEFAULT ''`,

  `CREATE TABLE IF NOT EXISTS facebook_post_log (
     id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
     post_type TEXT NOT NULL,
     product_id VARCHAR,
     message TEXT NOT NULL,
     image_url TEXT,
     link_url TEXT,
     facebook_post_id TEXT,
     source TEXT NOT NULL DEFAULT 'manual',
     success INTEGER NOT NULL DEFAULT 1,
     error TEXT,
     created_at TIMESTAMP NOT NULL DEFAULT NOW()
   )`,
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
