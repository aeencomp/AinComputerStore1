/** Shift row used to attribute untagged / admin POS orders to the cashier on duty. */
export type SalesShiftAttribution = {
  salesUserId: string;
  startTime: string | Date;
  endTime?: string | Date | null;
  salesLocationId?: number;
};

export function shiftCoversOrderTime(
  shift: SalesShiftAttribution,
  orderCreatedAt: string | Date,
): boolean {
  const t = new Date(orderCreatedAt).getTime();
  const start = new Date(shift.startTime).getTime();
  const end = shift.endTime ? new Date(shift.endTime).getTime() : Date.now();
  return t >= start && t <= end;
}

/**
 * Resolve which sales portal user should receive credit for a POS order.
 * Matches store shift reports: explicit salesperson, else shift owner at sale time.
 */
export function resolveOrderSalesOwner(
  order: { salespersonId?: string | null; createdAt: string | Date },
  shifts: SalesShiftAttribution[],
  knownSalesUserIds: ReadonlySet<string>,
): string | null {
  const sp = String(order.salespersonId ?? "").trim() || null;

  if (sp && knownSalesUserIds.has(sp)) {
    return sp;
  }

  const storeShifts = shifts
    .filter((s) => !String(s.salesUserId).startsWith("tech:") && shiftCoversOrderTime(s, order.createdAt))
    .sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );

  if (storeShifts.length > 0) {
    return storeShifts[0].salesUserId;
  }

  if (sp) return sp;
  return null;
}
