import {
  type AdminCustomerRow,
  formatCustomerExportDate,
  listAdminCustomers,
  normalizeContactPhone,
  prepareContactsList,
} from "./admin-customers";

export type CustomerExportSource = "repair" | "order" | "all";
export type CustomerExportFormat = "xlsx" | "contacts" | "vcf";

export async function getCustomersForExport(
  source: CustomerExportSource,
  search = "",
): Promise<AdminCustomerRow[]> {
  const customers = await listAdminCustomers(search);
  if (source === "all") {
    return customers.filter(c => c.source === "repair" || c.source === "order");
  }
  return customers.filter(c => c.source === source);
}

export function buildContactsCsv(customers: AdminCustomerRow[]): string {
  const contacts = prepareContactsList(customers);
  const header = "Name,Phone 1 - Type,Phone 1 - Value";
  const rows = contacts.map((contact) => {
    const name = contact.name.replace(/"/g, '""');
    const phone = contact.phone.replace(/"/g, '""');
    return `"${name}",Mobile,"${phone}"`;
  });
  return `\uFEFF${[header, ...rows].join("\r\n")}`;
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

function toInternationalPhone(phone: string): string {
  const local = normalizeContactPhone(phone);
  if (local.startsWith("0")) {
    return `+964${local.slice(1)}`;
  }
  if (local.startsWith("+")) {
    return local;
  }
  return local;
}

export function buildContactsVcf(customers: AdminCustomerRow[]): string {
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

export async function buildCustomersExcelBuffer(
  customers: AdminCustomerRow[],
  source: CustomerExportSource,
  language: "ar" | "en",
): Promise<Buffer> {
  const XLSX = await import("xlsx");
  const isAr = language === "ar";
  const rows = customers.map((customer) => ({
    [isAr ? "الاسم" : "Name"]: customer.name,
    [isAr ? "رقم الهاتف" : "Phone"]: normalizeContactPhone(customer.phone),
    [isAr ? "تاريخ الإضافة" : "Date Added"]: formatCustomerExportDate(customer.createdAt, language),
    ...(source === "repair" || (source === "all" && customer.source === "repair")
      ? { [isAr ? "رقم العميل" : "Customer ID"]: customer.customerId || "" }
      : {}),
    [isAr ? "المصدر" : "Source"]: customer.source,
    [isAr ? "البريد الإلكتروني" : "Email"]: customer.email || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 28 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 28 },
  ];

  const workbook = XLSX.utils.book_new();
  const sheetName = source === "repair"
    ? (isAr ? "عملاء الصيانة" : "Repair Customers")
    : source === "order"
      ? (isAr ? "عملاء الطلبات" : "Order Customers")
      : (isAr ? "كل العملاء" : "All Customers");
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function exportFilename(
  source: CustomerExportSource,
  format: CustomerExportFormat,
): string {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const sourcePart = source === "all" ? "all-customers" : `${source}-customers`;
  const ext = format === "contacts" ? "csv" : format === "vcf" ? "vcf" : "xlsx";
  return `${sourcePart}-${dateStamp}.${ext}`;
}
