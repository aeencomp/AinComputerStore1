import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Printer,
  Calendar,
  Store,
  Wrench,
  Loader2,
  TrendingUp,
  TrendingDown,
  Banknote,
  CreditCard,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface InStoreOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  total: string;
  subtotal: string;
  discount?: string;
  paymentMethod: string;
  paymentStatus: string;
  orderType: string;
  items: any[];
  notes?: string;
  createdAt: string;
}

interface RepairSale {
  id: number;
  ticketNumber: string;
  customerName: string;
  customerPhone?: string;
  deviceType: string;
  deviceBrand?: string;
  deviceModel?: string;
  issueDescriptionAr: string;
  technicianNotes?: string;
  finalCost?: string;
  costEstimate?: string;
  paymentStatus: string;
  paymentMethod?: string;
  status: string;
  deliveredAt?: string;
  updatedAt: string;
}

interface DailyReportSummary {
  inStoreCount: number;
  inStoreTotal: number;
  inStoreTotalCash: number;
  inStoreTotalZain: number;
  inStoreTotalQi: number;
  inStoreTotalDeferred: number;
  repairCount: number;
  repairTotal: number;
  repairTotalDeferred: number;
  repairTotalCash: number;
  repairTotalCard: number;
  grandTotal: number;
  grandTotalCash: number;
  grandTotalCard: number;
  grandTotalZain: number;
  grandTotalQi: number;
  totalWithdrawals: number;
  withdrawalCount: number;
  netTotal: number;
}

interface Withdrawal {
  id: number;
  amount: string;
  reason: string | null;
  employeeName: string;
  createdAt: string;
}

interface DailyReportData {
  date: string;
  inStoreSales: InStoreOrder[];
  repairSales: RepairSale[];
  withdrawals: Withdrawal[];
  summary: DailyReportSummary;
}

interface DailyReportProps {
  user: { id: string };
}

function fmtNum(n: number) {
  return n.toLocaleString("ar-IQ") + " د.ع";
}

function paymentLabel(method: string | undefined, status: string | undefined): string {
  if (status === "deferred") return "آجل";
  if (!method || method === "cash") return "نقداً";
  if (method === "zaincash") return "ZainCash";
  if (method === "qicard") return "QiCard";
  return method;
}

function paymentBadge(method: string | undefined, status: string | undefined) {
  if (status === "deferred") return <Badge variant="outline" className="text-orange-600 border-orange-400">آجل</Badge>;
  if (!method || method === "cash") return <Badge variant="outline" className="text-green-700 border-green-400">نقداً</Badge>;
  if (method === "zaincash") return <Badge variant="outline" className="text-blue-700 border-blue-400">ZainCash</Badge>;
  if (method === "qicard") return <Badge variant="outline" className="text-purple-700 border-purple-400">QiCard</Badge>;
  return <Badge variant="outline">{method}</Badge>;
}

