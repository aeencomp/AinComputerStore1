export type CustomerExportRow = {
  id: string;
  name: string;
  email?: string;
  phone: string;
  createdAt: string;
  source: "repair" | "account" | "order";
  customerId?: string;
  editable?: boolean;
};

export type ExportSource = "repair" | "order" | "all";

export function normalizeContactPhone(phone: string): string {
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+964")) {
    digits = `0${digits.slice(4)}`;
  } else if (digits.startsWith("964")) {
    digits = `0${digits.slice(3)}`;
  } else if (/^7\d{9}$/.test(digits)) {
    digits = `0${digits}`;
  }
  return digits;
}

export function getCustomersForExport(
  customers: CustomerExportRow[],
  source: ExportSource,
  searchQuery: string,
): CustomerExportRow[] {
  return customers.filter((customer) => {
    if (source === "all") {
      if (customer.source !== "repair" && customer.source !== "order") return false;
    } else if (customer.source !== source) {
      return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      customer.name.toLowerCase().includes(q) ||
      customer.phone.includes(q) ||
      (customer.email?.toLowerCase().includes(q) ?? false) ||
      (customer.customerId?.toLowerCase().includes(q) ?? false)
    );
  });
}

export function buildContactsCsv(customers: CustomerExportRow[]): string {
  const byPhone = new Map<string, { name: string; phone: string }>();

  for (const customer of customers) {
    const phone = normalizeContactPhone(customer.phone);
    const name = customer.name.trim();
    if (!phone || !name) continue;

    const existing = byPhone.get(phone);
    if (!existing || name.length > existing.name.length) {
      byPhone.set(phone, { name, phone });
    }
  }

  const contacts = Array.from(byPhone.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "ar", { sensitivity: "base" }),
  );

  const header = "Name,Phone 1 - Type,Phone 1 - Value";
  const rows = contacts.map((contact) => {
    const name = contact.name.replace(/"/g, '""');
    const phone = contact.phone.replace(/"/g, '""');
    return `"${name}",Mobile,"${phone}"`;
  });

  return `\uFEFF${[header, ...rows].join("\r\n")}`;
}

export function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportFilename(source: ExportSource, format: "xlsx" | "contacts"): string {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const sourcePart = source === "all" ? "all-customers" : `${source}-customers`;
  const ext = format === "contacts" ? "csv" : "xlsx";
  return `${sourcePart}-${dateStamp}.${ext}`;
}
