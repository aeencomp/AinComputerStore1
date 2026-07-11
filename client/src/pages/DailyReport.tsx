import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Printer,
  Store,
  Wrench,
  Loader2,
  TrendingUp,
  TrendingDown,
  Banknote,
  CreditCard,
  Clock,
  RefreshCw,
  User,
  CheckCircle2,
  Radio,
  HandCoins,
  MessageCircle,
  Trash2,
  Ban,
  RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { SalesShift } from "@shared/schema";

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
  status?: string;
  items: any[];
  notes?: string;
  createdAt: string;
}

interface RepairSale {
  id: string;
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
  inStoreTotalCard: number;
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
  advancesTotal: number;
  advancesCount: number;
  netTotal: number;
}

interface Withdrawal {
  id: number;
  amount: string;
  reason: string | null;
  employeeName: string;
  createdAt: string;
}

interface StaffAdvance {
  id: number;
  amount: string;
  staffName: string;
  reason: string | null;
  createdAt: string;
}

interface ShiftReportData {
  shift: SalesShift;
  inStoreSales: InStoreOrder[];
  repairSales: RepairSale[];
  withdrawals: Withdrawal[];
  advances: StaffAdvance[];
  summary: DailyReportSummary;
}

interface DailyReportApiResponse {
  date: string;
  inStoreSales: InStoreOrder[];
  repairSales: RepairSale[];
  withdrawals: Withdrawal[];
  summary: Omit<DailyReportSummary, "advancesTotal" | "advancesCount">;
}

interface DailyReportProps {
  user: { id: string; role?: string; permissions?: { canEditReceipt?: number; canViewReports?: number } };
  salesLocationId?: number;
}

function fmtNum(n: number) {
  return n.toLocaleString("ar-IQ") + " د.ع";
}

function isDeferredPayment(method: string | undefined, status: string | undefined): boolean {
  return status === "deferred" || method === "deferred";
}

function paymentLabel(
  method: string | undefined,
  status: string | undefined,
  order?: { cashPaidAmount?: string | null; cardPaidAmount?: string | null },
): string {
  if (isDeferredPayment(method, status)) return "آجل";
  if (method === "split" && order) {
    const cash = parseFloat(order.cashPaidAmount || "0") || 0;
    const card = parseFloat(order.cardPaidAmount || "0") || 0;
    return `نقد ${cash.toLocaleString("en-US")} + بطاقة ${card.toLocaleString("en-US")}`;
  }
  if (!method || method === "cash") return "نقداً";
  if (method === "card") return "بطاقة";
  if (method === "zaincash") return "ZainCash";
  if (method === "qicard") return "QiCard";
  return method;
}

function paymentBadge(
  method: string | undefined,
  status: string | undefined,
  order?: { cashPaidAmount?: string | null; cardPaidAmount?: string | null },
) {
  if (isDeferredPayment(method, status)) return <Badge variant="outline" className="text-orange-600 border-orange-400">آجل</Badge>;
  if (method === "split") {
    return <Badge variant="outline" className="text-teal-700 border-teal-400">{paymentLabel(method, status, order)}</Badge>;
  }
  if (!method || method === "cash") return <Badge variant="outline" className="text-green-700 border-green-400">نقداً</Badge>;
  if (method === "card") return <Badge variant="outline" className="text-indigo-700 border-indigo-400">بطاقة</Badge>;
  if (method === "zaincash") return <Badge variant="outline" className="text-blue-700 border-blue-400">ZainCash</Badge>;
  if (method === "qicard") return <Badge variant="outline" className="text-purple-700 border-purple-400">QiCard</Badge>;
  return <Badge variant="outline">{method}</Badge>;
}

function formatShiftRange(shift: SalesShift): string {
  const start = format(new Date(shift.startTime), "dd/MM/yyyy HH:mm");
  const end = shift.endTime ? format(new Date(shift.endTime), "dd/MM/yyyy HH:mm") : "جارية";
  return `${start} — ${end}`;
}

