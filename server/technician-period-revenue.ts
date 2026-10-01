import { cashWithdrawals } from "@shared/schema";
import { WITHDRAWAL_SOURCE_TECHNICIAN } from "@shared/schema";
import type { RepairTicket } from "@shared/schema";
import {
  normalizeBaghdadDateRange,
  previousBaghdadPeriod,
} from "@shared/baghdadDateRange";
import { computeTechnicianRevenueStats } from "@shared/technicianRevenue";
import { db } from "./db";
import { and, eq, sql } from "drizzle-orm";
import { LOCATION_MAIN_ID } from "./sales-locations";

async function sumTechnicianWithdrawals(from: string, to: string): Promise<number> {
  const dateFromClause = sql`(${cashWithdrawals.createdAt} AT TIME ZONE 'Asia/Baghdad')::date >= ${from}::date`;
  const dateToClause = sql`(${cashWithdrawals.createdAt} AT TIME ZONE 'Asia/Baghdad')::date <= ${to}::date`;
  const rows = await db
    .select({ amount: cashWithdrawals.amount })
    .from(cashWithdrawals)
    .where(
      and(
        eq(cashWithdrawals.source, WITHDRAWAL_SOURCE_TECHNICIAN),
        eq(cashWithdrawals.salesLocationId, LOCATION_MAIN_ID),
        dateFromClause,
        dateToClause,
      ),
    );
  return rows.reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0);
}

export async function computeTechnicianPeriodRevenueSummary(
  tickets: RepairTicket[],
  fromStr: string,
  toStr: string,
) {
  const { from, to } = normalizeBaghdadDateRange(fromStr, toStr);
  const stats = computeTechnicianRevenueStats(tickets, { from, to });
  const totalWithdrawals = await sumTechnicianWithdrawals(from, to);
  const netTotal = stats.periodRevenue - totalWithdrawals;

  const prev = previousBaghdadPeriod(from, to);
  const prevStats = computeTechnicianRevenueStats(tickets, prev);
  const prevWithdrawals = await sumTechnicianWithdrawals(prev.from, prev.to);
  const prevNetTotal = prevStats.periodRevenue - prevWithdrawals;

  return {
    from,
    to,
    periodRevenue: stats.periodRevenue,
    totalWithdrawals,
    netTotal,
    previousPeriod: {
      from: prev.from,
      to: prev.to,
      periodRevenue: prevStats.periodRevenue,
      totalWithdrawals: prevWithdrawals,
      netTotal: prevNetTotal,
    },
  };
}
