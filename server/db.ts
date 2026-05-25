import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Create a .env file in the project root with DATABASE_URL=postgresql://... then run npm run db:push and npm run dev.",
  );
}

function pgSslOption():
  | false
  | { rejectUnauthorized: boolean } {
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  if (isLocal) return false;
  return { rejectUnauthorized: false };
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 20000,
  idleTimeoutMillis: 60000,
  ssl: pgSslOption(),
});

pool.on("error", (err) => {
  console.error("[db-pool] idle client error:", err.message);
});

export const db = drizzle(pool);
