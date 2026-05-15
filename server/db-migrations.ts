import { pool } from "./db";

/** Idempotent SQL run on startup so deploy does not require manual ALTER TABLE. */
const STARTUP_MIGRATIONS: string[] = [
  `ALTER TABLE in_store_products
     ADD COLUMN IF NOT EXISTS bulk_wholesale_price NUMERIC(10, 2)`,
];

export async function runDbMigrations(): Promise<void> {
  for (const statement of STARTUP_MIGRATIONS) {
    await pool.query(statement);
  }
  console.log("[db-migrations] startup migrations applied");
}
