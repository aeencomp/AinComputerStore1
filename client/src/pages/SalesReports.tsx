import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart3, 
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Loader2,
  Calendar,
  Printer,
  Trash2,
  CheckCheck,
  Clock,
  Truck,
  Wrench,
  Banknote,
  CreditCard,
  HandCoins
} from "lucide-react";
import { startOfDay, startOfWeek, startOfMonth, startOfYear, isAfter } from "date-fns";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  total: string;
  subtotal?: string;
  discount?: string;
  paymentMethod: string;
  orderType: string | null;
  status: string;
  createdAt: string;
  items: any[];
}

interface RepairTicket {
  id: string;
  ticketNumber: string;
  customerName: string;
  customerPhone?: string;
  deviceType: string;
  deviceBrand?: string;
  finalCost?: string;
  costEstimate?: string;
  paymentStatus: string;
  paymentMethod?: string;
  status: string;
  updatedAt: string;
  deliveredAt?: string;
}

interface SalesUser {
  id: string;
  permissions: {
    canViewReports: number;
  };
}

interface WithdrawalEntry {
  id: number;
  amount: string;
  reason: string | null;
  employeeName: string;
  createdAt: string;
}

interface StaffAdvanceEntry {
  id: number;
  amount: string;
  reason: string | null;
  staffName: string;
  createdAt: string;
}

interface MonthlyCashflowResponse {
  month: string;
  from: string;
  to: string;
  mode: 'month' | 'range';
  daily: Array<{
    date: string;
    withdrawalsCount: number;
    withdrawalsTotal: number;
    advancesCount: number;
    advancesTotal: number;
    net: number;
  }>;
  withdrawals: WithdrawalEntry[];
  advances: StaffAdvanceEntry[];
  totals: {
    withdrawalsCount: number;
    withdrawalsTotal: number;
    advancesCount: number;
    advancesTotal: number;
    net: number;
  };
}

interface SalesReportsProps {
  user: SalesUser;
}

