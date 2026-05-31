import { STORE_BRAND_RED, STORE_WEBSITE } from "@/lib/a4InvoicePrint";

export type WithdrawalReportPrintData = {
  from: string;
  to: string;
  grandTotal: number;
  grandCount: number;
  employees: Array<{
    employeeName: string;
    totalAmount: number;
    entryCount: number;
    byDate: Array<{ date: string; totalAmount: number; entryCount: number }>;
  }>;
  /** When not "all", show filter line on print */
  employeeFilter?: string;
  issuedBy?: string;
};

const fmtNum = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function buildWithdrawalReportA4Html(data: WithdrawalReportPrintData): string {
  const printedAt = new Date().toLocaleString("ar-IQ", {
    timeZone: "Asia/Baghdad",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const filterLine =
    data.employeeFilter && data.employeeFilter !== "all"
      ? `<p class="meta-line"><strong>الموظف:</strong> ${escapeHtml(data.employeeFilter)}</p>`
      : `<p class="meta-line"><strong>الموظفون:</strong> الكل (${data.employees.length})</p>`;

  const employeeSections = data.employees
    .map((emp) => {
      const rows = emp.byDate
        .map(
          (row) => `
        <tr>
          <td>${escapeHtml(row.date)}</td>
          <td style="text-align:center">${row.entryCount}</td>
          <td style="text-align:end;font-weight:600;color:${STORE_BRAND_RED}">${fmtNum(row.totalAmount)} IQD</td>
        </tr>`,
        )
        .join("");
      return `
      <section class="employee-block">
        <div class="employee-head">
          <h3>${escapeHtml(emp.employeeName)}</h3>
          <span class="employee-total">${fmtNum(emp.totalAmount)} IQD</span>
        </div>
        <p class="employee-sub">${emp.entryCount} عملية · إجمالي الفترة للموظف</p>
        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th style="text-align:center">العمليات</th>
              <th style="text-align:end">المجموع</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="3" style="text-align:center;color:#888">—</td></tr>`}
          </tbody>
        </table>
      </section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <title>تقرير سحوبات الموظفين ${data.from} — ${data.to}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", Tahoma, Arial, sans-serif;
      font-size: 12px;
      color: #111;
      direction: rtl;
      background: white;
    }
    .report-header {
      text-align: center;
      border-bottom: 2px solid ${STORE_BRAND_RED};
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .report-header h1 { font-size: 20px; font-weight: 700; color: ${STORE_BRAND_RED}; }
    .report-header h2 { font-size: 14px; margin-top: 4px; }
    .meta { margin-bottom: 14px; font-size: 12px; color: #444; }
    .meta-line { margin: 3px 0; }
    .summary-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid #e5e7eb;
      background: #fff7ed;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 16px;
    }
    .summary-box strong { font-size: 18px; color: ${STORE_BRAND_RED}; }
    .employee-block {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .employee-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .employee-head h3 { font-size: 14px; font-weight: 700; }
    .employee-total { font-size: 14px; font-weight: 700; color: ${STORE_BRAND_RED}; }
    .employee-sub { font-size: 11px; color: #666; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #e5e7eb; padding: 6px 8px; }
    th { background: #f8fafc; font-weight: 600; }
    .footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #ddd;
      font-size: 10px;
      color: #666;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <header class="report-header">
    <h1>العين لتجارة الحاسبات</h1>
    <h2>تقرير سحوبات الموظفين</h2>
  </header>
  <div class="meta">
    <p class="meta-line"><strong>الفترة:</strong> من ${escapeHtml(data.from)} إلى ${escapeHtml(data.to)}</p>
    ${filterLine}
    ${data.issuedBy ? `<p class="meta-line"><strong>صادر عن:</strong> ${escapeHtml(data.issuedBy)}</p>` : ""}
    <p class="meta-line"><strong>تاريخ الطباعة:</strong> ${escapeHtml(printedAt)}</p>
  </div>
  <div class="summary-box">
    <span>إجمالي السحوبات (${data.grandCount} عملية)</span>
    <strong>${fmtNum(data.grandTotal)} IQD</strong>
  </div>
  ${employeeSections}
  <footer class="footer">
    <span>${STORE_WEBSITE}</span>
    <span>تقرير سحوبات — A4</span>
  </footer>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      }, 350);
    };
  </script>
</body>
</html>`;
}

export function openWithdrawalReportA4Print(data: WithdrawalReportPrintData): void {
  const html = buildWithdrawalReportA4Html(data);
  const popup = window.open("", "_blank", "width=1000,height=900");
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
}
