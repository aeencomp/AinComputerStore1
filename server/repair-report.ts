import { db } from "./db";
import { cashWithdrawals, repairTickets, salesShifts } from "@shared/schema";
import { and, eq, desc, or, isNull, sql, type SQL } from "drizzle-orm";
import { LOCATION_MAIN_ID } from "./sales-locations";
import {
  fetchShiftReportEndTime,
  reconcileClosedShiftRecord,
} from "./shift-report";
import { repairCashAmount, repairCardAmount } from "./order-payment";
import {
  sqlRepairTicketInTechnicianReportWindow,
  sqlRepairTicketTechnicianActivityAt,
} from "./repair-sales-date";
import {
  sqlBaghdadDayStart,
  sqlBaghdadDayEnd,
  sqlBaghdadRepairEndBound,
} from "./daily-revenue-report";
import { WITHDRAWAL_SOURCE_TECHNICIAN } from "@shared/schema";
import { technicianShiftOwnerId } from "./technician-shift";

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

export type RepairReportOptions = {
  /** Scope repairs/withdrawals to this technician's shift windows on the selected day. */
  technicianId?: string;
};

/** Technician daily repair report — scoped to technician shift windows on the Baghdad calendar day. */
export async function computeRepairReport(
  baghdadDateStr: string,
  options?: RepairReportOptions,
) {
  const startOfDay = new Date(`${baghdadDateStr}T00:00:00+03:00`);
  const endOfDay = new Date(`${baghdadDateStr}T23:59:59.999+03:00`);
  const dayStartSql = sqlBaghdadDayStart(baghdadDateStr);
  const dayEndSql = sqlBaghdadDayEnd(baghdadDateStr);

  const shiftConditions: SQL[] = [
    eq(salesShifts.salesLocationId, LOCATION_MAIN_ID),
    sql`${salesShifts.salesUserId} like 'tech:%'`,
    sql`${salesShifts.startTime} <= ${dayEndSql}`,
    or(isNull(salesShifts.endTime), sql`${salesShifts.endTime} >= ${dayStartSql}`)!,
  ];

  if (options?.technicianId) {
    shiftConditions.push(eq(salesShifts.salesUserId, technicianShiftOwnerId(options.technicianId)));
  }

  const overlappingShifts = await db
    .select()
    .from(salesShifts)
    .where(and(...shiftConditions))
    .orderBy(desc(salesShifts.startTime));

  let withdrawalEndSql: SQL = dayEndSql;
  if (overlappingShifts.length > 0) {
    let maxEndMs = endOfDay.getTime();
    for (const shift of overlappingShifts) {
      if (String(shift.status).toLowerCase() === "closed") {
        await reconcileClosedShiftRecord(shift.id);
        const ext = await fetchShiftReportEndTime(shift.id, {
          status: shift.status,
          salesUserId: shift.salesUserId,
          salesLocationId: shift.salesLocationId,
          startTime: shift.startTime,
        });
        maxEndMs = Math.max(maxEndMs, ext.getTime());
      } else {
        maxEndMs = Math.max(maxEndMs, Date.now());
      }
    }
    withdrawalEndSql = sqlBaghdadRepairEndBound(baghdadDateStr, new Date(maxEndMs));
  }

  const activityAt = sqlRepairTicketTechnicianActivityAt();
  let repairConditions: SQL = sqlRepairTicketInTechnicianReportWindow(dayStartSql, withdrawalEndSql);

  if (options?.technicianId) {
    const ownerId = technicianShiftOwnerId(options.technicianId);
    repairConditions = and(
      repairConditions,
      sql`exists (
        select 1 from sales_shifts ss
        where ss.sales_user_id = ${ownerId}
          and coalesce(ss.sales_location_id, 1) = ${LOCATION_MAIN_ID}
          and ${activityAt} >= ss.start_time
          and ${activityAt} <= coalesce(ss.end_time, ${dayEndSql})
      )`,
    )!;
  }

  const paidRepairTickets = await db
    .select()
    .from(repairTickets)
    .where(repairConditions)
    .orderBy(desc(activityAt));

  const withdrawalConditions: SQL[] = [
    eq(cashWithdrawals.source, WITHDRAWAL_SOURCE_TECHNICIAN),
    eq(cashWithdrawals.salesLocationId, LOCATION_MAIN_ID),
    sql`${cashWithdrawals.createdAt} >= ${dayStartSql}`,
    sql`${cashWithdrawals.createdAt} <= ${withdrawalEndSql}`,
  ];

  const dailyWithdrawals = await db
    .select()
    .from(cashWithdrawals)
    .where(and(...withdrawalConditions))
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
