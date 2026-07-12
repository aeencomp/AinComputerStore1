import { repairTickets } from "@shared/schema";
import { sql, and, or, eq, isNotNull, ne, isNull, type SQL } from "drizzle-orm";

export const REPAIR_PAYMENT_SOURCE_SALES = "sales" as const;
export const REPAIR_PAYMENT_SOURCE_TECHNICIAN = "technician" as const;

/** Stable payment timestamp for shift attribution (matches sales window logic). */
export function sqlRepairTicketSalesAtForShift() {
  return sql`coalesce(
    case when ${repairTickets.status} = 'delivered' and ${repairTickets.deliveredAt} is not null then ${repairTickets.deliveredAt} end,
    case when ${repairTickets.paymentStatus} = 'paid' and ${repairTickets.paidAt} is not null then ${repairTickets.paidAt} end,
    ${repairTickets.paidAt},
    ${repairTickets.deliveredAt},
    ${repairTickets.updatedAt}
  )`;
}

/** Paid/collected while a technician repair shift was open. */
export function sqlRepairTicketPaidDuringTechnicianShift(): SQL {
  const salesAt = sqlRepairTicketSalesAtForShift();
  return sql`exists (
    select 1 from sales_shifts ss
    where ss.sales_user_id like 'tech:%'
      and ss.sales_location_id = 1
      and ${salesAt} is not null
      and ${salesAt} >= ss.start_time
      and ${salesAt} <= coalesce(ss.end_time, timezone('Asia/Baghdad', now()))
  )`;
}

/** Store / cashier repair payments (excludes technician portal & technician shifts). */
export function sqlRepairTicketIncludedInStoreSales(): SQL {
  return and(
    eq(repairTickets.excludedFromSalesReport, 0),
    or(
      eq(repairTickets.repairPaymentSource, REPAIR_PAYMENT_SOURCE_SALES),
      isNull(repairTickets.repairPaymentSource),
    ),
    sql`not (${sqlRepairTicketPaidDuringTechnicianShift()})`,
  )!;
}

/** Technician portal repair payments + collections during technician shifts. */
export function sqlRepairTicketIncludedInTechnicianSales(): SQL {
  return and(
    eq(repairTickets.excludedFromSalesReport, 0),
    or(
      eq(repairTickets.repairPaymentSource, REPAIR_PAYMENT_SOURCE_TECHNICIAN),
      sqlRepairTicketPaidDuringTechnicianShift(),
    ),
  )!;
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
