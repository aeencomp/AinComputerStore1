import { db } from "./db";
import {
  orders,
  repairTickets,
  cashWithdrawals,
  salesShifts,
  adminUsers,
} from "@shared/schema";
import { and, or, inArray, eq, isNotNull, isNull, desc, sql } from "drizzle-orm";
import { LOCATION_MAIN_ID, LOCATION_SHOP2_ID } from "./sales-locations";
import {
  computeShiftReportForShift,
  fetchShiftReportEndTime,
  orderIncludedInSalesReport,
  repairTicketIncludedInSalesReport,
  reconcileClosedShiftRecord,
} from "./shift-report";
import {
  isOrderDeferred,
  isInStoreZainCash,
  isInStoreQiCard,
  orderCashAmount,
  orderCardAmount,
  repairCashAmount,
  repairCardAmount,
} from "./order-payment";
import { sqlRepairTicketInSalesWindow } from "./repair-sales-date";

export type DailyReportSummary = {
  inStoreCount: number;
  inStoreTotal: number;
  inStoreTotalCash: number;
  inStoreTotalCard: number;
  inStoreTotalZain: number;
  inStoreTotalQi: number;
  inStoreTotalDeferred: number;
  repairCount: number;
  repairTotal: number;
  repairTotalDeferred: number;
  repairTotalCash: number;
  repairTotalCard: number;
  repairTotalZain: number;
  repairTotalQi: number;
  totalWithdrawals: number;
  withdrawalCount: number;
  grandTotal: number;
  grandTotalCash: number;
  grandTotalCard: number;
  grandTotalZain: number;
  grandTotalQi: number;
  netTotal: number;
};

export type CombinedDailyRevenue = {
  date: string;
  location1InStore: number;
  location2InStore: number;
  repair: number;
  total: number;
  withdrawalsLocation1: number;
  withdrawalsLocation2: number;
};

export function baghdadDateString(date?: Date): string {
  return (date ?? new Date()).toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
}

/** DB `timestamp` columns store Baghdad wall clock — compare in SQL, not JS Date. */
export function sqlBaghdadDayStart(dateStr: string) {
  return sql`((${dateStr}::date)::timestamp)`;
}

export function sqlBaghdadDayEnd(dateStr: string) {
  return sql`((((${dateStr}::date) + interval '1 day')::timestamp) - interval '1 millisecond')`;
}

/** JS Date → naive Baghdad wall-clock timestamp for SQL (never use toISOString()). */
export function sqlBaghdadWallClock(d: Date) {
  const s = d.toLocaleString("sv-SE", { timeZone: "Asia/Baghdad" });
  return sql`${s}::timestamp`;
}

/** Repair window end: calendar day end, extended through overnight shift if needed. */
export function sqlBaghdadRepairEndBound(dateStr: string, extendedEnd?: Date) {
  const dayEndSql = sqlBaghdadDayEnd(dateStr);
  if (!extendedEnd) return dayEndSql;
  const calendarEndMs = new Date(`${dateStr}T23:59:59.999+03:00`).getTime();
  if (extendedEnd.getTime() <= calendarEndMs) return dayEndSql;
  return sql`greatest(${dayEndSql}, ${sqlBaghdadWallClock(extendedEnd)})`;
}

export type DailyReportSummaryOptions = {
  /**
   * Owner WhatsApp report: all sales on the calendar day per location.
   * Shift report UI: shift-aware attribution (default).
   */
  calendarDayOnly?: boolean;
};

