import "dotenv/config";
import { and, desc, inArray, sql } from "drizzle-orm";

import { db } from "../server/db";
import { orders, salesShifts } from "../shared/schema";

async function main() {
  const orderNumber = process.argv[2] ?? "ORD-01250";

  const [o] = await db
    .select()
    .from(orders)
    .where(sql`${orders.orderNumber} = ${orderNumber}`)
    .limit(1);

  console.log("order:", o
    ? {
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        orderType: o.orderType,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        total: o.total,
        salespersonId: o.salespersonId,
      }
    : null);

  const [activeShift] = await db
    .select()
    .from(salesShifts)
    .where(sql`lower(${salesShifts.status}) = 'active'`)
    .orderBy(desc(salesShifts.startTime))
    .limit(1);

  console.log("activeShift:", activeShift
    ? {
        id: activeShift.id,
        salesUserName: activeShift.salesUserName,
        salesUserId: activeShift.salesUserId,
        status: activeShift.status,
        startTime: activeShift.startTime,
        endTime: activeShift.endTime,
      }
    : null);

  if (!o || !activeShift) return;

  // Compute window in SQL (matches app logic for timestamp-without-timezone columns)
  const shiftStartSql = sql`(select start_time from sales_shifts where id = ${activeShift.id} limit 1)`;
  const shiftEndSql = sql`(select coalesce(end_time, timezone('Asia/Baghdad', now())) from sales_shifts where id = ${activeShift.id} limit 1)`;
  console.log("windowSql:", { shiftId: activeShift.id });

  const [inWindowRow] = await db
    .select({ ok: sql`1` })
    .from(orders)
    .where(and(
      sql`${orders.orderNumber} = ${orderNumber}`,
      sql`${orders.createdAt} >= ${shiftStartSql}`,
      sql`${orders.createdAt} <= ${shiftEndSql}`,
    ))
    .limit(1);
  console.log("orderInWindowSql:", !!inWindowRow);

  const latest = await db
    .select()
    .from(orders)
    .where(and(
      inArray(orders.orderType, ["walk-in", "in-store"]),
      sql`${orders.createdAt} >= ${shiftStartSql}`,
      sql`${orders.createdAt} <= ${shiftEndSql}`,
    ))
    .orderBy(desc(orders.createdAt))
    .limit(10);

  console.log(
    "latestPosOrdersInWindow:",
    latest.map((r) => ({
      orderNumber: r.orderNumber,
      orderType: r.orderType,
      createdAt: r.createdAt,
      salespersonId: r.salespersonId,
      total: r.total,
    })),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

