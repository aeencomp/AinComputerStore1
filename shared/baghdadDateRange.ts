export function baghdadDateKey(d: Date | string = new Date()): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
}

export function baghdadMonthStartKey(): string {
  const today = baghdadDateKey();
  return `${today.slice(0, 8)}01`;
}

export function addBaghdadDays(dateStr: string, delta: number): string {
  const base = new Date(`${dateStr}T12:00:00+03:00`);
  base.setDate(base.getDate() + delta);
  return base.toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
}

export function normalizeBaghdadDateRange(from?: string, to?: string): { from: string; to: string } {
  const today = baghdadDateKey();
  let f = /^\d{4}-\d{2}-\d{2}$/.test(String(from || "").trim()) ? String(from).trim() : today;
  let t = /^\d{4}-\d{2}-\d{2}$/.test(String(to || "").trim()) ? String(to).trim() : f;
  if (f > t) [f, t] = [t, f];
  return { from: f, to: t };
}

export function inclusiveDayCount(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00+03:00`);
  const b = new Date(`${to}T12:00:00+03:00`);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

export function previousBaghdadPeriod(from: string, to: string): { from: string; to: string } {
  const days = inclusiveDayCount(from, to);
  const prevTo = addBaghdadDays(from, -1);
  const prevFrom = addBaghdadDays(prevTo, -(days - 1));
  return { from: prevFrom, to: prevTo };
}

export function enumerateBaghdadDays(from: string, to: string): string[] {
  const days: string[] = [];
  let cur = from;
  while (cur <= to) {
    days.push(cur);
    if (cur === to) break;
    cur = addBaghdadDays(cur, 1);
  }
  return days;
}
