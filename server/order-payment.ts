/** Order payment helpers — POS uses paymentStatus for deferred vs paid totals. */

export type OrderPaymentRow = {
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  total?: string | null;
  cashPaidAmount?: string | null;
  cardPaidAmount?: string | null;
};

export function isOrderDeferred(order: OrderPaymentRow): boolean {
  return order.paymentStatus === "deferred" || order.paymentMethod === "deferred";
}

/** Map receipt/POS payment method to stored method + status. */
export function paymentFieldsFromMethod(paymentMethod?: string | null): {
  paymentMethod: string;
  paymentStatus: string;
} {
  const method = String(paymentMethod || "cash").trim() || "cash";
  if (method === "deferred") {
    return { paymentMethod: "deferred", paymentStatus: "deferred" };
  }
  return { paymentMethod: method, paymentStatus: "success" };
}

export function orderCashAmount(order: OrderPaymentRow): number {
  if (isOrderDeferred(order)) return 0;
  if (order.paymentMethod === "split") {
    return parseFloat(order.cashPaidAmount || "0") || 0;
  }
  if (order.paymentMethod === "cash" || !order.paymentMethod) {
    return parseFloat(order.total || "0") || 0;
  }
  return 0;
}

export function orderCardAmount(order: OrderPaymentRow): number {
  if (isOrderDeferred(order)) return 0;
  if (order.paymentMethod === "split") {
    return parseFloat(order.cardPaidAmount || "0") || 0;
  }
  if (order.paymentMethod === "card") {
    return parseFloat(order.total || "0") || 0;
  }
  return 0;
}

export function isInStoreCash(order: OrderPaymentRow): boolean {
  return orderCashAmount(order) > 0;
}

export function isInStoreCard(order: OrderPaymentRow): boolean {
  return orderCardAmount(order) > 0;
}

export function isInStoreZainCash(order: OrderPaymentRow): boolean {
  return !isOrderDeferred(order) && order.paymentMethod === "zaincash";
}

export function isInStoreQiCard(order: OrderPaymentRow): boolean {
  return !isOrderDeferred(order) && order.paymentMethod === "qicard";
}
