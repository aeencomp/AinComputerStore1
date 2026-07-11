import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Wrench, Banknote, CreditCard, Printer } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

interface Technician {
  id: string;
  displayName: string;
  isAdmin: number;
  permissions: string[];
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
  cashPaidAmount?: string | null;
  cardPaidAmount?: string | null;
}

interface RepairReportResponse {
  date: string;
  repairSales: RepairSale[];
  summary: {
    repairCount: number;
    repairTotal: number;
    repairTotalDeferred: number;
    repairTotalCash: number;
    repairTotalCard: number;
  };
}

function baghdadToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
}

function fmtNum(n: number) {
  return n.toLocaleString("ar-IQ") + " د.ع";
}

function buildRepairPrintHTML(
  dateLabel: string,
  repairSales: RepairSale[],
  summary: RepairReportResponse["summary"],
) {
  const repairRows = repairSales.map((t, i) => {
    const amount = parseFloat(t.finalCost || t.costEstimate || "0");
    const isDeferred = t.paymentStatus === "deferred";
    const isDelivered = t.status === "delivered";
    const badgeTxt = isDeferred ? "آجل" : isDelivered ? "مُسلَّم" : "مدفوع";
    const methodTxt =
      !isDeferred && t.paymentStatus === "paid"
        ? t.paymentMethod === "split"
          ? ` — نقد ${(parseFloat(t.cashPaidAmount || "0") || 0).toLocaleString("en-US")} + بطاقة ${(parseFloat(t.cardPaidAmount || "0") || 0).toLocaleString("en-US")}`
          : t.paymentMethod === "card"
            ? " — بطاقة"
            : " — نقداً"
        : "";
    const deviceStr = [t.deviceBrand, t.deviceModel, t.deviceType].filter(Boolean).join(" ");
    const detailParts = [
      t.issueDescriptionAr ? `<strong>المشكلة:</strong> ${t.issueDescriptionAr}` : "",
      t.technicianNotes ? `<strong>ملاحظات الفني:</strong> ${t.technicianNotes}` : "",
    ].filter(Boolean);
    const detailRow =
      detailParts.length > 0
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
        <td><span class="badge ${isDeferred ? "badge-orange" : isDelivered ? "badge-delivered" : "badge-green"}">${badgeTxt}${methodTxt}</span></td>
        <td style="text-align:end;font-weight:600${isDeferred ? ";color:#c2410c" : ""}">${fmtNum(amount)}</td>
      </tr>${detailRow}`;
  }).join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <title>تقرير الصيانة - ${dateLabel}</title>
  <style>
    @page { size: A4; margin: 15mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Segoe UI", Arial, sans-serif; font-size: 12px; color: #111; direction: rtl; background: white; }
    .report-header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
    .report-header h1 { font-size: 20px; font-weight: 700; }
    .report-header .date { font-size: 12px; color: #555; margin-top: 4px; }
    .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 14px; }
    .summary-box { border: 1px solid #ddd; border-radius: 6px; padding: 8px 10px; }
    .summary-box .label { font-size: 10px; color: #666; margin-bottom: 2px; }
    .summary-box .value { font-size: 16px; font-weight: 700; }
    .section-title { font-size: 13px; font-weight: 700; background: #f4f4f5; padding: 6px 10px; border: 1px solid #e4e4e7; border-bottom: none; border-radius: 5px 5px 0 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e4e4e7; margin-bottom: 14px; }
    th { background: #f9fafb; font-weight: 600; color: #555; padding: 6px 8px; border-bottom: 1px solid #e4e4e7; text-align: start; }
    td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tfoot tr td { background: #f4f4f5; font-weight: 700; border-top: 2px solid #d1d5db; }
    td:last-child, th:last-child { text-align: end; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; border: 1px solid #ccc; }
    .badge-green { color: #15803d; border-color: #86efac; background: #f0fdf4; }
    .badge-orange { color: #c2410c; border-color: #fdba74; background: #fff7ed; }
    .badge-delivered { color: #047857; border-color: #6ee7b7; background: #ecfdf5; }
    .empty-msg { text-align: center; color: #888; padding: 16px; font-style: italic; border: 1px solid #e4e4e7; }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>تقرير الصيانة</h1>
    <div class="date">${dateLabel}</div>
  </div>
  <div class="summary-grid">
    <div class="summary-box"><div class="label">إجمالي الصيانة</div><div class="value" style="color:#2563eb">${fmtNum(summary.repairTotal)}</div></div>
    <div class="summary-box"><div class="label">نقداً</div><div class="value">${fmtNum(summary.repairTotalCash)}</div></div>
    <div class="summary-box"><div class="label">بطاقة</div><div class="value">${fmtNum(summary.repairTotalCard)}</div></div>
    <div class="summary-box"><div class="label">عدد السجلات</div><div class="value">${summary.repairCount}</div></div>
  </div>
  <div class="section-title">مدفوعات التصليح (${repairSales.length})</div>
  ${
    repairSales.length === 0
      ? '<div class="empty-msg">لا توجد مدفوعات تصليح في هذا اليوم</div>'
      : `<table>
          <thead>
            <tr>
              <th>#</th><th>رقم التذكرة</th><th>العميل</th><th>الجهاز</th><th>طريقة الدفع</th><th>المبلغ</th>
            </tr>
          </thead>
          <tbody>${repairRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="5">المجموع${summary.repairTotalDeferred > 0 ? ` <span style="font-size:10px;color:#c2410c">(آجل غير محسوب: ${fmtNum(summary.repairTotalDeferred)})</span>` : ""}</td>
              <td style="color:#2563eb">${fmtNum(summary.repairTotal)}</td>
            </tr>
          </tfoot>
        </table>`
  }
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;
}

export default function TechnicianDailyReport() {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(baghdadToday());

  const { data: technician, isLoading, error } = useQuery<Technician>({
    queryKey: ["/api/technician/auth/me"],
    retry: false,
  });

  const canViewRepairReport =
    !!technician &&
    (technician.isAdmin === 1 ||
      (technician.permissions || []).includes("view_daily_report"));

  const { data: report, isLoading: reportLoading } = useQuery<RepairReportResponse>({
    queryKey: ["/api/technician/repair-report", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/technician/repair-report?date=${selectedDate}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load repair report");
      return res.json();
    },
    enabled: canViewRepairReport,
  });

  useEffect(() => {
    if (error) navigate("/technician/login");
  }, [error, navigate]);

  useEffect(() => {
    if (technician && !canViewRepairReport) {
      navigate("/technician/dashboard");
    }
  }, [technician, canViewRepairReport, navigate]);

  if (isLoading || !technician || !canViewRepairReport) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const summary = report?.summary;
  const repairSales = report?.repairSales ?? [];

  const dateLabel = report?.date
    ? format(new Date(report.date), "dd/MM/yyyy")
    : format(new Date(`${selectedDate}T12:00:00+03:00`), "dd/MM/yyyy");

  const handlePrint = () => {
    if (!report?.summary) return;
    const html = buildRepairPrintHTML(dateLabel, repairSales, report.summary);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/technician/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {language === "ar" ? "العودة للوحة الفني" : "Back to dashboard"}
            </Button>
          </Link>
          <span className="text-sm text-muted-foreground">{technician.displayName}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="h-6 w-6 text-blue-500" />
              {language === "ar" ? "تقرير الصيانة" : "Repair Report"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {language === "ar" ? "مدفوعات التصليح فقط" : "Repair payments only"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
              data-testid="input-repair-report-date"
            />
            <Button
              onClick={handlePrint}
              disabled={reportLoading || !report?.summary}
              className="gap-2"
              data-testid="button-print-repair-report"
            >
              <Printer className="h-4 w-4" />
              {language === "ar" ? "طباعة A4" : "Print A4"}
            </Button>
          </div>
        </div>

        {reportLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? "إجمالي الصيانة" : "Repair Total"}
                  </p>
                  <p className="text-lg font-bold text-blue-600">{fmtNum(summary?.repairTotal ?? 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Banknote className="h-3 w-3" />
                    {language === "ar" ? "نقداً" : "Cash"}
                  </p>
                  <p className="text-lg font-bold">{fmtNum(summary?.repairTotalCash ?? 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    {language === "ar" ? "بطاقة" : "Card"}
                  </p>
                  <p className="text-lg font-bold">{fmtNum(summary?.repairTotalCard ?? 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? "عدد السجلات" : "Records"}
                  </p>
                  <p className="text-lg font-bold">{summary?.repairCount ?? 0}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="h-5 w-5 text-blue-500" />
                  {language === "ar" ? "مدفوعات التصليح" : "Repair Payments"}
                  <Badge variant="secondary" className="ms-auto">{repairSales.length}</Badge>
                </CardTitle>
                {report?.date && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(report.date), "dd/MM/yyyy")}
                  </p>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {repairSales.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    {language === "ar"
                      ? "لا توجد مدفوعات تصليح في هذا اليوم"
                      : "No repair payments on this day"}
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
                        {repairSales.map((ticket, idx) => {
                          const amount = parseFloat(ticket.finalCost || ticket.costEstimate || "0");
                          const deviceStr = [ticket.deviceBrand, ticket.deviceModel, ticket.deviceType]
                            .filter(Boolean)
                            .join(" ");
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
                                    {ticket.paymentStatus === "deferred" ? (
                                      <Badge variant="outline" className="text-orange-600 border-orange-400">
                                        {language === "ar" ? "آجل" : "Deferred"}
                                      </Badge>
                                    ) : ticket.status === "delivered" ? (
                                      <Badge variant="outline" className="text-emerald-700 border-emerald-400">
                                        {language === "ar" ? "مُسلَّم" : "Delivered"}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-green-700 border-green-400">
                                        {language === "ar" ? "مدفوع" : "Paid"}
                                      </Badge>
                                    )}
                                    {ticket.paymentStatus !== "deferred" && (
                                      <Badge variant="outline" className="text-xs">
                                        {ticket.paymentMethod === "split"
                                          ? `${language === "ar" ? "نقد" : "Cash"} ${(parseFloat(ticket.cashPaidAmount || "0") || 0).toLocaleString("en-US")} + ${language === "ar" ? "بطاقة" : "Card"} ${(parseFloat(ticket.cardPaidAmount || "0") || 0).toLocaleString("en-US")}`
                                          : ticket.paymentMethod === "card"
                                            ? language === "ar" ? "بطاقة" : "Card"
                                            : language === "ar" ? "نقداً" : "Cash"}
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td
                                  className={`py-2 px-4 text-end font-semibold ${ticket.paymentStatus === "deferred" ? "text-orange-600" : ""}`}
                                >
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
                                          <span className="font-medium text-foreground/70">
                                            {language === "ar" ? "المشكلة:" : "Issue:"}
                                          </span>{" "}
                                          {ticket.issueDescriptionAr}
                                        </span>
                                      )}
                                      {ticket.technicianNotes && (
                                        <span className="text-xs text-muted-foreground">
                                          <span className="font-medium text-foreground/70">
                                            {language === "ar" ? "ملاحظات الفني:" : "Tech notes:"}
                                          </span>{" "}
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
                            {(summary?.repairTotalDeferred ?? 0) > 0 && (
                              <span className="text-xs text-orange-500 font-normal ms-2">
                                ({language === "ar" ? "آجل غير محسوب" : "Deferred excluded"}:{" "}
                                {fmtNum(summary?.repairTotalDeferred ?? 0)})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-end text-blue-600 dark:text-blue-400">
                            {fmtNum(summary?.repairTotal ?? 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
