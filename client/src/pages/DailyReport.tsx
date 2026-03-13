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
  issueDescriptionAr: string;
  finalCost?: string;
  costEstimate?: string;
  paymentStatus: string;
  status: string;
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
  repairTotalCash: number;
  repairTotalZain: number;
  repairTotalQi: number;
  grandTotal: number;
  grandTotalCash: number;
  grandTotalZain: number;
  grandTotalQi: number;
}

interface DailyReportData {
  date: string;
  inStoreSales: InStoreOrder[];
  repairSales: RepairSale[];
  summary: DailyReportSummary;
}

interface DailyReportProps {
  user: { id: string };
}

function fmt(n: number) {
  return n.toLocaleString("ar-IQ") + " د.ع";
}

function paymentLabel(method: string | undefined, lang: string) {
  if (!method || method === "cash") return lang === "ar" ? "نقداً" : "Cash";
  if (method === "zaincash") return "ZainCash";
  if (method === "qicard") return "QiCard";
  if (method === "deferred") return lang === "ar" ? "آجل" : "Deferred";
  return method;
}

function paymentBadge(method: string | undefined, status: string | undefined) {
  if (status === "deferred") return <Badge variant="outline" className="text-orange-600 border-orange-400">{method === "ar" ? "آجل" : "آجل"}</Badge>;
  if (!method || method === "cash") return <Badge variant="outline" className="text-green-700 border-green-400">نقداً</Badge>;
  if (method === "zaincash") return <Badge variant="outline" className="text-blue-700 border-blue-400">ZainCash</Badge>;
  if (method === "qicard") return <Badge variant="outline" className="text-purple-700 border-purple-400">QiCard</Badge>;
  return <Badge variant="outline">{method}</Badge>;
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

  const handlePrint = () => window.print();

  const displayDate = selectedDate
    ? format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy", { locale: language === "ar" ? ar : undefined })
    : "";

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"} id="daily-report-content">
      {/* Header row - hidden on print */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-bold">
            {language === "ar" ? "التقرير اليومي" : "Daily Report"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {language === "ar"
              ? "مبيعات المتجر + مدفوعات التصليح في تقرير واحد"
              : "In-store sales + repair payments in one report"}
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
          <Button onClick={handlePrint} className="gap-2" data-testid="button-print-report">
            <Printer className="h-4 w-4" />
            {language === "ar" ? "طباعة" : "Print"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? null : (
        <div className="space-y-6 print:space-y-4">
          {/* Print header - only visible on print */}
          <div className="hidden print:block text-center mb-4 pb-4 border-b-2">
            <h1 className="text-xl font-bold">العين لتجارة الحاسبات</h1>
            <h2 className="text-lg font-semibold mt-1">التقرير اليومي</h2>
            <p className="text-sm text-muted-foreground mt-1">{displayDate}</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 print:grid-cols-4 print:gap-2">
            <Card className="print:shadow-none print:border">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "ar" ? "مجموع المتجر" : "In-Store Total"}
                </p>
                <p className="text-lg font-bold text-violet-600 dark:text-violet-400" data-testid="text-instore-total">
                  {fmt(data.summary.inStoreTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.summary.inStoreCount} {language === "ar" ? "فاتورة" : "txn"}
                  {data.summary.inStoreTotalDeferred > 0 && (
                    <span className="text-orange-500 ms-1">
                      + {fmt(data.summary.inStoreTotalDeferred)} آجل
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card className="print:shadow-none print:border">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "ar" ? "مجموع التصليح" : "Repair Total"}
                </p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400" data-testid="text-repair-total">
                  {fmt(data.summary.repairTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.summary.repairCount} {language === "ar" ? "تذكرة" : "ticket"}
                </p>
              </CardContent>
            </Card>
            <Card className="col-span-2 print:shadow-none print:border">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "ar" ? "الإجمالي الكلي" : "Grand Total"}
                </p>
                <p className="text-2xl font-bold text-primary" data-testid="text-grand-total">
                  {fmt(data.summary.grandTotal)}
                </p>
                <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                  {data.summary.grandTotalCash > 0 && (
                    <span className="flex items-center gap-1">
                      <Banknote className="h-3 w-3 text-green-500" />
                      {fmt(data.summary.grandTotalCash)} نقداً
                    </span>
                  )}
                  {data.summary.grandTotalZain > 0 && (
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3 text-blue-500" />
                      {fmt(data.summary.grandTotalZain)} زين
                    </span>
                  )}
                  {data.summary.grandTotalQi > 0 && (
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3 text-purple-500" />
                      {fmt(data.summary.grandTotalQi)} QiCard
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* In-Store Sales Section */}
          <Card className="print:shadow-none print:border">
            <CardHeader className="pb-3 print:pb-2">
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
                      {data.inStoreSales.map((order, idx) => (
                        <tr key={order.id} className="border-b last:border-0 hover-elevate" data-testid={`row-instore-${order.id}`}>
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
                          <td className={`py-2 px-4 text-end font-semibold ${order.paymentStatus === 'deferred' ? 'text-orange-600' : ''}`}>
                            {fmt(parseFloat(order.total))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 border-t-2 font-semibold">
                        <td colSpan={5} className="py-2 px-4">
                          {language === "ar" ? "المجموع" : "Total"}
                          {data.summary.inStoreTotalDeferred > 0 && (
                            <span className="text-xs text-orange-500 font-normal ms-2">
                              ({fmt(data.summary.inStoreTotalDeferred)} آجل غير محسوب)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-end text-violet-600 dark:text-violet-400">
                          {fmt(data.summary.inStoreTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Repair Sales Section */}
          <Card className="print:shadow-none print:border">
            <CardHeader className="pb-3 print:pb-2">
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
                        return (
                          <tr key={ticket.id} className="border-b last:border-0 hover-elevate" data-testid={`row-repair-${ticket.id}`}>
                            <td className="py-2 px-4 text-muted-foreground">{idx + 1}</td>
                            <td className="py-2 px-4 font-mono text-xs">{ticket.ticketNumber}</td>
                            <td className="py-2 px-4">
                              <div>{ticket.customerName}</div>
                              {ticket.customerPhone && (
                                <div className="text-xs text-muted-foreground">{ticket.customerPhone}</div>
                              )}
                            </td>
                            <td className="py-2 px-4 text-muted-foreground">
                              {ticket.deviceBrand ? `${ticket.deviceBrand} ` : ""}{ticket.deviceType}
                            </td>
                            <td className="py-2 px-4">
                              <Badge variant="outline" className="text-green-700 border-green-400">نقداً</Badge>
                            </td>
                            <td className="py-2 px-4 text-end font-semibold">
                              {fmt(amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 border-t-2 font-semibold">
                        <td colSpan={5} className="py-2 px-4">
                          {language === "ar" ? "المجموع" : "Total"}
                        </td>
                        <td className="py-2 px-4 text-end text-blue-600 dark:text-blue-400">
                          {fmt(data.summary.repairTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grand Total Summary Bar */}
          <Card className="border-primary/30 print:shadow-none print:border-2">
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
                        {language === "ar" ? "نقداً" : "Cash"}
                      </p>
                      <p className="font-semibold text-green-600">{fmt(data.summary.grandTotalCash)}</p>
                    </div>
                  )}
                  {data.summary.grandTotalZain > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CreditCard className="h-3 w-3 text-blue-500" />
                        ZainCash
                      </p>
                      <p className="font-semibold text-blue-600">{fmt(data.summary.grandTotalZain)}</p>
                    </div>
                  )}
                  {data.summary.grandTotalQi > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CreditCard className="h-3 w-3 text-purple-500" />
                        QiCard
                      </p>
                      <p className="font-semibold text-purple-600">{fmt(data.summary.grandTotalQi)}</p>
                    </div>
                  )}
                  {data.summary.inStoreTotalDeferred > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3 text-orange-500" />
                        {language === "ar" ? "آجل" : "Deferred"}
                      </p>
                      <p className="font-semibold text-orange-600">{fmt(data.summary.inStoreTotalDeferred)}</p>
                    </div>
                  )}
                  <Separator orientation="vertical" className="h-10" />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{language === "ar" ? "الكلي" : "Total"}</p>
                    <p className="font-bold text-2xl text-primary" data-testid="text-bottom-grand-total">
                      {fmt(data.summary.grandTotal)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Print footer */}
          <div className="hidden print:block text-center mt-6 pt-4 border-t text-xs text-muted-foreground">
            <p>تم طباعة هذا التقرير بتاريخ {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
            <p>العين لتجارة الحاسبات - نظام إدارة المبيعات</p>
          </div>
        </div>
      )}
    </div>
  );
}
