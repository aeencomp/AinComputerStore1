import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Truck
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

interface SalesUser {
  id: string;
  permissions: {
    canViewReports: number;
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

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
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

  const printOrderReceipt = (order: Order) => {
    const isAr = language === 'ar';
    const dir = isAr ? 'rtl' : 'ltr';
    const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 0 });

    const payLabel = order.paymentMethod === 'cash' ? (isAr ? 'نقدي' : 'Cash')
      : order.paymentMethod === 'card' ? (isAr ? 'بطاقة' : 'Card')
      : order.paymentMethod === 'zaincash' ? 'ZainCash'
      : order.paymentMethod === 'qicard' ? 'QiCard'
      : (isAr ? 'عند الاستلام' : 'COD');

    const parsedItems: any[] = (order.items || []).map((item: any) => {
      try { return typeof item === 'string' ? JSON.parse(item) : item; }
      catch { return item; }
    });

    const rowsHtml = parsedItems.map(item => {
      const unitPrice = parseFloat(item.price || item.unitPrice || '0');
      const qty = item.quantity || 1;
      const lineTotal = unitPrice * qty;
      const name = isAr ? (item.nameAr || item.name || '-') : (item.nameEn || item.nameAr || item.name || '-');
      return `<tr>
        <td style="padding:4px 2px;border-bottom:1px solid #eee;">${name}${item.sku ? `<br/><span style="font-size:9px;color:#888;">SKU: ${item.sku}</span>` : ''}</td>
        <td style="text-align:center;padding:4px 2px;border-bottom:1px solid #eee;">${qty}</td>
        <td style="text-align:end;padding:4px 2px;border-bottom:1px solid #eee;">${fmt(unitPrice)}</td>
        <td style="text-align:end;padding:4px 2px;border-bottom:1px solid #eee;font-weight:600;">${fmt(lineTotal)}</td>
      </tr>`;
    }).join('');

    const subtotalNum = parseFloat(order.subtotal || order.total || '0');
    const discountNum = parseFloat(order.discount || '0');
    const totalNum = parseFloat(order.total || '0');

    const discountRow = discountNum > 0 ? `
      <div style="display:flex;justify-content:space-between;color:#16a34a;">
        <span>${isAr ? 'الخصم:' : 'Discount:'}</span>
        <span>-${fmt(discountNum)} ${isAr ? 'د.ع' : 'IQD'}</span>
      </div>` : '';

    const customerHtml = (order.customerName || order.customerPhone) ? `
      <div style="background:#f9fafb;border-radius:6px;padding:8px 10px;margin-bottom:10px;font-size:12px;">
        ${order.customerName ? `<div style="display:flex;justify-content:space-between;"><span>${isAr ? 'الزبون:' : 'Customer:'}</span><span>${order.customerName}</span></div>` : ''}
        ${order.customerPhone ? `<div style="display:flex;justify-content:space-between;"><span>${isAr ? 'الهاتف:' : 'Phone:'}</span><span dir="ltr">${order.customerPhone}</span></div>` : ''}
      </div>` : '';

    const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${isAr ? 'ar' : 'en'}">
<head>
<meta charset="UTF-8"/>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Cairo', Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 8px; width: 80mm; }
  h2 { margin: 0 0 2px; font-size: 16px; }
  p { margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { border-bottom: 2px solid #333; padding: 4px 2px; font-weight: 600; }
  .dashed { border-top: 1px dashed #aaa; margin: 8px 0; }
  .section { background: #f9fafb; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 12px; }
  .row { display: flex; justify-content: space-between; }
  .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; border-top: 2px solid #333; padding-top: 6px; margin-top: 4px; }
  .footer { text-align: center; margin-top: 10px; font-size: 11px; color: #666; }
</style>
</head>
<body>
  <div style="text-align:center;border-bottom:2px dashed #aaa;padding-bottom:10px;margin-bottom:10px;">
    <h2>العين لتجارة الحاسبات</h2>
    <p style="font-size:11px;color:#666;">AEEN COMPUTER TRADING — العراق، كربلاء</p>
    <p style="font-size:10px;color:#999;margin-top:4px;">${isAr ? 'إيصال بيع' : 'Sales Receipt'}</p>
  </div>
  <div class="section" style="margin-bottom:10px;">
    <div class="row"><span>${isAr ? 'رقم الطلب:' : 'Order #:'}</span><span style="font-weight:700;font-family:monospace;">${order.orderNumber}</span></div>
    <div class="row"><span>${isAr ? 'التاريخ:' : 'Date:'}</span><span>${new Date(order.createdAt).toLocaleString(isAr ? 'ar-IQ' : 'en-US')}</span></div>
    <div class="row"><span>${isAr ? 'طريقة الدفع:' : 'Payment:'}</span><span style="font-weight:600;">${payLabel}</span></div>
  </div>
  ${customerHtml}
  <table>
    <thead>
      <tr>
        <th style="text-align:start;">${isAr ? 'المنتج' : 'Product'}</th>
        <th style="text-align:center;">${isAr ? 'الكمية' : 'Qty'}</th>
        <th style="text-align:end;">${isAr ? 'السعر' : 'Price'}</th>
        <th style="text-align:end;">${isAr ? 'المجموع' : 'Total'}</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="dashed"></div>
  <div style="font-size:12px;margin-bottom:8px;">
    <div class="row"><span>${isAr ? 'المجموع الفرعي:' : 'Subtotal:'}</span><span>${fmt(subtotalNum)} ${isAr ? 'د.ع' : 'IQD'}</span></div>
    ${discountRow}
    <div class="total-row"><span>${isAr ? 'الإجمالي:' : 'Total:'}</span><span>${fmt(totalNum)} ${isAr ? 'د.ع' : 'IQD'}</span></div>
  </div>
  <div class="footer">
    <div class="dashed"></div>
    <p>${isAr ? 'شكراً لتسوقكم معنا!' : 'Thank you for your purchase!'}</p>
    <p style="margin-top:4px;font-size:10px;">${isAr ? 'يرجى الاحتفاظ بالوصل' : 'Please keep this receipt'}</p>
  </div>
  <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };</script>
</body>
</html>`;

    const popup = window.open('', '_blank', 'width=400,height=650');
    if (popup) { popup.document.write(html); popup.document.close(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          {language === 'ar' ? 'تقارير المبيعات' : 'Sales Reports'}
        </h2>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
    </div>
  );
}
