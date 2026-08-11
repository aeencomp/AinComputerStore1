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
export type ExportFormat = "xlsx" | "contacts" | "vcf";

export type ContactExportRow = {
  name: string;
  phone: string;
};

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

export function toInternationalPhone(phone: string): string {
  const local = normalizeContactPhone(phone);
  if (local.startsWith("0")) {
    return `+964${local.slice(1)}`;
  }
  if (local.startsWith("+")) {
    return local;
  }
  return local;
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

export function prepareContactsList(customers: CustomerExportRow[]): ContactExportRow[] {
  const byPhone = new Map<string, ContactExportRow>();

  for (const customer of customers) {
    const phone = normalizeContactPhone(customer.phone);
    const name = customer.name.trim();
    if (!phone || !name) continue;

    const existing = byPhone.get(phone);
    if (!existing || name.length > existing.name.length) {
      byPhone.set(phone, { name, phone });
    }
  }

  return Array.from(byPhone.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "ar", { sensitivity: "base" }),
  );
}

function escapeVcardValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function splitContactName(name: string): { family: string; given: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { family: "", given: "" };
  }
  if (parts.length === 1) {
    return { family: parts[0], given: "" };
  }
  return {
    given: parts[0],
    family: parts.slice(1).join(" "),
  };
}

export function buildContactsCsv(customers: CustomerExportRow[]): string {
  const contacts = prepareContactsList(customers);
  const header = "Name,Phone 1 - Type,Phone 1 - Value";
  const rows = contacts.map((contact) => {
    const name = contact.name.replace(/"/g, '""');
    const phone = contact.phone.replace(/"/g, '""');
    return `"${name}",Mobile,"${phone}"`;
  });
  return `\uFEFF${[header, ...rows].join("\r\n")}`;
}

export function buildContactsVcf(customers: CustomerExportRow[]): string {
  const contacts = prepareContactsList(customers);
  const cards = contacts.map((contact) => {
    const { family, given } = splitContactName(contact.name);
    const tel = toInternationalPhone(contact.phone);
    return [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${escapeVcardValue(contact.name)}`,
      `N:${escapeVcardValue(family)};${escapeVcardValue(given)};;;`,
      `TEL;TYPE=CELL:${tel}`,
      "END:VCARD",
    ].join("\r\n");
  });

  return `${cards.join("\r\n")}\r\n`;
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

export function exportFilename(source: ExportSource, format: ExportFormat): string {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const sourcePart = source === "all" ? "all-customers" : `${source}-customers`;
  const ext = format === "contacts" ? "csv" : format === "vcf" ? "vcf" : "xlsx";
  return `${sourcePart}-${dateStamp}.${ext}`;
}
