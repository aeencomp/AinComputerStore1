import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft,
  ArrowRight,
  Calendar,
  TrendingUp,
  Package,
  DollarSign,
  Receipt,
  BarChart3,
  Loader2,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import type { BatterySale, BatterySaleItem } from "@shared/schema";

interface BatteryUserAuth {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface SaleWithItems extends BatterySale {
  items?: BatterySaleItem[];
}

type ReportPeriod = 'today' | 'week' | 'month' | 'custom';

export default function BatterySalesReport() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isRTL = language === 'ar';
  
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [showClearDialog, setShowClearDialog] = useState(false);

  const { data: currentUser, isLoading: authLoading } = useQuery<BatteryUserAuth>({
    queryKey: ['/api/battery/auth/me'],
    retry: false,
  });

  const { data: salesData = [], isLoading: salesLoading } = useQuery<SaleWithItems[]>({
    queryKey: ['/api/battery/pos/sales'],
    enabled: !!currentUser,
  });

  const clearSalesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', '/api/battery/pos/sales/clear-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/battery/pos/sales'] });
      setShowClearDialog(false);
      toast({
        title: isRTL ? 'تم المسح بنجاح' : 'Cleared Successfully',
        description: isRTL ? 'تم مسح جميع سجلات المبيعات' : 'All sales records have been cleared',
      });
    },
    onError: () => {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في مسح السجلات' : 'Failed to clear records',
        variant: 'destructive',
      });
    },
  });

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    let start = new Date();
    start.setHours(0, 0, 0, 0);
    
    switch (period) {
      case 'today':
        break;
      case 'week':
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start.setDate(1);
        break;
      case 'custom':
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        today.setTime(new Date(endDate).getTime());
        today.setHours(23, 59, 59, 999);
        break;
    }
    
    return { start, end: today };
  }, [period, startDate, endDate]);

  // Filter sales by date range
  const filteredSales = useMemo(() => {
    return salesData.filter(sale => {
      const saleDate = new Date(sale.createdAt);
      return saleDate >= dateRange.start && saleDate <= dateRange.end;
    });
  }, [salesData, dateRange]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalSales = filteredSales.length;
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.total || '0'), 0);
    const totalDiscount = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.discount || '0'), 0);
    const avgSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;
    
    // Payment method breakdown
    const paymentMethods = filteredSales.reduce((acc, sale) => {
      const method = sale.paymentMethod || 'cash';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return { totalSales, totalRevenue, totalDiscount, avgSaleValue, paymentMethods };
  }, [filteredSales]);

  // Daily breakdown for current period
  const dailyBreakdown = useMemo(() => {
    const breakdown: Record<string, { count: number; revenue: number }> = {};
    
    filteredSales.forEach(sale => {
      const dateKey = new Date(sale.createdAt).toISOString().split('T')[0];
      if (!breakdown[dateKey]) {
        breakdown[dateKey] = { count: 0, revenue: 0 };
      }
      breakdown[dateKey].count++;
      breakdown[dateKey].revenue += parseFloat(sale.total || '0');
    });
    
    return Object.entries(breakdown)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, data]) => ({ date, ...data }));
  }, [filteredSales]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' ' + (isRTL ? 'د.ع' : 'IQD');
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isRTL ? 'ar-IQ' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(isRTL ? 'ar-IQ' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      cash: { ar: 'نقدي', en: 'Cash' },
      card: { ar: 'بطاقة', en: 'Card' },
      zainCash: { ar: 'زين كاش', en: 'ZainCash' },
    };
    return labels[method]?.[isRTL ? 'ar' : 'en'] || method;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!currentUser) {
    setLocation("/battery/login");
    return null;
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/battery")}
              data-testid="button-back-dashboard"
            >
              {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
              {isRTL ? 'رجوع' : 'Back'}
            </Button>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold text-slate-800">
                {isRTL ? 'تقارير المبيعات' : 'Sales Reports'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearDialog(true)}
              className="border-red-200 text-red-600 hover:bg-red-50"
              disabled={salesData.length === 0}
              data-testid="button-clear-all-sales"
            >
              <Trash2 className="h-4 w-4 me-2" />
              {isRTL ? 'مسح الكل' : 'Clear All'}
            </Button>
            <Badge variant="secondary" className="text-sm">
              {currentUser.name}
            </Badge>
          </div>
        </div>

        {/* Period Filter */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label>{isRTL ? 'الفترة' : 'Period'}</Label>
                <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
                  <SelectTrigger className="w-[150px]" data-testid="select-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">{isRTL ? 'اليوم' : 'Today'}</SelectItem>
                    <SelectItem value="week">{isRTL ? 'آخر 7 أيام' : 'Last 7 Days'}</SelectItem>
                    <SelectItem value="month">{isRTL ? 'هذا الشهر' : 'This Month'}</SelectItem>
                    <SelectItem value="custom">{isRTL ? 'مخصص' : 'Custom'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {period === 'custom' && (
                <>
                  <div className="space-y-1">
                    <Label>{isRTL ? 'من' : 'From'}</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-[160px]"
                      data-testid="input-start-date"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{isRTL ? 'إلى' : 'To'}</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-[160px]"
                      data-testid="input-end-date"
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'عدد المبيعات' : 'Total Sales'}
                  </p>
                  <p className="text-2xl font-bold" data-testid="text-total-sales">
                    {stats.totalSales}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'إجمالي الإيرادات' : 'Total Revenue'}
                  </p>
                  <p className="text-xl font-bold text-green-600" data-testid="text-total-revenue">
                    {formatCurrency(stats.totalRevenue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'متوسط قيمة البيع' : 'Avg Sale Value'}
                  </p>
                  <p className="text-xl font-bold" data-testid="text-avg-sale">
                    {formatCurrency(stats.avgSaleValue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Receipt className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'إجمالي الخصومات' : 'Total Discounts'}
                  </p>
                  <p className="text-xl font-bold text-red-600" data-testid="text-total-discounts">
                    {formatCurrency(stats.totalDiscount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Daily Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                {isRTL ? 'التفاصيل اليومية' : 'Daily Breakdown'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyBreakdown.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {isRTL ? 'لا توجد مبيعات في هذه الفترة' : 'No sales in this period'}
                </p>
              ) : (
                <div className="space-y-3">
                  {dailyBreakdown.map((day) => (
                    <div key={day.date} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">{formatDate(day.date)}</p>
                        <p className="text-sm text-muted-foreground">
                          {day.count} {isRTL ? 'عملية' : 'sales'}
                        </p>
                      </div>
                      <p className="font-bold text-green-600">
                        {formatCurrency(day.revenue)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5" />
                {isRTL ? 'طرق الدفع' : 'Payment Methods'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(stats.paymentMethods).length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {isRTL ? 'لا توجد بيانات' : 'No data'}
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(stats.paymentMethods).map(([method, count]) => (
                    <div key={method} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="font-medium">{getPaymentMethodLabel(method)}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Sales Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="h-5 w-5" />
                {isRTL ? 'آخر المبيعات' : 'Recent Sales'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredSales.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {isRTL ? 'لا توجد مبيعات' : 'No sales'}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredSales.slice(0, 5).map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between p-2 border-b">
                      <div>
                        <p className="font-mono text-sm">{sale.saleNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(sale.createdAt as unknown as string)}
                        </p>
                      </div>
                      <p className="font-medium text-green-600">
                        {formatCurrency(parseFloat(sale.total || '0'))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Full Sales Table */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {isRTL ? 'سجل المبيعات' : 'Sales Log'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredSales.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {isRTL ? 'لا توجد مبيعات في هذه الفترة' : 'No sales in this period'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'رقم الفاتورة' : 'Invoice #'}</TableHead>
                      <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      <TableHead>{isRTL ? 'الزبون' : 'Customer'}</TableHead>
                      <TableHead>{isRTL ? 'طريقة الدفع' : 'Payment'}</TableHead>
                      <TableHead>{isRTL ? 'الخصم' : 'Discount'}</TableHead>
                      <TableHead>{isRTL ? 'الإجمالي' : 'Total'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => (
                      <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                        <TableCell className="font-mono text-sm">
                          {sale.saleNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{formatDate(sale.createdAt as unknown as string)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(sale.createdAt as unknown as string)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {sale.customerName || (isRTL ? 'زبون متجر' : 'Walk-in')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getPaymentMethodLabel(sale.paymentMethod || 'cash')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-red-600">
                          {parseFloat(sale.discount || '0') > 0 
                            ? formatCurrency(parseFloat(sale.discount || '0'))
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="font-bold text-green-600">
                          {formatCurrency(parseFloat(sale.total || '0'))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className={isRTL ? 'rtl' : ''}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              {isRTL ? 'تأكيد مسح جميع المبيعات' : 'Confirm Clear All Sales'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL 
                ? 'هل أنت متأكد من مسح جميع سجلات المبيعات؟ هذا الإجراء لا يمكن التراجع عنه.'
                : 'Are you sure you want to clear all sales records? This action cannot be undone.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRTL ? 'flex-row-reverse gap-2' : ''}>
            <AlertDialogCancel data-testid="button-cancel-clear">
              {isRTL ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearSalesMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
              disabled={clearSalesMutation.isPending}
              data-testid="button-confirm-clear"
            >
              {clearSalesMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin me-2" />
              ) : (
                <Trash2 className="h-4 w-4 me-2" />
              )}
              {isRTL ? 'مسح الكل' : 'Clear All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
