import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  TrendingUp,
  ShoppingCart,
  Store,
  Globe,
  Calendar,
  Search,
  DollarSign,
  Package,
  Users,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AdminNav } from "@/components/AdminNav";
import type { Order } from "@shared/schema";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface SalesStats {
  totalSales: number;
  totalOrders: number;
  walkInSales: number;
  walkInOrders: number;
  onlineSales: number;
  onlineOrders: number;
  todaySales: number;
  todayOrders: number;
}

export default function AdminSales() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");

  const { data: currentAdmin, isLoading: authLoading, isError: authError } = useQuery<AdminUser>({
    queryKey: ['/api/admin/auth/me'],
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && (authError || !currentAdmin)) {
      localStorage.removeItem("adminAuth");
      setLocation("/admin/login");
    }
  }, [authLoading, authError, currentAdmin, setLocation]);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['/api/admin/orders'],
    enabled: !!currentAdmin,
  });

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat('ar-IQ').format(typeof price === 'string' ? parseFloat(price) : price);
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isToday = (date: string | Date) => {
    const d = new Date(date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  };

  const isThisWeek = (date: string | Date) => {
    const d = new Date(date);
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  };

  const isThisMonth = (date: string | Date) => {
    const d = new Date(date);
    const today = new Date();
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const calculateStats = (): SalesStats => {
    let totalSales = 0;
    let totalOrders = 0;
    let walkInSales = 0;
    let walkInOrders = 0;
    let onlineSales = 0;
    let onlineOrders = 0;
    let todaySales = 0;
    let todayOrders = 0;

    orders.forEach(order => {
      const total = parseFloat(order.total);
      const orderType = (order as any).orderType || 'online';
      
      totalSales += total;
      totalOrders++;
      
      if (orderType === 'walk-in') {
        walkInSales += total;
        walkInOrders++;
      } else {
        onlineSales += total;
        onlineOrders++;
      }
      
      if (isToday(order.createdAt)) {
        todaySales += total;
        todayOrders++;
      }
    });

    return {
      totalSales,
      totalOrders,
      walkInSales,
      walkInOrders,
      onlineSales,
      onlineOrders,
      todaySales,
      todayOrders
    };
  };

  const stats = calculateStats();

  const filteredOrders = orders.filter(order => {
    const orderType = (order as any).orderType || 'online';
    
    if (activeTab === 'walk-in' && orderType !== 'walk-in') return false;
    if (activeTab === 'online' && orderType === 'walk-in') return false;
    
    if (dateFilter === 'today' && !isToday(order.createdAt)) return false;
    if (dateFilter === 'week' && !isThisWeek(order.createdAt)) return false;
    if (dateFilter === 'month' && !isThisMonth(order.createdAt)) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return order.orderNumber.toLowerCase().includes(query) ||
             order.customerName.toLowerCase().includes(query) ||
             order.customerPhone.includes(query);
    }
    
    return true;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: { ar: string; en: string }; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: { ar: 'قيد الانتظار', en: 'Pending' }, variant: 'secondary' },
      processing: { label: { ar: 'قيد المعالجة', en: 'Processing' }, variant: 'outline' },
      shipped: { label: { ar: 'تم الشحن', en: 'Shipped' }, variant: 'default' },
      delivered: { label: { ar: 'تم التوصيل', en: 'Delivered' }, variant: 'default' },
      completed: { label: { ar: 'مكتمل', en: 'Completed' }, variant: 'default' },
      cancelled: { label: { ar: 'ملغي', en: 'Cancelled' }, variant: 'destructive' },
    };
    
    const config = statusMap[status] || { label: { ar: status, en: status }, variant: 'secondary' as const };
    return (
      <Badge variant={config.variant}>
        {language === 'ar' ? config.label.ar : config.label.en}
      </Badge>
    );
  };

  const getOrderTypeBadge = (orderType: string) => {
    if (orderType === 'walk-in') {
      return (
        <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
          <Store className="w-3 h-3 me-1" />
          {language === 'ar' ? 'متجر' : 'Walk-in'}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        <Globe className="w-3 h-3 me-1" />
        {language === 'ar' ? 'أونلاين' : 'Online'}
      </Badge>
    );
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, { ar: string; en: string }> = {
      cash: { ar: 'نقدي', en: 'Cash' },
      cash_on_delivery: { ar: 'الدفع عند الاستلام', en: 'Cash on Delivery' },
      card: { ar: 'بطاقة', en: 'Card' },
      zaincash: { ar: 'زين كاش', en: 'ZainCash' },
      qicard: { ar: 'كي كارد', en: 'QiCard' },
    };
    return methods[method]?.[language === 'ar' ? 'ar' : 'en'] || method;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!currentAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <AdminNav currentAdmin={currentAdmin} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === 'ar' ? 'مبيعات اليوم' : "Today's Sales"}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatPrice(stats.todaySales)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.todayOrders} {language === 'ar' ? 'طلب' : 'orders'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === 'ar' ? 'مبيعات المتجر' : 'Walk-in Sales'}
              </CardTitle>
              <Store className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {formatPrice(stats.walkInSales)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.walkInOrders} {language === 'ar' ? 'طلب' : 'orders'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === 'ar' ? 'مبيعات أونلاين' : 'Online Sales'}
              </CardTitle>
              <Globe className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatPrice(stats.onlineSales)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.onlineOrders} {language === 'ar' ? 'طلب' : 'orders'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPrice(stats.totalSales)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.totalOrders} {language === 'ar' ? 'طلب' : 'orders'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>{language === 'ar' ? 'سجل المبيعات' : 'Sales History'}</CardTitle>
                <CardDescription>
                  {language === 'ar' ? 'جميع الطلبات من المتجر والأونلاين' : 'All orders from store and online'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ps-9 w-48"
                    data-testid="input-search"
                  />
                </div>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-36" data-testid="select-date-filter">
                    <Calendar className="w-4 h-4 me-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All Time'}</SelectItem>
                    <SelectItem value="today">{language === 'ar' ? 'اليوم' : 'Today'}</SelectItem>
                    <SelectItem value="week">{language === 'ar' ? 'هذا الأسبوع' : 'This Week'}</SelectItem>
                    <SelectItem value="month">{language === 'ar' ? 'هذا الشهر' : 'This Month'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all" data-testid="tab-all">
                  <ShoppingCart className="w-4 h-4 me-2" />
                  {language === 'ar' ? 'الكل' : 'All'}
                  <Badge variant="secondary" className="ms-2">{orders.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="walk-in" data-testid="tab-walkin">
                  <Store className="w-4 h-4 me-2" />
                  {language === 'ar' ? 'متجر' : 'Walk-in'}
                  <Badge variant="secondary" className="ms-2">{stats.walkInOrders}</Badge>
                </TabsTrigger>
                <TabsTrigger value="online" data-testid="tab-online">
                  <Globe className="w-4 h-4 me-2" />
                  {language === 'ar' ? 'أونلاين' : 'Online'}
                  <Badge variant="secondary" className="ms-2">{stats.onlineOrders}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{language === 'ar' ? 'لا توجد طلبات' : 'No orders found'}</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{language === 'ar' ? 'رقم الطلب' : 'Order #'}</TableHead>
                          <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                          <TableHead>{language === 'ar' ? 'الزبون' : 'Customer'}</TableHead>
                          <TableHead>{language === 'ar' ? 'الإجمالي' : 'Total'}</TableHead>
                          <TableHead>{language === 'ar' ? 'طريقة الدفع' : 'Payment'}</TableHead>
                          <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                          <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => {
                          const orderType = (order as any).orderType || 'online';
                          const discount = parseFloat((order as any).discount || '0');
                          
                          return (
                            <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                              <TableCell>
                                <span className="font-mono font-bold">{order.orderNumber}</span>
                              </TableCell>
                              <TableCell>
                                {getOrderTypeBadge(orderType)}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{order.customerName}</p>
                                  <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-bold">{formatPrice(order.total)} {language === 'ar' ? 'د.ع' : 'IQD'}</p>
                                  {discount > 0 && (
                                    <p className="text-xs text-green-600">
                                      -{formatPrice(discount)} {language === 'ar' ? 'خصم' : 'discount'}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {getPaymentMethodLabel(order.paymentMethod)}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(order.status)}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{formatDate(order.createdAt)}</span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