function buildPrintHTML(data: DailyReportData, displayDate: string): string {
  const { inStoreSales, repairSales, withdrawals = [], summary } = data;

  const inStoreRows = inStoreSales.map((o, i) => {
    const pay = paymentLabel(o.paymentMethod, o.paymentStatus);
    const isDeferred = o.paymentStatus === "deferred";
    const parsedItems: { nameAr?: string; nameEn?: string; price: string; quantity: number }[] =
      (o.items || []).map((it: any) => {
        try { return typeof it === "string" ? JSON.parse(it) : it; }
        catch { return null; }
      }).filter(Boolean);
    const itemsHtml = parsedItems.length > 0
      ? `<tr class="items-row">
          <td></td>
          <td colspan="5" style="padding:2px 8px 6px;">
            <div style="display:flex;flex-wrap:wrap;gap:4px 16px;">
              ${parsedItems.map(it =>
                `<span style="font-size:10px;color:#555">
                  ${it.nameAr || it.nameEn || ""}
                  <span style="color:#aaa">×</span>
                  <strong>${it.quantity}</strong>
                  <span style="color:#aaa">=</span>
                  <strong>${fmtNum(parseFloat(it.price) * it.quantity)}</strong>
                </span>`
              ).join("")}
            </div>
          </td>
        </tr>`
      : "";
    return `
      <tr style="${isDeferred ? "color:#c2410c" : ""}">
        <td>${i + 1}</td>
        <td style="font-family:monospace;font-size:11px">${o.orderNumber}</td>
        <td>
          ${o.customerName}
          ${o.customerPhone ? `<br><span style="font-size:11px;color:#666">${o.customerPhone}</span>` : ""}
        </td>
        <td style="color:#666">${format(new Date(o.createdAt), "HH:mm")}</td>
        <td><span class="badge ${isDeferred ? "badge-orange" : o.paymentMethod === "zaincash" ? "badge-blue" : o.paymentMethod === "qicard" ? "badge-purple" : "badge-green"}">${pay}</span></td>
        <td style="text-align:end;font-weight:600${isDeferred ? ";color:#c2410c" : ""}">${fmtNum(parseFloat(o.total))}</td>
      </tr>
      ${itemsHtml}`;
  }).join("");

  const repairRows = repairSales.map((t, i) => {
    const amount = parseFloat(t.finalCost || t.costEstimate || "0");
    const isDeferred = t.paymentStatus === 'deferred';
    const isDelivered = t.status === 'delivered';
    const badgeCls = isDeferred ? 'badge-orange' : isDelivered ? 'badge-delivered' : 'badge-green';
    const badgeTxt = isDeferred ? 'آجل' : isDelivered ? 'مُسلَّم ✓' : 'مدفوع';
    const methodTxt = !isDeferred ? (t.paymentMethod === 'card' ? ' — بطاقة' : ' — نقداً') : '';
    const deviceStr = [t.deviceBrand, t.deviceModel, t.deviceType].filter(Boolean).join(" ");
    const detailParts = [
      t.issueDescriptionAr ? `<strong>المشكلة:</strong> ${t.issueDescriptionAr}` : "",
      t.technicianNotes ? `<strong>ملاحظات الفني:</strong> ${t.technicianNotes}` : "",
    ].filter(Boolean);
    const detailRow = detailParts.length > 0
      ? `<tr style="background:#f8fafc">
          <td></td>
          <td colspan="5" style="padding:4px 8px 6px;font-size:11px;color:#555;border-bottom:1px dashed #e2e8f0">
            ${detailParts.join(" &nbsp;|&nbsp; ")}
          </td>
        </tr>`
      : "";
    return `
      <tr style="${isDeferred ? "color:#c2410c" : ""}">
        <td>${i + 1}</td>
        <td style="font-family:monospace;font-size:11px">${t.ticketNumber}</td>
        <td>
          ${t.customerName}
          ${t.customerPhone ? `<br><span style="font-size:11px;color:#666">${t.customerPhone}</span>` : ""}
        </td>
        <td style="color:#666">${deviceStr}</td>
        <td><span class="badge ${badgeCls}">${badgeTxt}${methodTxt}</span></td>
        <td style="text-align:end;font-weight:600${isDeferred ? ";color:#c2410c" : ""}">${fmtNum(amount)}</td>
      </tr>${detailRow}`;
  }).join("");

  const withdrawalRows = withdrawals.map((w, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${w.employeeName}</td>
      <td>${w.reason || "—"}</td>
      <td style="color:#666">${format(new Date(w.createdAt), "HH:mm")}</td>
      <td style="text-align:end;font-weight:600;color:#c2410c">${fmtNum(parseFloat(w.amount))}</td>
    </tr>`).join("");

  const payBreakdown = [
    summary.grandTotalCash > 0 ? `<div class="breakdown-item"><span class="dot green"></span><span>نقداً</span><strong>${fmtNum(summary.grandTotalCash)}</strong></div>` : "",
    (summary.grandTotalCard ?? 0) > 0 ? `<div class="breakdown-item"><span class="dot teal"></span><span>بطاقة (صيانة)</span><strong>${fmtNum(summary.grandTotalCard)}</strong></div>` : "",
    summary.grandTotalZain > 0 ? `<div class="breakdown-item"><span class="dot blue"></span><span>ZainCash</span><strong>${fmtNum(summary.grandTotalZain)}</strong></div>` : "",
    summary.grandTotalQi > 0 ? `<div class="breakdown-item"><span class="dot purple"></span><span>QiCard</span><strong>${fmtNum(summary.grandTotalQi)}</strong></div>` : "",
    summary.inStoreTotalDeferred > 0 ? `<div class="breakdown-item"><span class="dot orange"></span><span>آجل (غير محصّل)</span><strong style="color:#c2410c">${fmtNum(summary.inStoreTotalDeferred)}</strong></div>` : "",
    (summary.totalWithdrawals ?? 0) > 0 ? `<div class="breakdown-item"><span class="dot red"></span><span>السحوبات</span><strong style="color:#c2410c">- ${fmtNum(summary.totalWithdrawals)}</strong></div>` : "",
  ].join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <title>التقرير اليومي - ${displayDate}</title>
  <style>
    @page { size: A4; margin: 15mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 12px;
      color: #111;
      direction: rtl;
      background: white;
    }

    /* ---- Header ---- */
    .report-header {
      text-align: center;
      border-bottom: 2px solid #111;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .report-header h1 { font-size: 20px; font-weight: 700; }
    .report-header h2 { font-size: 14px; font-weight: 600; margin-top: 2px; }
    .report-header .date { font-size: 12px; color: #555; margin-top: 4px; }

    /* ---- Summary boxes ---- */
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-bottom: 14px;
    }
    .summary-box {
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 8px 10px;
    }
    .summary-box .label { font-size: 10px; color: #666; margin-bottom: 2px; }
    .summary-box .value { font-size: 16px; font-weight: 700; }
    .summary-box .sub { font-size: 10px; color: #888; margin-top: 2px; }
    .violet { color: #7c3aed; }
    .blue   { color: #2563eb; }
    .primary{ color: #111; }

    /* ---- Section title ---- */
    .section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      background: #f4f4f5;
      padding: 6px 10px;
      border-radius: 5px;
      margin-bottom: 0;
      border: 1px solid #e4e4e7;
      border-bottom: none;
      border-radius: 5px 5px 0 0;
    }
    .icon-dot {
      width: 10px; height: 10px; border-radius: 50%; display: inline-block;
    }

    /* ---- Table ---- */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      border: 1px solid #e4e4e7;
      border-radius: 0 0 5px 5px;
      margin-bottom: 14px;
      overflow: hidden;
    }
    th {
      background: #f9fafb;
      font-weight: 600;
      color: #555;
      padding: 6px 8px;
      border-bottom: 1px solid #e4e4e7;
      text-align: start;
    }
    td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .items-row td { background: #fafafa; border-bottom: 1px solid #f0f0f0; padding-top: 0; }
    tfoot tr td {
      background: #f4f4f5;
      font-weight: 700;
      border-top: 2px solid #d1d5db;
      border-bottom: none;
    }
    td:last-child, th:last-child { text-align: end; }
    .empty-msg {
      text-align: center; color: #888; padding: 16px; font-style: italic;
      border: 1px solid #e4e4e7; border-top: none; border-radius: 0 0 5px 5px;
      margin-bottom: 14px;
    }

    /* ---- Badges ---- */
    .badge {
      display: inline-block;
      padding: 1px 7px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 600;
      border: 1px solid;
    }
    .badge-green     { color: #15803d; border-color: #86efac; background: #f0fdf4; }
    .badge-delivered { color: #047857; border-color: #34d399; background: #ecfdf5; font-weight:700; }
    .badge-blue      { color: #1d4ed8; border-color: #93c5fd; background: #eff6ff; }
    .badge-purple    { color: #7e22ce; border-color: #c4b5fd; background: #faf5ff; }
    .badge-orange    { color: #c2410c; border-color: #fdba74; background: #fff7ed; }

    /* ---- Grand total bar ---- */
    .grand-total-bar {
      border: 2px solid #111;
      border-radius: 6px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }
    .grand-total-bar .title { font-size: 13px; font-weight: 700; }
    .grand-total-bar .right { display: flex; align-items: center; gap: 20px; }
    .breakdown-item {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
    }
    .breakdown-item span { font-size: 10px; color: #555; display: flex; align-items: center; gap: 3px; }
    .breakdown-item strong { font-size: 12px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .dot.green  { background: #16a34a; }
    .dot.teal   { background: #0d9488; }
    .dot.blue   { background: #2563eb; }
    .dot.purple { background: #7c3aed; }
    .dot.orange { background: #ea580c; }
    .divider { width: 1px; height: 40px; background: #d1d5db; }
    .total-big { text-align: center; }
    .total-big .lbl { font-size: 10px; color: #666; }
    .total-big .amt { font-size: 22px; font-weight: 800; }

    /* ---- Signature row ---- */
    .sig-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-top: 20px;
      border-top: 1px dashed #ccc;
      padding-top: 14px;
    }
    .sig-box { text-align: center; }
    .sig-box .sig-label { font-size: 10px; color: #666; margin-bottom: 24px; }
    .sig-box .sig-line { border-top: 1px solid #555; width: 80%; margin: 0 auto; }

    /* ---- Footer ---- */
    .report-footer {
      text-align: center;
      font-size: 10px;
      color: #888;
      border-top: 1px solid #eee;
      padding-top: 8px;
      margin-top: 8px;
    }
  </style>
</head>
<body>

  <div class="report-header">
    <h1>العين لتجارة الحاسبات</h1>
    <h2>التقرير اليومي للمبيعات</h2>
    <div class="date">تاريخ: ${displayDate}</div>
  </div>

  <!-- Summary -->
  <div class="summary-grid">
    <div class="summary-box">
      <div class="label">مبيعات المتجر</div>
      <div class="value violet">${fmtNum(summary.inStoreTotal)}</div>
      <div class="sub">${summary.inStoreCount} فاتورة${summary.inStoreTotalDeferred > 0 ? ` · آجل: ${fmtNum(summary.inStoreTotalDeferred)}` : ""}</div>
    </div>
    <div class="summary-box">
      <div class="label">مدفوعات التصليح</div>
      <div class="value blue">${fmtNum(summary.repairTotal)}</div>
      <div class="sub">${summary.repairCount} تذكرة</div>
    </div>
    <div class="summary-box">
      <div class="label">الإجمالي المحصّل</div>
      <div class="value primary">${fmtNum(summary.grandTotal)}</div>
      <div class="sub">&nbsp;</div>
    </div>
    ${(summary.totalWithdrawals ?? 0) > 0 ? `
    <div class="summary-box">
      <div class="label">السحوبات اليومية</div>
      <div class="value" style="color:#c2410c">- ${fmtNum(summary.totalWithdrawals)}</div>
      <div class="sub">${summary.withdrawalCount} عملية</div>
    </div>
    <div class="summary-box" style="border-color:#111;grid-column:span 2">
      <div class="label">صافي الإيراد</div>
      <div class="value" style="color:#111;font-size:20px">${fmtNum(summary.netTotal)}</div>
      <div class="sub">بعد خصم السحوبات</div>
    </div>` : ""}
  </div>

  <!-- In-Store Sales -->
  <div class="section-title">
    <span class="icon-dot" style="background:#7c3aed"></span>
    مبيعات المتجر
    <span style="margin-right:auto;font-size:10px;font-weight:400;color:#666">${inStoreSales.length} سجل</span>
  </div>
  ${inStoreSales.length === 0
    ? `<div class="empty-msg">لا توجد مبيعات لهذا اليوم</div>`
    : `<table>
      <thead>
        <tr>
          <th>#</th>
          <th>رقم الفاتورة</th>
          <th>العميل</th>
          <th>الوقت</th>
          <th>طريقة الدفع</th>
          <th>المبلغ</th>
        </tr>
      </thead>
      <tbody>${inStoreRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="5">
            المجموع
            ${summary.inStoreTotalDeferred > 0 ? `<span style="font-size:10px;font-weight:400;color:#c2410c;margin-right:8px">(آجل غير محسوب: ${fmtNum(summary.inStoreTotalDeferred)})</span>` : ""}
          </td>
          <td style="color:#7c3aed">${fmtNum(summary.inStoreTotal)}</td>
        </tr>
      </tfoot>
    </table>`}

  <!-- Repair Payments -->
  <div class="section-title">
    <span class="icon-dot" style="background:#2563eb"></span>
    مدفوعات التصليح
    <span style="margin-right:auto;font-size:10px;font-weight:400;color:#666">${repairSales.filter(t => t.paymentStatus !== 'deferred').length} سجل${repairSales.some(t => t.paymentStatus === 'deferred') ? ` + ${repairSales.filter(t => t.paymentStatus === 'deferred').length} آجل` : ""}</span>
  </div>
  ${repairSales.length === 0
    ? `<div class="empty-msg">لا توجد مدفوعات تصليح لهذا اليوم</div>`
    : `<table>
      <thead>
        <tr>
          <th>#</th>
          <th>رقم التذكرة</th>
          <th>العميل</th>
          <th>الجهاز</th>
          <th>طريقة الدفع</th>
          <th>المبلغ</th>
        </tr>
      </thead>
      <tbody>${repairRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="5">
            المجموع
            ${(summary.repairTotalDeferred ?? 0) > 0 ? `<span style="font-size:10px;font-weight:400;color:#c2410c;margin-right:8px">(آجل غير محسوب: ${fmtNum(summary.repairTotalDeferred)})</span>` : ""}
          </td>
          <td style="color:#2563eb">${fmtNum(summary.repairTotal)}</td>
        </tr>
      </tfoot>
    </table>`}

  ${withdrawals.length > 0 ? `
  <!-- Withdrawals -->
  <div class="section-title">
    <span class="icon-dot" style="background:#c2410c"></span>
    السحوبات اليومية
    <span style="margin-right:auto;font-size:10px;font-weight:400;color:#666">${withdrawals.length} سجل</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>الموظف</th>
        <th>السبب</th>
        <th>الوقت</th>
        <th>المبلغ</th>
      </tr>
    </thead>
    <tbody>${withdrawalRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">إجمالي السحوبات</td>
        <td style="color:#c2410c">${fmtNum(summary.totalWithdrawals)}</td>
      </tr>
    </tfoot>
  </table>` : ""}

  <!-- Grand Total -->
  <div class="grand-total-bar">
    <div class="title">الإجمالي الكلي ليوم ${displayDate}</div>
    <div class="right">
      ${payBreakdown}
      <div class="divider"></div>
      <div class="total-big">
        <div class="lbl">الكلي المحصّل</div>
        <div class="amt">${fmtNum(summary.grandTotal)}</div>
      </div>
      ${(summary.totalWithdrawals ?? 0) > 0 ? `
      <div class="divider"></div>
      <div class="total-big">
        <div class="lbl" style="color:#c2410c">صافي الإيراد</div>
        <div class="amt" style="color:#c2410c">${fmtNum(summary.netTotal)}</div>
      </div>` : ""}
    </div>
  </div>

  <!-- Signature Row -->
  <div class="sig-row">
    <div class="sig-box">
      <div class="sig-label">توقيع المسؤول</div>
      <div class="sig-line"></div>
    </div>
    <div class="sig-box">
      <div class="sig-label">ملاحظات</div>
      <div class="sig-line"></div>
    </div>
    <div class="sig-box">
      <div class="sig-label">مراجعة الصندوق</div>
      <div class="sig-line"></div>
    </div>
  </div>

  <div class="report-footer">
    طُبع بتاريخ ${format(new Date(), "dd/MM/yyyy HH:mm")} · العين لتجارة الحاسبات · نظام إدارة المبيعات
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;
}

export default function DailyReport({ user }: DailyReportProps) {
  const { language } = useLanguage();
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);

  const { data, isLoading } = useQuery<DailyReportData>({
    queryKey: ["/api/daily-report", selectedDate],
    queryFn: () =>
      fetch(`/api/daily-report?date=${selectedDate}`, { credentials: "include" })
        .then((r) => r.json()),
  });

  const displayDate = selectedDate
    ? format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy", { locale: ar })
    : "";

  const handlePrint = () => {
    if (!data) return;
    const html = buildPrintHTML(data, displayDate);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">
            {language === "ar" ? "التقرير اليومي" : "Daily Report"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {language === "ar"
              ? "مبيعات المتجر + مدفوعات التصليح في تقرير واحد قابل للطباعة"
              : "In-store sales + repair payments — printable A4 report"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => setSelectedDate(e.target.value)}
              data-testid="input-report-date"
              className="ps-9 pe-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <Button
            onClick={handlePrint}
            disabled={!data || isLoading}
            className="gap-2"
            data-testid="button-print-report"
          >
            <Printer className="h-4 w-4" />
            {language === "ar" ? "طباعة A4" : "Print A4"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? null : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "ar" ? "مجموع المتجر" : "In-Store Total"}
                </p>
                <p className="text-lg font-bold text-violet-600 dark:text-violet-400" data-testid="text-instore-total">
                  {fmtNum(data.summary.inStoreTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.summary.inStoreCount} {language === "ar" ? "فاتورة" : "txn"}
                  {data.summary.inStoreTotalDeferred > 0 && (
                    <span className="text-orange-500 ms-1">
                      · آجل: {fmtNum(data.summary.inStoreTotalDeferred)}
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "ar" ? "مجموع التصليح" : "Repair Total"}
                </p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400" data-testid="text-repair-total">
                  {fmtNum(data.summary.repairTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.summary.repairCount} {language === "ar" ? "تذكرة" : "ticket"}
                </p>
              </CardContent>
            </Card>

            <Card className={(data.summary.totalWithdrawals ?? 0) > 0 ? "" : "col-span-2"}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "ar" ? "الإجمالي المحصّل" : "Grand Total"}
                </p>
                <p className="text-2xl font-bold text-primary" data-testid="text-grand-total">
                  {fmtNum(data.summary.grandTotal)}
                </p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                  {data.summary.grandTotalCash > 0 && (
                    <span className="flex items-center gap-1">
                      <Banknote className="h-3 w-3 text-green-500" />
                      {fmtNum(data.summary.grandTotalCash)} نقداً
                    </span>
                  )}
                  {(data.summary.grandTotalCard ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3 text-teal-500" />
                      {fmtNum(data.summary.grandTotalCard)} {language === "ar" ? "بطاقة" : "Card"}
                    </span>
                  )}
                  {data.summary.grandTotalZain > 0 && (
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3 text-blue-500" />
                      {fmtNum(data.summary.grandTotalZain)} ZainCash
                    </span>
                  )}
                  {data.summary.grandTotalQi > 0 && (
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3 text-purple-500" />
                      {fmtNum(data.summary.grandTotalQi)} QiCard
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {(data.summary.totalWithdrawals ?? 0) > 0 && (
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    {language === "ar" ? "السحوبات اليومية" : "Withdrawals"}
                  </p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400" data-testid="text-withdrawals-total">
                    - {fmtNum(data.summary.totalWithdrawals)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {data.summary.withdrawalCount} {language === "ar" ? "عملية" : "entries"}
                  </p>
                </CardContent>
              </Card>
            )}

            {(data.summary.totalWithdrawals ?? 0) > 0 && (
              <Card className="col-span-2 border-primary/40">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    {language === "ar" ? "صافي الإيراد" : "Net Revenue"}
                  </p>
                  <p className="text-2xl font-bold text-primary" data-testid="text-net-total">
                    {fmtNum(data.summary.netTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {language === "ar" ? "بعد خصم السحوبات" : "After withdrawals"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* In-Store Sales */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="h-5 w-5 text-violet-500" />
                {language === "ar" ? "مبيعات المتجر" : "In-Store Sales"}
                <Badge variant="secondary" className="ms-auto">{data.inStoreSales.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.inStoreSales.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  {language === "ar" ? "لا توجد مبيعات لهذا اليوم" : "No sales for this day"}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-start py-2 px-4 font-medium text-muted-foreground">#</th>
                        <th className="text-start py-2 px-4 font-medium text-muted-foreground">
                          {language === "ar" ? "رقم الفاتورة" : "Order #"}
                        </th>
                        <th className="text-start py-2 px-4 font-medium text-muted-foreground">
                          {language === "ar" ? "العميل" : "Customer"}
                        </th>
                        <th className="text-start py-2 px-4 font-medium text-muted-foreground">
                          {language === "ar" ? "الوقت" : "Time"}
                        </th>
                        <th className="text-start py-2 px-4 font-medium text-muted-foreground">
                          {language === "ar" ? "طريقة الدفع" : "Payment"}
                        </th>
                        <th className="text-end py-2 px-4 font-medium text-muted-foreground">
                          {language === "ar" ? "المبلغ" : "Amount"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.inStoreSales.map((order, idx) => {
                        const parsedItems: { nameAr?: string; nameEn?: string; price: string; quantity: number }[] =
                          (order.items || []).map((i: any) => {
                            try { return typeof i === "string" ? JSON.parse(i) : i; }
                            catch { return null; }
                          }).filter(Boolean);
                        return (
                          <>
                            <tr key={order.id} className="border-b" data-testid={`row-instore-${order.id}`}>
                              <td className="py-2 px-4 text-muted-foreground">{idx + 1}</td>
                              <td className="py-2 px-4 font-mono text-xs">{order.orderNumber}</td>
                              <td className="py-2 px-4">
                                <div>{order.customerName}</div>
                                {order.customerPhone && (
                                  <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                                )}
                              </td>
                              <td className="py-2 px-4 text-muted-foreground text-xs">
                                {format(new Date(order.createdAt), "HH:mm")}
                              </td>
                              <td className="py-2 px-4">
                                {paymentBadge(order.paymentMethod, order.paymentStatus)}
                              </td>
                              <td className={`py-2 px-4 text-end font-semibold ${order.paymentStatus === "deferred" ? "text-orange-600" : ""}`}>
                                {fmtNum(parseFloat(order.total))}
                              </td>
                            </tr>
                            {parsedItems.length > 0 && (
                              <tr key={`${order.id}-items`} className="border-b last:border-0 bg-muted/20">
                                <td />
                                <td colSpan={5} className="py-1 px-4 pb-2">
                                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                                    {parsedItems.map((item, ii) => (
                                      <span key={ii} className="text-xs text-muted-foreground">
                                        {item.nameAr || item.nameEn}
                                        <span className="mx-1 text-foreground/50">×</span>
                                        <span className="font-medium text-foreground">{item.quantity}</span>
                                        <span className="mx-1 text-foreground/50">=</span>
                                        <span className="font-medium">{fmtNum(parseFloat(item.price) * item.quantity)}</span>
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 border-t-2 font-semibold">
                        <td colSpan={5} className="py-2 px-4">
                          {language === "ar" ? "المجموع" : "Total"}
                          {data.summary.inStoreTotalDeferred > 0 && (
                            <span className="text-xs text-orange-500 font-normal ms-2">
                              (آجل غير محسوب: {fmtNum(data.summary.inStoreTotalDeferred)})
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-end text-violet-600 dark:text-violet-400">
                          {fmtNum(data.summary.inStoreTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Repair Sales */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-5 w-5 text-blue-500" />
                {language === "ar" ? "مدفوعات التصليح" : "Repair Payments"}
                <Badge variant="secondary" className="ms-auto">{data.repairSales.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.repairSales.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  {language === "ar" ? "لا توجد مدفوعات تصليح لهذا اليوم" : "No repair payments for this day"}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-start py-2 px-4 font-medium text-muted-foreground">#</th>
                        <th className="text-start py-2 px-4 font-medium text-muted-foreground">
                          {language === "ar" ? "رقم التذكرة" : "Ticket #"}
                        </th>
                        <th className="text-start py-2 px-4 font-medium text-muted-foreground">
                          {language === "ar" ? "العميل" : "Customer"}
                        </th>
                        <th className="text-start py-2 px-4 font-medium text-muted-foreground">
                          {language === "ar" ? "الجهاز" : "Device"}
                        </th>
                        <th className="text-start py-2 px-4 font-medium text-muted-foreground">
                          {language === "ar" ? "طريقة الدفع" : "Payment"}
                        </th>
                        <th className="text-end py-2 px-4 font-medium text-muted-foreground">
                          {language === "ar" ? "المبلغ" : "Amount"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.repairSales.map((ticket, idx) => {
                        const amount = parseFloat(ticket.finalCost || ticket.costEstimate || "0");
                        const deviceStr = [ticket.deviceBrand, ticket.deviceModel, ticket.deviceType].filter(Boolean).join(" ");
                        const hasDetails = ticket.issueDescriptionAr || ticket.technicianNotes;
                        return (
                          <>
                            <tr key={ticket.id} className="border-b" data-testid={`row-repair-${ticket.id}`}>
                              <td className="py-2 px-4 text-muted-foreground">{idx + 1}</td>
                              <td className="py-2 px-4 font-mono text-xs">{ticket.ticketNumber}</td>
                              <td className="py-2 px-4">
                                <div>{ticket.customerName}</div>
                                {ticket.customerPhone && (
                                  <div className="text-xs text-muted-foreground">{ticket.customerPhone}</div>
                                )}
                              </td>
                              <td className="py-2 px-4 text-muted-foreground">{deviceStr}</td>
                              <td className="py-2 px-4">
                                <div className="flex flex-wrap gap-1">
                                  {ticket.paymentStatus === 'deferred'
                                    ? <Badge variant="outline" className="text-orange-600 border-orange-400">آجل</Badge>
                                    : ticket.status === 'delivered'
                                      ? <Badge variant="outline" className="text-emerald-700 border-emerald-400">مُسلَّم ✓</Badge>
                                      : <Badge variant="outline" className="text-green-700 border-green-400">مدفوع</Badge>
                                  }
                                  {ticket.paymentStatus !== 'deferred' && (
                                    <Badge variant="outline" className="text-xs">
                                      {ticket.paymentMethod === 'card' ? 'بطاقة' : 'نقداً'}
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className={`py-2 px-4 text-end font-semibold ${ticket.paymentStatus === 'deferred' ? 'text-orange-600' : ''}`}>
                                {fmtNum(amount)}
                              </td>
                            </tr>
                            {hasDetails && (
                              <tr key={`${ticket.id}-detail`} className="border-b last:border-0 bg-muted/20">
                                <td />
                                <td colSpan={5} className="py-1 px-4 pb-2">
                                  <div className="flex flex-wrap gap-x-6 gap-y-0.5">
                                    {ticket.issueDescriptionAr && (
                                      <span className="text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground/70">{language === "ar" ? "المشكلة:" : "Issue:"}</span>{" "}
                                        {ticket.issueDescriptionAr}
                                      </span>
                                    )}
                                    {ticket.technicianNotes && (
                                      <span className="text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground/70">{language === "ar" ? "ملاحظات الفني:" : "Tech notes:"}</span>{" "}
                                        {ticket.technicianNotes}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 border-t-2 font-semibold">
                        <td colSpan={5} className="py-2 px-4">
                          {language === "ar" ? "المجموع" : "Total"}
                          {(data.summary.repairTotalDeferred ?? 0) > 0 && (
                            <span className="text-xs text-orange-500 font-normal ms-2">
                              (آجل غير محسوب: {fmtNum(data.summary.repairTotalDeferred)})
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-end text-blue-600 dark:text-blue-400">
                          {fmtNum(data.summary.repairTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily Withdrawals */}
          {(data.withdrawals?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingDown className="h-5 w-5 text-orange-500" />
                  {language === "ar" ? "السحوبات اليومية" : "Daily Withdrawals"}
                  <Badge variant="secondary" className="ms-auto">{data.withdrawals.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-xs font-semibold text-muted-foreground">
                        <th className="py-2 px-4 text-start">#</th>
                        <th className="py-2 px-4 text-start">{language === "ar" ? "الموظف" : "Employee"}</th>
                        <th className="py-2 px-4 text-start">{language === "ar" ? "السبب" : "Reason"}</th>
                        <th className="py-2 px-4 text-start">{language === "ar" ? "الوقت" : "Time"}</th>
                        <th className="py-2 px-4 text-end">{language === "ar" ? "المبلغ" : "Amount"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.withdrawals.map((w, i) => (
                        <tr key={w.id} className="border-b last:border-0 hover:bg-muted/10">
                          <td className="py-2 px-4 text-muted-foreground">{i + 1}</td>
                          <td className="py-2 px-4 font-medium">{w.employeeName}</td>
                          <td className="py-2 px-4 text-muted-foreground">{w.reason || "—"}</td>
                          <td className="py-2 px-4 text-muted-foreground text-xs">
                            {format(new Date(w.createdAt), "HH:mm")}
                          </td>
                          <td className="py-2 px-4 text-end font-semibold text-orange-600 dark:text-orange-400">
                            {fmtNum(parseFloat(w.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 border-t-2 font-semibold">
                        <td colSpan={4} className="py-2 px-4">{language === "ar" ? "إجمالي السحوبات" : "Total Withdrawals"}</td>
                        <td className="py-2 px-4 text-end text-orange-600 dark:text-orange-400">
                          {fmtNum(data.summary.totalWithdrawals)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grand Total Bar */}
          <Card className="border-primary/30">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span className="font-bold text-lg">
                    {language === "ar" ? "الإجمالي الكلي ليوم" : "Grand Total for"} {displayDate}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  {data.summary.grandTotalCash > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Banknote className="h-3 w-3 text-green-500" />
                        نقداً
                      </p>
                      <p className="font-semibold text-green-600">{fmtNum(data.summary.grandTotalCash)}</p>
                    </div>
                  )}
                  {(data.summary.grandTotalCard ?? 0) > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CreditCard className="h-3 w-3 text-teal-500" />
                        {language === "ar" ? "بطاقة" : "Card"}
                      </p>
                      <p className="font-semibold text-teal-600">{fmtNum(data.summary.grandTotalCard)}</p>
                    </div>
                  )}
                  {data.summary.grandTotalZain > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CreditCard className="h-3 w-3 text-blue-500" />
                        ZainCash
                      </p>
                      <p className="font-semibold text-blue-600">{fmtNum(data.summary.grandTotalZain)}</p>
                    </div>
                  )}
                  {data.summary.grandTotalQi > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CreditCard className="h-3 w-3 text-purple-500" />
                        QiCard
                      </p>
                      <p className="font-semibold text-purple-600">{fmtNum(data.summary.grandTotalQi)}</p>
                    </div>
                  )}
                  {data.summary.inStoreTotalDeferred > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3 text-orange-500" />
                        آجل
                      </p>
                      <p className="font-semibold text-orange-600">{fmtNum(data.summary.inStoreTotalDeferred)}</p>
                    </div>
                  )}
                  <Separator orientation="vertical" className="h-10" />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{language === "ar" ? "الكلي المحصّل" : "Total Collected"}</p>
                    <p className="font-bold text-2xl text-primary" data-testid="text-bottom-grand-total">
                      {fmtNum(data.summary.grandTotal)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
