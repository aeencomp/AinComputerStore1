/**
 * Laptop inventory report for sales locations 1 & 2 (Baghdad date range).
 * Usage: npx tsx scripts/laptop-inventory-loc1-period.ts
 * Optional: npx tsx scripts/laptop-inventory-loc1-period.ts 2026-09-11 2026-10-27
 *
 * Set REMOTE_DATABASE_URL in .env for production (Neon), or DATABASE_URL after db:copy-remote.
 */
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { inStoreProducts, orders } from "@shared/schema";
import { and, gte, lt, sql, ilike, or, eq, inArray, isNull } from "drizzle-orm";

const LOCATION_IDS = [1, 2] as const;
const LOCATION_LABEL: Record<number, string> = {
  1: "Location 1 — main store",
  2: "Location 2",
};
const DEFAULT_FROM = "2026-09-11";
const DEFAULT_TO = "2026-10-27";

type LocStats = {
  intakeAllRows: number;
  intakeAllUnits: number;
  intake5400Rows: number;
  intake5400Units: number;
  onHandAllRows: number;
  onHandAllUnits: number;
  onHand5400Rows: number;
  onHand5400Units: number;
  soldLaptops: number;
  sold5400: number;
  orderCount: number;
};

function emptyStats(): LocStats {
  return {
    intakeAllRows: 0,
    intakeAllUnits: 0,
    intake5400Rows: 0,
    intake5400Units: 0,
    onHandAllRows: 0,
    onHandAllUnits: 0,
    onHand5400Rows: 0,
    onHand5400Units: 0,
    soldLaptops: 0,
    sold5400: 0,
    orderCount: 0,
  };
}

function addStats(a: LocStats, b: LocStats): LocStats {
  return {
    intakeAllRows: a.intakeAllRows + b.intakeAllRows,
    intakeAllUnits: a.intakeAllUnits + b.intakeAllUnits,
    intake5400Rows: a.intake5400Rows + b.intake5400Rows,
    intake5400Units: a.intake5400Units + b.intake5400Units,
    onHandAllRows: a.onHandAllRows + b.onHandAllRows,
    onHandAllUnits: a.onHandAllUnits + b.onHandAllUnits,
    onHand5400Rows: a.onHand5400Rows + b.onHand5400Rows,
    onHand5400Units: a.onHand5400Units + b.onHand5400Units,
    soldLaptops: a.soldLaptops + b.soldLaptops,
    sold5400: a.sold5400 + b.sold5400,
    orderCount: a.orderCount + b.orderCount,
  };
}

