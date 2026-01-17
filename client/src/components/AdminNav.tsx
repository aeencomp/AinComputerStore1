import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
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
  MessageSquare
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  const { language } = useLanguage();

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
    { href: "/admin/dashboard", icon: LayoutDashboard, labelAr: "لوحة التحكم", labelEn: "Dashboard", permission: "orders" },
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
    { href: "/admin/settings", icon: Settings, labelAr: "الإعدادات", labelEn: "Settings", permission: "settings" },
  ];

  // Filter nav items based on permissions
  const navItems = allNavItems.filter(item => hasPermission(item.permission));

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
