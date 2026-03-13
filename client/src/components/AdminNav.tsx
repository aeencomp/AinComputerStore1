import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Settings, 
  TrendingUp, 
  Warehouse,
  GraduationCap,
  LogOut,
  Loader2,
  ShoppingCart,
  BarChart3,
  Clock,
  Battery,
  Store,
  ExternalLink,
  Tag,
  MessageSquare,
  Languages,
  Activity,
  Bell,
  CheckCheck,
  ShoppingBag,
  Trash2,
  MessageCircle
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";

interface AdminNavProps {
  currentAdmin: { 
    id: string; 
    username: string; 
    name: string; 
    role: string;
    canOrders?: number;
    canProducts?: number;
    canCategories?: number;
    canSettings?: number;
    canUsers?: number;
    canReports?: number;
    canPOS?: number;
    canInventory?: number;
    canCustomers?: number;
    canDiscounts?: number;
  } | null;
}

export function AdminNav({ currentAdmin }: AdminNavProps) {
  const [location, setLocation] = useLocation();
  const { language, setLanguage } = useLanguage();
  const { notifications, unreadCount, markAllAsRead, clearNotifications } = useAdminNotifications();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/auth/logout');
    },
    onSuccess: () => {
      localStorage.removeItem("adminAuth");
      queryClient.clear();
      setLocation("/admin/login");
    },
  });

  // Check if user has a specific permission (admins have all permissions)
  const hasPermission = (permission: string): boolean => {
    if (!currentAdmin) return false;
    if (currentAdmin.role === 'admin') return true;
    
    const permissionMap: Record<string, number | undefined> = {
      orders: currentAdmin.canOrders,
      products: currentAdmin.canProducts,
      categories: currentAdmin.canCategories,
      settings: currentAdmin.canSettings,
      users: currentAdmin.canUsers,
      reports: currentAdmin.canReports,
      pos: currentAdmin.canPOS,
      inventory: currentAdmin.canInventory,
      customers: currentAdmin.canCustomers,
      discounts: currentAdmin.canDiscounts,
    };
    
    return permissionMap[permission] === 1;
  };

  const allNavItems = [
    { href: "/admin/dashboard", icon: LayoutDashboard, labelAr: "لوحة التحكم", labelEn: "Dashboard", permission: "orders", hideForEditor: true },
    { href: "/admin/pos", icon: ShoppingCart, labelAr: "نقطة البيع", labelEn: "POS", permission: "pos" },
    { href: "/admin/sales", icon: BarChart3, labelAr: "المبيعات", labelEn: "Sales", permission: "reports" },
    { href: "/admin/products", icon: Package, labelAr: "المنتجات", labelEn: "Products", permission: "products" },
    { href: "/admin/inventory", icon: Warehouse, labelAr: "المخزون", labelEn: "Inventory", permission: "inventory" },
    { href: "/admin/customers", icon: Users, labelAr: "العملاء", labelEn: "Customers", permission: "customers" },
    { href: "/admin/attendance", icon: Clock, labelAr: "الحضور", labelEn: "Attendance", permission: "settings" },
    { href: "/admin/market-prices", icon: TrendingUp, labelAr: "أسعار السوق", labelEn: "Market Prices", permission: "products" },
    { href: "/admin/programs", icon: GraduationCap, labelAr: "البرامج", labelEn: "Programs", permission: "products" },
    { href: "/admin/discount-codes", icon: Tag, labelAr: "أكواد الخصم", labelEn: "Discount Codes", permission: "discounts" },
    { href: "/admin/reviews", icon: MessageSquare, labelAr: "التقييمات", labelEn: "Reviews", permission: "products" },
    { href: "/admin/analytics", icon: Activity, labelAr: "تحليلات الزوار", labelEn: "Analytics", permission: "reports" },
    { href: "/admin/whatsapp", icon: MessageCircle, labelAr: "تسويق واتساب", labelEn: "WhatsApp", permission: "settings" },
    { href: "/admin/platform", icon: Store, labelAr: "المتاجر", labelEn: "Shops", permission: "settings" },
    { href: "/admin/recycle-bin", icon: Trash2, labelAr: "سلة المحذوفات", labelEn: "Recycle Bin", permission: "orders" },
    { href: "/admin/settings", icon: Settings, labelAr: "الإعدادات", labelEn: "Settings", permission: "settings" },
  ];

  // Filter nav items based on permissions and role
  const navItems = allNavItems.filter(item => {
    // Hide items marked as hideForEditor for editor users
    if (item.hideForEditor && currentAdmin?.role === 'editor') {
      return false;
    }
    return hasPermission(item.permission);
  });

  const externalSections = [
    { href: "/battery", icon: Battery, labelAr: "البطاريات", labelEn: "Battery", color: "text-green-600" },
    { href: "/sales", icon: Store, labelAr: "بوابة المبيعات", labelEn: "Sales Portal", color: "text-blue-600" },
  ];

  return (
    <header className="border-b bg-card" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <nav className="flex items-center gap-1 flex-wrap">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <Button 
                    variant={isActive ? "secondary" : "ghost"} 
                    size="sm"
                    className="gap-1"
                    data-testid={`nav-${item.href.split('/').pop()}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden md:inline">
                      {language === 'ar' ? item.labelAr : item.labelEn}
                    </span>
                  </Button>
                </Link>
              );
            })}
            
            {/* Separator and External Sections */}
            <Separator orientation="vertical" className="h-6 mx-2 hidden md:block" />
            
            {externalSections.map((section) => {
              const Icon = section.icon;
              return (
                <Link key={section.href} href={section.href}>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className={`gap-1 ${section.color}`}
                    data-testid={`nav-external-${section.href.split('/').pop()}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden md:inline">
                      {language === 'ar' ? section.labelAr : section.labelEn}
                    </span>
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </Button>
                </Link>
              );
            })}
          </nav>
          
          <div className="flex items-center gap-2">
            {currentAdmin && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {currentAdmin.name}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              data-testid="button-language-switch"
              className="gap-1"
            >
              <Languages className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'ar' ? 'EN' : 'عربي'}</span>
            </Button>

            <ThemeToggle />

            {/* Notification Bell */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 end-1 h-2 w-2 rounded-full bg-red-500" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <div className="flex items-center justify-between p-3 border-b">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    <span className="font-semibold text-sm">
                      {language === 'ar' ? 'الإشعارات' : 'Notifications'}
                    </span>
                    {unreadCount > 0 && (
                      <Badge variant="destructive" className="text-xs px-1.5 py-0">
                        {unreadCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {notifications.length > 0 && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={markAllAsRead} title={language === 'ar' ? 'تعيين الكل كمقروء' : 'Mark all read'}>
                          <CheckCheck className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearNotifications} title={language === 'ar' ? 'مسح الكل' : 'Clear all'}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                      <Bell className="w-8 h-8 opacity-30" />
                      <p className="text-sm">
                        {language === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}
                      </p>
                    </div>
                  ) : (
                    notifications.map((notif, i) => (
                      <div
                        key={notif.timestamp}
                        className={`flex gap-3 p-3 border-b last:border-0 transition-colors ${!notif.read ? 'bg-primary/5' : ''}`}
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <ShoppingBag className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {language === 'ar' ? 'طلب جديد' : 'New Order'} #{notif.data.orderNumber}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{notif.data.customerName}</p>
                          <p className="text-xs font-semibold text-primary mt-0.5">
                            {new Intl.NumberFormat('ar-IQ').format(parseFloat(notif.data.total))} IQD
                          </p>
                        </div>
                        {!notif.read && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              {logoutMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span className="hidden sm:inline ms-1">
                {language === 'ar' ? 'خروج' : 'Logout'}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