function parseOrderItem(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

function isLaptopLine(item: Record<string, unknown>): boolean {
  const type = String(item.productType ?? item.type ?? "").toLowerCase();
  if (type === "laptop") return true;
  const src = String(item.productSource ?? "").toLowerCase();
  if (src === "laptop") return true;
  const cat = String(item.category ?? "").toLowerCase();
  if (cat.includes("laptop") || cat === "laptops") return true;
  return false;
}

function isDell5400Line(item: Record<string, unknown>): boolean {
  const hay = [item.name, item.nameAr, item.nameEn, item.model, item.brand, item.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes("5400");
}

function dell5400ProductWhere(locationId: number) {
  return and(
    eq(inStoreProducts.productType, "laptop"),
    eq(inStoreProducts.salesLocationId, locationId),
    or(
      and(
        sql`coalesce(${inStoreProducts.specs}->>'brand', '') ILIKE '%dell%'`,
        sql`coalesce(${inStoreProducts.specs}->>'model', '') ILIKE '%5400%'`,
      ),
      sql`(${inStoreProducts.nameAr} ILIKE '%dell%' AND ${inStoreProducts.nameAr} ILIKE '%5400%')`,
      ilike(inStoreProducts.nameAr, "%5400%"),
    ),
  );
}

function allLaptopsWhere(locationId: number) {
  return and(
    eq(inStoreProducts.productType, "laptop"),
    eq(inStoreProducts.salesLocationId, locationId),
  );
}

async function reportLocation(
  db: NodePgDatabase,
  locationId: number,
  start: Date,
  end: Date,
  fromKey: string,
): Promise<LocStats> {
  const stats = emptyStats();

  console.log(`\n--- ${LOCATION_LABEL[locationId] ?? `Location ${locationId}`} ---`);

  const intakeAll = await db
    .select({
      id: inStoreProducts.id,
      nameAr: inStoreProducts.nameAr,
      stockQuantity: inStoreProducts.stockQuantity,
      createdAt: inStoreProducts.createdAt,
      brand: sql<string>`coalesce(${inStoreProducts.specs}->>'brand', '')`,
      model: sql<string>`coalesce(${inStoreProducts.specs}->>'model', '')`,
      serial: sql<string>`coalesce(${inStoreProducts.specs}->>'serialNumber', '')`,
    })
    .from(inStoreProducts)
    .where(
      and(allLaptopsWhere(locationId), gte(inStoreProducts.createdAt, start), lt(inStoreProducts.createdAt, end)),
    )
    .orderBy(inStoreProducts.createdAt);

  stats.intakeAllRows = intakeAll.length;
  stats.intakeAllUnits = intakeAll.reduce((s, r) => s + (r.stockQuantity || 0), 0);

  console.log(`[A] Laptops ADDED (new rows): ${stats.intakeAllRows} row(s), ${stats.intakeAllUnits} unit(s)`);
  for (const r of intakeAll) {
    console.log(
      `    • id=${r.id} qty=${r.stockQuantity} ${r.brand} ${r.model} ${r.serial} | ${r.nameAr} | ${r.createdAt}`,
    );
  }

  const intake5400 = await db
    .select({
      id: inStoreProducts.id,
      nameAr: inStoreProducts.nameAr,
      stockQuantity: inStoreProducts.stockQuantity,
      createdAt: inStoreProducts.createdAt,
      model: sql<string>`coalesce(${inStoreProducts.specs}->>'model', '')`,
    })
    .from(inStoreProducts)
    .where(
      and(dell5400ProductWhere(locationId), gte(inStoreProducts.createdAt, start), lt(inStoreProducts.createdAt, end)),
    )
    .orderBy(inStoreProducts.createdAt);

  stats.intake5400Rows = intake5400.length;
  stats.intake5400Units = intake5400.reduce((s, r) => s + (r.stockQuantity || 0), 0);

  console.log(`[B] Dell 5400 ADDED: ${stats.intake5400Rows} row(s), ${stats.intake5400Units} unit(s)`);
  for (const r of intake5400) {
    console.log(`    • id=${r.id} qty=${r.stockQuantity} ${r.model} | ${r.nameAr} | ${r.createdAt}`);
  }

  const onHandAll = await db
    .select({
      rows: sql<number>`count(*)::int`,
      units: sql<number>`coalesce(sum(${inStoreProducts.stockQuantity}),0)::int`,
    })
    .from(inStoreProducts)
    .where(and(allLaptopsWhere(locationId), eq(inStoreProducts.isActive, 1)));

  const onHand5400 = await db
    .select({
      rows: sql<number>`count(*)::int`,
      units: sql<number>`coalesce(sum(${inStoreProducts.stockQuantity}),0)::int`,
    })
    .from(inStoreProducts)
    .where(and(dell5400ProductWhere(locationId), eq(inStoreProducts.isActive, 1)));

  stats.onHandAllRows = onHandAll[0]?.rows ?? 0;
  stats.onHandAllUnits = onHandAll[0]?.units ?? 0;
  stats.onHand5400Rows = onHand5400[0]?.rows ?? 0;
  stats.onHand5400Units = onHand5400[0]?.units ?? 0;

  console.log(
    `[C] On-hand now: all laptops ${stats.onHandAllUnits} unit(s) (${stats.onHandAllRows} rows); Dell 5400 ${stats.onHand5400Units} unit(s) (${stats.onHand5400Rows} rows)`,
  );

  const posOrders = await db
    .select({
      orderNumber: orders.orderNumber,
      createdAt: orders.createdAt,
      items: orders.items,
    })
    .from(orders)
    .where(
      and(
        eq(orders.salesLocationId, locationId),
        inArray(orders.orderType, ["walk-in", "in-store"]),
        gte(orders.createdAt, start),
        lt(orders.createdAt, end),
        isNull(orders.voidedAt),
      ),
    );

  stats.orderCount = posOrders.length;
  const sold5400Lines: string[] = [];

  for (const o of posOrders) {
    for (const raw of o.items || []) {
      const item = parseOrderItem(raw);
      if (!item || !isLaptopLine(item)) continue;
      const qty = Math.max(1, parseInt(String(item.quantity ?? 1), 10) || 1);
      stats.soldLaptops += qty;
      if (isDell5400Line(item)) {
        stats.sold5400 += qty;
        sold5400Lines.push(
          `    • ${o.orderNumber} x${qty} ${item.name ?? item.nameAr ?? ""} | ${o.createdAt}`,
        );
      }
    }
  }

  console.log(
    `[D] Sold (POS): all laptops ${stats.soldLaptops} in ${stats.orderCount} order(s); Dell 5400 ${stats.sold5400}`,
  );
  if (sold5400Lines.length) {
    console.log("    Dell 5400 sale lines:");
    for (const line of sold5400Lines) console.log(line);
  }

  console.log(
    `[E] Dell 5400 check (period only): added ${stats.intake5400Units} − sold ${stats.sold5400} ≈ ${stats.intake5400Units - stats.sold5400}; on-hand now ${stats.onHand5400Units} (pre-${fromKey} stock not included)`,
  );

  return stats;
}

function printCombined(fromKey: string, combined: LocStats) {
  console.log(`\n${"=".repeat(60)}`);
  console.log("COMBINED — Locations 1 + 2");
  console.log("=".repeat(60));
  console.log(
    `[A] Laptops ADDED: ${combined.intakeAllRows} rows, ${combined.intakeAllUnits} units`,
  );
  console.log(
    `[B] Dell 5400 ADDED: ${combined.intake5400Rows} rows, ${combined.intake5400Units} units`,
  );
  console.log(
    `[C] On-hand now: all laptops ${combined.onHandAllUnits} units; Dell 5400 ${combined.onHand5400Units} units`,
  );
  console.log(
    `[D] Sold: all laptops ${combined.soldLaptops}; Dell 5400 ${combined.sold5400} (${combined.orderCount} orders total)`,
  );
  console.log(
    `[E] Dell 5400: added ${combined.intake5400Units} − sold ${combined.sold5400} ≈ ${combined.intake5400Units - combined.sold5400}; on-hand ${combined.onHand5400Units}`,
  );
}

async function runReport(label: string, connectionString: string, fromKey: string, toKey: string) {
  const start = new Date(`${fromKey}T00:00:00+03:00`);
  const end = new Date(`${toKey}T00:00:00+03:00`);
  end.setDate(end.getDate() + 1);

  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new pg.Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  const db = drizzle(pool);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`${label}`);
  console.log(`Both sales locations (1 & 2) | ${fromKey} → ${toKey} (Asia/Baghdad)`);
  console.log("=".repeat(60));

  try {
    let combined = emptyStats();
    for (const locationId of LOCATION_IDS) {
      const stats = await reportLocation(db, locationId, start, end, fromKey);
      combined = addStats(combined, stats);
    }
    printCombined(fromKey, combined);
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("Report failed:", err.message || e);
  }

  await pool.end();
}

async function main() {
  const fromKey = process.argv[2] || DEFAULT_FROM;
  const toKey = process.argv[3] || DEFAULT_TO;

  const urls: { label: string; url: string }[] = [];
  if (process.env.REMOTE_DATABASE_URL) {
    urls.push({ label: "REMOTE_DATABASE_URL (production)", url: process.env.REMOTE_DATABASE_URL });
  } else if (process.env.DATABASE_URL) {
    urls.push({ label: "DATABASE_URL", url: process.env.DATABASE_URL });
  }
  if (!urls.length) {
    console.error("No DATABASE_URL in .env");
    process.exit(1);
  }

  for (const { label, url } of urls) {
    await runReport(label, url, fromKey, toKey);
  }

  if (!process.env.REMOTE_DATABASE_URL) {
    console.log(
      "\n⚠ Production data: add REMOTE_DATABASE_URL (Neon URL from VPS .env) and re-run, or npm run db:copy-remote.",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
