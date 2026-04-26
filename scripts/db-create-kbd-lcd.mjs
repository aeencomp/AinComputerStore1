import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const sql = `
CREATE TABLE IF NOT EXISTS keyboards (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  serial_number text NOT NULL UNIQUE,
  part_number text,
  barcode text,
  brand text NOT NULL,
  layout text,
  keyboard_type text,
  backlight integer NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock_level integer NOT NULL DEFAULT 2,
  purchase_price numeric(10,2),
  selling_price numeric(10,2),
  wholesale_price numeric(10,2),
  supplier text,
  location text,
  notes text,
  is_active integer NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lcds (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  serial_number text NOT NULL UNIQUE,
  part_number text,
  barcode text,
  brand text NOT NULL,
  size_inch numeric(4,1),
  resolution text,
  connector_type text,
  panel_type text,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock_level integer NOT NULL DEFAULT 2,
  purchase_price numeric(10,2),
  selling_price numeric(10,2),
  wholesale_price numeric(10,2),
  supplier text,
  location text,
  notes text,
  is_active integer NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS keyboard_sale_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sale_id varchar NOT NULL,
  keyboard_id varchar NOT NULL,
  serial_number text NOT NULL,
  brand text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  line_total numeric(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS lcd_sale_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sale_id varchar NOT NULL,
  lcd_id varchar NOT NULL,
  serial_number text NOT NULL,
  brand text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  line_total numeric(10,2) NOT NULL
);
`;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(sql);
await client.end();
console.log('Created or verified: keyboards, lcds, keyboard_sale_items, lcd_sale_items');
