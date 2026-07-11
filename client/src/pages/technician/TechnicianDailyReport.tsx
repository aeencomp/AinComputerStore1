import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Wrench, Banknote, CreditCard } from "lucide-react";
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
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
            data-testid="input-repair-report-date"
          />
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
