/** Fields needed to determine when a repair ticket counts in sales reports. */
export type RepairSalesDateFields = {
  status: string;
  paymentStatus?: string | null;
  deliveredAt?: Date | string | null;
  paidAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

/**
 * Stable sales date for a repair ticket — never use updatedAt for delivered/paid repairs
 * (updatedAt changes on archive, notes, etc. and causes old repairs to reappear in sales).
 */
export function repairTicketSalesAt(ticket: RepairSalesDateFields): Date | null {
  if (ticket.status === "delivered" && ticket.deliveredAt) {
    return new Date(ticket.deliveredAt);
  }
  if (ticket.paymentStatus === "paid") {
    if (ticket.paidAt) return new Date(ticket.paidAt);
    if (ticket.updatedAt) return new Date(ticket.updatedAt);
    return null;
  }
  return null;
}

export function repairTicketEligibleForSalesReport(ticket: {
  status: string;
  paymentStatus?: string | null;
  excludedFromSalesReport?: number | null;
}): boolean {
  if (ticket.excludedFromSalesReport === 1) return false;
  if (ticket.status === "delivered") return true;
  if (ticket.paymentStatus === "paid") return true;
  if (ticket.paymentStatus === "deferred") return true;
  return false;
}

/** Baghdad calendar day for a repair in daily/shift reports (blocks wrong-day bleed). */
export function repairTicketOnBaghdadReportDay(
  ticket: RepairSalesDateFields,
  baghdadDateStr: string,
  extendedEnd?: Date | null,
): boolean {
  const salesAt = repairTicketSalesAt(ticket);
  if (!salesAt) return false;
  const day = salesAt.toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
  if (day < baghdadDateStr) return false;
  if (day === baghdadDateStr) return true;
  if (extendedEnd && salesAt.getTime() <= extendedEnd.getTime()) return true;
  return false;
}
