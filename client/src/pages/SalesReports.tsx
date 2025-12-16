import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Loader2,
  Calendar
} from "lucide-react";
import { startOfDay, startOfWeek, startOfMonth, startOfYear, isAfter } from "date-fns";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  total: string;
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
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('today');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'online' | 'walk-in'>('all');

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
  });

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
      if (orderTypeFilter === 'online' && orderType !== 'online') return false;
    }
    
    return true;
  });

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);
  const orderCount = filteredOrders.length;
  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
  const walkInOrders = filteredOrders.filter(o => o.orderType === 'walk-in').length;
  const onlineOrders = filteredOrders.filter(o => o.orderType !== 'walk-in').length;

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
            <SelectTrigger className="w-40" data-testid="select-order-type">
              <ShoppingCart className="h-4 w-4 me-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'ar' ? 'جميع الطلبات' : 'All Orders'}</SelectItem>
              <SelectItem value="walk-in">{language === 'ar' ? 'في المتجر' : 'Walk-in'}</SelectItem>
              <SelectItem value="online">{language === 'ar' ? 'أونلاين' : 'Online'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  {language === 'ar' ? 'في المتجر / أونلاين' : 'Walk-in / Online'}
                </p>
                <p className="text-xl font-bold">{walkInOrders} / {onlineOrders}</p>
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
                    <th className="text-start p-3">{language === 'ar' ? 'الدفع' : 'Payment'}</th>
                    <th className="text-end p-3">{language === 'ar' ? 'المبلغ' : 'Amount'}</th>
                    <th className="text-start p-3">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.slice(0, 50).map(order => (
                    <tr key={order.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-mono">{order.orderNumber}</td>
                      <td className="p-3">{order.customerName}</td>
                      <td className="p-3">
                        <Badge variant={order.orderType === 'walk-in' ? 'default' : 'secondary'}>
                          {order.orderType === 'walk-in' 
                            ? (language === 'ar' ? 'في المتجر' : 'Walk-in')
                            : (language === 'ar' ? 'أونلاين' : 'Online')
                          }
                        </Badge>
                      </td>
                      <td className="p-3">{getPaymentMethodLabel(order.paymentMethod)}</td>
                      <td className="p-3 text-end font-bold">{formatPrice(parseFloat(order.total))} IQD</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString('ar-IQ')}
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
