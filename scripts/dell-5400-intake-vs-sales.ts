/**
 * Dell 5400 — inventory INPUT (new rows) vs POS sales for reconciliation with paper order forms.
 *
 * Usage (on VPS with production .env):
 *   set -a && source .env && set +a
 *   npx tsx scripts/dell-5400-intake-vs-sales.ts
 *   npx tsx scripts/dell-5400-intake-vs-sales.ts 2026-09-11 2026-10-27
 *   npx tsx scripts/dell-5400-intake-vs-sales.ts 2026-09-11 2026-10-27 --csv
 *
 * "5400" match: name, SKU, description, or specs JSON contains 5400 (both locations).
 */
import "dotenv/config";
import fs from "fs";
import { db } from "../server/db";
import { batterySales, inStoreProducts, laptopSaleItems, laptops, orders } from "@shared/schema";
import { and, gte, lt, sql, ilike, or, eq, inArray, isNull } from "drizzle-orm";
import { baghdadDateKey } from "../shared/baghdadDateRange";

const DEFAULT_FROM = "2026-09-11";
const DEFAULT_TO = "2026-10-27";

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

function parseItem(raw: unknown): Record<string, unknown> | null {
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

function lineHas5400(raw: unknown, item: Record<string, unknown> | null): boolean {
  const blob = (typeof raw === "string" ? raw : JSON.stringify(item ?? raw)).toLowerCase();
  return blob.includes("5400");
}

type IntakeRow = {
  kind: "intake";
  baghdadDate: string;
  locationId: number;
  units: number;
  serial: string;
  brand: string;
  model: string;
  nameAr: string;
  sku: string;
  productId: number;
  productType: string;
  source: "in_store" | "legacy_laptops";
};

type SaleRow = {
  kind: "sale";
  baghdadDate: string;
  locationId: number;
  units: number;
  orderNumber: string;
  lineName: string;
  source: "pos_order" | "battery_pos";
};

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const writeCsv = process.argv.includes("--csv");
  const fromKey = args[0] || DEFAULT_FROM;
  const toKey = args[1] || DEFAULT_TO;
  const start = new Date(`${fromKey}T00:00:00+03:00`);
  const end = new Date(`${toKey}T00:00:00+03:00`);
  end.setDate(end.getDate() + 1);

  console.log("Dell 5400 reconciliation (match: text contains \"5400\")");
  console.log(`Period: ${fromKey} → ${toKey} (Asia/Baghdad)`);
  console.log("Locations: 1 + 2\n");

  const intakeRows: IntakeRow[] = [];

  const instoreIntake = await db
    .select({
      id: inStoreProducts.id,
      salesLocationId: inStoreProducts.salesLocationId,
      stockQuantity: inStoreProducts.stockQuantity,
      createdAt: inStoreProducts.createdAt,
      nameAr: inStoreProducts.nameAr,
      sku: inStoreProducts.sku,
      productType: inStoreProducts.productType,
      brand: sql<string>`coalesce(${inStoreProducts.specs}->>'brand', '')`,
      model: sql<string>`coalesce(${inStoreProducts.specs}->>'model', '')`,
      serial: sql<string>`coalesce(${inStoreProducts.specs}->>'serialNumber', '')`,
    })
    .from(inStoreProducts)
    .where(and(match5400InStore(), gte(inStoreProducts.createdAt, start), lt(inStoreProducts.createdAt, end)))
    .orderBy(inStoreProducts.createdAt);

  for (const r of instoreIntake) {
    intakeRows.push({
      kind: "intake",
      baghdadDate: baghdadDateKey(r.createdAt),
      locationId: r.salesLocationId,
      units: r.stockQuantity || 0,
      serial: r.serial || "",
      brand: r.brand || "",
      model: r.model || "",
      nameAr: r.nameAr,
      sku: r.sku || "",
      productId: r.id,
      productType: r.productType || "",
      source: "in_store",
    });
  }

  try {
    const legacyIntake = await db
      .select({
        id: laptops.id,
        salesLocationId: laptops.salesLocationId,
        stockQuantity: laptops.stockQuantity,
        createdAt: laptops.createdAt,
        brand: laptops.brand,
        model: laptops.model,
        serialNumber: laptops.serialNumber,
      })
      .from(laptops)
      .where(
        and(
          gte(laptops.createdAt, start),
          lt(laptops.createdAt, end),
          or(
            ilike(laptops.model, "%5400%"),
            ilike(laptops.brand, "%5400%"),
            sql`coalesce(${laptops.notes}, '') ILIKE '%5400%'`,
          ),
        ),
      )
      .orderBy(laptops.createdAt);

    for (const r of legacyIntake) {
      intakeRows.push({
        kind: "intake",
        baghdadDate: baghdadDateKey(r.createdAt),
        locationId: r.salesLocationId,
        units: r.stockQuantity || 0,
        serial: r.serialNumber || "",
        brand: r.brand || "",
        model: r.model || "",
        nameAr: `${r.brand} ${r.model || ""}`.trim(),
        sku: r.serialNumber || "",
        productId: 0,
        productType: "legacy_laptop",
        source: "legacy_laptops",
      });
    }
  } catch {
    /* optional table */
  }

  const saleRows: SaleRow[] = [];

  const posOrders = await db
    .select({
      orderNumber: orders.orderNumber,
      salesLocationId: orders.salesLocationId,
      createdAt: orders.createdAt,
      items: orders.items,
    })
    .from(orders)
    .where(
      and(
        inArray(orders.orderType, ["walk-in", "in-store"]),
        gte(orders.createdAt, start),
        lt(orders.createdAt, end),
        isNull(orders.voidedAt),
      ),
    )
    .orderBy(orders.createdAt);

  for (const o of posOrders) {
    for (const raw of o.items || []) {
      const item = parseItem(raw);
      if (!item || !lineHas5400(raw, item)) continue;
      const qty = Math.max(1, parseInt(String(item.quantity ?? 1), 10) || 1);
      saleRows.push({
        kind: "sale",
        baghdadDate: baghdadDateKey(o.createdAt),
        locationId: o.salesLocationId,
        units: qty,
        orderNumber: o.orderNumber,
        lineName: String(item.nameAr ?? item.name ?? item.nameEn ?? ""),
        source: "pos_order",
      });
    }
  }

  try {
    const batSales = await db
      .select({
        saleNumber: batterySales.saleNumber,
        createdAt: batterySales.createdAt,
        qty: laptopSaleItems.quantity,
        brand: laptopSaleItems.brand,
        model: laptopSaleItems.model,
      })
      .from(laptopSaleItems)
      .innerJoin(batterySales, eq(laptopSaleItems.saleId, batterySales.id))
      .where(
        and(
          gte(batterySales.createdAt, start),
          lt(batterySales.createdAt, end),
          or(ilike(laptopSaleItems.model, "%5400%"), sql`coalesce(${laptopSaleItems.model}, '') ILIKE '%5400%'`),
        ),
      );

    for (const r of batSales) {
      saleRows.push({
        kind: "sale",
        baghdadDate: baghdadDateKey(r.createdAt),
        locationId: 0,
        units: r.qty || 1,
        orderNumber: r.saleNumber,
        lineName: `${r.brand} ${r.model || ""}`.trim(),
        source: "battery_pos",
      });
    }
  } catch {
    /* optional */
  }

  const onHand = await db
    .select({
      locationId: inStoreProducts.salesLocationId,
      units: sql<number>`coalesce(sum(${inStoreProducts.stockQuantity}),0)::int`,
      rows: sql<number>`count(*)::int`,
    })
    .from(inStoreProducts)
    .where(and(match5400InStore(), eq(inStoreProducts.isActive, 1)))
    .groupBy(inStoreProducts.salesLocationId);

  const totalInputUnits = intakeRows.reduce((s, r) => s + r.units, 0);
  const totalSoldUnits = saleRows.reduce((s, r) => s + r.units, 0);
  const onHandTotal = onHand.reduce((s, r) => s + (r.units || 0), 0);

  console.log("========== SUMMARY (match your order form totals) ==========");
  console.log(`INVENTORY INPUT in period:  ${intakeRows.length} line(s),  ${totalInputUnits} unit(s)`);
  console.log(`SOLD (POS + battery) in period: ${saleRows.length} line(s), ${totalSoldUnits} unit(s)`);
  console.log(`ON HAND now (in-store, active):   ${onHandTotal} unit(s)`);
  console.log("");
  console.log("Compare INPUT total to your receiving / order form for 5400 in this date range.");
  console.log("Compare SOLD lines to sales receipts (order numbers below).");
  console.log(
    `Note: INPUT = quantity when each product row was first created in the system (not later stock +/- edits).`,
  );
  console.log(
    `      Stock before ${fromKey} is not in INPUT; ON HAND includes all dates.`,
  );
  console.log("");

  console.log("========== INVENTORY INPUT (detail) ==========");
  console.log("date\tloc\tqty\tserial\tbrand\tmodel\tname\tsource\tid");
  for (const r of intakeRows) {
    console.log(
      `${r.baghdadDate}\t${r.locationId}\t${r.units}\t${r.serial}\t${r.brand}\t${r.model}\t${r.nameAr}\t${r.source}\t${r.productId}`,
    );
  }

  console.log("\n========== SALES (detail) ==========");
  console.log("date\tloc\tqty\torder\tline\tsource");
  for (const r of saleRows) {
    console.log(
      `${r.baghdadDate}\t${r.locationId}\t${r.units}\t${r.orderNumber}\t${r.lineName}\t${r.source}`,
    );
  }

  console.log("\n========== ON HAND by location ==========");
  for (const r of onHand) {
    console.log(`  Location ${r.locationId}: ${r.units} unit(s), ${r.rows} SKU row(s)`);
  }

  if (intakeRows.length === 0) {
    console.log("\n⚠ No INPUT lines with \"5400\" in this period.");
    console.log("  If your order form uses another name (e.g. Latitude without 5400), run:");
    console.log("  npx tsx scripts/diagnose-dell-5400.ts");
  }

  if (writeCsv) {
    const escape = (v: string | number) => {
      const s = String(v);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines: string[] = [];
    lines.push("type,date,location,qty,serial,brand,model,name,order_number,source,product_id");
    for (const r of intakeRows) {
      lines.push(
        [
          "INPUT",
          r.baghdadDate,
          r.locationId,
          r.units,
          r.serial,
          r.brand,
          r.model,
          r.nameAr,
          "",
          r.source,
          r.productId,
        ].map(escape).join(","),
      );
    }
    for (const r of saleRows) {
      lines.push(
        [
          "SALE",
          r.baghdadDate,
          r.locationId,
          r.units,
          "",
          "",
          "",
          r.lineName,
          r.orderNumber,
          r.source,
          "",
        ].map(escape).join(","),
      );
    }
    const outPath = "dell-5400-reconciliation.csv";
    fs.writeFileSync(outPath, lines.join("\n"), "utf8");
    console.log(`\nWrote ${outPath} (open in Excel next to your order form)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
