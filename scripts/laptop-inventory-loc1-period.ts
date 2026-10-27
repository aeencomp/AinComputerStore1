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
import { batterySales, inStoreProducts, laptopSaleItems, laptops, orders } from "@shared/schema";
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

type CatalogMaps = {
  laptopIds: Set<string>;
  dell5400Ids: Set<string>;
};

function itemInStoreProductId(item: Record<string, unknown>): string | null {
  const raw = item.productId ?? item.instoreProductId;
  if (raw == null || raw === "") return null;
  return String(raw);
}

function isLaptopLine(item: Record<string, unknown>, maps: CatalogMaps): boolean {
  const pid = itemInStoreProductId(item);
  if (pid && maps.laptopIds.has(pid)) return true;

  const type = String(item.productType ?? item.type ?? "").toLowerCase();
  if (type === "laptop") return true;
  const src = String(item.productSource ?? "").toLowerCase();
  if (src === "laptop") return true;
  const cat = String(item.category ?? "").toLowerCase();
  if (cat.includes("laptop") || cat === "laptops") return true;

  const names = [item.name, item.nameAr, item.nameEn].filter(Boolean).join(" ").toLowerCase();
  if (names.includes("laptop") || names.includes("لابتوب")) return true;

  if (Array.isArray(item.specs)) {
    const specText = item.specs.map(String).join(" ").toLowerCase();
    if (specText.includes("الموديل") || specText.includes("المعالج") || specText.includes("cpu")) {
      return true;
    }
  }
  return false;
}

/** Any in-store row whose name, SKU, description, or specs JSON contains "5400". */
function match5400InStore(locationId?: number) {
  const textMatch = sql`(
    ${inStoreProducts.nameAr} ILIKE '%5400%'
    OR coalesce(${inStoreProducts.nameEn}, '') ILIKE '%5400%'
    OR coalesce(${inStoreProducts.sku}, '') ILIKE '%5400%'
    OR coalesce(${inStoreProducts.description}, '') ILIKE '%5400%'
    OR coalesce(${inStoreProducts.specs}::text, '') ILIKE '%5400%'
  )`;
  if (locationId != null) {
    return and(eq(inStoreProducts.salesLocationId, locationId), textMatch);
  }
  return textMatch;
}

function orderLineMentions5400(raw: unknown, item: Record<string, unknown> | null): boolean {
  const blob = (typeof raw === "string" ? raw : JSON.stringify(item ?? raw)).toLowerCase();
  return blob.includes("5400");
}

function isDell5400Line(
  raw: unknown,
  item: Record<string, unknown>,
  maps: CatalogMaps,
): boolean {
  if (orderLineMentions5400(raw, item)) return true;
  const pid = itemInStoreProductId(item);
  if (pid && maps.dell5400Ids.has(pid)) return true;
  return false;
}

function dell5400ProductWhereAnyLocation() {
  return match5400InStore();
}

async function loadCatalogMaps(db: NodePgDatabase): Promise<CatalogMaps> {
  const laptopRows = await db
    .select({ id: inStoreProducts.id })
    .from(inStoreProducts)
    .where(eq(inStoreProducts.productType, "laptop"));
  const dell5400Rows = await db
    .select({ id: inStoreProducts.id })
    .from(inStoreProducts)
    .where(dell5400ProductWhereAnyLocation());

  return {
    laptopIds: new Set(laptopRows.map((r) => String(r.id))),
    dell5400Ids: new Set(dell5400Rows.map((r) => String(r.id))),
  };
}

function dell5400ProductWhere(locationId: number) {
  return match5400InStore(locationId);
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
  catalog: CatalogMaps,
): Promise<LocStats> {
  const stats = emptyStats();

  console.log(`\n--- ${LOCATION_LABEL[locationId] ?? `Location ${locationId}`} ---`);
  console.log("    (Dell 5400 = any inventory/sale line containing \"5400\" in name, SKU, or specs)");

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

  let legacy5400Units = 0;
  let legacy5400Rows = 0;
  try {
    const legacyOnHand = await db
      .select({
        rows: sql<number>`count(*)::int`,
        units: sql<number>`coalesce(sum(${laptops.stockQuantity}),0)::int`,
      })
      .from(laptops)
      .where(
        and(
          eq(laptops.salesLocationId, locationId),
          eq(laptops.isActive, 1),
          or(
            ilike(laptops.model, "%5400%"),
            ilike(laptops.brand, "%5400%"),
            sql`coalesce(${laptops.notes}, '') ILIKE '%5400%'`,
            sql`coalesce(${laptops.serialNumber}, '') ILIKE '%5400%'`,
          ),
        ),
      );
    legacy5400Rows = legacyOnHand[0]?.rows ?? 0;
    legacy5400Units = legacyOnHand[0]?.units ?? 0;
  } catch {
    /* legacy table optional */
  }

  console.log(
    `[C] On-hand now: all laptops ${stats.onHandAllUnits} unit(s) (${stats.onHandAllRows} rows); 5400-match ${stats.onHand5400Units} in-store + ${legacy5400Units} legacy (${stats.onHand5400Rows}+${legacy5400Rows} rows)`,
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
      if (!item) continue;
      const qty = Math.max(1, parseInt(String(item.quantity ?? 1), 10) || 1);
      if (isLaptopLine(item, catalog)) {
        stats.soldLaptops += qty;
      }
      if (isDell5400Line(raw, item, catalog)) {
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
    const catalog = await loadCatalogMaps(db);
    console.log(
      `Catalog: ${catalog.laptopIds.size} in-store laptop SKU(s), ${catalog.dell5400Ids.size} SKU(s) with "5400" in name/specs`,
    );

    let combined = emptyStats();
    for (const locationId of LOCATION_IDS) {
      const stats = await reportLocation(db, locationId, start, end, fromKey, catalog);
      combined = addStats(combined, stats);
    }
    printCombined(fromKey, combined);

    const legacyLaptopSales = await db
      .select({
        qty: sql<number>`coalesce(sum(${laptopSaleItems.quantity}),0)::int`,
        dell5400: sql<number>`coalesce(sum(case when coalesce(${laptopSaleItems.model}, '') ilike '%5400%' or coalesce(${laptopSaleItems.brand}, '') ilike '%dell%' and coalesce(${laptopSaleItems.model}, '') ilike '%5400%' then ${laptopSaleItems.quantity} else 0 end),0)::int`,
      })
      .from(laptopSaleItems)
      .innerJoin(batterySales, eq(laptopSaleItems.saleId, batterySales.id))
      .where(and(gte(batterySales.createdAt, start), lt(batterySales.createdAt, end)));

    console.log(
      `\n[F] Battery-POS laptop sales (all locations, no loc field in DB): ${legacyLaptopSales[0]?.qty ?? 0} unit(s); Dell 5400-ish: ${legacyLaptopSales[0]?.dell5400 ?? 0}`,
    );
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

  const url = process.env.REMOTE_DATABASE_URL || process.env.DATABASE_URL || "";
  if (/localhost|127\.0\.0\.1/.test(url) && !process.env.REMOTE_DATABASE_URL) {
    console.log(
      "\nNote: DATABASE_URL is localhost — on your PC this is not the VPS DB. Run on the server or set REMOTE_DATABASE_URL.",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
