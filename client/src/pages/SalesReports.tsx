import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { repairTicketSalesAt, repairTicketEligibleForSalesReport } from "@shared/repair-sales";
import { orderIncludedInSalesReport } from "@shared/order-sales";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Ban,
  CheckCheck,
  Clock,
  Truck,
  Wrench,
  Banknote,
  CreditCard,
  HandCoins,
  Edit3,
  Save,
  FileText,
} from "lucide-react";
import { openA4InvoicePrint, type A4InvoiceOrder } from "@/lib/a4InvoicePrint";
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
  paymentStatus?: string;
  orderType: string | null;
  status: string;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
  items: any[];
  notes?: string | null;
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
  paidAt?: string;
  deliveredAt?: string;
  excludedFromSalesReport?: number;
}

interface SalesUser {
  id: string;
  name?: string;
  role?: string;
  permissions: {
    canViewReports: number;
    canEditReceipt?: number;
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
  salesLocationId?: number;
}

export default function SalesReports({ user, salesLocationId = 1 }: SalesReportsProps) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('today');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'online' | 'walk-in' | 'in-store'>('all');
  const [activeTab, setActiveTab] = useState<'sales' | 'cashflow'>('sales');
  const [salesSearchQuery, setSalesSearchQuery] = useState("");
  const [cashflowMonth, setCashflowMonth] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" }).slice(0, 7));
  const [cashflowFromDate, setCashflowFromDate] = useState("");
  const [cashflowToDate, setCashflowToDate] = useState("");
  const [receiptEditorOpen, setReceiptEditorOpen] = useState(false);
  const [receiptDraft, setReceiptDraft] = useState<any>(null);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders', salesLocationId],
    queryFn: async () => {
      const res = await fetch(`/api/orders?locationId=${salesLocationId}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json();
    },
  });

  const { data: allRepairTickets = [] } = useQuery<RepairTicket[]>({
    queryKey: ['/api/repair-tickets'],
  });

  const { data: monthlyCashflow, isLoading: cashflowLoading } = useQuery<MonthlyCashflowResponse>({
    queryKey: ['/api/instore/monthly-cashflow', cashflowMonth, cashflowFromDate, cashflowToDate, salesLocationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cashflowFromDate && cashflowToDate) {
        params.set("from", cashflowFromDate);
        params.set("to", cashflowToDate);
      } else {
        params.set("month", cashflowMonth);
      }
      params.set("locationId", String(salesLocationId));
      const res = await fetch(`/api/instore/monthly-cashflow?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to load monthly cashflow");
      return res.json();
    },
    enabled: activeTab === 'cashflow',
  });

  const invalidateOrderQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    queryClient.invalidateQueries({ queryKey: ['/api/orders', salesLocationId] });
    queryClient.invalidateQueries({ queryKey: ['/api/daily-report'] });
    queryClient.invalidateQueries({ queryKey: ['/api/sales/shifts'] });
    queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets'] });
  };

  const canVoidSales = user.role === 'sales_admin' || user.permissions.canEditReceipt === 1;

  const voidRepairMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await apiRequest('POST', `/api/sales/repair-tickets/${ticketId}/void`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateOrderQueries();
      toast({
        title: language === 'ar' ? 'تم إلغاء مبيعة الصيانة' : 'Repair sale voided',
        description: language === 'ar'
          ? 'التذكرة ما زالت موجودة في بوابة الفني'
          : 'The ticket remains in the technician portal',
      });
    },
    onError: (error: Error) => {
      toast({
        title: language === 'ar' ? 'فشل الإلغاء' : 'Void failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const confirmVoidRepair = (ticket: RepairTicket) => {
    const msg = language === 'ar'
      ? `إلغاء مبيعة تذكرة ${ticket.ticketNumber}؟ (تبقى في بوابة الفني)`
      : `Void repair sale ${ticket.ticketNumber}? (Stays in technician portal)`;
    if (window.confirm(msg)) {
      voidRepairMutation.mutate(ticket.id);
    }
  };

  const voidOrderMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiRequest('POST', `/api/sales/orders/${id}/void`, { reason });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateOrderQueries();
      toast({ title: language === 'ar' ? 'تم إلغاء الطلب واسترجاع المخزون' : 'Order voided and inventory restored' });
    },
    onError: (error: Error) => {
      toast({
        title: language === 'ar' ? 'فشل الإلغاء' : 'Void failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const confirmVoidOrder = (order: Order) => {
    const msg = language === 'ar'
      ? `إلغاء الطلب ${order.orderNumber}؟ سيتم استرجاع المخزون وإزالته من التقارير.`
      : `Void order ${order.orderNumber}? Inventory will be restored and removed from reports.`;
    if (!window.confirm(msg)) return;
    const reason = window.prompt(
      language === 'ar' ? 'سبب الإلغاء (اختياري):' : 'Void reason (optional):',
    ) || undefined;
    voidOrderMutation.mutate({ id: order.id, reason });
  };

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest('PATCH', `/api/orders/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      invalidateOrderQueries();
      toast({ title: language === 'ar' ? 'تم تحديث حالة الطلب' : 'Order status updated' });
    },
    onError: () => {
      toast({ title: language === 'ar' ? 'فشل تحديث الحالة' : 'Update failed', variant: 'destructive' });
    },
  });

  const updateReceiptMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('PATCH', `/api/sales/orders/${data.id}/receipt`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateOrderQueries();
      setReceiptEditorOpen(false);
      setReceiptDraft(null);
      toast({ title: language === 'ar' ? 'تم تعديل الوصل' : 'Receipt updated' });
    },
    onError: (error: any) => {
      toast({
        title: language === 'ar' ? 'فشل تعديل الوصل' : 'Receipt update failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const parseOrderItems = (order: Order) => (order.items || []).map((item: any) => {
    if (typeof item === 'string') {
      try { return JSON.parse(item); }
      catch { return null; }
    }
    return item;
  }).filter((item: any) => item !== null && typeof item === 'object');

  const openReceiptEditor = (order: Order) => {
    setReceiptDraft({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      paymentMethod: order.paymentMethod || 'cash',
      discount: order.discount || '0',
      notes: (order as any).notes || '',
      items: parseOrderItems(order).map((item: any) => ({
        ...item,
        nameAr: item.nameAr || item.name || item.nameEn || '',
        nameEn: item.nameEn || '',
        sku: item.sku || '',
        price: String(item.price || item.unitPrice || '0'),
        quantity: parseInt(String(item.quantity || '1'), 10) || 1,
      })),
    });
    setReceiptEditorOpen(true);
  };

  const updateReceiptItem = (index: number, field: string, value: string) => {
    setReceiptDraft((prev: any) => {
      if (!prev) return prev;
      const items = [...(prev.items || [])];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const saveReceiptEdits = () => {
    if (!receiptDraft) return;
    updateReceiptMutation.mutate(receiptDraft);
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

    const q = salesSearchQuery.trim().toLowerCase();
    if (q) {
      const orderNo = (order.orderNumber || "").toLowerCase();
      const customer = (order.customerName || "").toLowerCase();
      const phone = (order.customerPhone || "").toLowerCase();
      if (!orderNo.includes(q) && !customer.includes(q) && !phone.includes(q)) return false;
    }
    
    return true;
  });

  const activeOrders = filteredOrders.filter(order => orderIncludedInSalesReport(order));

  const totalRevenue = activeOrders.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);
  const orderCount = activeOrders.length;
  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
  const walkInOrders = activeOrders.filter(o => o.orderType === 'walk-in').length;
  const inStoreOrders = activeOrders.filter(o => o.orderType === 'in-store').length;
  const onlineOrders = activeOrders.filter(o => o.orderType === 'online').length;

  const filteredRepairTickets = salesLocationId === 1 ? allRepairTickets.filter(t => {
    if (!repairTicketEligibleForSalesReport(t as RepairTicket)) return false;
    const ticketDate = repairTicketSalesAt(t as RepairTicket);
    if (!ticketDate) return false;
    const rangeStart = getDateRangeStart();
    if (dateRange !== 'all' && !isAfter(ticketDate, rangeStart)) return false;
    return true;
  }) : [];

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

  const getPaymentMethodLabel = (order: Order) => {
    if (order.paymentStatus === 'deferred' || order.paymentMethod === 'deferred') {
      return language === 'ar' ? 'أجل' : 'Deferred';
    }
    const method = order.paymentMethod || 'cash';
    const labels: Record<string, { ar: string; en: string }> = {
      'cash': { ar: 'نقداً', en: 'Cash' },
      'card': { ar: 'بطاقة', en: 'Card' },
      'zaincash': { ar: 'زين كاش', en: 'ZainCash' },
      'qicard': { ar: 'كي كارد', en: 'QiCard' },
      'cod': { ar: 'عند الاستلام', en: 'COD' },
      'deferred': { ar: 'أجل', en: 'Deferred' },
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
      : order.paymentMethod === 'deferred' ? '\u0623\u062c\u0644'
      : '\u0639\u0646\u062f \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645';

    const parsedItems: any[] = parseOrderItems(order);

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

  ${(order as any).notes ? `<div style="padding:8px 12px;border-bottom:1px solid #d1d5db;font-size:11px;"><span style="font-weight:700;">\u0645\u0644\u0627\u062d\u0638\u0629: </span><span style="font-weight:800;">${(order as any).notes}</span></div>` : ''}

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

  const toA4InvoiceOrder = (order: Order): A4InvoiceOrder => ({
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: (order as { customerAddress?: string }).customerAddress,
    items: parseOrderItems(order).map((item: any) => ({
      nameAr: item.nameAr || item.name,
      nameEn: item.nameEn,
      name: item.name,
      sku: item.sku,
      price: item.price ?? item.unitPrice ?? "0",
      quantity: parseInt(String(item.quantity || "1"), 10) || 1,
      specs: item.specs,
      notes: item.notes,
    })),
    subtotal: order.subtotal ?? order.total,
    discount: order.discount,
    total: order.total,
    paymentMethod: order.paymentMethod,
    notes: order.notes,
  });

  const printA4OrderReceipt = async (order: Order) => {
    try {
      await openA4InvoicePrint(toA4InvoiceOrder(order), {
        issuedBy: user.name || "",
      });
    } catch {
      toast({
        title: language === "ar" ? "فشل طباعة فاتورة A4" : "A4 print failed",
        variant: "destructive",
      });
    }
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
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];

  const detailedCashflowByDay = (() => {
    const map = new Map<string, {
      date: string;
      withdrawalsTotal: number;
      advancesTotal: number;
      net: number;
      rows: typeof detailedCashflowRows;
    }>();

    for (const row of detailedCashflowRows) {
      const dateKey = new Date(row.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Baghdad' });
      const entry =
        map.get(dateKey) ||
        {
          date: dateKey,
          withdrawalsTotal: 0,
          advancesTotal: 0,
          net: 0,
          rows: [],
        };
      entry.rows.push(row);
      if (row.type === 'withdrawal') entry.withdrawalsTotal += row.amount;
      else entry.advancesTotal += row.amount;
      map.set(dateKey, entry);
    }

    const days = Array.from(map.values())
      .map((d) => ({ ...d, net: d.advancesTotal - d.withdrawalsTotal }))
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const day of days) {
      day.rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    return days;
  })();

  const printMonthlyCashflow = () => {
    if (!monthlyCashflow) return;
    const monthLabel = monthlyCashflow.mode === "range"
      ? `${monthlyCashflow.from} → ${monthlyCashflow.to}`
      : monthlyCashflow.month;
    let rowIndex = 0;
    const detailedRows = detailedCashflowByDay.map((day) => {
      const header = `
        <tr>
          <td colspan="7" style="background:#f9fafb;font-weight:700">
            ${day.date}
            <span style="margin-right:10px;color:#c2410c">سحوبات: - ${formatPrice(day.withdrawalsTotal)}</span>
            <span style="margin-right:10px;color:#059669">دفع من الجيب: + ${formatPrice(day.advancesTotal)}</span>
            <span style="margin-right:10px;">الصافي: ${formatPrice(day.net)}</span>
          </td>
        </tr>`;
      const rows = day.rows.map((row) => {
        rowIndex += 1;
        return `
          <tr>
            <td>${rowIndex}</td>
            <td>${formatDate(row.createdAt)}</td>
            <td>${formatTime(row.createdAt)}</td>
            <td>${row.type === 'withdrawal' ? 'سحب' : 'دفع من الجيب'}</td>
            <td>${row.actor}</td>
            <td>${row.reason || '—'}</td>
            <td style="text-align:end;${row.type === 'withdrawal' ? 'color:#c2410c' : 'color:#059669'}">${row.type === 'withdrawal' ? '-' : '+'} ${formatPrice(row.amount)}</td>
          </tr>`;
      }).join("");
      return header + rows;
    }).join("");

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
              <Input
                className="w-72"
                placeholder={language === 'ar' ? 'ابحث بالعميل / الهاتف / رقم الوصل...' : 'Search by customer / phone / receipt #...'}
                value={salesSearchQuery}
                onChange={(e) => setSalesSearchQuery(e.target.value)}
                data-testid="input-sales-report-search"
              />
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
                        ) : order.status === 'voided' ? (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300 gap-1">
                            <Ban className="h-3 w-3" />
                            {language === 'ar' ? 'ملغى' : 'Voided'}
                          </Badge>
                        ) : order.status === 'cancelled' ? (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300">
                            {language === 'ar' ? 'ملغي' : 'Cancelled'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">{order.status}</Badge>
                        )}
                      </td>
                      <td className="p-3">{getPaymentMethodLabel(order)}</td>
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
                            title={language === 'ar' ? 'طباعة وصل حراري' : 'Print thermal receipt'}
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => printA4OrderReceipt(order)}
                            data-testid={`button-print-a4-${order.id}`}
                            title={language === 'ar' ? 'طباعة فاتورة A4' : 'Print A4 invoice'}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          {user.permissions.canEditReceipt === 1 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openReceiptEditor(order)}
                              data-testid={`button-edit-receipt-${order.id}`}
                              title={language === 'ar' ? 'تعديل الوصل' : 'Edit Receipt'}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          )}
                          {canVoidSales && order.status !== 'voided' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => confirmVoidOrder(order)}
                              disabled={voidOrderMutation.isPending}
                              data-testid={`button-void-${order.id}`}
                              title={language === 'ar' ? 'إلغاء الطلب' : 'Void Order'}
                              className="text-destructive hover:text-destructive"
                            >
                              {voidOrderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                            </Button>
                          )}
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
                    {canVoidSales && (
                      <th className="text-center py-2 px-4 font-medium text-muted-foreground w-16" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredRepairTickets.map((ticket, idx) => {
                    const amount = parseFloat(ticket.finalCost || ticket.costEstimate || '0');
                    const isDeferred = ticket.paymentStatus === 'deferred';
                    const ticketDate = repairTicketSalesAt(ticket) ?? new Date(ticket.updatedAt);
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
                        {canVoidSales && (
                          <td className="py-2 px-4 text-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => confirmVoidRepair(ticket)}
                              disabled={voidRepairMutation.isPending}
                              title={language === 'ar' ? 'إلغاء مبيعة الصيانة' : 'Void repair sale'}
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-void-repair-${ticket.id}`}
                            >
                              {voidRepairMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Ban className="w-4 h-4" />
                              )}
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 border-t-2 font-semibold">
                    <td colSpan={canVoidSales ? 7 : 6} className="py-2 px-4">
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
                      {(() => {
                        let idx = 0;
                        return detailedCashflowByDay.flatMap((day) => {
                          const headerKey = `day-${day.date}`;
                          const headerRow = (
                            <tr key={headerKey} className="border-b bg-muted/30">
                              <td colSpan={7} className="p-3 font-semibold">
                                <span className="me-3">{day.date}</span>
                                <span className="me-3 text-orange-700">
                                  {language === 'ar' ? 'سحوبات:' : 'Withdrawals:'} − {formatPrice(day.withdrawalsTotal)} IQD
                                </span>
                                <span className="me-3 text-emerald-700">
                                  {language === 'ar' ? 'دفع من الجيب:' : 'Pay From Pocket:'} + {formatPrice(day.advancesTotal)} IQD
                                </span>
                                <span className="me-3">
                                  {language === 'ar' ? 'الصافي:' : 'Net:'} {formatPrice(day.net)} IQD
                                </span>
                              </td>
                            </tr>
                          );

                          const rows = day.rows.map((row) => {
                            idx += 1;
                            return (
                              <tr key={row.id} className="border-b">
                                <td className="p-3">{idx}</td>
                                <td className="p-3">{formatDate(row.createdAt)}</td>
                                <td className="p-3">{formatTime(row.createdAt)}</td>
                                <td className="p-3">
                                  {row.type === 'withdrawal'
                                    ? (language === 'ar' ? 'سحب' : 'Withdrawal')
                                    : (language === 'ar' ? 'دفع من الجيب' : 'Pay From Pocket')}
                                </td>
                                <td className="p-3">{row.actor}</td>
                                <td className="p-3">{row.reason || '—'}</td>
                                <td className={`p-3 text-end font-semibold ${row.type === 'withdrawal' ? 'text-orange-600' : 'text-emerald-600'}`}>
                                  {row.type === 'withdrawal' ? '-' : '+'} {formatPrice(row.amount)} IQD
                                </td>
                              </tr>
                            );
                          });

                          return [headerRow, ...rows];
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={receiptEditorOpen} onOpenChange={setReceiptEditorOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              {language === 'ar' ? 'تعديل الوصل بعد البيع' : 'Edit Receipt After Sale'}
            </DialogTitle>
          </DialogHeader>

          {receiptDraft && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                {language === 'ar'
                  ? `سيتم حفظ تعديل الوصل رقم ${receiptDraft.orderNumber}. لا يتم تعديل المخزون.`
                  : `Changes will be saved for receipt ${receiptDraft.orderNumber}. Stock is not adjusted.`}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{language === 'ar' ? 'اسم الزبون' : 'Customer Name'}</Label>
                  <Input
                    value={receiptDraft.customerName || ''}
                    onChange={(e) => setReceiptDraft((prev: any) => ({ ...prev, customerName: e.target.value }))}
                    data-testid="input-report-receipt-customer"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{language === 'ar' ? 'رقم الهاتف' : 'Phone'}</Label>
                  <Input
                    value={receiptDraft.customerPhone || ''}
                    onChange={(e) => setReceiptDraft((prev: any) => ({ ...prev, customerPhone: e.target.value }))}
                    data-testid="input-report-receipt-phone"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</Label>
                  <Select
                    value={receiptDraft.paymentMethod || 'cash'}
                    onValueChange={(value) => setReceiptDraft((prev: any) => ({ ...prev, paymentMethod: value }))}
                  >
                    <SelectTrigger data-testid="select-report-receipt-payment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{language === 'ar' ? 'نقدي' : 'Cash'}</SelectItem>
                      <SelectItem value="card">{language === 'ar' ? 'بطاقة' : 'Card'}</SelectItem>
                      <SelectItem value="zaincash">{language === 'ar' ? 'زين كاش' : 'ZainCash'}</SelectItem>
                      <SelectItem value="qicard">{language === 'ar' ? 'كي كارد' : 'QiCard'}</SelectItem>
                      <SelectItem value="deferred">{language === 'ar' ? 'أجل' : 'Deferred'}</SelectItem>
                      <SelectItem value="cod">{language === 'ar' ? 'عند الاستلام' : 'COD'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{language === 'ar' ? 'الخصم' : 'Discount'}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={receiptDraft.discount || '0'}
                    onChange={(e) => setReceiptDraft((prev: any) => ({ ...prev, discount: e.target.value }))}
                    data-testid="input-report-receipt-discount"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{language === 'ar' ? 'منتجات الوصل' : 'Receipt Items'}</Label>
                <div className="space-y-3">
                  {(receiptDraft.items || []).map((item: any, index: number) => (
                    <div key={index} className="rounded-lg border p-3 space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">{language === 'ar' ? 'اسم المنتج عربي' : 'Arabic Name'}</Label>
                          <Input
                            value={item.nameAr || ''}
                            onChange={(e) => updateReceiptItem(index, 'nameAr', e.target.value)}
                            data-testid={`input-report-receipt-name-ar-${index}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{language === 'ar' ? 'اسم المنتج إنكليزي' : 'English Name'}</Label>
                          <Input
                            value={item.nameEn || ''}
                            onChange={(e) => updateReceiptItem(index, 'nameEn', e.target.value)}
                            data-testid={`input-report-receipt-name-en-${index}`}
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="space-y-1.5 md:col-span-2">
                          <Label className="text-xs">SKU</Label>
                          <Input
                            value={item.sku || ''}
                            onChange={(e) => updateReceiptItem(index, 'sku', e.target.value)}
                            data-testid={`input-report-receipt-sku-${index}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{language === 'ar' ? 'الكمية' : 'Qty'}</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity || 1}
                            onChange={(e) => updateReceiptItem(index, 'quantity', e.target.value)}
                            data-testid={`input-report-receipt-qty-${index}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{language === 'ar' ? 'السعر' : 'Price'}</Label>
                          <Input
                            type="number"
                            min="0"
                            value={item.price || '0'}
                            onChange={(e) => updateReceiptItem(index, 'price', e.target.value)}
                            data-testid={`input-report-receipt-price-${index}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{language === 'ar' ? 'ملاحظة الوصل' : 'Receipt Note'}</Label>
                <Textarea
                  value={receiptDraft.notes || ''}
                  onChange={(e) => setReceiptDraft((prev: any) => ({ ...prev, notes: e.target.value }))}
                  className="min-h-[80px]"
                  data-testid="textarea-report-receipt-note"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReceiptEditorOpen(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  onClick={saveReceiptEdits}
                  disabled={updateReceiptMutation.isPending}
                  className="gap-2"
                  data-testid="button-save-report-receipt"
                >
                  {updateReceiptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {language === 'ar' ? 'حفظ التعديل' : 'Save Edits'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
