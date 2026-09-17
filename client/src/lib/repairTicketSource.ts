import type { RepairTicket } from "@shared/schema";

/** Read request source from API row (camelCase or legacy snake_case). */
export function getRepairTicketRequestSource(
  ticket: RepairTicket | null | undefined,
): "online" | "technician" {
  if (!ticket) return "technician";
  const raw = ticket.requestSource ?? (ticket as { request_source?: string }).request_source;
  return raw === "online" ? "online" : "technician";
}

export function isOnlineRepairTicket(ticket: RepairTicket | null | undefined): boolean {
  return getRepairTicketRequestSource(ticket) === "online";
}
