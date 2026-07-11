import { repairTickets } from "@shared/schema";
import { sql, and, or, eq, isNotNull, ne, type SQL } from "drizzle-orm";

/** SQL expression: stable timestamp when a repair counts in sales (not updatedAt for delivered). */
export function sqlRepairTicketSalesAt() {
  return sql`case
    when ${repairTickets.status} = 'delivered' and ${repairTickets.deliveredAt} is not null then ${repairTickets.deliveredAt}
    when ${repairTickets.paymentStatus} = 'paid' and ${repairTickets.paidAt} is not null then ${repairTickets.paidAt}
    when ${repairTickets.paymentStatus} = 'paid' then ${repairTickets.updatedAt}
    else null
  end`;
}

/** Repair ticket appears in sales reports and falls within [startSql, endSql]. */
export function sqlRepairTicketInSalesWindow(startSql: SQL, endSql: SQL): SQL {
  const salesAt = sqlRepairTicketSalesAt();
  return and(
    or(
      and(eq(repairTickets.paymentStatus, "paid"), ne(repairTickets.status, "delivered")),
      and(eq(repairTickets.status, "delivered"), isNotNull(repairTickets.deliveredAt)),
    ),
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
    when rt.payment_status = 'paid' then rt.updated_at
    else null
  end`;
  return sql`(
    select max(${salesAt}) from repair_tickets rt
    where coalesce(rt.excluded_from_sales_report, 0) = 0
      and (
        (rt.payment_status = 'paid' and rt.status <> 'delivered')
        or (rt.status = 'delivered' and rt.delivered_at is not null)
      )
      and ${salesAt} >= ${shiftStartSql}
      and ${salesAt} <= ${dayEndSql}
  )`;
}
