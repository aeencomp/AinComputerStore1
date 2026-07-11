/** Whether an order should appear in sales/shift reports. */
export function orderIncludedInSalesReport(order: { status: string }): boolean {
  return order.status !== "voided" && order.status !== "cancelled";
}
