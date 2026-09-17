import type { RepairTicket } from "@shared/schema";

export type TechnicianRevenueStats = {
  /** All-time completed + delivered revenue. */
  totalRevenue: number;
  /** Revenue for completed/delivered tickets within the selected date range. */
  periodRevenue: number;
  completedCount: number;
  completedRevenue: number;
  pendingCount: number;
  deliveredCount: number;
  deferredCount: number;
};

export type TechnicianRevenueRange = {
  from: string;
  to: string;
};

function ticketCost(ticket: RepairTicket): number {
  return parseFloat(ticket.finalCost || ticket.costEstimate || "0");
}

function baghdadDayKey(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
}

/** Technician daily report — technician-tagged payments only. */
export function getTechnicianDailyActivityDay(ticket: RepairTicket): string | null {
  if (ticket.repairPaymentSource !== "technician") return null;
  if (ticket.isArchived === 1) return null;

  if (ticket.status === "delivered") {
    return baghdadDayKey(ticket.deliveredAt);
  }

  if (ticket.paymentStatus === "paid" && ticket.paidAt) {
    return baghdadDayKey(ticket.paidAt);
  }

  if (ticket.status === "completed" && ticket.completedAt) {
    return baghdadDayKey(ticket.completedAt);
  }

  if (ticket.paymentStatus === "deferred") {
    return baghdadDayKey(ticket.paidAt || ticket.updatedAt);
  }

  return null;
}

export function baghdadTodayKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
}

export function baghdadMonthStartKey(): string {
  const today = baghdadTodayKey();
  return `${today.slice(0, 8)}01`;
}

function normalizeRevenueRange(range?: TechnicianRevenueRange): TechnicianRevenueRange {
  const today = baghdadTodayKey();
  const from = range?.from?.trim() || baghdadMonthStartKey();
  const to = range?.to?.trim() || today;
  return from <= to ? { from, to } : { from: to, to: from };
}

function isDayInRange(day: string | null, from: string, to: string): boolean {
  if (!day) return false;
  return day >= from && day <= to;
}

/** Dashboard stats — all repair tickets visible in the technician portal. */
export function computeTechnicianRevenueStats(
  tickets: RepairTicket[] | undefined,
  range?: TechnicianRevenueRange,
): TechnicianRevenueStats {
  const empty: TechnicianRevenueStats = {
    totalRevenue: 0,
    periodRevenue: 0,
    completedCount: 0,
    completedRevenue: 0,
    pendingCount: 0,
    deliveredCount: 0,
    deferredCount: 0,
  };
  if (!tickets?.length) return empty;

  const { from, to } = normalizeRevenueRange(range);
  let totalRevenue = 0;
  let periodRevenue = 0;
  let completedCount = 0;
  let completedRevenue = 0;
  let pendingCount = 0;
  let deliveredCount = 0;
  let deferredCount = 0;

  for (const ticket of tickets) {
    const cost = ticketCost(ticket);
    const archived = ticket.isArchived === 1;

    if (!archived) {
      if (ticket.paymentStatus === "deferred") deferredCount++;
      if (ticket.status === "pending") pendingCount++;
    }

    if (ticket.status === "completed") {
      totalRevenue += cost;
      const completedDay = baghdadDayKey(ticket.completedAt || ticket.updatedAt);
      if (isDayInRange(completedDay, from, to)) periodRevenue += cost;
      if (!archived) {
        completedCount++;
        completedRevenue += cost;
      }
    } else if (ticket.status === "delivered") {
      totalRevenue += cost;
      const deliveredDay = baghdadDayKey(ticket.deliveredAt || ticket.updatedAt);
      if (isDayInRange(deliveredDay, from, to)) periodRevenue += cost;
      if (!archived) deliveredCount++;
    }
  }

  return {
    totalRevenue,
    periodRevenue,
    completedCount,
    completedRevenue,
    pendingCount,
    deliveredCount,
    deferredCount,
  };
}
