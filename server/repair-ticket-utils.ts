import type { RepairTicket } from "@shared/schema";

export function omitInternalRepairFields<T extends { internalTeamNotes?: string | null }>(ticket: T) {
  const { internalTeamNotes: _internal, ...rest } = ticket;
  return rest;
}

function normalizeRepairField(key: string, value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (
    key === "estimatedCompletion" ||
    key === "completedAt" ||
    key === "deliveredAt" ||
    key === "paidAt" ||
    key === "receivedAt" ||
    key === "createdAt" ||
    key === "updatedAt"
  ) {
    const ms = new Date(String(value)).getTime();
    return Number.isNaN(ms) ? String(value) : String(ms);
  }
  if (
    key === "costEstimate" ||
    key === "finalCost" ||
    key === "cashPaidAmount" ||
    key === "cardPaidAmount"
  ) {
    const n = parseFloat(String(value));
    return Number.isNaN(n) ? String(value) : n.toFixed(2);
  }
  return String(value);
}

/** True when save should trigger a customer WhatsApp update (internal team notes alone do not). */
export function repairTicketUpdateNotifiesCustomer(
  existing: RepairTicket,
  updateData: Record<string, unknown>,
  whatsappCustomMessage: string,
): boolean {
  if (whatsappCustomMessage.trim()) return true;
  for (const key of Object.keys(updateData)) {
    if (key === "internalTeamNotes") continue;
    const before = normalizeRepairField(key, (existing as Record<string, unknown>)[key]);
    const after = normalizeRepairField(key, updateData[key]);
    if (before !== after) return true;
  }
  return false;
}
