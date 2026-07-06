import { db } from "./db";
import {
  orders,
  repairTickets,
  cashWithdrawals,
  staffAdvances,
  salesShifts,
} from "@shared/schema";
import { and, or, inArray, eq, isNotNull, desc, sql } from "drizzle-orm";
import { LOCATION_MAIN_ID } from "./sales-locations";
import { baghdadDateString } from "./daily-revenue-report";
import {
  isOrderDeferred,
  isInStoreZainCash,
  isInStoreQiCard,
  orderCashAmount,
  orderCardAmount,
  repairCashAmount,
  repairCardAmount,
} from "./order-payment";

/** Repair tickets hidden from sales/shift reports only (technician records unchanged). */
export const repairTicketIncludedInSalesReport = eq(repairTickets.excludedFromSalesReport, 0);

function sqlBaghdadDayEnd(dateStr: string) {
  return sql`((((${dateStr}::date) + interval '1 day')::timestamp) - interval '1 millisecond')`;
}

/** Shift window end — for closed shifts, extend to same-day sales if shift ended early. */
export function sqlShiftReportEnd(shiftId: string, shift: {
  status: string;
  salesUserId: string;
  salesLocationId: number;
  startTime: Date | string;
}) {
  const shiftEndSql = sql`(select coalesce(end_time, timezone('Asia/Baghdad', now())) from sales_shifts where id = ${shiftId} limit 1)`;
  const shiftStartSql = sql`(select start_time from sales_shifts where id = ${shiftId} limit 1)`;

  if (String(shift.status).toLowerCase() !== "closed") {
    return shiftEndSql;
  }

  const shiftDay = baghdadDateString(new Date(shift.startTime));
  const dayEndSql = sqlBaghdadDayEnd(shiftDay);

  return sql`(
    select least(
      ${dayEndSql},
      greatest(
        ${shiftEndSql},
        coalesce(
          (select max(o.created_at) from orders o
           where o.order_type in ('walk-in', 'in-store')
             and o.sales_location_id = ${shift.salesLocationId}
             and o.salesperson_id = ${shift.salesUserId}
             and o.created_at >= ${shiftStartSql}
             and o.created_at <= ${dayEndSql}),
          ${shiftEndSql}
        ),
        coalesce(
          (select max(rt.updated_at) from repair_tickets rt
           where rt.payment_status = 'paid'
             and coalesce(rt.excluded_from_sales_report, 0) = 0
             and rt.updated_at >= ${shiftStartSql}
             and rt.updated_at <= ${dayEndSql}),
          ${shiftEndSql}
        ),
        coalesce(
          (select max(rt.delivered_at) from repair_tickets rt
           where rt.status = 'delivered'
             and rt.delivered_at is not null
             and coalesce(rt.excluded_from_sales_report, 0) = 0
             and rt.delivered_at >= ${shiftStartSql}
             and rt.delivered_at <= ${dayEndSql}),
          ${shiftEndSql}
        )
      )
    )
  )`;
}

