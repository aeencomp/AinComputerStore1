import { db } from "./db";
import { orders, salesShifts } from "@shared/schema";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { LOCATION_SHOP2_ID } from "./sales-locations";
import { fetchShiftReportEndTime } from "./shift-report";

type OrderRow = typeof orders.$inferSelect;

/**
 * Orders visible for a sales location (reports, customer directory, POS lookup).
 * Location 2 includes sales during Location 2 shifts even if order.salesLocationId was saved as 1.
 */
export async function listOrdersForSalesLocationListing(
  locationId: number,
): Promise<OrderRow[]> {
  if (locationId !== LOCATION_SHOP2_ID) {
    return db
      .select()
      .from(orders)
      .where(eq(orders.salesLocationId, locationId))
      .orderBy(desc(orders.createdAt));
  }

  const byId = new Map<string, OrderRow>();

  const direct = await db
    .select()
    .from(orders)
    .where(eq(orders.salesLocationId, LOCATION_SHOP2_ID));
  for (const o of direct) byId.set(o.id, o);

  const loc2Shifts = await db
    .select()
    .from(salesShifts)
    .where(eq(salesShifts.salesLocationId, LOCATION_SHOP2_ID))
    .orderBy(desc(salesShifts.startTime));

  for (const shift of loc2Shifts) {
    let end: Date;
    try {
      end = await fetchShiftReportEndTime(shift.id, {
        status: shift.status,
        salesUserId: shift.salesUserId,
        salesLocationId: shift.salesLocationId ?? LOCATION_SHOP2_ID,
        startTime: shift.startTime,
      });
    } catch {
      end = shift.endTime ? new Date(shift.endTime) : new Date();
    }
    const start = new Date(shift.startTime);

    const duringShift = await db
      .select()
      .from(orders)
      .where(
        and(
          inArray(orders.orderType, ["walk-in", "in-store"]),
          eq(orders.salespersonId, shift.salesUserId),
          gte(orders.createdAt, start),
          lte(orders.createdAt, end),
        ),
      );

    for (const o of duringShift) byId.set(o.id, o);
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
