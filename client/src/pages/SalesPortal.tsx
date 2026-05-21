import { useEffect, useState, useMemo, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";
import { IntercomWidget } from "@/components/IntercomWidget";
import { 
  ShoppingCart, 
  Package, 
  Users, 
  BarChart3, 
  LogOut, 
  Loader2,
  Menu,
  X,
  LayoutDashboard,
  Store,
  Warehouse,
  Settings,
  Bell,
  ChevronDown,
  Languages,
  FileText,
  TrendingDown
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShoppingBag, CheckCheck, Trash2 } from "lucide-react";
import SalesDashboard from "./SalesDashboard";
import SalesPOS from "./SalesPOS";
import SalesInventory from "./SalesInventory";
import SalesInStoreInventory from "./SalesInStoreInventory";
import SalesLocationPick from "./SalesLocationPick";
import SalesTransferStock from "./SalesTransferStock";
import SalesWithdrawals from "./SalesWithdrawals";
import SalesUsers from "./SalesUsers";
import SalesReports from "./SalesReports";
import DailyReport from "./DailyReport";

interface SalesUser {
  id: string;
  username: string;
  name: string;
  role: string;
  activeSalesLocationId?: number | null;
  needsLocationPick?: boolean;
  allowedLocations?: { id: number; code: string; nameAr: string; nameEn?: string | null }[];
  permissions: {
    canPos: number;
    canInventory: number;
    canInventoryLocation2: number;
    canManageUsers: number;
    canViewReports: number;
    canViewWithdrawals: number;
    canApplyDiscount: number;
    canEditReceipt?: number;
  };
}

export default function SalesPortal() {
  const { language, setLanguage } = useLanguage();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [seenOrderIds, setSeenOrderIds] = useState<Set<string>>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem('sales_seen_orders') || '[]')); }
    catch { return new Set<string>(); }
  });

  const { data: currentUser, isLoading, error } = useQuery<SalesUser>({
    queryKey: ['/api/sales/auth/me'],
    retry: false,
  });

  const { notifications: wsNotifications } = useAdminNotifications('/ws/sales');
  const lastNotifTimestampRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUser || wsNotifications.length === 0) return;
    const latest = wsNotifications[0];
    if (!latest || latest.timestamp === lastNotifTimestampRef.current) return;
    lastNotifTimestampRef.current = latest.timestamp;

    queryClient.invalidateQueries({ queryKey: ['/api/orders'] });

    toast({
      title: language === 'ar' ? 'طلب جديد!' : 'New Order!',
      description: language === 'ar'
        ? `رقم ${latest.data.orderNumber} — ${latest.data.customerName}`
        : `#${latest.data.orderNumber} — ${latest.data.customerName}`,
      duration: 6000,
    });
  }, [wsNotifications, currentUser, queryClient, toast, language]);

  const { data: recentOrders = [] } = useQuery<any[]>({
    queryKey: ['/api/orders'],
    enabled: !!currentUser,
    refetchInterval: 30000,
    select: (data) => data
      .filter((o: any) => !o.orderType || o.orderType === 'online')
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20),
  });

  const unreadOrderCount = recentOrders.filter((o: any) => !seenOrderIds.has(o.id)).length;

  const markAllOrdersSeen = () => {
    const allIds = recentOrders.map((o: any) => o.id);
    const next = new Set<string>(Array.from(seenOrderIds).concat(allIds));
    setSeenOrderIds(next);
    localStorage.setItem('sales_seen_orders', JSON.stringify(Array.from(next)));
  };

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/sales/auth/logout', {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/auth/me'] });
      setLocation("/sales/login");
    },
  });

  useEffect(() => {
    if (!isLoading && (error || !currentUser)) {
      setLocation("/sales/login");
    }
  }, [isLoading, error, currentUser, setLocation]);

  useEffect(() => {
    if (!currentUser || isLoading) return;
    if (currentUser.needsLocationPick && location !== "/sales/pick-location") {
      setLocation("/sales/pick-location");
    }
  }, [currentUser, isLoading, location, setLocation]);

  if (location === "/sales/pick-location") {
    return <SalesLocationPick />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">
            {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const activeLoc = currentUser.activeSalesLocationId ?? 1;
  const allowedLocationIds = currentUser.allowedLocations?.map((loc) => loc.id) ?? [activeLoc];
  const canUseLoc1 = allowedLocationIds.includes(1) || currentUser.role === 'sales_admin';
  const canUseLoc2 =
    allowedLocationIds.includes(2) ||
    currentUser.permissions.canInventoryLocation2 === 1 ||
    currentUser.role === 'sales_admin';

  const navItems = [
    { 
      path: "/sales", 
      exactMatch: true,
      label: language === 'ar' ? 'لوحة التحكم' : 'Dashboard', 
      icon: LayoutDashboard,
      permission: true,
      color: 'text-primary',
    },
    ...(canUseLoc1 ? [{
      path: "/sales/pos",
      label: language === 'ar' ? 'POS عام' : 'General POS',
      icon: ShoppingCart,
      permission: currentUser.permissions.canPos,
      color: 'text-green-500',
    }] : []),
    ...(canUseLoc1 ? [{
      path: "/sales/instore-pos",
      label: language === 'ar' ? 'POS الموقع 1' : 'POS Location 1',
      icon: Store,
      permission: currentUser.permissions.canPos,
      color: 'text-violet-500',
    }] : []),
    ...(canUseLoc2 ? [{
      path: "/sales/pos-loc2",
      label: language === 'ar' ? 'POS الموقع 2' : 'POS Location 2',
      icon: Store,
      permission: currentUser.permissions.canPos,
      color: 'text-violet-500',
    }] : []),
    ...(canUseLoc1 ? [
      {
        path: "/sales/inventory-loc1",
        label: language === 'ar' ? 'مخزون الموقع 1' : 'Inventory Loc 1',
        icon: Warehouse,
        permission: currentUser.permissions.canInventory,
        color: 'text-violet-400',
      },
    ] : []),
    ...(canUseLoc2 ? [{
      path: "/sales/inventory-loc2",
      label: language === 'ar' ? 'مخزون الموقع 2' : 'Inventory Loc 2',
      icon: Warehouse,
      permission: currentUser.permissions.canInventoryLocation2 || currentUser.role === 'sales_admin',
      color: 'text-violet-400',
    }] : []),
    ...(canUseLoc1 ? [
      {
        path: "/sales/transfer-stock",
        label: language === 'ar' ? 'نقل إلى الموقع 2' : 'Transfer to Loc 2',
        icon: Package,
        permission: currentUser.permissions.canInventory || currentUser.role === 'sales_admin',
        color: 'text-amber-500',
      },
    ] : []),
    {
      path: "/sales/instore-inventory",
      label: language === 'ar' ? 'مخزون المتجر (قديم)' : 'Store Inventory (legacy)',
      icon: Warehouse,
      permission: false,
      color: 'text-violet-400',
    },
    { 
      path: "/sales/withdrawals", 
      label: language === 'ar' ? 'السحوبات اليومية' : 'Withdrawals', 
      icon: TrendingDown,
      permission:
        currentUser.permissions.canViewWithdrawals === 1 ||
        currentUser.role === 'sales_admin',
      color: 'text-orange-500',
    },
    { 
      path: "/sales/inventory", 
      label: language === 'ar' ? 'المخزون' : 'Inventory', 
      icon: Package,
      permission: currentUser.permissions.canInventory,
      color: 'text-blue-500',
    },
    { 
      path: "/sales/daily-report", 
      label: language === 'ar' ? 'التقرير اليومي' : 'Daily Report', 
      icon: FileText,
      permission: currentUser.permissions.canViewReports,
      color: 'text-emerald-500',
    },
    { 
      path: "/sales/reports", 
      label: language === 'ar' ? 'التقارير' : 'Reports', 
      icon: BarChart3,
      permission: currentUser.permissions.canViewReports,
      color: 'text-purple-500',
    },
    { 
      path: "/sales/users", 
      label: language === 'ar' ? 'المستخدمين' : 'Users', 
      icon: Users,
      permission: currentUser.permissions.canManageUsers,
      color: 'text-orange-500',
    },
  ].filter(item => item.permission);

  const isActive = (path: string, exactMatch?: boolean) => {
    if (exactMatch) {
      return location === path || location === path + '/';
    }
    return location === path || location.startsWith(path + '/');
  };

  const currentPage = navItems.find(item => isActive(item.path, item.exactMatch)) || navItems[0];
  const dashboardItem = navItems.find(item => item.path === "/sales");
  const navGroups = [
    {
      label: language === 'ar' ? 'المبيعات' : 'Sales',
      icon: ShoppingCart,
      items: navItems.filter(item => [
        "/sales/pos",
        "/sales/instore-pos",
        "/sales/pos-loc2",
        "/sales/withdrawals",
      ].includes(item.path)),
    },
    {
      label: language === 'ar' ? 'المخزون' : 'Inventory',
      icon: Warehouse,
      items: navItems.filter(item => [
        "/sales/inventory-loc1",
        "/sales/inventory-loc2",
        "/sales/transfer-stock",
        "/sales/inventory",
      ].includes(item.path)),
    },
    {
      label: language === 'ar' ? 'التقارير' : 'Reports',
      icon: BarChart3,
      items: navItems.filter(item => [
        "/sales/daily-report",
        "/sales/reports",
      ].includes(item.path)),
    },
    {
      label: language === 'ar' ? 'الإدارة' : 'Admin',
      icon: Settings,
      items: navItems.filter(item => [
        "/sales/users",
      ].includes(item.path)),
    },
  ].filter(group => group.items.length > 0);

  return (
    <div className="min-h-screen bg-muted/30" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Enhanced Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Mobile Menu */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="button-mobile-menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <Link href="/sales">
                <div className="flex items-center gap-3 cursor-pointer group">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                    <Store className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="hidden sm:block">
                    <h1 className="font-bold text-lg leading-tight">
                      {language === 'ar' ? 'بوابة المبيعات' : 'Sales Portal'}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar' ? 'العين لتجارة الحاسبات' : 'Al-Ain Computers'}
                    </p>
                  </div>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              {dashboardItem && (
                <Link href={dashboardItem.path}>
                  <Button
                    variant={isActive(dashboardItem.path, dashboardItem.exactMatch) ? "default" : "ghost"}
                    size="sm"
                    className={`gap-2 transition-all ${
                      isActive(dashboardItem.path, dashboardItem.exactMatch)
                        ? 'shadow-sm' 
                        : 'hover:bg-background'
                    }`}
                    data-testid="nav-dashboard"
                  >
                    <dashboardItem.icon className={`h-4 w-4 ${!isActive(dashboardItem.path, dashboardItem.exactMatch) ? dashboardItem.color : ''}`} />
                    <span className="hidden lg:inline">{dashboardItem.label}</span>
                  </Button>
                </Link>
              )}
              {navGroups.map((group) => {
                const groupActive = group.items.some(item => isActive(item.path, item.exactMatch));
                return (
                  <DropdownMenu key={group.label}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={groupActive ? "default" : "ghost"}
                        size="sm"
                        className={`gap-2 transition-all ${groupActive ? 'shadow-sm' : 'hover:bg-background'}`}
                        data-testid={`nav-group-${group.label}`}
                      >
                        <group.icon className="h-4 w-4" />
                        <span className="hidden lg:inline">{group.label}</span>
                        <ChevronDown className="h-3 w-3 opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={language === 'ar' ? 'end' : 'start'} className="w-56">
                      {group.items.map((item) => (
                        <DropdownMenuItem
                          key={item.path}
                          className="gap-2 cursor-pointer"
                          onSelect={() => setLocation(item.path)}
                        >
                          <item.icon className={`h-4 w-4 ${item.color}`} />
                          <span>{item.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
            </nav>

            {/* User Menu & Actions */}
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <ThemeToggle />
              {/* Language Switcher */}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                className="gap-1"
                data-testid="button-language-switch"
              >
                <Languages className="h-4 w-4" />
                <span className="hidden sm:inline">{language === 'ar' ? 'EN' : 'عربي'}</span>
              </Button>
              
              {/* Notifications */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                    <Bell className="h-5 w-5" />
                    {unreadOrderCount > 0 && (
                      <span className="absolute top-1 end-1 h-2 w-2 rounded-full bg-red-500" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <div className="flex items-center justify-between p-3 border-b">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      <span className="font-semibold text-sm">
                        {language === 'ar' ? 'الطلبات الجديدة' : 'New Orders'}
                      </span>
                      {unreadOrderCount > 0 && (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0">
                          {unreadOrderCount}
                        </Badge>
                      )}
                    </div>
                    {recentOrders.length > 0 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={markAllOrdersSeen} title={language === 'ar' ? 'تعيين الكل كمقروء' : 'Mark all read'}>
                        <CheckCheck className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {recentOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                        <Bell className="h-8 w-8 opacity-30" />
                        <p className="text-sm">
                          {language === 'ar' ? 'لا توجد طلبات جديدة' : 'No new orders'}
                        </p>
                      </div>
                    ) : (
                      recentOrders.map((order: any) => {
                        const isNew = !seenOrderIds.has(order.id);
                        return (
                          <div
                            key={order.id}
                            className={`flex gap-3 p-3 border-b last:border-0 ${isNew ? 'bg-primary/5' : ''}`}
                          >
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                              <ShoppingBag className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">
                                {language === 'ar' ? 'طلب' : 'Order'} #{order.orderNumber}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{order.customerName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs font-semibold text-primary">
                                  {new Intl.NumberFormat('ar-IQ').format(parseFloat(order.total || '0'))} IQD
                                </p>
                                <Badge variant={order.status === 'pending' ? 'destructive' : 'secondary'} className="text-xs py-0 px-1.5">
                                  {order.status === 'pending'
                                    ? (language === 'ar' ? 'جديد' : 'New')
                                    : (language === 'ar' ? 'معالج' : 'Processed')}
                                </Badge>
                              </div>
                            </div>
                            {isNew && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2" data-testid="button-user-menu">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border">
                      <span className="text-sm font-bold text-primary">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="hidden sm:block text-start">
                      <p className="text-sm font-medium leading-tight">{currentUser.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {currentUser.role === 'admin' 
                          ? (language === 'ar' ? 'مدير' : 'Admin')
                          : (language === 'ar' ? 'موظف' : 'Staff')
                        }
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{currentUser.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">@{currentUser.username}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2">
                    <Settings className="h-4 w-4" />
                    {language === 'ar' ? 'الإعدادات' : 'Settings'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="gap-2 text-destructive focus:text-destructive"
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                  >
                    <LogOut className="h-4 w-4" />
                    {language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background animate-in slide-in-from-top-2">
            <nav className="container mx-auto px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive(item.path, item.exactMatch) ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      isActive(item.path, item.exactMatch) ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <item.icon className={`h-4 w-4 ${item.color}`} />
                    </div>
                    <span>{item.label}</span>
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/sales">
            <span className="hover:text-primary transition-colors cursor-pointer">
              {language === 'ar' ? 'بوابة المبيعات' : 'Sales Portal'}
            </span>
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium flex items-center gap-1.5">
            <currentPage.icon className={`h-4 w-4 ${currentPage.color}`} />
            {currentPage.label}
          </span>
        </div>

        {/* Render Active Page */}
        {(location === "/sales" || location === "/sales/") && <SalesDashboard user={currentUser} />}
        {location === "/sales/pos" && <SalesPOS user={currentUser} orderType="walk-in" salesLocationId={1} />}
        {location === "/sales/instore-pos" && (
          <SalesPOS user={currentUser} orderType="in-store" salesLocationId={1} />
        )}
        {location === "/sales/pos-loc2" && (
          <SalesPOS
            user={currentUser}
            orderType="in-store"
            salesLocationId={2}
            productSources={['laptop', 'desktop', 'instore']}
          />
        )}
        {location === "/sales/inventory-loc1" && (
          <SalesInStoreInventory user={currentUser} salesLocationId={1} />
        )}
        {location === "/sales/inventory-loc2" && (
          <SalesInStoreInventory
            user={currentUser}
            salesLocationId={2}
            readOnly={!(currentUser.permissions.canInventoryLocation2 || currentUser.role === 'sales_admin')}
          />
        )}
        {location === "/sales/transfer-stock" && <SalesTransferStock />}
        {location === "/sales/instore-inventory" && (
          <SalesInStoreInventory user={currentUser} salesLocationId={1} />
        )}
        {location === "/sales/withdrawals" && <SalesWithdrawals user={currentUser} />}
        {location === "/sales/inventory" && <SalesInventory user={currentUser} />}
        {location === "/sales/daily-report" && (
          <DailyReport user={currentUser} salesLocationId={activeLoc} />
        )}
        {location === "/sales/reports" && (
          <SalesReports user={currentUser} salesLocationId={activeLoc} />
        )}
        {location === "/sales/users" && <SalesUsers user={currentUser} />}
      </main>
      <IntercomWidget portal="sales" />
    </div>
  );
}
