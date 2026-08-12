import type { RepairTicket } from "@shared/schema";

export type TechnicianRevenueStats = {
  totalRevenue: number;
  dailyRevenue: number;
  completedCount: number;
  completedRevenue: number;
  pendingCount: number;
  deliveredCount: number;
  deferredCount: number;
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

/** When a technician repair counts for daily revenue (Baghdad calendar day). */
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

export function computeTechnicianRevenueStats(tickets: RepairTicket[] | undefined): TechnicianRevenueStats {
  const empty: TechnicianRevenueStats = {
    totalRevenue: 0,
    dailyRevenue: 0,
    completedCount: 0,
    completedRevenue: 0,
    pendingCount: 0,
    deliveredCount: 0,
    deferredCount: 0,
  };
  if (!tickets?.length) return empty;

  const baghdadToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
  let totalRevenue = 0;
  let dailyRevenue = 0;
  let completedCount = 0;
  let completedRevenue = 0;
  let pendingCount = 0;
  let deliveredCount = 0;
  let deferredCount = 0;

  for (const ticket of tickets) {
    if (ticket.repairPaymentSource !== "technician") continue;

    const cost = ticketCost(ticket);
    const archived = ticket.isArchived === 1;

    if (!archived) {
      if (ticket.paymentStatus === "deferred") deferredCount++;
      if (ticket.status === "pending") pendingCount++;
    }

    if (ticket.status === "completed" || ticket.status === "delivered") {
      totalRevenue += cost;
    }

    const activityDay = getTechnicianDailyActivityDay(ticket);
    if (activityDay === baghdadToday) {
      dailyRevenue += cost;
    }

    if (!archived && ticket.status === "completed") {
      completedCount++;
      completedRevenue += cost;
    }

    if (!archived && ticket.status === "delivered") {
      deliveredCount++;
    }
  }

  return {
    totalRevenue,
    dailyRevenue,
    completedCount,
    completedRevenue,
    pendingCount,
    deliveredCount,
    deferredCount,
  };
}