/** Full daily report payload for GET /api/daily-report (shift-aware Baghdad day). */
export async function computeDailyReportForApi(
  baghdadDateStr: string,
  salesLocationId: number,
  options?: DailyReportSummaryOptions,
) {
  const dayStartSql = sqlBaghdadDayStart(baghdadDateStr);
  const dayEndSql = sqlBaghdadDayEnd(baghdadDateStr);

  const allInStoreOrders: (typeof orders.$inferSelect)[] = [];

  if (options?.calendarDayOnly) {
    allInStoreOrders.push(
      ...(await db
        .select()
        .from(orders)
        .where(
          and(
            inArray(orders.orderType, ["walk-in", "in-store"]),
            eq(orders.salesLocationId, salesLocationId),
            orderIncludedInSalesReport,
            sql`${orders.createdAt} >= ${dayStartSql}`,
            sql`${orders.createdAt} <= ${dayEndSql}`,
          ),
        )),
    );
  } else {
    const shiftsStartedOnDate = await db
      .select()
      .from(salesShifts)
      .where(
        and(
          eq(salesShifts.salesLocationId, salesLocationId),
          sql`${salesShifts.salesUserId} not like 'tech:%'`,
          sql`${salesShifts.startTime} >= ${dayStartSql}`,
          sql`${salesShifts.startTime} <= ${dayEndSql}`,
        ),
      )
      .orderBy(desc(salesShifts.startTime));

    // Shifts that started earlier but were still open during this day (e.g. overnight)
    const shiftsOverlapping = await db
      .select()
      .from(salesShifts)
      .where(
        and(
          eq(salesShifts.salesLocationId, salesLocationId),
          sql`${salesShifts.salesUserId} not like 'tech:%'`,
          sql`${salesShifts.startTime} < ${dayStartSql}`,
          or(
            sql`${salesShifts.endTime} is null`,
            sql`${salesShifts.endTime} >= ${dayStartSql}`,
          ),
        ),
      )
      .orderBy(desc(salesShifts.startTime));

    const shiftsById = new Map<string, typeof salesShifts.$inferSelect>();
    for (const s of [...shiftsStartedOnDate, ...shiftsOverlapping]) {
      shiftsById.set(s.id, s);
    }
    const shiftsOnDate = Array.from(shiftsById.values());

    const seenOrderIds = new Set<string>();

    for (const shift of shiftsOnDate) {
      if (String(shift.status).toLowerCase() === "closed") {
        await reconcileClosedShiftRecord(shift.id);
      }
      const report = await computeShiftReportForShift(shift.id);
      for (const o of report.inStoreSales) {
        const orderDay = baghdadDateString(new Date(o.createdAt));
        if (orderDay !== baghdadDateStr) continue;
        if (!seenOrderIds.has(o.id)) {
          seenOrderIds.add(o.id);
          allInStoreOrders.push(o);
        }
      }
    }

    // Catch any POS sale on this Baghdad calendar day not tied to a shift window
    const calendarDayOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          inArray(orders.orderType, ["walk-in", "in-store"]),
          eq(orders.salesLocationId, salesLocationId),
          orderIncludedInSalesReport,
          sql`${orders.createdAt} >= ${dayStartSql}`,
          sql`${orders.createdAt} <= ${dayEndSql}`,
        ),
      );
    for (const o of calendarDayOrders) {
      if (!seenOrderIds.has(o.id)) {
        seenOrderIds.add(o.id);
        allInStoreOrders.push(o);
      }
    }
  }

  // Extend repair/withdrawal window through any shift that ran past midnight on this date
  let repairEndBound: ReturnType<typeof sqlBaghdadDayEnd> | ReturnType<typeof sql> = dayEndSql;
  let extendedEndDate: Date | null = null;
  if (!options?.calendarDayOnly) {
    const shiftsForRepair = await db
      .select()
      .from(salesShifts)
      .where(
        and(
          eq(salesShifts.salesLocationId, salesLocationId),
          sql`${salesShifts.salesUserId} not like 'tech:%'`,
          sql`${salesShifts.startTime} <= ${dayEndSql}`,
          or(
            sql`${salesShifts.endTime} is null`,
            sql`${salesShifts.endTime} >= ${dayStartSql}`,
          ),
        ),
      );
    let maxEndMs = new Date(`${baghdadDateStr}T23:59:59.999+03:00`).getTime();
    for (const shift of shiftsForRepair) {
      const ext = String(shift.status).toLowerCase() === "closed"
        ? await fetchShiftReportEndTime(shift.id, {
          status: shift.status,
          salesUserId: shift.salesUserId,
          salesLocationId: shift.salesLocationId,
          startTime: shift.startTime,
        })
        : new Date(shift.endTime || Date.now());
      maxEndMs = Math.max(maxEndMs, ext.getTime());
    }
    extendedEndDate = new Date(maxEndMs);
    repairEndBound = sqlBaghdadRepairEndBound(baghdadDateStr, extendedEndDate);
  }

  const paidRepairTickets =
    salesLocationId === LOCATION_MAIN_ID
      ? await db
          .select()
          .from(repairTickets)
          .where(
            and(
              repairTicketIncludedInSalesReport,
              sqlRepairTicketInSalesWindow(dayStartSql, repairEndBound),
            ),
          )
      : [];

  const withdrawalEndSql = options?.calendarDayOnly ? dayEndSql : repairEndBound;

  const dailyWithdrawals = await db
    .select()
    .from(cashWithdrawals)
    .where(
      and(
        eq(cashWithdrawals.source, "sales"),
        eq(cashWithdrawals.salesLocationId, salesLocationId),
        sql`${cashWithdrawals.createdAt} >= ${dayStartSql}`,
        sql`${cashWithdrawals.createdAt} <= ${withdrawalEndSql}`,
      ),
    )
    .orderBy(desc(cashWithdrawals.createdAt));

  const inStoreOrders = allInStoreOrders;
  const inStoreTotalCash = inStoreOrders.reduce((sum, o) => sum + orderCashAmount(o), 0);
  const inStoreTotalCard = inStoreOrders.reduce((sum, o) => sum + orderCardAmount(o), 0);
  const inStoreTotalZain = inStoreOrders
    .filter((o) => isInStoreZainCash(o))
    .reduce((sum, o) => sum + parseFloat(o.total), 0);
  const inStoreTotalQi = inStoreOrders
    .filter((o) => isInStoreQiCard(o))
    .reduce((sum, o) => sum + parseFloat(o.total), 0);
  const inStoreTotalDeferred = inStoreOrders
    .filter((o) => isOrderDeferred(o))
    .reduce((sum, o) => sum + parseFloat(o.total), 0);
  const inStoreTotal = inStoreOrders
    .filter((o) => !isOrderDeferred(o))
    .reduce((sum, o) => sum + parseFloat(o.total), 0);

  const totalWithdrawals = dailyWithdrawals.reduce((sum, w) => sum + parseFloat(w.amount), 0);

  const repairTotalDeferred = paidRepairTickets
    .filter((t) => t.paymentStatus === "deferred")
    .reduce((sum, t) => sum + parseFloat(t.finalCost || t.costEstimate || "0"), 0);
  const repairTotal = paidRepairTickets
    .filter((t) => t.paymentStatus !== "deferred")
    .reduce((sum, t) => sum + parseFloat(t.finalCost || t.costEstimate || "0"), 0);
  const repairTotalCash = paidRepairTickets.reduce((sum, t) => sum + repairCashAmount(t), 0);
  const repairTotalCard = paidRepairTickets.reduce((sum, t) => sum + repairCardAmount(t), 0);

  const grandTotal = inStoreTotal + repairTotal;

  const summary: DailyReportSummary = {
    inStoreCount: inStoreOrders.length,
    inStoreTotal,
    inStoreTotalCash,
    inStoreTotalCard,
    inStoreTotalZain,
    inStoreTotalQi,
    inStoreTotalDeferred,
    repairCount: paidRepairTickets.filter((t) => t.paymentStatus !== "deferred").length,
    repairTotal,
    repairTotalDeferred,
    repairTotalCash,
    repairTotalCard,
    repairTotalZain: 0,
    repairTotalQi: 0,
    totalWithdrawals,
    withdrawalCount: dailyWithdrawals.length,
    grandTotal,
    grandTotalCash: inStoreTotalCash + repairTotalCash,
    grandTotalCard: inStoreTotalCard + repairTotalCard,
    grandTotalZain: inStoreTotalZain,
    grandTotalQi: inStoreTotalQi,
    netTotal: grandTotal - totalWithdrawals,
  };

  return {
    date: new Date(`${baghdadDateStr}T00:00:00+03:00`).toISOString(),
    inStoreSales: inStoreOrders,
    repairSales: paidRepairTickets,
    withdrawals: dailyWithdrawals,
    summary,
  };
}

