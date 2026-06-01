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
  isOrderDeferred,
  isInStoreZainCash,
  isInStoreQiCard,
  orderCashAmount,
  orderCardAmount,
  repairCashAmount,
  repairCardAmount,
} from "./order-payment";

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
function sqlBaghdadDayStart(dateStr: string) {
  return sql`((${dateStr}::date)::timestamp)`;
}

function sqlBaghdadDayEnd(dateStr: string) {
  return sql`((((${dateStr}::date) + interval '1 day')::timestamp) - interval '1 millisecond')`;
}

export type DailyReportSummaryOptions = {
  /**
   * Owner WhatsApp report: all sales on the calendar day per location.
   * Shift report UI: shift-aware attribution (default).
   */
  calendarDayOnly?: boolean;
};

/** Same logic as GET /api/daily-report — shift-aware Baghdad calendar day (SQL timestamps). */
export async function computeDailyReportSummary(
  baghdadDateStr: string,
  salesLocationId: number,
  options?: DailyReportSummaryOptions,
): Promise<DailyReportSummary> {
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
            sql`${orders.createdAt} >= ${dayStartSql}`,
            sql`${orders.createdAt} <= ${dayEndSql}`,
          ),
        )),
    );
  } else {
    const shiftsOnDate = await db
      .select()
      .from(salesShifts)
      .where(
        and(
          eq(salesShifts.salesLocationId, salesLocationId),
          sql`${salesShifts.startTime} >= ${dayStartSql}`,
          sql`${salesShifts.startTime} <= ${dayEndSql}`,
        ),
      )
      .orderBy(desc(salesShifts.startTime));

    const effectiveEndSql =
      shiftsOnDate.length > 0
        ? sql`(
            select greatest(
              ${dayEndSql},
              coalesce(max(coalesce(end_time, timezone('Asia/Baghdad', now()))), ${dayEndSql})
            )
            from sales_shifts
            where sales_location_id = ${salesLocationId}
              and start_time >= ${dayStartSql}
              and start_time <= ${dayEndSql}
          )`
        : dayEndSql;

    const seenOrderIds = new Set<string>();

    if (shiftsOnDate.length > 0) {
      for (const shift of shiftsOnDate) {
        const shiftStartSql = sql`(select start_time from sales_shifts where id = ${shift.id} limit 1)`;
        const shiftEndSql = sql`(select coalesce(end_time, timezone('Asia/Baghdad', now())) from sales_shifts where id = ${shift.id} limit 1)`;
        const shiftOrders = await db
          .select()
          .from(orders)
          .where(
            and(
              inArray(orders.orderType, ["walk-in", "in-store"]),
              eq(orders.salesLocationId, salesLocationId),
              eq(orders.salespersonId, shift.salesUserId),
              sql`${orders.createdAt} >= ${shiftStartSql}`,
              sql`${orders.createdAt} <= ${shiftEndSql}`,
            ),
          );
        for (const o of shiftOrders) {
          if (!seenOrderIds.has(o.id)) {
            seenOrderIds.add(o.id);
            allInStoreOrders.push(o);
          }
        }
      }

      const adminOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            inArray(orders.orderType, ["walk-in", "in-store"]),
            eq(orders.salesLocationId, salesLocationId),
            isNull(orders.salespersonId),
            sql`${orders.createdAt} >= ${dayStartSql}`,
            sql`${orders.createdAt} <= ${effectiveEndSql}`,
          ),
        );
      for (const o of adminOrders) {
        if (!seenOrderIds.has(o.id)) {
          seenOrderIds.add(o.id);
          allInStoreOrders.push(o);
        }
      }

      const adminTaggedRows = await db
        .select({ o: orders })
        .from(orders)
        .innerJoin(adminUsers, eq(orders.salespersonId, adminUsers.id))
        .where(
          and(
            inArray(orders.orderType, ["walk-in", "in-store"]),
            eq(orders.salesLocationId, salesLocationId),
            sql`${orders.createdAt} >= ${dayStartSql}`,
            sql`${orders.createdAt} <= ${effectiveEndSql}`,
          ),
        );
      for (const row of adminTaggedRows) {
        const o = row.o;
        if (!seenOrderIds.has(o.id)) {
          seenOrderIds.add(o.id);
          allInStoreOrders.push(o);
        }
      }
    } else {
      const calOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            inArray(orders.orderType, ["walk-in", "in-store"]),
            eq(orders.salesLocationId, salesLocationId),
            sql`${orders.createdAt} >= ${dayStartSql}`,
            sql`${orders.createdAt} <= ${dayEndSql}`,
          ),
        );
      allInStoreOrders.push(...calOrders);
    }
  }

  const repairEndSql = options?.calendarDayOnly ? dayEndSql : sql`(
    select greatest(
      ${dayEndSql},
      coalesce(
        (select max(coalesce(end_time, timezone('Asia/Baghdad', now())))
         from sales_shifts
         where sales_location_id = ${salesLocationId}
           and start_time >= ${dayStartSql}
           and start_time <= ${dayEndSql}),
        ${dayEndSql}
      )
    )
  )`;

  const paidRepairTickets =
    salesLocationId === LOCATION_MAIN_ID
      ? await db
          .select()
          .from(repairTickets)
          .where(
            or(
              and(
                eq(repairTickets.paymentStatus, "paid"),
                sql`${repairTickets.updatedAt} >= ${dayStartSql}`,
                sql`${repairTickets.updatedAt} <= ${repairEndSql}`,
              ),
              and(
                eq(repairTickets.status, "delivered"),
                isNotNull(repairTickets.deliveredAt),
                sql`${repairTickets.deliveredAt} >= ${dayStartSql}`,
                sql`${repairTickets.deliveredAt} <= ${repairEndSql}`,
              ),
            ),
          )
      : [];

  const withdrawalEndSql = options?.calendarDayOnly ? dayEndSql : repairEndSql;

  const dailyWithdrawals = await db
    .select()
    .from(cashWithdrawals)
    .where(
      and(
        eq(cashWithdrawals.salesLocationId, salesLocationId),
        sql`${cashWithdrawals.createdAt} >= ${dayStartSql}`,
        sql`${cashWithdrawals.createdAt} <= ${withdrawalEndSql}`,
      ),
    );

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

  return {
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
