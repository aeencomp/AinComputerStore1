import "dotenv/config";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../server/db";
import { orders, salesUserLocations } from "../shared/schema";
import {
  aggregateSalesPosCustomers,
  filterOrdersForSalesCustomerList,
} from "../server/customer-export";
import { listOrdersForSalesLocationListing } from "../server/sales-location-orders";

async function main() {
  const loc2Orders = await listOrdersForSalesLocationListing(2);
  const loc2TaggedOnly = await db
    .select()
    .from(orders)
    .where(eq(orders.salesLocationId, 2));

  const phones = new Set<string>();
  for (const o of loc2Orders) {
    const p = (o.customerPhone || "").trim();
    if (p) phones.add(p);
  }

  const loc2Staff = await db
    .select({ userId: salesUserLocations.salesUserId })
    .from(salesUserLocations)
    .where(eq(salesUserLocations.salesLocationId, 2));
  const staffIds = loc2Staff.map((r) => r.userId);

  let legacyInStoreAtLoc1: typeof loc2Orders = [];
  if (staffIds.length > 0) {
    legacyInStoreAtLoc1 = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.salesLocationId, 1),
          inArray(orders.orderType, ["in-store", "walk-in"]),
          inArray(orders.salespersonId, staffIds),
        ),
      );
  }

  const filtered = filterOrdersForSalesCustomerList(loc2Orders, {
    reportEligibleOnly: false,
  });
  const customers = aggregateSalesPosCustomers(filtered);

  console.log("=== Location 2 customer debug ===");
  console.log("Orders (listing API loc2):", loc2Orders.length);
  console.log("Orders salesLocationId=2 tag only:", loc2TaggedOnly.length);
  console.log("Unique phones (raw):", phones.size);
  console.log("API-style customers:", customers.length);
  console.log("Loc2 staff count:", staffIds.length);
  console.log("Legacy in-store/walk-in @ loc1 tag by loc2 staff:", legacyInStoreAtLoc1.length);
  const legacyPhones = new Set<string>();
  for (const o of legacyInStoreAtLoc1) {
    const p = (o.customerPhone || "").trim();
    if (p) legacyPhones.add(p);
  }
  console.log("Legacy unique phones:", legacyPhones.size);
  console.log("Combined unique phones (est.):", new Set([...phones, ...legacyPhones]).size);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