function buildPrintHTML(data: ShiftReportData): string {
  const { shift, inStoreSales, repairSales, withdrawals = [], advances = [], summary } = data;
  const displayRange = formatShiftRange(shift);

  const inStoreRows = inStoreSales.map((o, i) => {
    const pay = paymentLabel(o.paymentMethod, o.paymentStatus, o);
    const isDeferred = isDeferredPayment(o.paymentMethod, o.paymentStatus);
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
    const badgeTxt = isDeferred ? 'آجل' : isDelivered ? 'مُسلَّم' : 'مدفوع';
    const methodTxt = !isDeferred && t.paymentStatus === 'paid'
      ? (t.paymentMethod === 'split'
        ? ` — نقد ${(parseFloat((t as any).cashPaidAmount || '0') || 0).toLocaleString('en-US')} + بطاقة ${(parseFloat((t as any).cardPaidAmount || '0') || 0).toLocaleString('en-US')}`
        : t.paymentMethod === 'card' ? ' — بطاقة' : ' — نقداً')
      : '';
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

  const advanceRows = advances.map((a, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${a.staffName}</td>
      <td>${a.reason || "—"}</td>
      <td style="color:#666">${format(new Date(a.createdAt), "HH:mm")}</td>
      <td style="text-align:end;font-weight:600;color:#059669">${fmtNum(parseFloat(a.amount))}</td>
    </tr>`).join("");

  const advancesTotal = (summary.advancesTotal ?? 0);

  const payBreakdown = [
    summary.grandTotalCash > 0 ? `<div class="breakdown-item"><span class="dot green"></span><span>نقداً</span><strong>${fmtNum(summary.grandTotalCash)}</strong></div>` : "",
    (summary.grandTotalCard ?? 0) > 0 ? `<div class="breakdown-item"><span class="dot teal"></span><span>بطاقة</span><strong>${fmtNum(summary.grandTotalCard)}</strong></div>` : "",
    summary.grandTotalZain > 0 ? `<div class="breakdown-item"><span class="dot blue"></span><span>ZainCash</span><strong>${fmtNum(summary.grandTotalZain)}</strong></div>` : "",
    summary.grandTotalQi > 0 ? `<div class="breakdown-item"><span class="dot purple"></span><span>QiCard</span><strong>${fmtNum(summary.grandTotalQi)}</strong></div>` : "",
    advancesTotal > 0 ? `<div class="breakdown-item"><span class="dot emerald"></span><span>دفع من الجيب</span><strong style="color:#059669">+ ${fmtNum(advancesTotal)}</strong></div>` : "",
    summary.inStoreTotalDeferred > 0 ? `<div class="breakdown-item"><span class="dot orange"></span><span>آجل (غير محصّل)</span><strong style="color:#c2410c">${fmtNum(summary.inStoreTotalDeferred)}</strong></div>` : "",
    (summary.totalWithdrawals ?? 0) > 0 ? `<div class="breakdown-item"><span class="dot red"></span><span>السحوبات</span><strong style="color:#c2410c">- ${fmtNum(summary.totalWithdrawals)}</strong></div>` : "",
  ].join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <title>تقرير الوردية - ${shift.salesUserName}</title>
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
    .report-header {
      text-align: center;
      border-bottom: 2px solid #111;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .report-header h1 { font-size: 20px; font-weight: 700; }
    .report-header h2 { font-size: 14px; font-weight: 600; margin-top: 2px; }
    .report-header .date { font-size: 12px; color: #555; margin-top: 4px; }
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
    .section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      background: #f4f4f5;
      padding: 6px 10px;
      border-radius: 5px 5px 0 0;
      margin-bottom: 0;
      border: 1px solid #e4e4e7;
      border-bottom: none;
    }
    .icon-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
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
    .breakdown-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .breakdown-item span { font-size: 10px; color: #555; display: flex; align-items: center; gap: 3px; }
    .breakdown-item strong { font-size: 12px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .dot.green   { background: #16a34a; }
    .dot.teal    { background: #0d9488; }
    .dot.blue    { background: #2563eb; }
    .dot.purple  { background: #7c3aed; }
    .dot.orange  { background: #ea580c; }
    .dot.emerald { background: #059669; }
    .divider { width: 1px; height: 40px; background: #d1d5db; }
    .total-big { text-align: center; }
    .total-big .lbl { font-size: 10px; color: #666; }
    .total-big .amt { font-size: 22px; font-weight: 800; }
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
    <h2>تقرير الوردية — ${shift.salesUserName}</h2>
    <div class="date">${displayRange}</div>
  </div>

  <div class="summary-grid">
    <div class="summary-box">
      <div class="label">مبيعات المتجر</div>
      <div class="value violet">${fmtNum(summary.inStoreTotal)}</div>
      <div class="sub">${summary.inStoreCount} فاتورة${summary.inStoreTotalCash > 0 ? ` · نقداً: ${fmtNum(summary.inStoreTotalCash)}` : ""}${(summary.inStoreTotalCard ?? 0) > 0 ? ` · بطاقة: ${fmtNum(summary.inStoreTotalCard)}` : ""}${summary.inStoreTotalDeferred > 0 ? ` · آجل: ${fmtNum(summary.inStoreTotalDeferred)}` : ""}</div>
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
    ${advancesTotal > 0 ? `
    <div class="summary-box">
      <div class="label">دفع من الجيب (سلف)</div>
      <div class="value" style="color:#059669">+ ${fmtNum(advancesTotal)}</div>
      <div class="sub">${summary.advancesCount ?? 0} سلفة</div>
    </div>` : ""}
    ${(summary.totalWithdrawals ?? 0) > 0 ? `
    <div class="summary-box">
      <div class="label">السحوبات</div>
      <div class="value" style="color:#c2410c">- ${fmtNum(summary.totalWithdrawals)}</div>
      <div class="sub">${summary.withdrawalCount} عملية</div>
    </div>` : ""}
    ${(advancesTotal > 0 || (summary.totalWithdrawals ?? 0) > 0) ? `
    <div class="summary-box" style="border-color:#111;grid-column:span ${advancesTotal > 0 && (summary.totalWithdrawals ?? 0) > 0 ? 1 : 2}">
      <div class="label">صافي الإيراد</div>
      <div class="value" style="color:#111;font-size:20px">${fmtNum(summary.netTotal)}</div>
      <div class="sub">بعد احتساب السلف والسحوبات</div>
    </div>` : ""}
  </div>

  <div class="section-title">
    <span class="icon-dot" style="background:#7c3aed"></span>
    مبيعات المتجر
    <span style="margin-right:auto;font-size:10px;font-weight:400;color:#666">${inStoreSales.length} سجل</span>
  </div>
  ${inStoreSales.length === 0
    ? `<div class="empty-msg">لا توجد مبيعات في هذه الوردية</div>`
    : `<table>
      <thead>
        <tr>
          <th>#</th><th>رقم الفاتورة</th><th>العميل</th><th>الوقت</th><th>طريقة الدفع</th><th>المبلغ</th>
        </tr>
      </thead>
      <tbody>${inStoreRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="5">المجموع ${summary.inStoreTotalDeferred > 0 ? `<span style="font-size:10px;font-weight:400;color:#c2410c;margin-right:8px">(آجل غير محسوب: ${fmtNum(summary.inStoreTotalDeferred)})</span>` : ""}</td>
          <td style="color:#7c3aed">${fmtNum(summary.inStoreTotal)}</td>
        </tr>
      </tfoot>
    </table>`}

  <div class="section-title">
    <span class="icon-dot" style="background:#2563eb"></span>
    مدفوعات التصليح
    <span style="margin-right:auto;font-size:10px;font-weight:400;color:#666">${repairSales.filter(t => t.paymentStatus !== 'deferred').length} سجل</span>
  </div>
  ${repairSales.length === 0
    ? `<div class="empty-msg">لا توجد مدفوعات تصليح في هذه الوردية</div>`
    : `<table>
      <thead>
        <tr>
          <th>#</th><th>رقم التذكرة</th><th>العميل</th><th>الجهاز</th><th>طريقة الدفع</th><th>المبلغ</th>
        </tr>
      </thead>
      <tbody>${repairRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="5">المجموع ${(summary.repairTotalDeferred ?? 0) > 0 ? `<span style="font-size:10px;font-weight:400;color:#c2410c;margin-right:8px">(آجل غير محسوب: ${fmtNum(summary.repairTotalDeferred)})</span>` : ""}</td>
          <td style="color:#2563eb">${fmtNum(summary.repairTotal)}</td>
        </tr>
      </tfoot>
    </table>`}

  ${withdrawals.length > 0 ? `
  <div class="section-title">
    <span class="icon-dot" style="background:#c2410c"></span>
    السحوبات
    <span style="margin-right:auto;font-size:10px;font-weight:400;color:#666">${withdrawals.length} سجل</span>
  </div>
  <table>
    <thead><tr><th>#</th><th>الموظف</th><th>السبب</th><th>الوقت</th><th>المبلغ</th></tr></thead>
    <tbody>${withdrawalRows}</tbody>
    <tfoot><tr><td colspan="4">إجمالي السحوبات</td><td style="color:#c2410c">${fmtNum(summary.totalWithdrawals)}</td></tr></tfoot>
  </table>` : ""}

  ${advances.length > 0 ? `
  <div class="section-title">
    <span class="icon-dot" style="background:#059669"></span>
    دفع من الجيب (سلف الموظفين)
    <span style="margin-right:auto;font-size:10px;font-weight:400;color:#666">${advances.length} سجل</span>
  </div>
  <table>
    <thead><tr><th>#</th><th>الموظف</th><th>السبب</th><th>الوقت</th><th>المبلغ</th></tr></thead>
    <tbody>${advanceRows}</tbody>
    <tfoot><tr><td colspan="4">إجمالي السلف</td><td style="color:#059669">+ ${fmtNum(advancesTotal)}</td></tr></tfoot>
  </table>` : ""}

  <div class="grand-total-bar">
    <div class="title">الإجمالي الكلي للوردية</div>
    <div class="right">
      ${payBreakdown}
      <div class="divider"></div>
      ${(summary.totalWithdrawals ?? 0) > 0 ? `
      <div class="total-big">
        <div class="lbl" style="color:#666;font-size:11px">الكلي قبل السحوبات</div>
        <div class="amt" style="font-size:15px;color:#555;text-decoration:line-through">${fmtNum(summary.grandTotal)}</div>
      </div>
      <div class="total-big">
        <div class="lbl" style="color:#c2410c">السحوبات (${summary.withdrawalCount})</div>
        <div class="amt" style="color:#c2410c;font-size:15px">- ${fmtNum(summary.totalWithdrawals)}</div>
      </div>
      <div class="divider"></div>
      <div class="total-big">
        <div class="lbl">صافي الإيراد</div>
        <div class="amt">${fmtNum(summary.netTotal)}</div>
      </div>` : `
      <div class="total-big">
        <div class="lbl">الكلي المحصّل</div>
        <div class="amt">${fmtNum(summary.grandTotal)}</div>
      </div>`}
    </div>
  </div>

  <div class="sig-row">
    <div class="sig-box"><div class="sig-label">توقيع المسؤول</div><div class="sig-line"></div></div>
    <div class="sig-box"><div class="sig-label">ملاحظات</div><div class="sig-line"></div></div>
    <div class="sig-box"><div class="sig-label">مراجعة الصندوق</div><div class="sig-line"></div></div>
  </div>

  <div class="report-footer">
    طُبع بتاريخ ${format(new Date(), "dd/MM/yyyy HH:mm")} · العين لتجارة الحاسبات · نظام إدارة المبيعات
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;
}

export default function DailyReport({ user, salesLocationId = 1 }: DailyReportProps) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canVoidSales = user.role === "sales_admin" || user.permissions?.canEditReceipt === 1;
  const canSendDailyRevenueWhatsApp = user.role === "sales_admin";
  const canReopenShift = (shift: SalesShift) =>
    shift.salesUserId === user.id
    || user.role === "sales_admin"
    || user.permissions?.canViewReports === 1;

  const voidOrderMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiRequest("POST", `/api/sales/orders/${id}/void`, { reason });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-report"] });
      toast({
        title: language === "ar" ? "تم إلغاء الطلب" : "Order voided",
        description: language === "ar" ? "تم استرجاع المخزون" : "Inventory restored",
      });
    },
    onError: (err: Error) => {
      toast({
        title: language === "ar" ? "فشل الإلغاء" : "Void failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const confirmVoidOrder = (order: InStoreOrder) => {
    const msg = language === "ar"
      ? `إلغاء الطلب ${order.orderNumber}؟`
      : `Void order ${order.orderNumber}?`;
    if (!window.confirm(msg)) return;
    const reason = window.prompt(
      language === "ar" ? "سبب الإلغاء (اختياري):" : "Void reason (optional):",
    ) || undefined;
    voidOrderMutation.mutate({ id: order.id, reason });
  };
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [manualLabelName, setManualLabelName] = useState("");
  const [manualLabelDate, setManualLabelDate] = useState("");
  const [manualLabelAmount, setManualLabelAmount] = useState("");
  const labelPrintRef = useRef<HTMLDivElement>(null);
  const baghdadToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });

  const sendDailyRevenueWhatsAppMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/daily-revenue/whatsapp", {
        date: baghdadToday,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      return data;
    },
    onSuccess: (data: { deliveryMethod?: string; deliveryWarning?: string; formattedTo?: string }) => {
      const viaTemplate = data.deliveryMethod === "repair_status_template" || data.deliveryMethod === "daily_template";
      toast({
        title: language === "ar" ? "تم إرسال واتساب" : "WhatsApp sent",
        description:
          data.deliveryWarning && !viaTemplate
            ? data.deliveryWarning
            : language === "ar"
              ? `تقرير اليوم (موقع 1، 2، صيانة) → ${data.formattedTo || "الرقم المضبوط"}${viaTemplate ? " (قالب معتمد)" : ""}`
              : `Today's report sent to ${data.formattedTo || "configured number"}${viaTemplate ? " (approved template)" : ""}`,
      });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: language === "ar" ? "فشل الإرسال" : "Send failed",
        description: err.message,
      });
    },
  });

  // List of all shifts
  const { data: shifts = [], isLoading: shiftsLoading, refetch: refetchShifts } = useQuery<SalesShift[]>({
    queryKey: ["/api/sales/shifts", salesLocationId],
    queryFn: async () => {
      const r = await fetch(`/api/sales/shifts?locationId=${salesLocationId}`, { credentials: "include" });
      if (!r.ok) throw new Error(`Failed to load shifts: ${r.status}`);
      return r.json();
    },
    staleTime: 0,
  });

  // Active shift live snapshot
  const { data: activeSnapshot, isLoading: snapshotLoading, refetch: refetchSnapshot } = useQuery<ShiftReportData | null>({
    queryKey: ["/api/sales/shifts/active-snapshot", salesLocationId],
    queryFn: async () => {
      const r = await fetch(`/api/sales/shifts/active-snapshot?locationId=${salesLocationId}`, { credentials: "include" });
      if (!r.ok) throw new Error(`Failed to load active snapshot: ${r.status}`);
      return r.json();
    },
    staleTime: 0,
    refetchInterval: 30000,
  });

  // Calendar-day report fallback (when no active shift). This matches what users expect as "daily report".
  const { data: dailyReportApi, isLoading: dailyLoading, refetch: refetchDaily } = useQuery<DailyReportApiResponse>({
    queryKey: ["/api/daily-report", baghdadToday, salesLocationId],
    queryFn: async () => {
      const r = await fetch(`/api/daily-report?date=${baghdadToday}&locationId=${salesLocationId}`, { credentials: "include" });
      if (!r.ok) throw new Error(`Failed to load daily report: ${r.status}`);
      return r.json();
    },
    enabled: !selectedShiftId && !activeSnapshot,
    staleTime: 0,
  });

  // Full report for selected shift
  const { data: shiftReport, isLoading: reportLoading, isFetching: reportFetching, refetch: refetchReport } = useQuery<ShiftReportData>({
    queryKey: ["/api/sales/shifts", selectedShiftId, "report"],
    queryFn: async () => {
      const r = await fetch(`/api/sales/shifts/${selectedShiftId}/report`, { credentials: "include" });
      if (!r.ok) throw new Error(`Failed to load shift report: ${r.status}`);
      return r.json();
    },
    enabled: !!selectedShiftId,
    staleTime: 0,
  });

  const voidRepairMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await apiRequest("POST", `/api/sales/repair-tickets/${ticketId}/void`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-report"] });
      toast({
        title: language === "ar" ? "تم إلغاء مبيعة الصيانة" : "Repair sale voided",
        description: language === "ar"
          ? "التذكرة ما زالت موجودة في بوابة الفني"
          : "The ticket remains in the technician portal",
      });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: language === "ar" ? "فشل الإلغاء" : "Void failed",
        description: err.message,
      });
    },
  });

  const confirmVoidRepair = (ticket: RepairSale) => {
    const msg = language === "ar"
      ? `إلغاء مبيعة تذكرة ${ticket.ticketNumber}؟`
      : `Void repair sale ${ticket.ticketNumber}?`;
    if (window.confirm(msg)) {
      voidRepairMutation.mutate(ticket.id);
    }
  };

  const reopenShiftMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const res = await apiRequest("POST", `/api/sales/shifts/${shiftId}/reopen`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/shifts/active-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/shifts/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-report"] });
      setSelectedShiftId(null);
      toast({
        title: language === "ar" ? "تم إعادة فتح الوردية" : "Shift reopened",
        description: language === "ar"
          ? "يمكنك الآن إضافة المبيعات الناقصة من نقطة البيع، ثم إغلاق الوردية مرة أخرى"
          : "You can add missing sales from POS, then close the shift again",
      });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: language === "ar" ? "فشل إعادة الفتح" : "Reopen failed",
        description: err.message,
      });
    },
  });

  const confirmReopenShift = (shift: SalesShift, e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = language === "ar"
      ? `إعادة فتح وردية ${shift.salesUserName} (${shift.startTime ? format(new Date(shift.startTime), "dd/MM HH:mm") : ""})؟\n\nستُضاف المبيعات الجديدة لهذه الوردية فقط.`
      : `Reopen shift for ${shift.salesUserName} (${shift.startTime ? format(new Date(shift.startTime), "dd/MM HH:mm") : ""})?\n\nNew sales will be added to this shift only.`;
    if (window.confirm(msg)) {
      reopenShiftMutation.mutate(shift.id);
    }
  };

  const dailyAsShift: ShiftReportData | null = dailyReportApi ? {
    shift: {
      id: `daily-${baghdadToday}`,
      salesUserId: "daily",
      salesUserName: language === "ar" ? "تقرير اليوم" : "Daily",
      startTime: new Date(`${baghdadToday}T00:00:00+03:00`).toISOString(),
      endTime: new Date(`${baghdadToday}T23:59:59.999+03:00`).toISOString(),
      openingCash: "0",
      closingCash: null,
      expectedCash: null,
      cashDifference: null,
      totalSales: String(dailyReportApi.summary.grandTotal ?? 0),
      totalTransactions: (dailyReportApi.summary.inStoreCount ?? 0) + (dailyReportApi.summary.repairCount ?? 0),
      notes: null,
      status: "closed",
      createdAt: new Date().toISOString(),
    } as unknown as SalesShift,
    inStoreSales: dailyReportApi.inStoreSales,
    repairSales: dailyReportApi.repairSales,
    withdrawals: dailyReportApi.withdrawals,
    advances: [],
    summary: {
      ...dailyReportApi.summary,
      advancesTotal: 0,
      advancesCount: 0,
    },
  } : null;

  const data: ShiftReportData | null | undefined = selectedShiftId ? shiftReport : (activeSnapshot ?? dailyAsShift ?? null);
  const isLoading = selectedShiftId ? reportLoading : (snapshotLoading || dailyLoading);
  const isFetching = selectedShiftId ? reportFetching : false;
  const handlePrint = () => {
    if (!data) return;
    const html = buildPrintHTML(data);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const handlePrintLabel = () => {
    if (!data || !labelPrintRef.current) return;
    const labelHtml = labelPrintRef.current.innerHTML;
    const win = window.open("", "_blank", "width=520,height=720");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <title>${language === "ar" ? "ملصق يومي" : "Daily label"}</title>
  <style>
    @page { size: 50mm 30mm; margin: 0; }
    html, body {
      width: 50mm;
      height: 30mm;
      margin: 0;
      padding: 0;
      overflow: hidden;
      font-family: "Segoe UI", Arial, sans-serif;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label-wrap {
      box-sizing: border-box;
      width: 50mm;
      height: 30mm;
      border: 1px solid #111;
      padding: 1mm 1.5mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.5mm;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 2mm;
      font-size: 12pt;
      line-height: 1.2;
    }
    .row .k { color: #444; flex-shrink: 0; }
    .row .v { font-weight: 700; text-align: end; word-break: break-word; }
  </style>
</head>
<body>
  ${labelHtml}
  <script>window.onload = () => window.print();</script>
</body>
</html>`);
    win.document.close();
  };

  const handleRefresh = () => {
    refetchShifts();
    refetchSnapshot();
    if (!selectedShiftId && !activeSnapshot) refetchDaily();
    if (selectedShiftId) refetchReport();
  };

  const closedShifts = shifts.filter(s => String(s.status).toLowerCase() === 'closed');
  const otherOpenShifts = shifts.filter(
    (s) => {
      const st = String(s.status).toLowerCase();
      return (st === "active" || st === "paused") && s.id !== (activeSnapshot?.shift?.id ?? null);
    },
  );

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">
            {language === "ar" ? "تقارير الورديات" : "Shift Reports"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {language === "ar"
              ? "عرض تقرير كل وردية بشكل منفصل مع إمكانية الطباعة"
              : "View each shift's report separately with print support"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isFetching}
            data-testid="button-refresh-report"
            title={language === "ar" ? "تحديث" : "Refresh"}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button
            onClick={handlePrint}
            disabled={!data || isLoading}
            className="gap-2"
            data-testid="button-print-report"
          >
            <Printer className="h-4 w-4" />
            {language === "ar" ? "طباعة A4" : "Print A4"}
          </Button>
          <Button
            variant="secondary"
            onClick={handlePrintLabel}
            disabled={!data || isLoading}
            className="gap-2"
            data-testid="button-print-daily-label"
          >
            <Printer className="h-4 w-4" />
            {language === "ar" ? "طباعة ملصق (50×30)" : "Print label (50×30)"}
          </Button>
          {canSendDailyRevenueWhatsApp && (
            <Button
              variant="outline"
              onClick={() => sendDailyRevenueWhatsAppMutation.mutate()}
              disabled={sendDailyRevenueWhatsAppMutation.isPending}
              className="gap-2 border-green-600 text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
              data-testid="button-send-daily-revenue-whatsapp"
            >
              {sendDailyRevenueWhatsAppMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              {language === "ar" ? "إرسال إيرادات واتساب" : "Send revenue WhatsApp"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-4" style={{ minHeight: '500px' }}>
        {/* Left panel: shift selector */}
        <div className="w-72 flex-shrink-0 space-y-2">
          {/* Active shift snapshot at top */}
          {activeSnapshot && (
            <Card
              className={`cursor-pointer border-2 ${!selectedShiftId ? "border-primary" : "border-transparent"}`}
              onClick={() => setSelectedShiftId(null)}
              data-testid="card-active-shift"
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Radio className={`h-3.5 w-3.5 ${String(activeSnapshot.shift.status).toLowerCase() === 'paused' ? 'text-amber-500' : 'text-green-500 animate-pulse'}`} />
                  <span className={`text-xs font-semibold ${String(activeSnapshot.shift.status).toLowerCase() === 'paused' ? 'text-amber-600' : 'text-green-600'}`}>
                    {String(activeSnapshot.shift.status).toLowerCase() === 'paused'
                      ? (language === "ar" ? "وردية متوقفة" : "Paused Shift")
                      : (activeSnapshot.shift as any).reopenedAt
                        ? (language === "ar" ? "وردية معاد فتحها" : "Reopened Shift")
                        : (language === "ar" ? "وردية نشطة" : "Active Shift")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{activeSnapshot.shift.salesUserName}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "بدأ:" : "Started:"}{" "}
                  {format(new Date(activeSnapshot.shift.startTime), "HH:mm dd/MM")}
                </p>
                <p className="text-sm font-bold text-primary mt-1">
                  {fmtNum(activeSnapshot.summary.grandTotal)}
                </p>
              </CardContent>
            </Card>
          )}

          {/* If API returns active shifts (supervisors), show them selectable too */}
          {otherOpenShifts.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground px-1 pt-1">
                {language === "ar" ? "ورديات مفتوحة" : "Open Shifts"}
                <span className="ms-1">({otherOpenShifts.length})</span>
              </p>
              <div className="space-y-2">
                {otherOpenShifts.map(shift => (
                  <Card
                    key={shift.id}
                    className={`cursor-pointer border-2 transition-colors hover-elevate ${
                      selectedShiftId === shift.id ? "border-primary" : "border-transparent"
                    }`}
                    onClick={() => setSelectedShiftId(shift.id)}
                    data-testid={`card-active-shift-${shift.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Radio className={`h-3.5 w-3.5 ${String(shift.status).toLowerCase() === 'paused' ? 'text-amber-500' : 'text-green-500'}`} />
                        <span className={`text-xs font-semibold ${String(shift.status).toLowerCase() === 'paused' ? 'text-amber-600' : 'text-green-600'}`}>
                          {String(shift.status).toLowerCase() === 'paused'
                            ? (language === "ar" ? "متوقفة" : "Paused")
                            : (language === "ar" ? "نشطة" : "Active")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium truncate">{shift.salesUserName}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {shift.startTime ? format(new Date(shift.startTime), "HH:mm dd/MM") : "—"}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          <p className="text-xs font-semibold text-muted-foreground px-1 pt-3">
            {language === "ar" ? "الورديات المغلقة" : "Closed Shifts"}
            {closedShifts.length > 0 && <span className="ms-1">({closedShifts.length})</span>}
          </p>

          {shiftsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : closedShifts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "لا توجد ورديات مغلقة بعد" : "No closed shifts yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '70vh' }}>
              {closedShifts.map(shift => (
                <Card
                  key={shift.id}
                  className={`cursor-pointer border-2 transition-colors hover-elevate ${selectedShiftId === shift.id ? "border-primary" : "border-transparent"}`}
                  onClick={() => setSelectedShiftId(shift.id)}
                  data-testid={`card-shift-${shift.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">{shift.salesUserName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {shift.startTime ? format(new Date(shift.startTime), "dd/MM HH:mm") : "—"}
                      {" — "}
                      {shift.endTime ? format(new Date(shift.endTime), "HH:mm") : "—"}
                    </p>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-bold text-primary">
                        {fmtNum(parseFloat(shift.totalSales || "0"))}
                      </p>
                      <div className="flex items-center gap-1">
                        {canReopenShift(shift) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={(e) => confirmReopenShift(shift, e)}
                            disabled={reopenShiftMutation.isPending}
                            data-testid={`button-reopen-shift-${shift.id}`}
                            title={language === "ar" ? "إعادة فتح لإضافة مبيعات" : "Reopen to add sales"}
                          >
                            {reopenShiftMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3 w-3" />
                            )}
                            {language === "ar" ? "فتح" : "Reopen"}
                          </Button>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {shift.totalTransactions} {language === "ar" ? "معاملة" : "txn"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right panel: report */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !data ? (
            <Card className="h-64">
              <CardContent className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <TrendingUp className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">
                  {language === "ar"
                    ? "اختر وردية من القائمة لعرض تقريرها"
                    : "Select a shift from the list to view its report"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {language === "ar" ? "ملصق يومي (50×30 مم)" : "Daily label (50×30 mm)"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={manualLabelName}
                      onChange={(e) => setManualLabelName(e.target.value)}
                      placeholder={language === "ar" ? "الاسم (يدوي)" : "Name (manual)"}
                      data-testid="input-daily-label-name-manual"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setManualLabelName("")}
                      disabled={manualLabelName.trim() === ""}
                      data-testid="button-reset-daily-label-name"
                    >
                      {language === "ar" ? "مسح" : "Clear"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="flex gap-2">
                      <Input
                        value={manualLabelDate}
                        onChange={(e) => setManualLabelDate(e.target.value)}
                        placeholder={language === "ar" ? "التاريخ (يدوي)" : "Date (manual)"}
                        data-testid="input-daily-label-date-manual"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setManualLabelDate("")}
                        disabled={manualLabelDate.trim() === ""}
                        data-testid="button-reset-daily-label-date"
                      >
                        {language === "ar" ? "مسح" : "Clear"}
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={manualLabelAmount}
                        onChange={(e) => setManualLabelAmount(e.target.value)}
                        placeholder={language === "ar" ? "المبلغ (يدوي)" : "Amount (manual)"}
                        data-testid="input-daily-label-amount-manual"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setManualLabelAmount("")}
                        disabled={manualLabelAmount.trim() === ""}
                        data-testid="button-reset-daily-label-amount"
                      >
                        {language === "ar" ? "مسح" : "Clear"}
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3 flex justify-center">
                    <div
                      ref={labelPrintRef}
                      className="label-wrap"
                      style={{
                        width: "50mm",
                        height: "30mm",
                        boxSizing: "border-box",
                        border: "1px solid #111",
                        padding: "1mm 1.5mm",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        gap: "0.5mm",
                        background: "#fff",
                      }}
                    >
                      <div
                        className="row"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          gap: "2mm",
                          fontSize: "12pt",
                          lineHeight: 1.2,
                        }}
                      >
                        <span className="k" style={{ color: "#444", flexShrink: 0 }}>{language === "ar" ? "الاسم" : "Name"}</span>
                        <span className="v" style={{ fontWeight: 700, textAlign: "end", wordBreak: "break-word" }}>{manualLabelName.trim() || "—"}</span>
                      </div>
                      <div
                        className="row"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          gap: "2mm",
                          fontSize: "12pt",
                          lineHeight: 1.2,
                        }}
                      >
                        <span className="k" style={{ color: "#444", flexShrink: 0 }}>{language === "ar" ? "التاريخ" : "Date"}</span>
                        <span className="v" style={{ fontWeight: 700, textAlign: "end" }}>{manualLabelDate.trim() || "—"}</span>
                      </div>
                      <div
                        className="row"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          gap: "2mm",
                          fontSize: "12pt",
                          lineHeight: 1.2,
                        }}
                      >
                        <span className="k" style={{ color: "#444", flexShrink: 0 }}>{language === "ar" ? "المبلغ" : "Amount"}</span>
                        <span className="v" style={{ fontWeight: 700, textAlign: "end" }}>
                          {manualLabelAmount.trim() || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Shift info header */}
              <Card>
                <CardContent className="py-3 px-4">
                  <div className="flex flex-wrap items-center gap-4 justify-between">
                    <div className="flex items-center gap-3">
                      {String(data.shift.status).toLowerCase() === 'active' ? (
                        <Badge className="gap-1 bg-green-500/15 text-green-700 border-green-300 hover:bg-green-500/20">
                          <Radio className="h-3 w-3 animate-pulse" />
                          {language === "ar" ? "نشطة" : "Active"}
                        </Badge>
                      ) : String(data.shift.status).toLowerCase() === 'paused' ? (
                        <Badge className="gap-1 bg-amber-500/15 text-amber-700 border-amber-300 hover:bg-amber-500/20">
                          <Radio className="h-3 w-3" />
                          {language === "ar" ? "متوقفة" : "Paused"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {language === "ar" ? "مغلقة" : "Closed"}
                        </Badge>
                      )}
                      <div className="flex items-center gap-1.5">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{data.shift.salesUserName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{formatShiftRange(data.shift)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {language === "ar" ? "مجموع المتجر" : "In-Store Total"}
                    </p>
                    <p className="text-lg font-bold text-violet-600 dark:text-violet-400" data-testid="text-instore-total">
                      {fmtNum(data.summary.inStoreTotal)}
                    </p>
                    <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                      <p>{data.summary.inStoreCount} {language === "ar" ? "فاتورة" : "txn"}</p>
                      {data.summary.inStoreTotalCash > 0 && (
                        <p className="text-green-600 dark:text-green-400">
                          {language === "ar" ? "نقداً:" : "Cash:"} {fmtNum(data.summary.inStoreTotalCash)}
                        </p>
                      )}
                      {(data.summary.inStoreTotalCard ?? 0) > 0 && (
                        <p className="text-teal-600 dark:text-teal-400">
                          {language === "ar" ? "بطاقة:" : "Card:"} {fmtNum(data.summary.inStoreTotalCard)}
                        </p>
                      )}
                      {data.summary.inStoreTotalDeferred > 0 && (
                        <p className="text-orange-500">
                          {language === "ar" ? "آجل:" : "Deferred:"} {fmtNum(data.summary.inStoreTotalDeferred)}
                        </p>
                      )}
                    </div>
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

                <Card className="col-span-2 border-primary/30">
                  <CardContent className="pt-4 pb-4">
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {language === "ar" ? "متجر + تصليح" : "Store + Repair"}
                        </span>
                        <span className="font-medium">
                          {fmtNum((data.summary.inStoreTotal ?? 0) + (data.summary.repairTotal ?? 0))}
                        </span>
                      </div>
                      {(data.summary.advancesTotal ?? 0) > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <HandCoins className="h-3.5 w-3.5" />
                            {language === "ar"
                              ? `دفع من الجيب (${data.summary.advancesCount} سلفة)`
                              : `Staff Advances (${data.summary.advancesCount})`}
                          </span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400" data-testid="text-advances-total">
                            + {fmtNum(data.summary.advancesTotal)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm font-medium border-t border-border pt-1.5">
                        <span className="text-muted-foreground">
                          {language === "ar" ? "الإجمالي الكلي" : "Grand Total"}
                        </span>
                        <span data-testid="text-grand-total">
                          {fmtNum(data.summary.grandTotal)}
                        </span>
                      </div>
                      {data.summary.totalWithdrawals > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1">
                            <TrendingDown className="h-3.5 w-3.5" />
                            {language === "ar"
                              ? `السحوبات (${data.summary.withdrawalCount} سحب)`
                              : `Withdrawals (${data.summary.withdrawalCount})`}
                          </span>
                          <span className="font-medium text-orange-600 dark:text-orange-400" data-testid="text-withdrawals-total">
                            − {fmtNum(data.summary.totalWithdrawals)}
                          </span>
                        </div>
                      )}
                      <div className="border-t border-border pt-1.5 flex items-center justify-between">
                        <span className="text-sm font-semibold">
                          {language === "ar" ? "صافي الإيراد" : "Net Revenue"}
                        </span>
                        <span className="text-2xl font-bold text-primary" data-testid="text-net-total">
                          {fmtNum(data.summary.netTotal)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {data.summary.grandTotalCash > 0 && (
                        <span className="flex items-center gap-1">
                          <Banknote className="h-3 w-3 text-green-500" />
                          {fmtNum(data.summary.grandTotalCash)} {language === "ar" ? "نقداً" : "Cash"}
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
                      {language === "ar" ? "لا توجد مبيعات في هذه الوردية" : "No sales in this shift"}
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
                            {canVoidSales && (
                              <th className="text-center py-2 px-4 font-medium text-muted-foreground w-16" />
                            )}
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
                                    {paymentBadge(order.paymentMethod, order.paymentStatus, order)}
                                  </td>
                                  <td className={`py-2 px-4 text-end font-semibold ${isDeferredPayment(order.paymentMethod, order.paymentStatus) ? "text-orange-600" : ""}`}>
                                    {fmtNum(parseFloat(order.total))}
                                  </td>
                                  {canVoidSales && order.status !== "voided" && (
                                    <td className="py-2 px-4 text-center">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => confirmVoidOrder(order)}
                                        disabled={voidOrderMutation.isPending}
                                        title={language === "ar" ? "إلغاء الطلب" : "Void order"}
                                        className="text-destructive hover:text-destructive"
                                        data-testid={`button-void-order-${order.id}`}
                                      >
                                        {voidOrderMutation.isPending ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Ban className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </td>
                                  )}
                                  {canVoidSales && order.status === "voided" && <td />}
                                </tr>
                                {parsedItems.length > 0 && (
                                  <tr key={`${order.id}-items`} className="border-b last:border-0 bg-muted/20">
                                    <td />
                                    <td colSpan={canVoidSales ? 6 : 5} className="py-1 px-4 pb-2">
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
                            <td colSpan={canVoidSales ? 6 : 5} className="py-2 px-4">
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
                            {canVoidSales && <td />}
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
                      {language === "ar" ? "لا توجد مدفوعات تصليح في هذه الوردية" : "No repair payments in this shift"}
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
                            {canVoidSales && (
                              <th className="text-center py-2 px-4 font-medium text-muted-foreground w-16" />
                            )}
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
                                          ? <Badge variant="outline" className="text-emerald-700 border-emerald-400">مُسلَّم</Badge>
                                          : <Badge variant="outline" className="text-green-700 border-green-400">مدفوع</Badge>
                                      }
                                      {ticket.paymentStatus !== 'deferred' && (
                                        <Badge variant="outline" className="text-xs">
                                          {ticket.paymentMethod === 'split'
                                            ? `نقد ${(parseFloat((ticket as any).cashPaidAmount || '0') || 0).toLocaleString('en-US')} + بطاقة ${(parseFloat((ticket as any).cardPaidAmount || '0') || 0).toLocaleString('en-US')}`
                                            : ticket.paymentMethod === 'card' ? 'بطاقة' : 'نقداً'}
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className={`py-2 px-4 text-end font-semibold ${ticket.paymentStatus === 'deferred' ? 'text-orange-600' : ''}`}>
                                    {fmtNum(amount)}
                                  </td>
                                  {canVoidSales && (
                                    <td className="py-2 px-4 text-center">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => confirmVoidRepair(ticket)}
                                        disabled={voidRepairMutation.isPending}
                                        title={language === "ar" ? "إلغاء مبيعة الصيانة" : "Void repair sale"}
                                        className="text-destructive hover:text-destructive"
                                        data-testid={`button-void-repair-${ticket.id}`}
                                      >
                                        {voidRepairMutation.isPending ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Ban className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </td>
                                  )}
                                </tr>
                                {hasDetails && (
                                  <tr key={`${ticket.id}-detail`} className="border-b last:border-0 bg-muted/20">
                                    <td />
                                    <td colSpan={canVoidSales ? 6 : 5} className="py-1 px-4 pb-2">
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
                            <td colSpan={canVoidSales ? 6 : 5} className="py-2 px-4">
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
                            {canVoidSales && <td />}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Withdrawals */}
              {(data.withdrawals?.length ?? 0) > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingDown className="h-5 w-5 text-orange-500" />
                      {language === "ar" ? "السحوبات" : "Withdrawals"}
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

              {/* Staff Advances */}
              {(data.advances?.length ?? 0) > 0 && (
                <Card className="border-emerald-200 dark:border-emerald-900/40">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <HandCoins className="h-5 w-5 text-emerald-600" />
                      {language === "ar" ? "دفع من الجيب (سلف الموظفين)" : "Staff Advances"}
                      <Badge variant="secondary" className="ms-auto">{data.advances.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-emerald-50/50 dark:bg-emerald-900/10 text-xs font-semibold text-muted-foreground">
                            <th className="py-2 px-4 text-start">#</th>
                            <th className="py-2 px-4 text-start">{language === "ar" ? "الموظف" : "Staff"}</th>
                            <th className="py-2 px-4 text-start">{language === "ar" ? "السبب" : "Reason"}</th>
                            <th className="py-2 px-4 text-start">{language === "ar" ? "الوقت" : "Time"}</th>
                            <th className="py-2 px-4 text-end">{language === "ar" ? "المبلغ" : "Amount"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.advances.map((a, i) => (
                            <tr key={a.id} className="border-b last:border-0 hover:bg-muted/10" data-testid={`row-advance-report-${a.id}`}>
                              <td className="py-2 px-4 text-muted-foreground">{i + 1}</td>
                              <td className="py-2 px-4 font-medium">{a.staffName}</td>
                              <td className="py-2 px-4 text-muted-foreground">{a.reason || "—"}</td>
                              <td className="py-2 px-4 text-muted-foreground text-xs">
                                {format(new Date(a.createdAt), "HH:mm")}
                              </td>
                              <td className="py-2 px-4 text-end font-semibold text-emerald-600 dark:text-emerald-400">
                                + {fmtNum(parseFloat(a.amount))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-emerald-50/50 dark:bg-emerald-900/10 border-t-2 font-semibold">
                            <td colSpan={4} className="py-2 px-4">{language === "ar" ? "إجمالي السلف" : "Total Advances"}</td>
                            <td className="py-2 px-4 text-end text-emerald-600 dark:text-emerald-400">
                              + {fmtNum(data.summary.advancesTotal ?? 0)}
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
                        {language === "ar" ? "الإجمالي الكلي للوردية" : "Shift Grand Total"}
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
                      {(data.summary.advancesTotal ?? 0) > 0 && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <HandCoins className="h-3 w-3 text-emerald-500" />
                            {language === "ar" ? "دفع من الجيب" : "Advances"}
                          </p>
                          <p className="font-semibold text-emerald-600">+ {fmtNum(data.summary.advancesTotal)}</p>
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
      </div>
    </div>
  );
}
