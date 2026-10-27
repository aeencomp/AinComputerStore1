/**
 * Find how Dell / 5400 laptops appear in DB (names, types, stock, sales).
 * Run on VPS: set -a && source .env && set +a && npx tsx scripts/diagnose-dell-5400.ts
 */
import "dotenv/config";
import { db } from "../server/db";
import { batterySales, inStoreProducts, laptopSaleItems, laptops, orders } from "@shared/schema";
import { and, gte, lt, sql, ilike, or, eq, inArray, isNull } from "drizzle-orm";

const START = new Date("2026-09-11T00:00:00+03:00");
const END = new Date("2026-10-28T00:00:00+03:00");

const match5400Sql = sql`(
  ${inStoreProducts.nameAr} ILIKE '%5400%'
  OR coalesce(${inStoreProducts.nameEn}, '') ILIKE '%5400%'
  OR coalesce(${inStoreProducts.sku}, '') ILIKE '%5400%'
  OR coalesce(${inStoreProducts.description}, '') ILIKE '%5400%'
  OR coalesce(${inStoreProducts.specs}::text, '') ILIKE '%5400%'
)`;

const matchDellSql = sql`(
  ${inStoreProducts.nameAr} ILIKE '%dell%'
  OR ${inStoreProducts.nameAr} ILIKE '%ديل%'
  OR coalesce(${inStoreProducts.nameEn}, '') ILIKE '%dell%'
  OR coalesce(${inStoreProducts.specs}->>'brand', '') ILIKE '%dell%'
  OR coalesce(${inStoreProducts.specs}->>'brand', '') ILIKE '%ديل%'
)`;

async function main() {
  console.log("=== In-store: any field contains 5400 ===");
  const byType5400 = await db
    .select({
      productType: inStoreProducts.productType,
      rows: sql<number>`count(*)::int`,
      units: sql<number>`coalesce(sum(${inStoreProducts.stockQuantity}),0)::int`,
    })
    .from(inStoreProducts)
    .where(and(eq(inStoreProducts.isActive, 1), match5400Sql))
    .groupBy(inStoreProducts.productType);
  console.table(byType5400);

  const top5400 = await db
    .select({
      id: inStoreProducts.id,
      loc: inStoreProducts.salesLocationId,
      type: inStoreProducts.productType,
      qty: inStoreProducts.stockQuantity,
      nameAr: inStoreProducts.nameAr,
      model: sql<string>`coalesce(${inStoreProducts.specs}->>'model', '')`,
      brand: sql<string>`coalesce(${inStoreProducts.specs}->>'brand', '')`,
    })
    .from(inStoreProducts)
    .where(match5400Sql)
    .orderBy(sql`${inStoreProducts.stockQuantity} desc`)
    .limit(40);
  console.log("\nTop rows matching 5400 (up to 40):");
  for (const r of top5400) {
    console.log(`  loc=${r.loc} type=${r.type} qty=${r.qty} id=${r.id} ${r.brand} ${r.model} | ${r.nameAr}`);
  }

  console.log("\n=== In-store: Dell brand laptops (no 5400 filter) — top stock ===");
  const dellLaptops = await db
    .select({
      id: inStoreProducts.id,
      loc: inStoreProducts.salesLocationId,
      type: inStoreProducts.productType,
      qty: inStoreProducts.stockQuantity,
      nameAr: inStoreProducts.nameAr,
      model: sql<string>`coalesce(${inStoreProducts.specs}->>'model', '')`,
    })
    .from(inStoreProducts)
    .where(and(eq(inStoreProducts.productType, "laptop"), matchDellSql, eq(inStoreProducts.isActive, 1)))
    .orderBy(sql`${inStoreProducts.stockQuantity} desc`)
    .limit(25);
  for (const r of dellLaptops) {
    console.log(`  loc=${r.loc} qty=${r.qty} model=${r.model} | ${r.nameAr}`);
  }

  console.log("\n=== Legacy laptops table (if exists): model/br/name 5400 ===");
  try {
    const legacy = await db
      .select({
        loc: laptops.salesLocationId,
        rows: sql<number>`count(*)::int`,
        units: sql<number>`coalesce(sum(${laptops.stockQuantity}),0)::int`,
      })
      .from(laptops)
      .where(
        or(
          ilike(laptops.model, "%5400%"),
          ilike(laptops.brand, "%5400%"),
          sql`coalesce(${laptops.notes}, '') ILIKE '%5400%'`,
        ),
      )
      .groupBy(laptops.salesLocationId);
    console.table(legacy);
  } catch (e: unknown) {
    console.log("  (no laptops table or error)", (e as Error).message);
  }

  console.log("\n=== POS orders Sep11–Oct27: lines whose JSON mentions 5400 ===");
  const posOrders = await db
    .select({ orderNumber: orders.orderNumber, items: orders.items, loc: orders.salesLocationId })
    .from(orders)
    .where(
      and(
        inArray(orders.orderType, ["walk-in", "in-store"]),
        gte(orders.createdAt, START),
        lt(orders.createdAt, END),
        isNull(orders.voidedAt),
      ),
    );

  let lines5400 = 0;
  let units5400 = 0;
  for (const o of posOrders) {
    for (const raw of o.items || []) {
      const blob = typeof raw === "string" ? raw : JSON.stringify(raw);
      if (!blob.toLowerCase().includes("5400")) continue;
      lines5400++;
      try {
        const item = typeof raw === "string" ? JSON.parse(raw) : raw;
        units5400 += Math.max(1, parseInt(String((item as any).quantity ?? 1), 10) || 1);
      } catch {
        units5400 += 1;
      }
    }
  }
  console.log(`  Orders scanned: ${posOrders.length}, lines with 5400: ${lines5400}, units: ${units5400}`);

  console.log("\n=== Battery-POS laptop_sale_items (model/brand 5400) in period ===");
  try {
    const bat = await db
      .select({
        qty: sql<number>`coalesce(sum(${laptopSaleItems.quantity}),0)::int`,
      })
      .from(laptopSaleItems)
      .innerJoin(batterySales, eq(laptopSaleItems.saleId, batterySales.id))
      .where(
        and(
          gte(batterySales.createdAt, START),
          lt(batterySales.createdAt, END),
          or(ilike(laptopSaleItems.model, "%5400%"), sql`${laptopSaleItems.brand} || ' ' || coalesce(${laptopSaleItems.model},'') ILIKE '%5400%'`),
        ),
      );
    console.log(`  Units sold: ${bat[0]?.qty ?? 0}`);
  } catch (e: unknown) {
    console.log("  ", (e as Error).message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
