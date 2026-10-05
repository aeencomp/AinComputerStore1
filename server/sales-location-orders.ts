import { db } from "./db";
import { orders } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

type OrderRow = typeof orders.$inferSelect;

/** Orders for one shop only — matched by orders.salesLocationId (1 or 2). */
export async function listOrdersForSalesLocationListing(
  locationId: number,
): Promise<OrderRow[]> {
  return db
    .select()
    .from(orders)
    .where(eq(orders.salesLocationId, locationId))
    .orderBy(desc(orders.createdAt));
}
