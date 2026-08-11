import * as XLSX from "xlsx";
import {
  type AdminCustomerRow,
  formatCustomerExportDate,
  listAdminCustomers,
  normalizeContactPhone,
  prepareContactsList,
} from "./admin-customers";

export type CustomerExportSource = "repair" | "order" | "all";
export type CustomerExportFormat = "xlsx" | "contacts";

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

export function buildCustomersExcelBuffer(
  customers: AdminCustomerRow[],
  source: CustomerExportSource,
  language: "ar" | "en",
): Buffer {
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
  const ext = format === "contacts" ? "csv" : "xlsx";
  return `${sourcePart}-${dateStamp}.${ext}`;
}
