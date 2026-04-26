-- Run once if `npm run db:push` fails with:
--   code 42804, hint: You might need to specify "USING discount::numeric(10,2)"
--
-- Usage (from project root, with DATABASE_URL in env):
--   psql "%DATABASE_URL%" -f scripts/fix-discount-numeric-columns.sql
--   (PowerShell: $env:DATABASE_URL | psql -f scripts/fix-discount-numeric-columns.sql)
--
-- Then run: npm run db:push

-- orders.discount → numeric(10,2)
ALTER TABLE "orders"
  ALTER COLUMN "discount" TYPE numeric(10,2)
  USING (COALESCE(NULLIF(trim("discount"::text), ''), '0')::numeric(10,2));

-- battery_sales.discount (skip if table does not exist)
DO $$
BEGIN
  IF to_regclass('public.battery_sales') IS NOT NULL THEN
    ALTER TABLE "battery_sales"
      ALTER COLUMN "discount" TYPE numeric(10,2)
      USING (COALESCE(NULLIF(trim("discount"::text), ''), '0')::numeric(10,2));
  END IF;
END $$;
