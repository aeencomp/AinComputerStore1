/**
 * Dell 5400 — how many units were ADDED to inventory (new product rows only).
 * Does not include sales.
 *
 * Usage on VPS:
 *   set -a && source .env && set +a
 *   npx tsx scripts/dell-5400-intake-only.ts
 *   npx tsx scripts/dell-5400-intake-only.ts 2026-09-11 2026-10-27
 */
import "dotenv/config";
import { db } from "../server/db";
import { inStoreProducts, laptops } from "@shared/schema";
import { and, gte, lt, sql, ilike, or } from "drizzle-orm";
import { baghdadDateKey } from "../shared/baghdadDateRange";

const DEFAULT_FROM = "2026-09-11";
const DEFAULT_TO = "2026-10-27";

function match5400InStore() {
  return sql`(
    ${inStoreProducts.nameAr} ILIKE '%5400%'
    OR coalesce(${inStoreProducts.nameEn}, '') ILIKE '%5400%'
    OR coalesce(${inStoreProducts.sku}, '') ILIKE '%5400%'
    OR coalesce(${inStoreProducts.description}, '') ILIKE '%5400%'
    OR coalesce(${inStoreProducts.specs}::text, '') ILIKE '%5400%'
  )`;
}

async function main() {
  const fromKey = process.argv[2] || DEFAULT_FROM;
  const toKey = process.argv[3] || DEFAULT_TO;
  const start = new Date(`${fromKey}T00:00:00+03:00`);
  const end = new Date(`${toKey}T00:00:00+03:00`);
  end.setDate(end.getDate() + 1);

  console.log("Dell 5400 — ADDED to inventory only (not sales)");
  console.log(`Dates: ${fromKey} → ${toKey} (Baghdad), locations 1 + 2`);
  console.log('Match: "5400" in name, SKU, or specs\n');

  const rows = await db
    .select({
      id: inStoreProducts.id,
      loc: inStoreProducts.salesLocationId,
      qty: inStoreProducts.stockQuantity,
      createdAt: inStoreProducts.createdAt,
      nameAr: inStoreProducts.nameAr,
      serial: sql<string>`coalesce(${inStoreProducts.specs}->>'serialNumber', '')`,
      brand: sql<string>`coalesce(${inStoreProducts.specs}->>'brand', '')`,
      model: sql<string>`coalesce(${inStoreProducts.specs}->>'model', '')`,
    })
    .from(inStoreProducts)
    .where(and(match5400InStore(), gte(inStoreProducts.createdAt, start), lt(inStoreProducts.createdAt, end)))
    .orderBy(inStoreProducts.createdAt);

  let legacy: typeof rows = [];
  try {
    legacy = await db
      .select({
        id: sql<number>`0`.as("id"),
        loc: laptops.salesLocationId,
        qty: laptops.stockQuantity,
        createdAt: laptops.createdAt,
        nameAr: sql<string>`${laptops.brand} || ' ' || coalesce(${laptops.model}, '')`,
        serial: laptops.serialNumber,
        brand: laptops.brand,
        model: sql<string>`coalesce(${laptops.model}, '')`,
      })
      .from(laptops)
      .where(
        and(
          gte(laptops.createdAt, start),
          lt(laptops.createdAt, end),
          or(
            ilike(laptops.model, "%5400%"),
            sql`coalesce(${laptops.notes}, '') ILIKE '%5400%'`,
          ),
        ),
      )
      .orderBy(laptops.createdAt);
  } catch {
    /* no legacy table */
  }

  const all = [
    ...rows.map((r) => ({ ...r, source: "in_store" as const })),
    ...legacy.map((r) => ({ ...r, source: "legacy" as const })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const byLoc = new Map<number, { lines: number; units: number }>();
  let totalUnits = 0;

  console.log("date\tloc\tqty\tserial\tbrand\tmodel\tname\tsource");
  for (const r of all) {
    totalUnits += r.qty || 0;
    const loc = r.loc ?? 0;
    const prev = byLoc.get(loc) ?? { lines: 0, units: 0 };
    byLoc.set(loc, { lines: prev.lines + 1, units: prev.units + (r.qty || 0) });

    console.log(
      `${baghdadDateKey(r.createdAt)}\t${loc}\t${r.qty}\t${r.serial}\t${r.brand}\t${r.model}\t${r.nameAr}\t${r.source}`,
    );
  }

  console.log("\n--- TOTAL ADDED in period ---");
  console.log(`Lines (new products): ${all.length}`);
  console.log(`Units (sum of qty at entry): ${totalUnits}`);
  for (const [loc, v] of [...byLoc.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  Location ${loc}: ${v.lines} line(s), ${v.units} unit(s)`);
  }

  console.log(
    "\nEach line = one time you created a product in inventory; qty = amount entered that day.",
  );
  console.log("Does not count sales or later stock adjustments on old SKUs.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
