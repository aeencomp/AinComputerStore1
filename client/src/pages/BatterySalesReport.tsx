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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Printer,
  Edit,
  Trash2,
  Battery,
  Plug,
  Languages,
} from "lucide-react";
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
import type { BatterySale, BatterySaleItem, AdapterSaleItem } from "@shared/schema";

interface BatteryUserAuth {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface SaleWithItems extends BatterySale {
  items?: BatterySaleItem[];
  adapterItems?: AdapterSaleItem[];
}

type ReportPeriod = 'today' | 'week' | 'month' | 'custom';
type ProductTypeFilter = 'all' | 'batteries' | 'adapters';

export default function BatterySalesReport() {
  const { language, setLanguage } = useLanguage();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isRTL = language === 'ar';
  
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const [productTypeFilter, setProductTypeFilter] = useState<ProductTypeFilter>('all');
  const [editingSale, setEditingSale] = useState<SaleWithItems | null>(null);
  const [deletingSale, setDeletingSale] = useState<SaleWithItems | null>(null);
  const [editForm, setEditForm] = useState({
    customerName: '',
    customerPhone: '',
    paymentMethod: 'cash',
    discount: '0',
  });
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const { data: currentUser, isLoading: authLoading } = useQuery<BatteryUserAuth>({
    queryKey: ['/api/battery/auth/me'],
    retry: false,
  });

  const { data: salesData = [], isLoading: salesLoading } = useQuery<SaleWithItems[]>({
    queryKey: ['/api/battery/pos/sales'],
    enabled: !!currentUser,
  });

  const updateSaleMutation = useMutation({
    mutationFn: async (data: { id: string; customerName: string; customerPhone: string; paymentMethod: string; discount: number }) => {
      return await apiRequest('PATCH', `/api/battery/pos/sales/${data.id}`, {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        paymentMethod: data.paymentMethod,
        discount: data.discount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/battery/pos/sales'] });
      setEditingSale(null);
      toast({
        title: isRTL ? 'تم التحديث بنجاح' : 'Updated Successfully',
        description: isRTL ? 'تم تحديث بيانات الفاتورة' : 'Receipt has been updated',
      });
    },
    onError: () => {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحديث الفاتورة' : 'Failed to update receipt',
        variant: 'destructive',
      });
    },
  });

  const deleteSaleMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/battery/pos/sales/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/battery/pos/sales'] });
      setDeletingSale(null);
      toast({
        title: isRTL ? 'تم الحذف بنجاح' : 'Deleted Successfully',
        description: isRTL ? 'تم حذف الفاتورة' : 'Receipt has been deleted',
      });
    },
    onError: () => {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في حذف الفاتورة' : 'Failed to delete receipt',
        variant: 'destructive',
      });
    },
  });

  const openEditModal = (sale: SaleWithItems) => {
    setEditForm({
      customerName: sale.customerName || '',
      customerPhone: sale.customerPhone || '',
      paymentMethod: sale.paymentMethod || 'cash',
      discount: sale.discount || '0',
    });
    setEditingSale(sale);
  };

  const handleConfirmDelete = () => {
    if (!deletingSale) return;
    deleteSaleMutation.mutate(deletingSale.id);
  };

  const handleSaveEdit = () => {
    if (!editingSale) return;
    
    const discountAmount = parseFloat(editForm.discount) || 0;
    const subtotal = parseFloat(editingSale.subtotal || '0');
    
    if (discountAmount > subtotal) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'الخصم لا يمكن أن يتجاوز المجموع الفرعي' : 'Discount cannot exceed subtotal',
        variant: 'destructive',
      });
      return;
    }
    
    updateSaleMutation.mutate({
      id: editingSale.id,
      customerName: editForm.customerName,
      customerPhone: editForm.customerPhone,
      paymentMethod: editForm.paymentMethod,
      discount: discountAmount,
    });
  };

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

  const filteredSales = useMemo(() => {
    let sales = salesData.filter(sale => {
      const saleDate = new Date(sale.createdAt);
      return saleDate >= dateRange.start && saleDate <= dateRange.end;
    });

    if (productTypeFilter === 'batteries') {
      sales = sales.filter(sale => (sale.items?.length || 0) > 0);
    } else if (productTypeFilter === 'adapters') {
      sales = sales.filter(sale => (sale.adapterItems?.length || 0) > 0);
    }

    return sales;
  }, [salesData, dateRange, productTypeFilter]);

  const stats = useMemo(() => {
    const totalSales = filteredSales.length;
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.total || '0'), 0);
    const totalDiscount = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.discount || '0'), 0);
    const avgSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;
    
    const paymentMethods = filteredSales.reduce((acc, sale) => {
      const method = sale.paymentMethod || 'cash';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let totalBatteryItemsSold = 0;
    let batteryRevenue = 0;
    let totalAdapterItemsSold = 0;
    let adapterRevenue = 0;

    filteredSales.forEach(sale => {
      if (sale.items) {
        sale.items.forEach(item => {
          totalBatteryItemsSold += item.quantity || 1;
          batteryRevenue += parseFloat(item.lineTotal || '0');
        });
      }
      if (sale.adapterItems) {
        sale.adapterItems.forEach(item => {
          totalAdapterItemsSold += item.quantity || 1;
          adapterRevenue += parseFloat(item.lineTotal || '0');
        });
      }
    });

    const salesWithBatteries = filteredSales.filter(s => (s.items?.length || 0) > 0).length;
    const salesWithAdapters = filteredSales.filter(s => (s.adapterItems?.length || 0) > 0).length;
    
    return { 
      totalSales, 
      totalRevenue, 
      totalDiscount, 
      avgSaleValue, 
      paymentMethods,
      totalBatteryItemsSold,
      batteryRevenue,
      totalAdapterItemsSold,
      adapterRevenue,
      totalItemsSold: totalBatteryItemsSold + totalAdapterItemsSold,
      salesWithBatteries,
      salesWithAdapters,
    };
  }, [filteredSales]);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' ' + (isRTL ? 'د.ع' : 'IQD');
  };

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

  const handlePrintReceipt = (sale: SaleWithItems) => {
    const saleDate = new Date(sale.createdAt);
    const warrantyEndDate = new Date(saleDate);
    warrantyEndDate.setMonth(warrantyEndDate.getMonth() + 1);

    const receiptData = {
      saleNumber: sale.saleNumber,
      saleDate: saleDate.toISOString(),
      customerName: sale.customerName || undefined,
      customerPhone: sale.customerPhone || undefined,
      items: (sale.items || []).map(item => ({
        brand: item.brand || 'Battery',
        serialNumber: item.serialNumber || '',
        quantity: item.quantity || 1,
        unitPrice: parseFloat(item.unitPrice || '0'),
      })),
      adapterItems: (sale.adapterItems || []).map(item => ({
        brand: item.brand || 'Adapter',
        wattage: item.wattage || 0,
        serialNumber: item.serialNumber || '',
        quantity: item.quantity || 1,
        unitPrice: parseFloat(item.unitPrice || '0'),
      })),
      subtotal: parseFloat(sale.subtotal || '0'),
      discount: 0,
      discountAmount: parseFloat(sale.discount || '0'),
      total: parseFloat(sale.total || '0'),
      paymentMethod: sale.paymentMethod || 'cash',
      warrantyEndDate: warrantyEndDate.toISOString(),
    };

    sessionStorage.setItem("battery_receipt_print", JSON.stringify(receiptData));
    setLocation("/battery/pos/print");
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
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="gap-1"
              data-testid="button-language-switch"
            >
              <Languages className="h-4 w-4" />
              {language === 'ar' ? 'EN' : 'عربي'}
            </Button>
            <Badge variant="secondary" className="text-sm">
              {currentUser.name}
            </Badge>
          </div>
        </div>

        {/* Period & Product Type Filter */}
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

              <div className="space-y-1">
                <Label>{isRTL ? 'نوع المنتج' : 'Product Type'}</Label>
                <Select value={productTypeFilter} onValueChange={(v) => setProductTypeFilter(v as ProductTypeFilter)}>
                  <SelectTrigger className="w-[150px]" data-testid="select-product-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                    <SelectItem value="batteries">{isRTL ? 'البطاريات' : 'Batteries'}</SelectItem>
                    <SelectItem value="adapters">{isRTL ? 'الشواحن' : 'Adapters'}</SelectItem>
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

        {/* Product Type Breakdown Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Battery className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'مبيعات البطاريات' : 'Battery Sales'}
                  </p>
                  <p className="text-lg font-bold" data-testid="text-battery-sales-count">
                    {stats.salesWithBatteries} {isRTL ? 'عملية' : 'sales'}
                  </p>
                  <p className="text-sm text-muted-foreground" data-testid="text-battery-items-sold">
                    {stats.totalBatteryItemsSold} {isRTL ? 'قطعة' : 'items'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'إيرادات البطاريات' : 'Battery Revenue'}
                  </p>
                  <p className="text-lg font-bold text-purple-600" data-testid="text-battery-revenue">
                    {formatCurrency(stats.batteryRevenue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Plug className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'مبيعات الشواحن' : 'Adapter Sales'}
                  </p>
                  <p className="text-lg font-bold" data-testid="text-adapter-sales-count">
                    {stats.salesWithAdapters} {isRTL ? 'عملية' : 'sales'}
                  </p>
                  <p className="text-sm text-muted-foreground" data-testid="text-adapter-items-sold">
                    {stats.totalAdapterItemsSold} {isRTL ? 'قطعة' : 'items'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'إيرادات الشواحن' : 'Adapter Revenue'}
                  </p>
                  <p className="text-lg font-bold text-orange-600" data-testid="text-adapter-revenue">
                    {formatCurrency(stats.adapterRevenue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Total Items Sold */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'إجمالي القطع المباعة' : 'Total Items Sold'}
                </p>
                <p className="text-3xl font-bold" data-testid="text-total-items-sold">
                  {stats.totalItemsSold}
                </p>
                <p className="text-sm text-muted-foreground">
                  ({stats.totalBatteryItemsSold} {isRTL ? 'بطارية' : 'batteries'} + {stats.totalAdapterItemsSold} {isRTL ? 'شاحن' : 'adapters'})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
                      <TableHead>{isRTL ? 'المنتجات' : 'Products'}</TableHead>
                      <TableHead>{isRTL ? 'طريقة الدفع' : 'Payment'}</TableHead>
                      <TableHead>{isRTL ? 'الخصم' : 'Discount'}</TableHead>
                      <TableHead>{isRTL ? 'الإجمالي' : 'Total'}</TableHead>
                      <TableHead>{isRTL ? 'الإجراءات' : 'Actions'}</TableHead>
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
                          <div className="space-y-1">
                            {(sale.items || []).map((item, idx) => (
                              <div key={`battery-${item.id || idx}`} className="flex items-center gap-1 text-sm" data-testid={`item-battery-${sale.id}-${idx}`}>
                                <Battery className="h-3 w-3 text-purple-600" />
                                <span>{item.brand}</span>
                                {item.serialNumber && (
                                  <span className="text-xs text-muted-foreground">({item.serialNumber})</span>
                                )}
                              </div>
                            ))}
                            {(sale.adapterItems || []).map((item, idx) => (
                              <div key={`adapter-${item.id || idx}`} className="flex items-center gap-1 text-sm" data-testid={`item-adapter-${sale.id}-${idx}`}>
                                <Plug className="h-3 w-3 text-orange-600" />
                                <span>{item.brand} {item.wattage}W</span>
                                {item.serialNumber && (
                                  <span className="text-xs text-muted-foreground">({item.serialNumber})</span>
                                )}
                              </div>
                            ))}
                            {(!sale.items || sale.items.length === 0) && (!sale.adapterItems || sale.adapterItems.length === 0) && (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </div>
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
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditModal(sale)}
                              data-testid={`button-edit-${sale.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePrintReceipt(sale)}
                              data-testid={`button-print-${sale.id}`}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingSale(sale)}
                              className="text-red-500 hover:text-red-700"
                              data-testid={`button-delete-${sale.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Edit Sale Modal */}
      <Dialog open={!!editingSale} onOpenChange={(open) => !open && setEditingSale(null)}>
        <DialogContent className={`max-w-md ${isRTL ? 'rtl' : ''}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              {isRTL ? 'تعديل الفاتورة' : 'Edit Receipt'}
            </DialogTitle>
            <DialogDescription>
              {isRTL 
                ? `رقم الفاتورة: ${editingSale?.saleNumber}`
                : `Receipt #: ${editingSale?.saleNumber}`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'اسم الزبون' : 'Customer Name'}</Label>
              <Input
                value={editForm.customerName}
                onChange={(e) => setEditForm(prev => ({ ...prev, customerName: e.target.value }))}
                placeholder={isRTL ? 'زبون متجر' : 'Walk-in Customer'}
                data-testid="input-edit-customer-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label>{isRTL ? 'رقم الهاتف' : 'Phone Number'}</Label>
              <Input
                value={editForm.customerPhone}
                onChange={(e) => setEditForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                placeholder="07XXXXXXXXX"
                dir="ltr"
                data-testid="input-edit-customer-phone"
              />
            </div>
            
            <div className="space-y-2">
              <Label>{isRTL ? 'طريقة الدفع' : 'Payment Method'}</Label>
              <Select 
                value={editForm.paymentMethod} 
                onValueChange={(v) => setEditForm(prev => ({ ...prev, paymentMethod: v }))}
              >
                <SelectTrigger data-testid="select-edit-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{isRTL ? 'نقدي' : 'Cash'}</SelectItem>
                  <SelectItem value="card">{isRTL ? 'بطاقة' : 'Card'}</SelectItem>
                  <SelectItem value="zaincash">{isRTL ? 'زين كاش' : 'ZainCash'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>{isRTL ? 'الخصم (د.ع)' : 'Discount (IQD)'}</Label>
              <Input
                type="number"
                value={editForm.discount}
                onChange={(e) => setEditForm(prev => ({ ...prev, discount: e.target.value }))}
                min="0"
                data-testid="input-edit-discount"
              />
            </div>

            {editingSale && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{isRTL ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                  <span>{formatCurrency(parseFloat(editingSale.subtotal || '0'))}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>{isRTL ? 'الخصم:' : 'Discount:'}</span>
                  <span>-{formatCurrency(parseFloat(editForm.discount) || 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-1 border-t">
                  <span>{isRTL ? 'الإجمالي:' : 'Total:'}</span>
                  <span className="text-green-600">
                    {formatCurrency(parseFloat(editingSale.subtotal || '0') - (parseFloat(editForm.discount) || 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className={isRTL ? 'flex-row-reverse gap-2' : ''}>
            <Button
              variant="outline"
              onClick={() => setEditingSale(null)}
              data-testid="button-cancel-edit"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateSaleMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateSaleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingSale} onOpenChange={(open) => !open && setDeletingSale(null)}>
        <AlertDialogContent className={isRTL ? 'rtl' : ''}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              {isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL 
                ? `هل أنت متأكد من حذف الفاتورة رقم ${deletingSale?.saleNumber}؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete receipt #${deletingSale?.saleNumber}? This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRTL ? 'flex-row-reverse gap-2' : ''}>
            <AlertDialogCancel data-testid="button-cancel-delete">
              {isRTL ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600"
              disabled={deleteSaleMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteSaleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {isRTL ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
