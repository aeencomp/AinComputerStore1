import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ShoppingCart, 
  Package, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Clock,
  ArrowUpRight,
  Receipt,
  Calculator,
  Search,
  RefreshCcw,
  Wallet,
  BarChart3,
  TrendingDown,
  Loader2,
  PlayCircle,
  StopCircle,
  Timer,
  HandCoins,
  Trash2,
  Plus
} from "lucide-react";
import { Link } from "wouter";
import type { Order, Product, SalesShift } from "@shared/schema";

interface SalesUser {
  id: string;
  username: string;
  name: string;
  role: string;
  permissions: {
    canPos: number;
    canInventory: number;
    canManageUsers: number;
    canViewReports: number;
    canViewWithdrawals: number;
    canApplyDiscount: number;
  };
}

interface SalesDashboardProps {
  user: SalesUser;
}

export default function SalesDashboard({ user }: SalesDashboardProps) {
  const { language } = useLanguage();
  const { toast } = useToast();
  
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [shiftAction, setShiftAction] = useState<'start' | 'end'>('start');
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [shiftNotes, setShiftNotes] = useState("");

  // Staff advances state
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceStaffName, setAdvanceStaffName] = useState("");
  const [advanceReason, setAdvanceReason] = useState("");

  // Fetch current shift
  const { data: currentShift } = useQuery<SalesShift | null>({
    queryKey: ['/api/sales/shifts/current'],
  });

  // Fetch live snapshot for close dialog preview
  const { data: activeSnapshot } = useQuery<{ summary: { grandTotal: number; grandTotalCash: number; grandTotalZain: number; grandTotalQi: number; grandTotalCard: number; inStoreCount: number; repairCount: number } } | null>({
    queryKey: ['/api/sales/shifts/active-snapshot'],
    enabled: !!currentShift,
    staleTime: 30000,
  });

  const startShiftMutation = useMutation({
    mutationFn: async (data: { openingCash: string; notes: string }) => {
      const res = await apiRequest('POST', '/api/sales/shifts/start', data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: language === 'ar' ? 'بدأت الوردية' : 'Shift started',
      });
      setShowShiftDialog(false);
      setOpeningCash("");
      setShiftNotes("");
      queryClient.invalidateQueries({ queryKey: ['/api/sales/shifts/current'] });
    },
    onError: () => {
      toast({
        title: language === 'ar' ? 'فشل بدء الوردية' : 'Failed to start shift',
        variant: 'destructive',
      });
    },
  });

  const endShiftMutation = useMutation({
    mutationFn: async (data: { closingCash: string; notes: string }) => {
      const res = await apiRequest('POST', '/api/sales/shifts/end', data);
      return res.json();
    },
    onSuccess: (data) => {
      const diff = data.shift?.cashDifference ? parseFloat(data.shift.cashDifference) : 0;
      toast({
        title: language === 'ar' ? 'انتهت الوردية' : 'Shift ended',
        description: diff !== 0 
          ? (language === 'ar' ? `فرق الصندوق: ${formatPrice(diff)} د.ع` : `Cash difference: ${formatPrice(diff)} IQD`)
          : undefined,
      });
      setShowShiftDialog(false);
      setClosingCash("");
      setShiftNotes("");
      queryClient.invalidateQueries({ queryKey: ['/api/sales/shifts/current'] });
    },
    onError: () => {
      toast({
        title: language === 'ar' ? 'فشل إنهاء الوردية' : 'Failed to end shift',
        variant: 'destructive',
      });
    },
  });

  const handleShiftAction = () => {
    if (shiftAction === 'start') {
      startShiftMutation.mutate({
        openingCash: openingCash || '0',
        notes: shiftNotes,
      });
    } else {
      endShiftMutation.mutate({
        closingCash: closingCash || '0',
        notes: shiftNotes,
      });
    }
  };

  // Fetch staff advances scoped to the active shift window
  interface StaffAdvance { id: number; amount: string; staffName: string; reason: string | null; createdAt: string; }
  const shiftStartDate = currentShift?.startTime
    ? new Date(currentShift.startTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Baghdad' })
    : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Baghdad' });
  const { data: allAdvances = [], isLoading: advancesLoading } = useQuery<StaffAdvance[]>({
    queryKey: ['/api/instore/staff-advances', shiftStartDate],
    queryFn: () =>
      fetch(`/api/instore/staff-advances?date=${shiftStartDate}`, { credentials: 'include' }).then(r => r.json()),
  });
  // Filter to only advances at or after shift start
  const advances = currentShift?.startTime
    ? allAdvances.filter(a => new Date(a.createdAt) >= new Date(currentShift.startTime))
    : allAdvances;

  const addAdvanceMutation = useMutation({
    mutationFn: async (data: { amount: string; staffName: string; reason: string }) => {
      const res = await apiRequest('POST', '/api/instore/staff-advances', data);
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error'); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === 'ar' ? 'تمت إضافة السلفة' : 'Advance added' });
      setShowAdvanceForm(false);
      setAdvanceAmount("");
      setAdvanceStaffName("");
      setAdvanceReason("");
      queryClient.invalidateQueries({ queryKey: ['/api/instore/staff-advances', shiftStartDate] });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: 'destructive' });
    },
  });

  const deleteAdvanceMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/instore/staff-advances/${id}`);
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error'); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === 'ar' ? 'تم حذف السلفة' : 'Advance deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/instore/staff-advances', shiftStartDate] });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: 'destructive' });
    },
  });

  // Fetch today's orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
  });

  // Fetch products for low stock alerts
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  // Calculate today's stats - filtered by current salesperson
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todaysOrders = orders.filter(order => {
    const orderDate = new Date(order.createdAt);
    return orderDate >= today;
  });

  // Filter walk-in orders by current salesperson only
  const myWalkInOrders = todaysOrders.filter(o => 
    o.orderType === 'walk-in' && o.salespersonId === user.id
  );
  const myInStoreOrders = todaysOrders.filter(o =>
    o.orderType === 'in-store' && o.salespersonId === user.id
  );
  const myAllPosOrders = [...myWalkInOrders, ...myInStoreOrders];
  const onlineOrders = todaysOrders.filter(o => o.orderType === 'online');
  
  // Calculate stats based on current salesperson's orders only
  const todaySales = myAllPosOrders.reduce((sum, order) => 
    sum + parseFloat(order.total || '0'), 0
  );
  
  const avgTicket = myAllPosOrders.length > 0 
    ? todaySales / myAllPosOrders.length 
    : 0;

  // Low stock products (less than 5 items)
  const lowStockProducts = products.filter(p => (p.stockQuantity || 0) < 5 && (p.stockQuantity || 0) > 0);
  const outOfStockProducts = products.filter(p => (p.stockQuantity || 0) === 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ar-IQ').format(price);
  };

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 
    ? (language === 'ar' ? 'صباح الخير' : 'Good Morning')
    : currentHour < 17 
    ? (language === 'ar' ? 'مساء الخير' : 'Good Afternoon')
    : (language === 'ar' ? 'مساء الخير' : 'Good Evening');

  const isLoading = ordersLoading || productsLoading;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-6 border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              {greeting}، {user.name}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === 'ar' 
                ? `اليوم ${new Date().toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
                : `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
              }
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-sm py-1.5 px-3">
              <Clock className="h-3.5 w-3.5 me-1.5" />
              {new Date().toLocaleTimeString(language === 'ar' ? 'ar-IQ' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
            </Badge>
            {currentShift ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/20"
                onClick={() => {
                  setShiftAction('end');
                  setShowShiftDialog(true);
                }}
                data-testid="button-end-shift"
              >
                <Timer className="h-3.5 w-3.5" />
                {language === 'ar' ? 'وردية نشطة' : 'Shift Active'}
                <StopCircle className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 bg-orange-500/10 text-orange-600 border-orange-200 hover:bg-orange-500/20"
                onClick={() => {
                  setShiftAction('start');
                  setShowShiftDialog(true);
                }}
                data-testid="button-start-shift"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                {language === 'ar' ? 'بدء وردية' : 'Start Shift'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-s-4 border-s-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'مبيعاتي اليوم' : "My Sales Today"}
                </p>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-primary">
                    {formatPrice(todaySales)}
                    <span className="text-sm font-normal text-muted-foreground me-1">
                      {language === 'ar' ? 'د.ع' : 'IQD'}
                    </span>
                  </p>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-s-4 border-s-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'كاونتر (POS عام)' : 'Counter (General POS)'}
                </p>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-green-600">
                    {myWalkInOrders.length}
                    <span className="text-sm font-normal text-muted-foreground me-1">
                      {language === 'ar' ? 'طلب' : 'orders'}
                    </span>
                  </p>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-s-4 border-s-violet-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'مبيعات المتجر' : 'In-Store Sales'}
                </p>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-violet-600">
                    {myInStoreOrders.length}
                    <span className="text-sm font-normal text-muted-foreground me-1">
                      {language === 'ar' ? 'طلب' : 'orders'}
                    </span>
                  </p>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-s-4 border-s-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'طلبات أونلاين' : 'Online Orders'}
                </p>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-orange-600">
                    {onlineOrders.length}
                    <span className="text-sm font-normal text-muted-foreground me-1">
                      {language === 'ar' ? 'جديد' : 'new'}
                    </span>
                  </p>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-primary" />
            {language === 'ar' ? 'الإجراءات السريعة' : 'Quick Actions'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {user.permissions.canPos ? (
              <Link href="/sales/pos">
                <Button 
                  variant="outline" 
                  className="w-full h-24 flex-col gap-2 hover:bg-primary hover:text-primary-foreground transition-colors group"
                  data-testid="quick-action-pos"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 group-hover:bg-primary-foreground/20 flex items-center justify-center transition-colors">
                    <ShoppingCart className="h-5 w-5 text-primary group-hover:text-primary-foreground" />
                  </div>
                  <span className="text-sm font-medium">
                    {language === 'ar' ? 'بيع جديد' : 'New Sale'}
                  </span>
                </Button>
              </Link>
            ) : null}
            
            {user.permissions.canInventory ? (
              <Link href="/sales/inventory">
                <Button 
                  variant="outline" 
                  className="w-full h-24 flex-col gap-2 hover:bg-blue-500 hover:text-white transition-colors group"
                  data-testid="quick-action-inventory"
                >
                  <div className="h-10 w-10 rounded-full bg-blue-500/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                    <Package className="h-5 w-5 text-blue-500 group-hover:text-white" />
                  </div>
                  <span className="text-sm font-medium">
                    {language === 'ar' ? 'المخزون' : 'Inventory'}
                  </span>
                </Button>
              </Link>
            ) : null}

            <Button 
              variant="outline" 
              className="w-full h-24 flex-col gap-2 hover:bg-purple-500 hover:text-white transition-colors group"
              data-testid="quick-action-search"
            >
              <div className="h-10 w-10 rounded-full bg-purple-500/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                <Search className="h-5 w-5 text-purple-500 group-hover:text-white" />
              </div>
              <span className="text-sm font-medium">
                {language === 'ar' ? 'بحث منتج' : 'Search Product'}
              </span>
            </Button>

            {user.permissions.canViewReports ? (
              <Link href="/sales/reports">
                <Button 
                  variant="outline" 
                  className="w-full h-24 flex-col gap-2 hover:bg-green-500 hover:text-white transition-colors group"
                  data-testid="quick-action-reports"
                >
                  <div className="h-10 w-10 rounded-full bg-green-500/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                    <BarChart3 className="h-5 w-5 text-green-500 group-hover:text-white" />
                  </div>
                  <span className="text-sm font-medium">
                    {language === 'ar' ? 'التقارير' : 'Reports'}
                  </span>
                </Button>
              </Link>
            ) : null}

            {user.permissions.canViewWithdrawals === 1 || user.role === 'sales_admin' ? (
              <Link href="/sales/withdrawals">
                <Button
                  variant="outline"
                  className="w-full h-24 flex-col gap-2 hover:bg-orange-500 hover:text-white transition-colors group"
                  data-testid="quick-action-withdrawals"
                >
                  <div className="h-10 w-10 rounded-full bg-orange-500/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                    <TrendingDown className="h-5 w-5 text-orange-500 group-hover:text-white" />
                  </div>
                  <span className="text-sm font-medium">
                    {language === 'ar' ? 'السحوبات' : 'Withdrawals'}
                  </span>
                </Button>
              </Link>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Sales - all my POS orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              {language === 'ar' ? 'آخر مبيعاتي' : 'My Recent Sales'}
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1">
              <RefreshCcw className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : myAllPosOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>{language === 'ar' ? 'لا توجد مبيعات اليوم' : 'No sales today'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myAllPosOrders
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 5)
                  .map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${order.orderType === 'in-store' ? 'bg-violet-500/10' : 'bg-primary/10'}`}>
                        <Users className={`h-5 w-5 ${order.orderType === 'in-store' ? 'text-violet-500' : 'text-primary'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm">{order.customerName || (language === 'ar' ? 'زبون' : 'Customer')}</p>
                          <Badge variant="outline" className={`text-xs py-0 ${order.orderType === 'in-store' ? 'text-violet-600 border-violet-300' : 'text-green-600 border-green-300'}`}>
                            {order.orderType === 'in-store' ? (language === 'ar' ? 'متجر' : 'In-Store') : (language === 'ar' ? 'كاونتر' : 'Counter')}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {order.orderNumber} • {new Date(order.createdAt).toLocaleTimeString(language === 'ar' ? 'ar-IQ' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="font-bold text-primary">{formatPrice(parseFloat(order.total || '0'))}</p>
                      <Badge variant="outline" className="text-xs">
                        {order.paymentMethod === 'cash' ? (language === 'ar' ? 'نقداً' : 'Cash') : order.paymentMethod}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-500" />
              {language === 'ar' ? 'تنبيهات المخزون' : 'Stock Alerts'}
              {(lowStockProducts.length + outOfStockProducts.length) > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {lowStockProducts.length + outOfStockProducts.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (lowStockProducts.length + outOfStockProducts.length) === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>{language === 'ar' ? 'المخزون جيد' : 'Stock is healthy'}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {outOfStockProducts.slice(0, 3).map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-destructive/20 flex items-center justify-center">
                        <Package className="h-5 w-5 text-destructive" />
                      </div>
                      <div>
                        <p className="font-medium text-sm line-clamp-1">
                          {language === 'ar' ? product.nameAr : (product.nameEn || product.nameAr)}
                        </p>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                      </div>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {language === 'ar' ? 'نفذ' : 'Out'}
                    </Badge>
                  </div>
                ))}
                {lowStockProducts.slice(0, 3).map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-orange-500/20 flex items-center justify-center">
                        <Package className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm line-clamp-1">
                          {language === 'ar' ? product.nameAr : (product.nameEn || product.nameAr)}
                        </p>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                      </div>
                    </div>
                    <Badge className="text-xs bg-orange-500/20 text-orange-600 border-orange-300">
                      {product.stockQuantity} {language === 'ar' ? 'متبقي' : 'left'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Staff Advances (دفع من الجيب) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-emerald-600" />
            {language === 'ar' ? 'دفع من الجيب (سلف الموظفين)' : 'Staff Advances'}
            {advances.length > 0 && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-400">
                {advances.length}
              </Badge>
            )}
          </CardTitle>
          {currentShift && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-emerald-700 border-emerald-300"
              onClick={() => setShowAdvanceForm(v => !v)}
              data-testid="button-toggle-advance-form"
            >
              <Plus className="h-3.5 w-3.5" />
              {language === 'ar' ? 'إضافة' : 'Add'}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!currentShift && (
            <p className="text-sm text-muted-foreground text-center py-2">
              {language === 'ar' ? 'ابدأ وردية لإضافة سلف' : 'Start a shift to add advances'}
            </p>
          )}
          {showAdvanceForm && currentShift && (
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-900/10 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{language === 'ar' ? 'اسم الموظف' : 'Staff Name'}</Label>
                  <Input
                    value={advanceStaffName}
                    onChange={e => setAdvanceStaffName(e.target.value)}
                    placeholder={language === 'ar' ? 'الاسم' : 'Name'}
                    data-testid="input-advance-staff-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{language === 'ar' ? 'المبلغ (د.ع)' : 'Amount (IQD)'}</Label>
                  <Input
                    type="number"
                    value={advanceAmount}
                    onChange={e => setAdvanceAmount(e.target.value)}
                    placeholder="0"
                    data-testid="input-advance-amount"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{language === 'ar' ? 'السبب (اختياري)' : 'Reason (optional)'}</Label>
                <Input
                  value={advanceReason}
                  onChange={e => setAdvanceReason(e.target.value)}
                  placeholder={language === 'ar' ? 'سبب السلفة...' : 'Reason...'}
                  data-testid="input-advance-reason"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setShowAdvanceForm(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!advanceAmount || !advanceStaffName || addAdvanceMutation.isPending}
                  onClick={() => addAdvanceMutation.mutate({ amount: advanceAmount, staffName: advanceStaffName, reason: advanceReason })}
                  data-testid="button-submit-advance"
                >
                  {addAdvanceMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin me-1" /> : null}
                  {language === 'ar' ? 'حفظ' : 'Save'}
                </Button>
              </div>
            </div>
          )}
          {advancesLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : advances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              {language === 'ar' ? 'لا توجد سلف اليوم' : 'No advances today'}
            </p>
          ) : (
            <div className="space-y-2">
              {advances.map(adv => (
                <div key={adv.id} className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30" data-testid={`row-advance-${adv.id}`}>
                  <div className="flex items-center gap-2.5">
                    <HandCoins className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{adv.staffName}</p>
                      {adv.reason && <p className="text-xs text-muted-foreground">{adv.reason}</p>}
                      <p className="text-xs text-muted-foreground">
                        {new Date(adv.createdAt).toLocaleTimeString(language === 'ar' ? 'ar-IQ' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-700 text-sm">{formatPrice(parseFloat(adv.amount))} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                    {currentShift && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={deleteAdvanceMutation.isPending}
                        onClick={() => deleteAdvanceMutation.mutate(adv.id)}
                        data-testid={`button-delete-advance-${adv.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-1 border-t border-emerald-200 dark:border-emerald-900/30">
                <span className="text-sm text-muted-foreground">{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
                <span className="font-bold text-emerald-700">
                  {formatPrice(advances.reduce((s, a) => s + parseFloat(a.amount), 0))} {language === 'ar' ? 'د.ع' : 'IQD'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {language === 'ar' ? 'مبيعاتي حسب طريقة الدفع' : 'My Sales by Payment Method'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['cash', 'card', 'zaincash', 'qicard'].map((method) => {
                const methodOrders = myWalkInOrders.filter(o => o.paymentMethod === method);
                const methodTotal = methodOrders.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);
                const methodLabels: Record<string, { ar: string; en: string }> = {
                  cash: { ar: 'نقداً', en: 'Cash' },
                  card: { ar: 'بطاقة', en: 'Card' },
                  zaincash: { ar: 'زين كاش', en: 'ZainCash' },
                  qicard: { ar: 'كي كارد', en: 'QiCard' },
                };
                return (
                  <div key={method} className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-sm text-muted-foreground mb-1">
                      {language === 'ar' ? methodLabels[method].ar : methodLabels[method].en}
                    </p>
                    <p className="text-xl font-bold">{formatPrice(methodTotal)}</p>
                    <p className="text-xs text-muted-foreground">
                      {methodOrders.length} {language === 'ar' ? 'معاملة' : 'transactions'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shift Management Dialog */}
      <Dialog open={showShiftDialog} onOpenChange={setShowShiftDialog}>
        <DialogContent className="sm:max-w-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {shiftAction === 'start' ? (
                <>
                  <PlayCircle className="h-5 w-5 text-green-500" />
                  {language === 'ar' ? 'بدء وردية جديدة' : 'Start New Shift'}
                </>
              ) : (
                <>
                  <StopCircle className="h-5 w-5 text-red-500" />
                  {language === 'ar' ? 'إنهاء الوردية' : 'End Shift'}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {shiftAction === 'start' ? (
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'النقد الافتتاحي (د.ع)' : 'Opening Cash (IQD)'}</Label>
                <Input
                  type="number"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  placeholder={language === 'ar' ? 'أدخل مبلغ الصندوق' : 'Enter drawer amount'}
                  data-testid="input-opening-cash"
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'النقد الختامي (د.ع)' : 'Closing Cash (IQD)'}</Label>
                  <Input
                    type="number"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    placeholder={language === 'ar' ? 'عدّ النقد في الصندوق' : 'Count cash in drawer'}
                    data-testid="input-closing-cash"
                  />
                </div>
                {currentShift && (
                  <div className="p-3 rounded-lg bg-muted text-sm space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === 'ar' ? 'بدأت:' : 'Started:'}</span>
                      <span>{new Date(currentShift.startTime).toLocaleTimeString(language === 'ar' ? 'ar-IQ' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === 'ar' ? 'النقد الافتتاحي:' : 'Opening Cash:'}</span>
                      <span>{formatPrice(parseFloat(currentShift.openingCash || '0'))} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                    </div>
                    {activeSnapshot?.summary && (
                      <>
                        <div className="border-t border-border/60 my-1" />
                        <div className="flex justify-between font-medium">
                          <span className="text-muted-foreground">{language === 'ar' ? 'إجمالي مبيعات الوردية:' : 'Shift total sales:'}</span>
                          <span className="text-primary">{formatPrice(activeSnapshot.summary.grandTotal)} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{language === 'ar' ? 'نقداً:' : 'Cash:'}</span>
                          <span>{formatPrice(activeSnapshot.summary.grandTotalCash)} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                        </div>
                        {activeSnapshot.summary.grandTotalZain > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">ZainCash:</span>
                            <span>{formatPrice(activeSnapshot.summary.grandTotalZain)} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                          </div>
                        )}
                        {activeSnapshot.summary.grandTotalQi > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">QiCard:</span>
                            <span>{formatPrice(activeSnapshot.summary.grandTotalQi)} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                          </div>
                        )}
                        {activeSnapshot.summary.grandTotalCard > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{language === 'ar' ? 'بطاقة:' : 'Card:'}</span>
                            <span>{formatPrice(activeSnapshot.summary.grandTotalCard)} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{language === 'ar' ? 'فواتير + تذاكر:' : 'Orders + tickets:'}</span>
                          <span>{activeSnapshot.summary.inStoreCount + activeSnapshot.summary.repairCount}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
            
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</Label>
              <Textarea
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                placeholder={language === 'ar' ? 'أي ملاحظات للتسليم...' : 'Any handover notes...'}
                rows={3}
                data-testid="input-shift-notes"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowShiftDialog(false)}
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleShiftAction}
              disabled={startShiftMutation.isPending || endShiftMutation.isPending}
              className={shiftAction === 'start' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
              data-testid="button-confirm-shift"
            >
              {(startShiftMutation.isPending || endShiftMutation.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin me-2" />
              ) : null}
              {shiftAction === 'start' 
                ? (language === 'ar' ? 'بدء الوردية' : 'Start Shift')
                : (language === 'ar' ? 'إنهاء الوردية' : 'End Shift')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
