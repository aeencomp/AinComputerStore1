/** POS payment labels and split cash/card helpers (mirrors server/order-payment). */

export type PosPaymentOrder = {
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  total?: string | null;
  cashPaidAmount?: string | null;
  cardPaidAmount?: string | null;
};

export function posOrderCashAmount(order: PosPaymentOrder): number {
  if (order.paymentStatus === "deferred" || order.paymentMethod === "deferred") return 0;
  if (order.paymentMethod === "split") {
    return parseFloat(order.cashPaidAmount || "0") || 0;
  }
  if (order.paymentMethod === "cash" || !order.paymentMethod) {
    return parseFloat(order.total || "0") || 0;
  }
  return 0;
}

export function posOrderCardAmount(order: PosPaymentOrder): number {
  if (order.paymentStatus === "deferred" || order.paymentMethod === "deferred") return 0;
  if (order.paymentMethod === "split") {
    return parseFloat(order.cardPaidAmount || "0") || 0;
  }
  if (order.paymentMethod === "card") {
    return parseFloat(order.total || "0") || 0;
  }
  return 0;
}

export function formatPosPaymentLabel(
  order: PosPaymentOrder,
  language: "ar" | "en" = "ar",
): string {
  if (order.paymentStatus === "deferred" || order.paymentMethod === "deferred") {
    return language === "ar" ? "أجل - غير مدفوع" : "Deferred - Unpaid";
  }
  if (order.paymentMethod === "split") {
    const cash = posOrderCashAmount(order);
    const card = posOrderCardAmount(order);
    if (language === "ar") {
      return `نقد: ${cash.toLocaleString("en-US")} · بطاقة: ${card.toLocaleString("en-US")}`;
    }
    return `Cash: ${cash.toLocaleString("en-US")} · Card: ${card.toLocaleString("en-US")}`;
  }
  const labels: Record<string, { ar: string; en: string }> = {
    cash: { ar: "نقدي", en: "Cash" },
    card: { ar: "بطاقة", en: "Card" },
    zaincash: { ar: "زين كاش", en: "ZainCash" },
    qicard: { ar: "كي كارد", en: "QiCard" },
  };
  const key = order.paymentMethod || "cash";
  const entry = labels[key];
  if (entry) return language === "ar" ? entry.ar : entry.en;
  return key;
}
