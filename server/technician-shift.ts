import { db } from "./db";
import { salesShifts } from "@shared/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { LOCATION_MAIN_ID } from "./sales-locations";
import { computeShiftReportForShift } from "./shift-report";
import { orderCashAmount, repairCashAmount, isOrderDeferred } from "./order-payment";

export function technicianShiftOwnerId(technicianId: string) {
  return `tech:${technicianId}`;
}

function baghdadCalendarDateString(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
}

const salesShiftIsOpen = sql`lower(trim(${salesShifts.status})) in ('active', 'paused')`;
const salesShiftIsActive = sql`lower(trim(${salesShifts.status})) = 'active'`;

async function autoCloseShiftRecord(shiftId: string, reason: string): Promise<void> {
  const endTime = sql`timezone('Asia/Baghdad', now())`;
  await db
    .update(salesShifts)
    .set({
      status: "closed",
      endTime,
      notes: sql`COALESCE(${salesShifts.notes}, '') || ${"\n[auto] " + reason}`,
    })
    .where(eq(salesShifts.id, shiftId));
}

export async function findTechnicianRepairShift(
  technicianId: string,
  mode: "open" | "active" = "open",
) {
  const ownerId = technicianShiftOwnerId(technicianId);
  const statusFilter = mode === "active" ? salesShiftIsActive : salesShiftIsOpen;
  const [shift] = await db
    .select()
    .from(salesShifts)
    .where(
      and(
        eq(salesShifts.salesUserId, ownerId),
        statusFilter,
        eq(salesShifts.salesLocationId, LOCATION_MAIN_ID),
      ),
    )
    .orderBy(desc(salesShifts.startTime))
    .limit(1);
  return shift;
}

export async function startTechnicianRepairShift(
  technicianId: string,
  displayName: string,
  openingCash: string,
  notes?: string | null,
) {
  const ownerId = technicianShiftOwnerId(technicianId);
  let existingShift = await findTechnicianRepairShift(technicianId, "open");

  if (existingShift) {
    const shiftDay = baghdadCalendarDateString(new Date(existingShift.startTime));
    const today = baghdadCalendarDateString(new Date());
    if (shiftDay < today) {
      await autoCloseShiftRecord(
        existingShift.id,
        `closed stale repair shift from ${shiftDay} before starting ${today}`,
      );
      existingShift = null;
    }
  }

  if (existingShift) {
    const isPaused = String(existingShift.status).toLowerCase() === "paused";
    return {
      ok: false as const,
      error: isPaused
        ? "لديك وردية صيانة متوقفة. أنهها قبل بدء وردية جديدة."
        : "لديك وردية صيانة مفتوحة بالفعل",
      shift: existingShift,
    };
  }

  const [newShift] = await db
    .insert(salesShifts)
    .values({
      salesUserId: ownerId,
      salesUserName: `${displayName} (صيانة)`,
      openingCash: (openingCash || "0").toString(),
      notes: notes ? `[repair] ${notes}` : "[repair]",
      status: "active",
      salesLocationId: LOCATION_MAIN_ID,
    })
    .returning();

  return { ok: true as const, shift: newShift };
}

export async function endTechnicianRepairShift(
  technicianId: string,
  closingCash: string,
  notes?: string | null,
) {
  const activeShift = await findTechnicianRepairShift(technicianId, "open");
  if (!activeShift) {
    return { ok: false as const, error: "لا توجد وردية صيانة مفتوحة" };
  }

  const endTime = sql`timezone('Asia/Baghdad', now())`;
  const report = await computeShiftReportForShift(activeShift.id);
  const shiftOrders = report.inStoreSales;
  const shiftRepairs = report.repairSales;

  const cashSalesOrders = shiftOrders.reduce((sum, o) => sum + orderCashAmount(o), 0);
  const cashRepairs = shiftRepairs.reduce((sum, t) => sum + repairCashAmount(t), 0);
  const totalCash = cashSalesOrders + cashRepairs;

  const totalOrderSales = shiftOrders
    .filter((o) => !isOrderDeferred(o))
    .reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
  const totalRepairSales = shiftRepairs
    .filter((t) => t.paymentStatus !== "deferred")
    .reduce((sum, t) => sum + parseFloat(t.finalCost || t.costEstimate || "0"), 0);
  const totalAllSales = totalOrderSales + totalRepairSales;

  const expectedCash = parseFloat(activeShift.openingCash || "0") + totalCash;
  const closingCashNum = parseFloat(closingCash || "0");
  const cashDifference = closingCashNum - expectedCash;

  const noteSuffix = notes ? `\n[repair close] ${notes}` : "";
  const [updatedShift] = await db
    .update(salesShifts)
    .set({
      endTime,
      closingCash: closingCash?.toString() || null,
      expectedCash: expectedCash.toString(),
      cashDifference: cashDifference.toString(),
      totalSales: totalAllSales.toString(),
      totalTransactions:
        shiftOrders.length + shiftRepairs.filter((t) => t.paymentStatus !== "deferred").length,
      notes: sql`COALESCE(${salesShifts.notes}, '') || ${noteSuffix}`,
      status: "closed",
      reopenedAt: null,
      originalEndTime: null,
    })
    .where(eq(salesShifts.id, activeShift.id))
    .returning();

  return { ok: true as const, shift: updatedShift };
}
