/** Order payment helpers — POS uses paymentStatus for deferred vs paid totals. */

export type OrderPaymentRow = {
  paymentMethod?: string | null;
  paymentStatus?: string | null;
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

export function isInStoreCash(order: OrderPaymentRow): boolean {
  return !isOrderDeferred(order) && (order.paymentMethod === "cash" || !order.paymentMethod);
}

export function isInStoreCard(order: OrderPaymentRow): boolean {
  return !isOrderDeferred(order) && order.paymentMethod === "card";
}

export function isInStoreZainCash(order: OrderPaymentRow): boolean {
  return !isOrderDeferred(order) && order.paymentMethod === "zaincash";
}

export function isInStoreQiCard(order: OrderPaymentRow): boolean {
  return !isOrderDeferred(order) && order.paymentMethod === "qicard";
}
