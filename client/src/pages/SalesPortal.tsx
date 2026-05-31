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
  TrendingDown,
  ArrowRightLeft,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
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
    canTransferToLoc1: number;
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

  const { data: currentUser, isLoading, isFetched, error } = useQuery<SalesUser | null>({
    queryKey: ['/api/sales/auth/me'],
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
    if (isFetched && !isLoading && (error || !currentUser)) {
      setLocation("/sales/login");
    }
  }, [isFetched, isLoading, error, currentUser, setLocation]);

  useEffect(() => {
    if (!currentUser || isLoading) return;
    if (currentUser.needsLocationPick && location !== "/sales/pick-location") {
      setLocation("/sales/pick-location");
    }
  }, [currentUser, isLoading, location, setLocation]);

  if (location === "/sales/pick-location") {
    return <SalesLocationPick />;
  }

  if (!isFetched || isLoading) {
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
        icon: ArrowRightLeft,
        permission: currentUser.permissions.canInventory === 1 || currentUser.role === 'sales_admin',
        color: 'text-amber-500',
      },
    ] : []),
    ...(canUseLoc2 ? [
      {
        path: "/sales/transfer-to-loc1",
        label: language === 'ar' ? 'نقل إلى الموقع 1' : 'Transfer to Loc 1',
        icon: ArrowRightLeft,
        permission: currentUser.permissions.canTransferToLoc1 === 1 || currentUser.role === 'sales_admin',
        color: 'text-teal-500',
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
      id: "sales",
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
      id: "inventory",
      label: language === 'ar' ? 'المخزون' : 'Inventory',
      icon: Warehouse,
      items: navItems.filter(item => [
        "/sales/inventory-loc1",
        "/sales/inventory-loc2",
        "/sales/transfer-stock",
        "/sales/transfer-to-loc1",
        "/sales/inventory",
      ].includes(item.path)),
    },
    {
      id: "reports",
      label: language === 'ar' ? 'التقارير' : 'Reports',
      icon: BarChart3,
      items: navItems.filter(item => [
        "/sales/daily-report",
        "/sales/reports",
      ].includes(item.path)),
    },
    {
      id: "admin",
      label: language === 'ar' ? 'الإدارة' : 'Admin',
      icon: Settings,
      items: navItems.filter(item => [
        "/sales/users",
      ].includes(item.path)),
    },
  ].filter(group => group.items.length > 0);

  const activeSection = (() => {
    if (dashboardItem && isActive(dashboardItem.path, dashboardItem.exactMatch)) {
      return "dashboard";
    }
    const group = navGroups.find((g) =>
      g.items.some((item) => isActive(item.path, item.exactMatch)),
    );
    return group?.id ?? "dashboard";
  })();

  const activeGroup = navGroups.find((g) => g.id === activeSection);

  const handleSectionChange = (section: string) => {
    if (section === "dashboard") {
      setLocation("/sales");
      return;
    }
    const group = navGroups.find((g) => g.id === section);
    if (!group?.items.length) return;
    const alreadyHere = group.items.some((item) => isActive(item.path, item.exactMatch));
    if (!alreadyHere) {
      setLocation(group.items[0].path);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Enhanced Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-sm">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between gap-2 h-12">
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
                  <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm shrink-0">
                    <Store className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="hidden sm:block min-w-0">
                    <h1 className="font-bold text-sm sm:text-base leading-tight truncate">
                      {language === 'ar' ? 'بوابة المبيعات' : 'Sales Portal'}
                    </h1>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      {language === 'ar' ? 'العين لتجارة الحاسبات' : 'Al-Ain Computers'}
                    </p>
                  </div>
                </div>
              </Link>
            </div>

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

          {/* Desktop: main section tabs + page sub-tabs */}
          <div className="hidden md:block border-t border-border/50 pb-2 pt-1.5">
            <Tabs value={activeSection} onValueChange={handleSectionChange}>
              <TabsList className="h-9 w-full justify-start overflow-x-auto bg-muted/40 p-1 gap-0.5">
                <TabsTrigger
                  value="dashboard"
                  className="h-7 px-3 text-xs sm:text-sm gap-1.5 data-[state=active]:shadow-sm"
                  data-testid="nav-dashboard"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  {dashboardItem?.label}
                </TabsTrigger>
                {navGroups.map((group) => (
                  <TabsTrigger
                    key={group.id}
                    value={group.id}
                    className="h-7 px-3 text-xs sm:text-sm gap-1.5 data-[state=active]:shadow-sm"
                    data-testid={`nav-group-${group.id}`}
                  >
                    <group.icon className="h-3.5 w-3.5" />
                    {group.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {activeGroup && activeGroup.items.length > 0 && (
              <nav className="flex items-center gap-1 mt-1.5 overflow-x-auto">
                {activeGroup.items.map((item) => (
                  <Link key={item.path} href={item.path}>
                    <Button
                      variant={isActive(item.path, item.exactMatch) ? "secondary" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-8 shrink-0 text-xs gap-1.5 px-2.5",
                        isActive(item.path, item.exactMatch) && "font-semibold",
                      )}
                    >
                      <item.icon className={cn("h-3.5 w-3.5", !isActive(item.path, item.exactMatch) && item.color)} />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </Button>
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background animate-in slide-in-from-top-2 max-h-[70vh] overflow-y-auto">
            <nav className="container mx-auto px-3 py-2 space-y-3">
              {dashboardItem && (
                <Link href={dashboardItem.path}>
                  <Button
                    variant={isActive(dashboardItem.path, dashboardItem.exactMatch) ? "secondary" : "ghost"}
                    className="w-full justify-start gap-2 h-9 text-sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <dashboardItem.icon className={`h-4 w-4 ${dashboardItem.color}`} />
                    {dashboardItem.label}
                  </Button>
                </Link>
              )}
              {navGroups.map((group) => (
                <div key={group.id} className="space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground px-2 uppercase tracking-wide">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <Link key={item.path} href={item.path}>
                      <Button
                        variant={isActive(item.path, item.exactMatch) ? "secondary" : "ghost"}
                        className="w-full justify-start gap-2 h-9 text-sm"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <item.icon className={`h-4 w-4 ${item.color}`} />
                        {item.label}
                      </Button>
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-5">
        <div className="flex items-center gap-2 mb-4">
          <currentPage.icon className={cn("h-5 w-5", currentPage.color)} />
          <h2 className="text-lg font-semibold">{currentPage.label}</h2>
        </div>

        {/* Render Active Page */}
        {(location === "/sales" || location === "/sales/") && <SalesDashboard user={currentUser} />}
        {location === "/sales/pos" && <SalesPOS user={currentUser} orderType="walk-in" salesLocationId={1} />}
        {location === "/sales/instore-pos" && (
          <SalesPOS user={currentUser} orderType="in-store" salesLocationId={1} />
        )}
        {location === "/sales/pos-loc2" && (
          <SalesPOS user={currentUser} orderType="in-store" salesLocationId={2} />
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
        {location === "/sales/transfer-stock" && (
          <SalesTransferStock direction="1-to-2" user={currentUser} />
        )}
        {location === "/sales/transfer-to-loc1" && (
          <SalesTransferStock direction="2-to-1" user={currentUser} />
        )}
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
