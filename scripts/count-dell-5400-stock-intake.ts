import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { inStoreProducts, laptops } from "@shared/schema";
import { and, gte, lt, sql, ilike, or, eq } from "drizzle-orm";

const START = new Date("2026-09-11T00:00:00+03:00");
const END = new Date("2026-10-28T00:00:00+03:00");

function dell5400InStoreWhere() {
  return and(
    eq(inStoreProducts.productType, "laptop"),
    or(
      and(
        sql`coalesce(${inStoreProducts.specs}->>'brand', '') ILIKE '%dell%'`,
        sql`coalesce(${inStoreProducts.specs}->>'model', '') ILIKE '%5400%'`,
      ),
      ilike(inStoreProducts.nameAr, "%5400%"),
      ilike(inStoreProducts.nameEn, "%5400%"),
      sql`(${inStoreProducts.nameAr} ILIKE '%dell%' AND ${inStoreProducts.nameAr} ILIKE '%5400%')`,
    ),
  );
}

async function runQuery(label: string, connectionString: string) {
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new pg.Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  const db = drizzle(pool);

  console.log(`\n========== ${label} ==========`);
  console.log("Dell Latitude 5400 — stock INTAKE (new inventory rows created in period)");
  console.log("Range: 2026-09-11 through 2026-10-27 (Asia/Baghdad)\n");

  try {
    const createdInRange = and(
      gte(inStoreProducts.createdAt, START),
      lt(inStoreProducts.createdAt, END),
      dell5400InStoreWhere(),
    );

    const intakeRows = await db
      .select({
        id: inStoreProducts.id,
        nameAr: inStoreProducts.nameAr,
        stockQuantity: inStoreProducts.stockQuantity,
        salesLocationId: inStoreProducts.salesLocationId,
        createdAt: inStoreProducts.createdAt,
        brand: sql<string>`coalesce(${inStoreProducts.specs}->>'brand', '')`,
        model: sql<string>`coalesce(${inStoreProducts.specs}->>'model', '')`,
        serial: sql<string>`coalesce(${inStoreProducts.specs}->>'serialNumber', '')`,
      })
      .from(inStoreProducts)
      .where(createdInRange)
      .orderBy(inStoreProducts.createdAt);

    const intakeUnits = intakeRows.reduce((s, r) => s + (r.stockQuantity || 0), 0);
    console.log(
      `Unified in-store (product_type=laptop): ${intakeRows.length} new row(s), ${intakeUnits} unit(s) at intake`,
    );
    for (const r of intakeRows) {
      console.log(
        `  id=${r.id} loc=${r.salesLocationId} qty=${r.stockQuantity} ${r.brand} ${r.model} ${r.serial} | ${r.nameAr} | ${r.createdAt}`,
      );
    }

    const onHandNow = await db
      .select({
        rows: sql<number>`count(*)::int`,
        units: sql<number>`coalesce(sum(${inStoreProducts.stockQuantity}),0)::int`,
      })
      .from(inStoreProducts)
      .where(dell5400InStoreWhere());
    console.log(
      `\nCurrent on-hand (all dates): ${onHandNow[0]?.rows ?? 0} row(s), ${onHandNow[0]?.units ?? 0} unit(s)`,
    );

    const span = await db
      .select({
        min: sql<string>`min(${inStoreProducts.createdAt})`,
        max: sql<string>`max(${inStoreProducts.createdAt})`,
        total: sql<number>`count(*)::int`,
      })
      .from(inStoreProducts)
      .where(eq(inStoreProducts.productType, "laptop"));
    console.log("in_store_products (laptops) DB span:", span[0]);
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    console.log("in_store_products:", err.message || err);
  }

  try {
    const legacyWhere = and(
      gte(laptops.createdAt, START),
      lt(laptops.createdAt, END),
      ilike(laptops.brand, "%dell%"),
      ilike(laptops.model, "%5400%"),
    );
    const legacyRows = await db
      .select({
        serialNumber: laptops.serialNumber,
        stockQuantity: laptops.stockQuantity,
        salesLocationId: laptops.salesLocationId,
        createdAt: laptops.createdAt,
        model: laptops.model,
      })
      .from(laptops)
      .where(legacyWhere)
      .orderBy(laptops.createdAt);

    const legacyUnits = legacyRows.reduce((s, r) => s + (r.stockQuantity || 0), 0);
    console.log(
      `\nLegacy laptops table: ${legacyRows.length} row(s) created in period, ${legacyUnits} unit(s) at intake`,
    );
    for (const r of legacyRows) {
      console.log(
        `  ${r.serialNumber} qty=${r.stockQuantity} loc=${r.salesLocationId} model=${r.model} | ${r.createdAt}`,
      );
    }
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.log("\nLegacy laptops table:", err.message || "unavailable");
  }

  await pool.end();
}

async function main() {
  if (process.env.DATABASE_URL) {
    await runQuery("DATABASE_URL", process.env.DATABASE_URL);
  }
  if (process.env.REMOTE_DATABASE_URL) {
    await runQuery("REMOTE_DATABASE_URL", process.env.REMOTE_DATABASE_URL);
  } else {
    console.log("\nTip: set REMOTE_DATABASE_URL in .env for live store numbers.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
