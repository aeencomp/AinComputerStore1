import { db } from "./db";
import { cashWithdrawals, repairTickets, salesShifts } from "@shared/schema";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";
import { LOCATION_MAIN_ID } from "./sales-locations";
import {
  fetchShiftReportEndTime,
  reconcileClosedShiftRecord,
} from "./shift-report";
import { repairCashAmount, repairCardAmount } from "./order-payment";
import {
  sqlRepairTicketInSalesWindow,
  sqlRepairTicketIncludedInTechnicianDailyReport,
} from "./repair-sales-date";
import {
  sqlBaghdadDayStart,
  sqlBaghdadRepairEndBound,
} from "./daily-revenue-report";
import { WITHDRAWAL_SOURCE_TECHNICIAN } from "@shared/schema";

export type RepairReportSummary = {
  repairCount: number;
  repairTotal: number;
  repairTotalDeferred: number;
  repairTotalCash: number;
  repairTotalCard: number;
  totalWithdrawals: number;
  withdrawalCount: number;
  netTotal: number;
};

/** Technician daily repair report — all calendar-day payments; withdrawals stay technician-only. */
export async function computeRepairReport(baghdadDateStr: string) {
  const startOfDay = new Date(`${baghdadDateStr}T00:00:00+03:00`);
  const endOfDay = new Date(`${baghdadDateStr}T23:59:59.999+03:00`);

  const shiftsOnDate = await db
    .select()
    .from(salesShifts)
    .where(
      and(
        eq(salesShifts.salesLocationId, LOCATION_MAIN_ID),
        gte(salesShifts.startTime, startOfDay),
        lte(salesShifts.startTime, endOfDay),
      ),
    )
    .orderBy(desc(salesShifts.startTime));

  const now = new Date();
  const extendedShiftEnds = new Map<string, Date>();
  for (const shift of shiftsOnDate) {
    if (String(shift.status).toLowerCase() === "closed") {
      await reconcileClosedShiftRecord(shift.id);
      extendedShiftEnds.set(
        shift.id,
        await fetchShiftReportEndTime(shift.id, {
          status: shift.status,
          salesUserId: shift.salesUserId,
          salesLocationId: shift.salesLocationId,
          startTime: shift.startTime,
        }),
      );
    } else {
      extendedShiftEnds.set(shift.id, shift.endTime || now);
    }
  }

  const effectiveEnd =
    shiftsOnDate.length > 0
      ? new Date(
          Math.max(
            endOfDay.getTime(),
            ...Array.from(extendedShiftEnds.values()).map((d) => d.getTime()),
          ),
        )
      : endOfDay;

  const dayStartSql = sqlBaghdadDayStart(baghdadDateStr);
  const repairEndSql = sqlBaghdadRepairEndBound(baghdadDateStr, effectiveEnd);

  const paidRepairTickets = await db
    .select()
    .from(repairTickets)
    .where(
      and(
        sqlRepairTicketIncludedInTechnicianDailyReport(),
        sqlRepairTicketInSalesWindow(dayStartSql, repairEndSql),
      ),
    );

  const dailyWithdrawals = await db
    .select()
    .from(cashWithdrawals)
    .where(
      and(
        eq(cashWithdrawals.source, WITHDRAWAL_SOURCE_TECHNICIAN),
        eq(cashWithdrawals.salesLocationId, LOCATION_MAIN_ID),
        sql`(${cashWithdrawals.createdAt} AT TIME ZONE 'Asia/Baghdad')::date = ${baghdadDateStr}::date`,
      ),
    )
    .orderBy(desc(cashWithdrawals.createdAt));

  const repairTotalDeferred = paidRepairTickets
    .filter((t) => t.paymentStatus === "deferred")
    .reduce((sum, t) => sum + parseFloat(t.finalCost || t.costEstimate || "0"), 0);
  const repairTotal = paidRepairTickets
    .filter((t) => t.paymentStatus !== "deferred")
    .reduce((sum, t) => sum + parseFloat(t.finalCost || t.costEstimate || "0"), 0);
  const repairTotalCash = paidRepairTickets.reduce((sum, t) => sum + repairCashAmount(t), 0);
  const repairTotalCard = paidRepairTickets.reduce((sum, t) => sum + repairCardAmount(t), 0);
  const totalWithdrawals = dailyWithdrawals.reduce((sum, w) => sum + parseFloat(w.amount), 0);

  return {
    date: startOfDay.toISOString(),
    repairSales: paidRepairTickets,
    withdrawals: dailyWithdrawals,
    summary: {
      repairCount: paidRepairTickets.filter((t) => t.paymentStatus !== "deferred").length,
      repairTotal,
      repairTotalDeferred,
      repairTotalCash,
      repairTotalCard,
      totalWithdrawals,
      withdrawalCount: dailyWithdrawals.length,
      netTotal: repairTotal - totalWithdrawals,
    } satisfies RepairReportSummary,
  };
}
