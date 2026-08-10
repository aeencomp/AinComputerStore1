import { storage } from "./storage";

export type AdminCustomerRow = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  createdAt: string;
  source: "repair" | "account" | "order";
  customerId?: string;
  editable: boolean;
};

const sourcePriority: Record<string, number> = { repair: 3, account: 2, order: 1 };

const normalizePhone = (phone: string) => phone.trim().replace(/\s+/g, "");

const mergeCustomer = (existing: AdminCustomerRow, incoming: AdminCustomerRow): AdminCustomerRow => {
  const earliestCreatedAt =
    new Date(incoming.createdAt) < new Date(existing.createdAt) ? incoming.createdAt : existing.createdAt;
  const preferred = sourcePriority[incoming.source] > sourcePriority[existing.source] ? incoming : existing;
  return {
    ...preferred,
    createdAt: earliestCreatedAt,
    email: preferred.email || existing.email || incoming.email,
  };
};

export async function listAdminCustomers(search = ""): Promise<AdminCustomerRow[]> {
  const phoneMap = new Map<string, AdminCustomerRow>();

  const upsertCustomer = (phone: string, row: AdminCustomerRow) => {
    const key = normalizePhone(phone);
    if (!key) return;
    const existing = phoneMap.get(key);
    if (!existing) {
      phoneMap.set(key, { ...row, phone: phone.trim() });
      return;
    }
    phoneMap.set(key, mergeCustomer(existing, { ...row, phone: phone.trim() }));
  };

  for (const c of await storage.listRepairCustomers()) {
    if (!c.phone?.trim()) continue;
    upsertCustomer(c.phone, {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email || undefined,
      createdAt: new Date(c.createdAt).toISOString(),
      source: "repair",
      customerId: c.customerId,
      editable: false,
    });
  }

  for (const u of await storage.getUsers()) {
    if (!u.phone?.trim()) continue;
    upsertCustomer(u.phone, {
      id: u.id,
      name: u.name || u.email,
      phone: u.phone,
      email: u.email,
      createdAt: new Date(u.createdAt).toISOString(),
      source: "account",
      editable: true,
    });
  }

  for (const o of await storage.getOrders()) {
    if (!o.customerPhone?.trim()) continue;
    const key = normalizePhone(o.customerPhone);
    if (phoneMap.has(key)) continue;
    phoneMap.set(key, {
      id: `order-${o.id}`,
      name: o.customerName || o.customerPhone.trim(),
      phone: o.customerPhone.trim(),
      email: o.customerEmail || undefined,
      createdAt: new Date(o.createdAt).toISOString(),
      source: "order",
      editable: false,
    });
  }

  let customers = Array.from(phoneMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const q = search.toLowerCase().trim();
  if (q) {
    customers = customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email?.toLowerCase().includes(q) ?? false) ||
      (c.customerId?.toLowerCase().includes(q) ?? false)
    );
  }

  return customers;
}

export function formatCustomerExportDate(dateString: string, language: "ar" | "en") {
  return new Date(dateString).toLocaleDateString(
    language === "ar" ? "ar-IQ" : "en-US",
    { year: "numeric", month: "2-digit", day: "2-digit" }
  );
}
