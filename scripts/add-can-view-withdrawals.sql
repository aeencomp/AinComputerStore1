-- Run once on VPS after deploy: psql $DATABASE_URL -f scripts/add-can-view-withdrawals.sql
ALTER TABLE sales_users
  ADD COLUMN IF NOT EXISTS can_view_withdrawals integer NOT NULL DEFAULT 0;

-- Optional: grant withdrawals to users who already had POS access
UPDATE sales_users
SET can_view_withdrawals = 1
WHERE can_pos = 1 AND can_view_withdrawals = 0;