/** Summary-only helper (e.g. owner WhatsApp revenue digest). */
export async function computeDailyReportSummary(
  baghdadDateStr: string,
  salesLocationId: number,
  options?: DailyReportSummaryOptions,
): Promise<DailyReportSummary> {
  const report = await computeDailyReportForApi(baghdadDateStr, salesLocationId, options);
  return report.summary;
}

export async function computeCombinedDailyRevenue(
  baghdadDateStr: string,
): Promise<CombinedDailyRevenue> {
  const calendarOpts = { calendarDayOnly: true as const };
  const [loc1, loc2] = await Promise.all([
    computeDailyReportSummary(baghdadDateStr, LOCATION_MAIN_ID, calendarOpts),
    computeDailyReportSummary(baghdadDateStr, LOCATION_SHOP2_ID, calendarOpts),
  ]);

  const location1InStore = loc1.inStoreTotal;
  const location2InStore = loc2.inStoreTotal;
  const repair = loc1.repairTotal;

  return {
    date: baghdadDateStr,
    location1InStore,
    location2InStore,
    repair,
    total: location1InStore + location2InStore + repair,
    withdrawalsLocation1: loc1.totalWithdrawals,
    withdrawalsLocation2: loc2.totalWithdrawals,
  };
}

export function formatIqdAmount(n: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)} IQD`;
}

export function buildDailyRevenueWhatsAppMessage(
  revenue: CombinedDailyRevenue,
  storeNameAr?: string,
): string {
  const title = storeNameAr?.trim() || "عين للحاسبات";
  const lines = [
    `تقرير إيرادات يوم ${revenue.date}`,
    title,
    "",
    `الموقع 1: ${formatIqdAmount(revenue.location1InStore)}`,
    `الموقع 2: ${formatIqdAmount(revenue.location2InStore)}`,
    `الصيانة: ${formatIqdAmount(revenue.repair)}`,
    "",
    `الإجمالي: ${formatIqdAmount(revenue.total)}`,
  ];

  if (revenue.withdrawalsLocation1 > 0 || revenue.withdrawalsLocation2 > 0) {
    lines.push("");
    lines.push("السحوبات:");
    if (revenue.withdrawalsLocation1 > 0) {
      lines.push(`  الموقع 1: ${formatIqdAmount(revenue.withdrawalsLocation1)}`);
    }
    if (revenue.withdrawalsLocation2 > 0) {
      lines.push(`  الموقع 2: ${formatIqdAmount(revenue.withdrawalsLocation2)}`);
    }
  }

  return lines.join("\n");
}