export async function computeShiftReportForShift(shiftId: string) {
  const [shift] = await db.select().from(salesShifts).where(eq(salesShifts.id, shiftId)).limit(1);
  if (!shift) {
    throw new Error("الوردية غير موجودة");
  }

  const salesLocationId = shift.salesLocationId ?? LOCATION_MAIN_ID;
  const shiftStartSql = sql`(select start_time from sales_shifts where id = ${shiftId} limit 1)`;
  const shiftEndSql = sqlShiftReportEnd(shiftId, shift);

  const inStoreOrders = await db
    .select()
    .from(orders)
    .where(and(
      inArray(orders.orderType, ["walk-in", "in-store"]),
      eq(orders.salesLocationId, salesLocationId),
      sql`${orders.createdAt} >= ${shiftStartSql}`,
      sql`${orders.createdAt} <= ${shiftEndSql}`,
    ));

  const paidRepairTickets = salesLocationId === LOCATION_MAIN_ID
    ? await db
      .select()
      .from(repairTickets)
      .where(
        and(
          repairTicketIncludedInSalesReport,
          or(
            and(
              eq(repairTickets.paymentStatus, "paid"),
              sql`${repairTickets.updatedAt} >= ${shiftStartSql}`,
              sql`${repairTickets.updatedAt} <= ${shiftEndSql}`,
            ),
            and(
              eq(repairTickets.status, "delivered"),
              isNotNull(repairTickets.deliveredAt),
              sql`${repairTickets.deliveredAt} >= ${shiftStartSql}`,
              sql`${repairTickets.deliveredAt} <= ${shiftEndSql}`,
            ),
          ),
        ),
      )
    : [];

  const dailyWithdrawals = await db
    .select()
    .from(cashWithdrawals)
    .where(and(
      eq(cashWithdrawals.salesLocationId, salesLocationId),
      sql`${cashWithdrawals.createdAt} >= ${shiftStartSql}`,
      sql`${cashWithdrawals.createdAt} <= ${shiftEndSql}`,
    ))
    .orderBy(desc(cashWithdrawals.createdAt));

  const dailyAdvances = await db
    .select()
    .from(staffAdvances)
    .where(and(
      eq(staffAdvances.salesLocationId, salesLocationId),
      sql`${staffAdvances.createdAt} >= ${shiftStartSql}`,
      sql`${staffAdvances.createdAt} <= ${shiftEndSql}`,
    ))
    .orderBy(desc(staffAdvances.createdAt));

  const inStoreTotalCash = inStoreOrders.reduce((s, o) => s + orderCashAmount(o), 0);
  const inStoreTotalCard = inStoreOrders.reduce((s, o) => s + orderCardAmount(o), 0);
  const inStoreTotalZain = inStoreOrders.filter(o => isInStoreZainCash(o)).reduce((s, o) => s + parseFloat(o.total || "0"), 0);
  const inStoreTotalQi = inStoreOrders.filter(o => isInStoreQiCard(o)).reduce((s, o) => s + parseFloat(o.total || "0"), 0);
  const inStoreTotalDeferred = inStoreOrders.filter(o => isOrderDeferred(o)).reduce((s, o) => s + parseFloat(o.total || "0"), 0);
  const inStoreTotal = inStoreOrders.filter(o => !isOrderDeferred(o)).reduce((s, o) => s + parseFloat(o.total || "0"), 0);
  const totalWithdrawals = dailyWithdrawals.reduce((s, w) => s + parseFloat(w.amount), 0);
  const totalAdvances = dailyAdvances.reduce((s, a) => s + parseFloat(a.amount), 0);
  const repairTotalDeferred = paidRepairTickets.filter(t => t.paymentStatus === "deferred").reduce((s, t) => s + parseFloat(t.finalCost || t.costEstimate || "0"), 0);
  const repairTotal = paidRepairTickets.filter(t => t.paymentStatus !== "deferred").reduce((s, t) => s + parseFloat(t.finalCost || t.costEstimate || "0"), 0);
  const repairTotalCash = paidRepairTickets.reduce((s, t) => s + repairCashAmount(t), 0);
  const repairTotalCard = paidRepairTickets.reduce((s, t) => s + repairCardAmount(t), 0);

  const baseGrandTotal = inStoreTotal + repairTotal;
  const grandTotal = baseGrandTotal + totalAdvances;

  return {
    shift,
    inStoreSales: inStoreOrders,
    repairSales: paidRepairTickets,
    withdrawals: dailyWithdrawals,
    advances: dailyAdvances,
    summary: {
      inStoreCount: inStoreOrders.length,
      inStoreTotal,
      inStoreTotalCash,
      inStoreTotalCard,
      inStoreTotalZain,
      inStoreTotalQi,
      inStoreTotalDeferred,
      repairCount: paidRepairTickets.filter(t => t.paymentStatus !== "deferred").length,
      repairTotal,
      repairTotalDeferred,
      repairTotalCash,
      repairTotalCard,
      repairTotalZain: 0,
      repairTotalQi: 0,
      totalWithdrawals,
      withdrawalCount: dailyWithdrawals.length,
      advancesTotal: totalAdvances,
      advancesCount: dailyAdvances.length,
      grandTotal,
      grandTotalCash: inStoreTotalCash + repairTotalCash,
      grandTotalCard: inStoreTotalCard + repairTotalCard,
      grandTotalZain: inStoreTotalZain,
      grandTotalQi: inStoreTotalQi,
      netTotal: grandTotal - totalWithdrawals,
    },
  };
}

/** Resolve the effective report end time for a shift (extends closed shifts to same-day sales). */
export async function fetchShiftReportEndTime(
  shiftId: string,
  shift: {
    status: string;
    salesUserId: string;
    salesLocationId: number;
    startTime: Date | string;
  },
): Promise<Date> {
  const endSql = sqlShiftReportEnd(shiftId, shift);
  const result = await db.execute<{ end_time: Date }>(sql`select (${endSql}) as end_time`);
  const row = (result.rows ?? result)[0];
  return new Date(row.end_time);
}

/** Reconcile closed shifts from the last N Baghdad calendar days (restores missing sales totals). */
export async function reconcileRecentClosedShifts(daysBack = 3): Promise<number> {
  const shifts = await db
    .select()
    .from(salesShifts)
    .where(and(
      eq(salesShifts.status, "closed"),
      sql`${salesShifts.startTime} >= timezone('Asia/Baghdad', now()) - (${daysBack} * interval '1 day')`,
    ));

  let reconciled = 0;
  for (const shift of shifts) {
    if (await reconcileClosedShiftRecord(shift.id)) {
      reconciled++;
    }
  }
  return reconciled;
}

/** Update closed shift totals from actual sales (fixes premature close / missing yesterday sales). */
export async function reconcileClosedShiftRecord(shiftId: string): Promise<boolean> {
  const [shift] = await db.select().from(salesShifts).where(eq(salesShifts.id, shiftId)).limit(1);
  if (!shift || String(shift.status).toLowerCase() !== "closed") {
    return false;
  }

  const report = await computeShiftReportForShift(shiftId);
  const salesTotal = report.summary.inStoreTotal + report.summary.repairTotal;
  const txnCount = report.summary.inStoreCount + report.summary.repairCount;
  const storedTotal = parseFloat(shift.totalSales || "0");
  const storedTxn = shift.totalTransactions ?? 0;

  if (Math.abs(salesTotal - storedTotal) <= 0.01 && txnCount === storedTxn) {
    return false;
  }

  const note = "\n[auto] restored sales totals from shift report";
  await db
    .update(salesShifts)
    .set({
      totalSales: salesTotal.toString(),
      totalTransactions: txnCount,
      notes: sql`COALESCE(${salesShifts.notes}, '') || ${note}`,
    })
    .where(eq(salesShifts.id, shiftId));

  console.log(`[shift-report] reconciled closed shift ${shiftId}: total=${salesTotal}, txn=${txnCount}`);
  return true;
}