export default function SalesReports({ user }: SalesReportsProps) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('today');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'online' | 'walk-in' | 'in-store'>('all');
  const [activeTab, setActiveTab] = useState<'sales' | 'cashflow'>('sales');
  const [cashflowMonth, setCashflowMonth] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" }).slice(0, 7));
  const [cashflowFromDate, setCashflowFromDate] = useState("");
  const [cashflowToDate, setCashflowToDate] = useState("");

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
  });

  const { data: allRepairTickets = [] } = useQuery<RepairTicket[]>({
    queryKey: ['/api/repair-tickets'],
  });

  const { data: monthlyCashflow, isLoading: cashflowLoading } = useQuery<MonthlyCashflowResponse>({
    queryKey: ['/api/instore/monthly-cashflow', cashflowMonth, cashflowFromDate, cashflowToDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cashflowFromDate && cashflowToDate) {
        params.set("from", cashflowFromDate);
        params.set("to", cashflowToDate);
      } else {
        params.set("month", cashflowMonth);
      }
      const res = await fetch(`/api/instore/monthly-cashflow?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to load monthly cashflow");
      return res.json();
    },
    enabled: activeTab === 'cashflow',
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: language === 'ar' ? 'تم حذف الطلب' : 'Order deleted' });
    },
    onError: () => {
      toast({ title: language === 'ar' ? 'فشل الحذف' : 'Delete failed', variant: 'destructive' });
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest('PATCH', `/api/orders/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: language === 'ar' ? 'تم تحديث حالة الطلب' : 'Order status updated' });
    },
    onError: () => {
      toast({ title: language === 'ar' ? 'فشل تحديث الحالة' : 'Update failed', variant: 'destructive' });
    },
  });

  const confirmDelete = (order: Order) => {
    const msg = language === 'ar'
      ? `هل تريد حذف الطلب ${order.orderNumber}؟ لا يمكن التراجع عن هذا الإجراء.`
      : `Delete order ${order.orderNumber}? This cannot be undone.`;
    if (window.confirm(msg)) deleteOrderMutation.mutate(order.id);
  };

  if (!user.permissions.canViewReports) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">
          {language === 'ar' ? 'ليس لديك صلاحية عرض التقارير' : 'You do not have access to reports'}
        </p>
      </div>
    );
  }

  const getDateRangeStart = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today': return startOfDay(now);
      case 'week': return startOfWeek(now, { weekStartsOn: 0 });
      case 'month': return startOfMonth(now);
      case 'year': return startOfYear(now);
      default: return new Date(0);
    }
  };

  const filteredOrders = orders.filter(order => {
    const orderDate = new Date(order.createdAt);
    const rangeStart = getDateRangeStart();
    
    if (!isAfter(orderDate, rangeStart) && dateRange !== 'all') return false;
    
    if (orderTypeFilter !== 'all') {
      const orderType = order.orderType || 'online';
      if (orderTypeFilter === 'walk-in' && orderType !== 'walk-in') return false;
      if (orderTypeFilter === 'in-store' && orderType !== 'in-store') return false;
      if (orderTypeFilter === 'online' && orderType !== 'online') return false;
    }
    
    return true;
  });

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);
  const orderCount = filteredOrders.length;
  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
  const walkInOrders = filteredOrders.filter(o => o.orderType === 'walk-in').length;
  const inStoreOrders = filteredOrders.filter(o => o.orderType === 'in-store').length;
  const onlineOrders = filteredOrders.filter(o => o.orderType === 'online').length;

  const filteredRepairTickets = allRepairTickets.filter(t => {
    if (t.paymentStatus !== 'paid' && t.paymentStatus !== 'deferred' && t.status !== 'delivered') return false;
    const ticketDate = new Date(t.deliveredAt || t.updatedAt);
    const rangeStart = getDateRangeStart();
    if (dateRange !== 'all' && !isAfter(ticketDate, rangeStart)) return false;
    return true;
  });

  const repairTotalCash = filteredRepairTickets
    .filter(t => t.paymentStatus !== 'deferred' && (!t.paymentMethod || t.paymentMethod === 'cash'))
    .reduce((sum, t) => sum + parseFloat(t.finalCost || t.costEstimate || '0'), 0);
  const repairTotalCard = filteredRepairTickets
    .filter(t => t.paymentStatus !== 'deferred' && t.paymentMethod === 'card')
    .reduce((sum, t) => sum + parseFloat(t.finalCost || t.costEstimate || '0'), 0);
  const repairTotalDeferred = filteredRepairTickets
    .filter(t => t.paymentStatus === 'deferred')
    .reduce((sum, t) => sum + parseFloat(t.finalCost || t.costEstimate || '0'), 0);
  const repairTotal = repairTotalCash + repairTotalCard;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ar-IQ').format(price);
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      'cash': { ar: 'نقداً', en: 'Cash' },
      'card': { ar: 'بطاقة', en: 'Card' },
      'zaincash': { ar: 'زين كاش', en: 'ZainCash' },
      'qicard': { ar: 'كي كارد', en: 'QiCard' },
      'cod': { ar: 'عند الاستلام', en: 'COD' },
    };
    return language === 'ar' ? labels[method]?.ar || method : labels[method]?.en || method;
  };

  const printOrderReceipt = async (order: Order) => {
    const { toDataURL } = await import('qrcode');
    const qrDataUrl = await toDataURL(
      `ORDER:${order.orderNumber}|TOTAL:${order.total}`,
      { width: 70, margin: 0 }
    );

    const fmt = (v: number) => v.toLocaleString('ar-IQ') + ' \u062f.\u0639';

    const payLabel = order.paymentMethod === 'cash' ? '\u0646\u0642\u062f\u064a'
      : order.paymentMethod === 'card' ? '\u0628\u0637\u0627\u0642\u0629'
      : order.paymentMethod === 'zaincash' ? '\u0632\u064a\u0646 \u0643\u0627\u0634'
      : order.paymentMethod === 'qicard' ? '\u0643\u064a \u0643\u0627\u0631\u062f'
      : '\u0639\u0646\u062f \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645';

    const parsedItems: any[] = (order.items || []).map((item: any) => {
      if (typeof item === 'string') {
        try { return JSON.parse(item); }
        catch { return null; }
      }
      return item;
    }).filter((item: any) => item !== null && typeof item === 'object');

    const saleDate = new Date(order.createdAt);

    const itemRowsHtml = parsedItems.map((item: any) => {
      const unitPrice = parseFloat(item.price || item.unitPrice || '0') || 0;
      const qty = parseInt(item.quantity) || 1;
      const lineTotal = unitPrice * qty;
      const name = item.nameAr || item.nameEn || item.name || '-';
      const nameEn = item.nameEn && item.nameEn !== item.nameAr ? item.nameEn : '';
      const skuLine = item.sku ? `<div style="font-size:9px;color:#333;font-weight:700;">SKU: ${item.sku}</div>` : '';
      const catLine = item.category ? `<div style="font-size:9px;color:#333;font-weight:700;">${item.category}</div>` : '';
      const nameLine = nameEn ? `<div style="font-size:9px;color:#333;font-weight:700;">${nameEn}</div>` : '';
      const unitPriceLine = `<div style="font-size:9px;color:#333;font-weight:700;">${fmt(unitPrice)} \xd7 ${qty}</div>`;
      return `<div style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;">
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:4px;align-items:start;">
          <div>
            <div style="font-weight:800;color:#000;">${name}</div>
            ${nameLine}
            ${catLine}
            ${skuLine}
            ${unitPriceLine}
          </div>
          <div style="text-align:center;font-weight:800;color:#000;padding:0 6px;min-width:24px;">${qty}</div>
          <div style="text-align:left;font-weight:800;color:#000;white-space:nowrap;">${fmt(lineTotal)}</div>
        </div>
      </div>`;
    }).join('');

    const subtotalNum = parseFloat(order.subtotal || order.total || '0');
    const discountNum = parseFloat(order.discount || '0');
    const totalNum = parseFloat(order.total || '0');

    const discountHtml = discountNum > 0 ? `
      <div style="display:flex;justify-content:space-between;font-weight:700;color:#000;margin-bottom:4px;">
        <span>\u0627\u0644\u062e\u0635\u0645:</span><span>-${fmt(discountNum)}</span>
      </div>` : '';

    const customerHtml = (order.customerName || order.customerPhone) ? `
      <div style="border-bottom:1px solid #d1d5db;padding:8px 12px;font-size:12px;">
        ${order.customerName ? `<div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="font-weight:700;">\u0627\u0644\u0632\u0628\u0648\u0646:</span><span style="font-weight:800;">${order.customerName}</span></div>` : ''}
        ${order.customerPhone ? `<div style="display:flex;justify-content:space-between;"><span style="font-weight:700;">\u0627\u0644\u0647\u0627\u062a\u0641:</span><span style="font-weight:800;" dir="ltr">${order.customerPhone}</span></div>` : ''}
      </div>` : '';

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
  @page { size: 72.1mm auto; margin: 2mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  body { font-family: 'Cairo', 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; width: 72.1mm; background: white !important; color: #000; }
  .bg-black { background-color: #000 !important; }
  .text-white { color: #fff !important; }
</style>
</head>
<body>
  <div class="bg-black text-white" style="padding:14px;text-align:center;">
    <div style="font-size:18px;font-weight:900;letter-spacing:0.5px;">\u0627\u0644\u0639\u064a\u0646 \u0644\u062a\u062c\u0627\u0631\u0629 \u0627\u0644\u062d\u0627\u0633\u0628\u0627\u062a</div>
    <div style="font-size:12px;font-weight:700;margin-top:2px;opacity:0.9;">AEEN COMPUTER TRADING</div>
    <div style="font-size:10px;margin-top:2px;opacity:0.75;">\u0643\u0631\u0628\u0644\u0627\u0621 - \u0627\u0644\u0639\u0631\u0627\u0642</div>
  </div>

  <div style="padding:10px 12px;border-bottom:2px solid #000;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:10px;font-weight:700;letter-spacing:1px;">\u0631\u0642\u0645 \u0627\u0644\u0648\u0635\u0644</div>
      <div style="font-family:monospace;font-weight:900;font-size:13px;">${order.orderNumber}</div>
    </div>
    <img src="${qrDataUrl}" width="50" height="50" style="display:block;"/>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:8px 12px;border-bottom:1px solid #d1d5db;font-size:12px;">
    <div>
      <div style="font-weight:700;">\u0627\u0644\u062a\u0627\u0631\u064a\u062e</div>
      <div style="font-weight:800;">${saleDate.toLocaleDateString('ar-IQ')}</div>
    </div>
    <div style="text-align:left;">
      <div style="font-weight:700;">\u0627\u0644\u0648\u0642\u062a</div>
      <div style="font-weight:800;">${saleDate.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>

  ${customerHtml}

  <div style="border:2px solid #000;border-radius:6px;overflow:hidden;margin:8px;">
    <div class="bg-black text-white" style="display:grid;grid-template-columns:1fr auto auto;gap:4px;padding:6px 8px;font-size:11px;font-weight:700;">
      <div>\u0627\u0644\u0645\u0646\u062a\u062c</div>
      <div style="padding:0 6px;">\u0627\u0644\u0643\u0645\u064a\u0629</div>
      <div>\u0627\u0644\u0633\u0639\u0631</div>
    </div>
    ${parsedItems.length > 0 ? itemRowsHtml : '<div style="padding:10px;text-align:center;font-size:11px;color:#666;">\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0646\u062a\u062c\u0627\u062a</div>'}
  </div>

  <div style="padding:8px 12px;font-size:12px;">
    <div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:4px;">
      <span>\u0627\u0644\u0645\u062c\u0645\u0648\u0639:</span><span>${fmt(subtotalNum)}</span>
    </div>
    ${discountHtml}
    <div class="bg-black text-white" style="display:flex;justify-content:space-between;padding:8px 10px;border-radius:6px;margin-top:4px;font-size:15px;font-weight:900;">
      <span>\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a:</span><span>${fmt(totalNum)}</span>
    </div>
  </div>

  <div style="text-align:center;padding:6px 12px;border-top:1px solid #d1d5db;border-bottom:1px solid #d1d5db;font-size:12px;">
    <span style="font-weight:700;">\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062f\u0641\u0639: </span>
    <span style="font-weight:800;">${payLabel}</span>
  </div>

  <div style="text-align:center;padding:10px 12px;border-top:2px dashed #000;margin-top:4px;">
    <div style="font-weight:800;font-size:13px;">\u0634\u0643\u0631\u0627\u064b \u0644\u062a\u0633\u0648\u0642\u0643\u0645 \u0645\u0639\u0646\u0627</div>
    <div style="font-size:10px;font-weight:700;margin-top:4px;">\u064a\u0631\u062c\u0649 \u0627\u0644\u0627\u062d\u062a\u0641\u0627\u0638 \u0628\u0627\u0644\u0648\u0635\u0644 \u0644\u063a\u0631\u0636 \u0627\u0644\u0636\u0645\u0627\u0646</div>
    <div style="font-weight:900;font-size:14px;margin-top:6px;" dir="ltr">07850006977</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      }, 500);
    };
  </script>
</body>
</html>`;

    const popup = window.open('', '_blank', 'width=420,height=700');
    if (popup) { popup.document.write(html); popup.document.close(); }
  };

  const formatDate = (value: string) => new Date(value).toLocaleDateString('ar-IQ');
  const formatTime = (value: string) => new Date(value).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

  const applyQuickCashflowRange = (preset: 'today' | 'last7' | 'thisMonth') => {
    const baghdadNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Baghdad' }));
    const yyyy = baghdadNow.getFullYear();
    const mm = String(baghdadNow.getMonth() + 1).padStart(2, '0');
    const dd = String(baghdadNow.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;

    if (preset === 'today') {
      setCashflowFromDate(today);
      setCashflowToDate(today);
      return;
    }

    if (preset === 'thisMonth') {
      setCashflowFromDate(`${yyyy}-${mm}-01`);
      setCashflowToDate(today);
      return;
    }

    const last7 = new Date(baghdadNow);
    last7.setDate(last7.getDate() - 6);
    const l7y = last7.getFullYear();
    const l7m = String(last7.getMonth() + 1).padStart(2, '0');
    const l7d = String(last7.getDate()).padStart(2, '0');
    setCashflowFromDate(`${l7y}-${l7m}-${l7d}`);
    setCashflowToDate(today);
  };

  const detailedCashflowRows = monthlyCashflow
    ? [
        ...monthlyCashflow.withdrawals.map((item) => ({
          id: `w-${item.id}`,
          type: 'withdrawal' as const,
          actor: item.employeeName,
          reason: item.reason,
          amount: parseFloat(item.amount || '0') || 0,
          createdAt: item.createdAt,
        })),
        ...monthlyCashflow.advances.map((item) => ({
          id: `a-${item.id}`,
          type: 'advance' as const,
          actor: item.staffName,
          reason: item.reason,
          amount: parseFloat(item.amount || '0') || 0,
          createdAt: item.createdAt,
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  const printMonthlyCashflow = () => {
    if (!monthlyCashflow) return;
    const monthLabel = monthlyCashflow.mode === "range"
      ? `${monthlyCashflow.from} → ${monthlyCashflow.to}`
      : monthlyCashflow.month;
    const detailedRows = detailedCashflowRows.map((row, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${formatDate(row.createdAt)}</td>
        <td>${formatTime(row.createdAt)}</td>
        <td>${row.type === 'withdrawal' ? 'سحب' : 'دفع من الجيب'}</td>
        <td>${row.actor}</td>
        <td>${row.reason || '—'}</td>
        <td style="text-align:end;${row.type === 'withdrawal' ? 'color:#c2410c' : 'color:#059669'}">${row.type === 'withdrawal' ? '-' : '+'} ${formatPrice(row.amount)}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8" />
<title>Monthly Cashflow</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: Arial, sans-serif; color: #111; }
  h1,h2 { margin: 0; }
  .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
  .card { border:1px solid #ddd; border-radius:6px; padding:8px; }
  .lbl{font-size:11px;color:#666}.val{font-size:18px;font-weight:700}
  table { width:100%; border-collapse: collapse; margin-bottom: 12px; }
  th,td { border:1px solid #ddd; padding:6px; font-size:12px; text-align:start; }
  th { background:#f5f5f5; }
</style>
</head>
<body>
<div class="header">
  <h1>تقرير السحوبات والدفع من الجيب</h1>
  <h2>الشهر: ${monthLabel}</h2>
</div>
<div class="cards">
  <div class="card"><div class="lbl">إجمالي السحوبات</div><div class="val" style="color:#c2410c">- ${formatPrice(monthlyCashflow.totals.withdrawalsTotal)}</div></div>
  <div class="card"><div class="lbl">إجمالي الدفع من الجيب</div><div class="val" style="color:#059669">+ ${formatPrice(monthlyCashflow.totals.advancesTotal)}</div></div>
  <div class="card"><div class="lbl">الصافي</div><div class="val">${formatPrice(monthlyCashflow.totals.net)}</div></div>
</div>
<h2 style="margin-bottom:6px;font-size:15px;">التفاصيل اليومية (كل العمليات)</h2>
<table>
  <thead><tr><th>#</th><th>التاريخ</th><th>الوقت</th><th>النوع</th><th>الموظف</th><th>السبب</th><th>المبلغ</th></tr></thead>
  <tbody>${detailedRows || '<tr><td colspan="7" style="text-align:center;color:#777">لا توجد بيانات</td></tr>'}</tbody>
</table>
<script>window.onload=()=>window.print()</script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          {language === 'ar' ? 'تقارير المبيعات' : 'Sales Reports'}
        </h2>
        <div className="flex flex-wrap gap-2">
          {activeTab === 'sales' ? (
            <>
              <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                <SelectTrigger className="w-40" data-testid="select-date-range">
                  <Calendar className="h-4 w-4 me-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">{language === 'ar' ? 'اليوم' : 'Today'}</SelectItem>
                  <SelectItem value="week">{language === 'ar' ? 'هذا الأسبوع' : 'This Week'}</SelectItem>
                  <SelectItem value="month">{language === 'ar' ? 'هذا الشهر' : 'This Month'}</SelectItem>
                  <SelectItem value="year">{language === 'ar' ? 'هذا العام' : 'This Year'}</SelectItem>
                  <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All Time'}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={orderTypeFilter} onValueChange={(v: any) => setOrderTypeFilter(v)}>
                <SelectTrigger className="w-44" data-testid="select-order-type">
                  <ShoppingCart className="h-4 w-4 me-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'جميع الطلبات' : 'All Orders'}</SelectItem>
                  <SelectItem value="walk-in">{language === 'ar' ? 'كاونتر (POS عام)' : 'Counter (General POS)'}</SelectItem>
                  <SelectItem value="in-store">{language === 'ar' ? 'مبيعات المتجر' : 'In-Store Sales'}</SelectItem>
                  <SelectItem value="online">{language === 'ar' ? 'أونلاين' : 'Online'}</SelectItem>
                </SelectContent>
              </Select>
            </>
          ) : (
            <>
              <Input
                type="month"
                className="w-44"
                value={cashflowMonth}
                onChange={(e) => setCashflowMonth(e.target.value || cashflowMonth)}
                data-testid="input-cashflow-month"
              />
              <Input
                type="date"
                className="w-40"
                value={cashflowFromDate}
                onChange={(e) => setCashflowFromDate(e.target.value)}
                data-testid="input-cashflow-from-date"
              />
              <Input
                type="date"
                className="w-40"
                value={cashflowToDate}
                onChange={(e) => setCashflowToDate(e.target.value)}
                data-testid="input-cashflow-to-date"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCashflowFromDate("");
                  setCashflowToDate("");
                }}
                data-testid="button-clear-cashflow-range"
              >
                {language === 'ar' ? 'مسح المدى' : 'Clear Range'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => applyQuickCashflowRange('today')}
                data-testid="button-cashflow-today"
              >
                {language === 'ar' ? 'اليوم' : 'Today'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => applyQuickCashflowRange('last7')}
                data-testid="button-cashflow-last7"
              >
                {language === 'ar' ? 'آخر 7 أيام' : 'Last 7 Days'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => applyQuickCashflowRange('thisMonth')}
                data-testid="button-cashflow-this-month"
              >
                {language === 'ar' ? 'هذا الشهر' : 'This Month'}
              </Button>
              <Button onClick={printMonthlyCashflow} disabled={!monthlyCashflow} data-testid="button-print-cashflow-a4">
                <Printer className="h-4 w-4 me-2" />
                {language === 'ar' ? 'طباعة A4' : 'Print A4'}
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'sales' | 'cashflow')} className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">{language === 'ar' ? 'تقارير المبيعات' : 'Sales Report'}</TabsTrigger>
          <TabsTrigger value="cashflow">{language === 'ar' ? 'سحوبات + دفع من الجيب' : 'Withdrawals + Pay From Pocket'}</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}
                </p>
                <p className="text-xl font-bold">{formatPrice(totalRevenue)} IQD</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'عدد الطلبات' : 'Order Count'}
                </p>
                <p className="text-xl font-bold">{orderCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'متوسط الطلب' : 'Avg. Order'}
                </p>
                <p className="text-xl font-bold">{formatPrice(avgOrderValue)} IQD</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'كاونتر / متجر' : 'Counter / In-Store'}
                </p>
                <p className="text-xl font-bold">{walkInOrders} / {inStoreOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-sky-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'أونلاين' : 'Online'}
                </p>
                <p className="text-xl font-bold">{onlineOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Wrench className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'إيراد الصيانة' : 'Repair Revenue'}
                </p>
                <p className="text-xl font-bold">{formatPrice(repairTotal)} IQD</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {repairTotalCash > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Banknote className="h-3 w-3 text-green-500" />
                      {formatPrice(repairTotalCash)}
                    </span>
                  )}
                  {repairTotalCard > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CreditCard className="h-3 w-3 text-teal-500" />
                      {formatPrice(repairTotalCard)}
                    </span>
                  )}
                  {repairTotalDeferred > 0 && (
                    <span className="text-xs text-orange-500">
                      آجل: {formatPrice(repairTotalDeferred)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'سجل الطلبات' : 'Order History'}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {language === 'ar' ? 'لا توجد طلبات في هذه الفترة' : 'No orders in this period'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-start p-3">{language === 'ar' ? 'رقم الطلب' : 'Order #'}</th>
                    <th className="text-start p-3">{language === 'ar' ? 'العميل' : 'Customer'}</th>
                    <th className="text-start p-3">{language === 'ar' ? 'النوع' : 'Type'}</th>
                    <th className="text-start p-3">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                    <th className="text-start p-3">{language === 'ar' ? 'الدفع' : 'Payment'}</th>
                    <th className="text-end p-3">{language === 'ar' ? 'المبلغ' : 'Amount'}</th>
                    <th className="text-start p-3">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.slice(0, 50).map(order => (
                    <tr key={order.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-mono">{order.orderNumber}</td>
                      <td className="p-3">{order.customerName}</td>
                      <td className="p-3">
                        {order.orderType === 'in-store' ? (
                          <Badge className="bg-violet-500/15 text-violet-700 border-violet-300">
                            {language === 'ar' ? 'مبيعات المتجر' : 'In-Store'}
                          </Badge>
                        ) : order.orderType === 'walk-in' ? (
                          <Badge variant="default">
                            {language === 'ar' ? 'كاونتر' : 'Counter'}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            {language === 'ar' ? 'أونلاين' : 'Online'}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {order.status === 'pending' ? (
                          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300 gap-1">
                            <Clock className="h-3 w-3" />
                            {language === 'ar' ? 'انتظار' : 'Pending'}
                          </Badge>
                        ) : order.status === 'processing' ? (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300 gap-1">
                            <Truck className="h-3 w-3" />
                            {language === 'ar' ? 'قيد المعالجة' : 'Processing'}
                          </Badge>
                        ) : order.status === 'completed' || order.status === 'delivered' ? (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300 gap-1">
                            <CheckCheck className="h-3 w-3" />
                            {language === 'ar' ? 'مكتمل' : 'Completed'}
                          </Badge>
                        ) : order.status === 'cancelled' ? (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300">
                            {language === 'ar' ? 'ملغي' : 'Cancelled'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">{order.status}</Badge>
                        )}
                      </td>
                      <td className="p-3">{getPaymentMethodLabel(order.paymentMethod)}</td>
                      <td className="p-3 text-end font-bold">{formatPrice(parseFloat(order.total))} IQD</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString('ar-IQ')}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {order.orderType === 'online' && order.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                              onClick={() => updateOrderStatusMutation.mutate({ id: order.id, status: 'processing' })}
                              disabled={updateOrderStatusMutation.isPending}
                            >
                              {updateOrderStatusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin me-1" /> : null}
                              {language === 'ar' ? 'استلام الطلب' : 'Process Order'}
                            </Button>
                          )}
                          {order.orderType === 'online' && order.status === 'processing' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                              onClick={() => updateOrderStatusMutation.mutate({ id: order.id, status: 'completed' })}
                              disabled={updateOrderStatusMutation.isPending}
                            >
                              {updateOrderStatusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin me-1" /> : null}
                              {language === 'ar' ? 'تم التوصيل' : 'Mark Completed'}
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => printOrderReceipt(order)}
                            data-testid={`button-print-${order.id}`}
                            title={language === 'ar' ? 'طباعة الوصل' : 'Print Receipt'}
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => confirmDelete(order)}
                            disabled={deleteOrderMutation.isPending}
                            data-testid={`button-delete-${order.id}`}
                            title={language === 'ar' ? 'حذف الطلب' : 'Delete Order'}
                            className="text-destructive hover:text-destructive"
                          >
                            {deleteOrderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredOrders.length > 50 && (
                <p className="text-center text-muted-foreground mt-4">
                  {language === 'ar' 
                    ? `عرض أول 50 من ${filteredOrders.length} طلب` 
                    : `Showing first 50 of ${filteredOrders.length} orders`}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repair Tickets Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-5 w-5 text-blue-500" />
            {language === 'ar' ? 'مدفوعات الصيانة' : 'Repair Payments'}
            <Badge variant="secondary" className="ms-auto">{filteredRepairTickets.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRepairTickets.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              {language === 'ar' ? 'لا توجد مدفوعات صيانة في هذه الفترة' : 'No repair payments in this period'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-start py-2 px-4 font-medium text-muted-foreground">#</th>
                    <th className="text-start py-2 px-4 font-medium text-muted-foreground">
                      {language === 'ar' ? 'رقم التذكرة' : 'Ticket #'}
                    </th>
                    <th className="text-start py-2 px-4 font-medium text-muted-foreground">
                      {language === 'ar' ? 'العميل' : 'Customer'}
                    </th>
                    <th className="text-start py-2 px-4 font-medium text-muted-foreground">
                      {language === 'ar' ? 'الجهاز' : 'Device'}
                    </th>
                    <th className="text-start py-2 px-4 font-medium text-muted-foreground">
                      {language === 'ar' ? 'طريقة الدفع' : 'Payment'}
                    </th>
                    <th className="text-start py-2 px-4 font-medium text-muted-foreground">
                      {language === 'ar' ? 'التاريخ' : 'Date'}
                    </th>
                    <th className="text-end py-2 px-4 font-medium text-muted-foreground">
                      {language === 'ar' ? 'المبلغ' : 'Amount'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRepairTickets.map((ticket, idx) => {
                    const amount = parseFloat(ticket.finalCost || ticket.costEstimate || '0');
                    const isDeferred = ticket.paymentStatus === 'deferred';
                    const ticketDate = new Date(ticket.deliveredAt || ticket.updatedAt);
                    return (
                      <tr key={ticket.id} className="border-b last:border-0" data-testid={`row-repair-full-${ticket.id}`}>
                        <td className="py-2 px-4 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 px-4 font-mono text-xs">{ticket.ticketNumber}</td>
                        <td className="py-2 px-4">
                          <div>{ticket.customerName}</div>
                          {ticket.customerPhone && (
                            <div className="text-xs text-muted-foreground">{ticket.customerPhone}</div>
                          )}
                        </td>
                        <td className="py-2 px-4 text-muted-foreground">
                          {ticket.deviceBrand ? `${ticket.deviceBrand} ` : ''}{ticket.deviceType}
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex flex-wrap gap-1">
                            {isDeferred ? (
                              <Badge variant="outline" className="text-orange-600 border-orange-400">آجل</Badge>
                            ) : (
                              <>
                                <Badge variant="outline" className="text-emerald-700 border-emerald-400">
                                  {language === 'ar' ? 'مدفوع' : 'Paid'}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {ticket.paymentMethod === 'card'
                                    ? (language === 'ar' ? 'بطاقة' : 'Card')
                                    : (language === 'ar' ? 'نقداً' : 'Cash')}
                                </Badge>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-muted-foreground text-xs">
                          {ticketDate.toLocaleDateString('ar-IQ')}
                        </td>
                        <td className={`py-2 px-4 text-end font-semibold ${isDeferred ? 'text-orange-600' : ''}`}>
                          {formatPrice(amount)} IQD
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 border-t-2 font-semibold">
                    <td colSpan={6} className="py-2 px-4">
                      {language === 'ar' ? 'المجموع' : 'Total'}
                      {repairTotalDeferred > 0 && (
                        <span className="text-xs text-orange-500 font-normal ms-2">
                          ({language === 'ar' ? 'آجل غير محسوب' : 'deferred excluded'}: {formatPrice(repairTotalDeferred)})
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-end text-blue-600 dark:text-blue-400">
                      {formatPrice(repairTotal)} IQD
                    </td>
                  </tr>
                  {repairTotal > 0 && (
                    <tr className="bg-muted/10">
                      <td colSpan={7} className="py-2 px-4">
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          {repairTotalCash > 0 && (
                            <span className="flex items-center gap-1">
                              <Banknote className="h-3 w-3 text-green-500" />
                              {language === 'ar' ? 'نقداً:' : 'Cash:'} <strong className="text-foreground">{formatPrice(repairTotalCash)}</strong>
                            </span>
                          )}
                          {repairTotalCard > 0 && (
                            <span className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3 text-teal-500" />
                              {language === 'ar' ? 'بطاقة:' : 'Card:'} <strong className="text-foreground">{formatPrice(repairTotalCard)}</strong>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="cashflow" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'إجمالي السحوبات (الشهر)' : 'Monthly Withdrawals Total'}</p>
                <p className="text-2xl font-bold text-orange-600">- {formatPrice(monthlyCashflow?.totals.withdrawalsTotal || 0)} IQD</p>
                <p className="text-xs text-muted-foreground mt-1">{monthlyCashflow?.totals.withdrawalsCount || 0} {language === 'ar' ? 'عملية' : 'transactions'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'إجمالي الدفع من الجيب (الشهر)' : 'Monthly Pay From Pocket Total'}</p>
                <p className="text-2xl font-bold text-emerald-600">+ {formatPrice(monthlyCashflow?.totals.advancesTotal || 0)} IQD</p>
                <p className="text-xs text-muted-foreground mt-1">{monthlyCashflow?.totals.advancesCount || 0} {language === 'ar' ? 'عملية' : 'transactions'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'صافي الشهر' : 'Monthly Net'}</p>
                <p className="text-2xl font-bold">{formatPrice(monthlyCashflow?.totals.net || 0)} IQD</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {monthlyCashflow?.mode === "range"
                    ? (language === 'ar'
                      ? `المدى: ${monthlyCashflow.from} → ${monthlyCashflow.to}`
                      : `Range: ${monthlyCashflow.from} → ${monthlyCashflow.to}`)
                    : (language === 'ar' ? `الشهر: ${cashflowMonth}` : `Month: ${cashflowMonth}`)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HandCoins className="h-5 w-5" />
                {language === 'ar' ? 'التفاصيل اليومية للعمليات' : 'Detailed Daily Transactions'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cashflowLoading ? (
                <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : detailedCashflowRows.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">{language === 'ar' ? 'لا توجد عمليات لهذا الشهر' : 'No transactions for this month'}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-start p-3">#</th>
                        <th className="text-start p-3">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                        <th className="text-start p-3">{language === 'ar' ? 'الوقت' : 'Time'}</th>
                        <th className="text-start p-3">{language === 'ar' ? 'النوع' : 'Type'}</th>
                        <th className="text-start p-3">{language === 'ar' ? 'الموظف' : 'Employee'}</th>
                        <th className="text-start p-3">{language === 'ar' ? 'السبب' : 'Reason'}</th>
                        <th className="text-end p-3">{language === 'ar' ? 'المبلغ' : 'Amount'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailedCashflowRows.map((row, i) => (
                        <tr key={row.id} className="border-b">
                          <td className="p-3">{i + 1}</td>
                          <td className="p-3">{formatDate(row.createdAt)}</td>
                          <td className="p-3">{formatTime(row.createdAt)}</td>
                          <td className="p-3">{row.type === 'withdrawal' ? (language === 'ar' ? 'سحب' : 'Withdrawal') : (language === 'ar' ? 'دفع من الجيب' : 'Pay From Pocket')}</td>
                          <td className="p-3">{row.actor}</td>
                          <td className="p-3">{row.reason || '—'}</td>
                          <td className={`p-3 text-end font-semibold ${row.type === 'withdrawal' ? 'text-orange-600' : 'text-emerald-600'}`}>
                            {row.type === 'withdrawal' ? '-' : '+'} {formatPrice(row.amount)} IQD
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
