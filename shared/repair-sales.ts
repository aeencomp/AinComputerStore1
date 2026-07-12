export const REPAIR_PAYMENT_SOURCE_SALES = "sales" as const;
export const REPAIR_PAYMENT_SOURCE_TECHNICIAN = "technician" as const;

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
export function parseBaghdadTimestamp(value: Date | string): Date {
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
    if (m) return new Date(`${m[1]}T${m[2]}+03:00`);
  }
  if (value instanceof Date) {
    const s = value.toISOString().slice(0, 19);
    const [datePart, timePart] = s.split("T");
    if (datePart && timePart) return new Date(`${datePart}T${timePart}+03:00`);
  }
  return new Date(value);
}

export function repairTicketSalesAt(ticket: RepairSalesDateFields): Date | null {
  if (ticket.status === "delivered" && ticket.deliveredAt) {
    return parseBaghdadTimestamp(ticket.deliveredAt);
  }
  if (ticket.paymentStatus === "paid") {
    if (ticket.paidAt) return parseBaghdadTimestamp(ticket.paidAt);
    if (ticket.updatedAt) return parseBaghdadTimestamp(ticket.updatedAt);
    return null;
  }
  return null;
}

export function repairTicketEligibleForSalesReport(ticket: {
  status: string;
  paymentStatus?: string | null;
  excludedFromSalesReport?: number | null;
  repairPaymentSource?: string | null;
}): boolean {
  if (!repairTicketIncludedInStoreSalesReport(ticket)) return false;
  if (ticket.status === "delivered") return true;
  if (ticket.paymentStatus === "paid") return true;
  if (ticket.paymentStatus === "deferred") return true;
  return false;
}

/** Store / cashier reports only — excludes technician portal repair payments. */
export function repairTicketIncludedInStoreSalesReport(ticket: {
  excludedFromSalesReport?: number | null;
  repairPaymentSource?: string | null;
}): boolean {
  if (ticket.excludedFromSalesReport === 1) return false;
  if (ticket.repairPaymentSource === REPAIR_PAYMENT_SOURCE_TECHNICIAN) return false;
  return true;
}
