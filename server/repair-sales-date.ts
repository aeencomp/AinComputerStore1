import { repairTickets } from "@shared/schema";
import { sql, and, or, eq, ne, isNotNull, type SQL } from "drizzle-orm";

export const REPAIR_PAYMENT_SOURCE_SALES = "sales" as const;
export const REPAIR_PAYMENT_SOURCE_TECHNICIAN = "technician" as const;

/** Store / cashier repair payments only (strict — never technician-tagged). */
export function sqlRepairTicketIncludedInStoreSales(): SQL {
  return and(
    eq(repairTickets.excludedFromSalesReport, 0),
    eq(repairTickets.repairPaymentSource, REPAIR_PAYMENT_SOURCE_SALES),
  )!;
}

/** Technician portal repair payments only (strict — never store-tagged). */
export function sqlRepairTicketIncludedInTechnicianSales(): SQL {
  return eq(repairTickets.repairPaymentSource, REPAIR_PAYMENT_SOURCE_TECHNICIAN);
}

/** Technician daily calendar report (same scope as shift technician repairs). */
export function sqlRepairTicketIncludedInTechnicianDailyReport(): SQL {
  return sqlRepairTicketIncludedInTechnicianSales();
}

/** SQL expression: stable timestamp when a repair counts in sales (not updatedAt for delivered). */
export function sqlRepairTicketSalesAt() {
  return sql`case
    when ${repairTickets.status} = 'delivered' and ${repairTickets.deliveredAt} is not null then ${repairTickets.deliveredAt}
    when ${repairTickets.paymentStatus} = 'paid' and ${repairTickets.paidAt} is not null then ${repairTickets.paidAt}
    when ${repairTickets.status} = 'delivered' and ${repairTickets.paymentStatus} = 'paid'
      then coalesce(${repairTickets.deliveredAt}, ${repairTickets.paidAt}, ${repairTickets.updatedAt})
    when ${repairTickets.paymentStatus} = 'paid' then coalesce(${repairTickets.paidAt}, ${repairTickets.updatedAt})
    else null
  end`;
}

/** Repair ticket is eligible to appear in sales/shift reports. */
export function sqlRepairTicketEligibleForSalesQuery(): SQL {
  return or(
    and(eq(repairTickets.paymentStatus, "paid"), ne(repairTickets.status, "delivered")),
    and(
      eq(repairTickets.status, "delivered"),
      or(isNotNull(repairTickets.deliveredAt), isNotNull(repairTickets.paidAt)),
    ),
    and(eq(repairTickets.paymentStatus, "paid"), isNotNull(repairTickets.paidAt)),
    eq(repairTickets.paymentStatus, "deferred"),
  )!;
}

/** When a technician-tagged repair counts for daily/shift reports (incl. 0 IQD delivered). */
export function sqlRepairTicketTechnicianActivityAt() {
  return sql`coalesce(${repairTickets.deliveredAt}, ${repairTickets.paidAt}, ${repairTickets.updatedAt})`;
}

/** Technician report window — paid, delivered (incl. 0 IQD), or deferred. */
export function sqlRepairTicketInTechnicianReportWindow(startSql: SQL, endSql: SQL): SQL {
  const activityAt = sqlRepairTicketTechnicianActivityAt();
  return and(
    sqlRepairTicketIncludedInTechnicianSales(),
    or(
      eq(repairTickets.paymentStatus, "deferred"),
      eq(repairTickets.status, "delivered"),
      eq(repairTickets.paymentStatus, "paid"),
    )!,
    sql`${activityAt} >= ${startSql}`,
    sql`${activityAt} <= ${endSql}`,
  )!;
}

/** Repair ticket appears in sales reports and falls within [startSql, endSql]. */
export function sqlRepairTicketInSalesWindow(startSql: SQL, endSql: SQL): SQL {
  const salesAt = sqlRepairTicketSalesAt();
  return and(
    sqlRepairTicketEligibleForSalesQuery(),
    sql`${salesAt} is not null`,
    sql`${salesAt} >= ${startSql}`,
    sql`${salesAt} <= ${endSql}`,
  )!;
}

/** Store daily/shift reports — store-tagged repairs only, within [startSql, endSql]. */
export function sqlRepairTicketInStoreSalesWindow(startSql: SQL, endSql: SQL): SQL {
  return and(
    sqlRepairTicketIncludedInStoreSales(),
    sqlRepairTicketInSalesWindow(startSql, endSql),
  )!;
}

/** Technician shift report — same scope as calendar technician daily report. */
export function sqlRepairTicketInTechnicianShiftWindow(startSql: SQL, endSql: SQL): SQL {
  return sqlRepairTicketInTechnicianReportWindow(startSql, endSql);
}

/** Max technician repair activity on a shift day (for extending closed technician shift windows). */
export function sqlMaxTechnicianRepairActivityOnShiftDay(
  shiftStartSql: SQL,
  dayEndSql: SQL,
): SQL {
  const activityAt = sql`coalesce(rt.delivered_at, rt.paid_at, rt.updated_at)`;
  return sql`(
    select max(${activityAt}) from repair_tickets rt
    where rt.repair_payment_source = 'technician'
      and (
        rt.payment_status = 'deferred'
        or rt.status = 'delivered'
        or rt.payment_status = 'paid'
      )
      and ${activityAt} >= ${shiftStartSql}
      and ${activityAt} <= ${dayEndSql}
  )`;
}

/** Max repair sales timestamp on a shift day (for extending closed-shift report windows). */
export function sqlMaxRepairSalesAtOnShiftDay(
  shiftStartSql: SQL,
  dayEndSql: SQL,
): SQL {
  const salesAt = sql`case
    when rt.status = 'delivered' and rt.delivered_at is not null then rt.delivered_at
    when rt.payment_status = 'paid' and rt.paid_at is not null then rt.paid_at
    when rt.status = 'delivered' and rt.payment_status = 'paid'
      then coalesce(rt.delivered_at, rt.paid_at, rt.updated_at)
    when rt.payment_status = 'paid' then coalesce(rt.paid_at, rt.updated_at)
    else null
  end`;
  return sql`(
    select max(${salesAt}) from repair_tickets rt
    where coalesce(rt.excluded_from_sales_report, 0) = 0
      and coalesce(rt.repair_payment_source, 'sales') = 'sales'
      and (
        (rt.payment_status = 'paid' and rt.status <> 'delivered')
        or (rt.status = 'delivered' and (rt.delivered_at is not null or rt.paid_at is not null))
        or (rt.payment_status = 'paid' and rt.paid_at is not null)
      )
      and ${salesAt} >= ${shiftStartSql}
      and ${salesAt} <= ${dayEndSql}
  )`;
}
