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
  Clock
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AdminNavProps {
  currentAdmin: { id: string; username: string; name: string; role: string } | null;
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

  const navItems = [
    { href: "/admin/dashboard", icon: LayoutDashboard, labelAr: "لوحة التحكم", labelEn: "Dashboard" },
    { href: "/admin/pos", icon: ShoppingCart, labelAr: "نقطة البيع", labelEn: "POS" },
    { href: "/admin/sales", icon: BarChart3, labelAr: "المبيعات", labelEn: "Sales" },
    { href: "/admin/products", icon: Package, labelAr: "المنتجات", labelEn: "Products" },
    { href: "/admin/inventory", icon: Warehouse, labelAr: "المخزون", labelEn: "Inventory" },
    { href: "/admin/customers", icon: Users, labelAr: "العملاء", labelEn: "Customers" },
    { href: "/admin/attendance", icon: Clock, labelAr: "الحضور", labelEn: "Attendance" },
    { href: "/admin/market-prices", icon: TrendingUp, labelAr: "أسعار السوق", labelEn: "Market Prices" },
    { href: "/admin/programs", icon: GraduationCap, labelAr: "البرامج", labelEn: "Programs" },
    { href: "/admin/settings", icon: Settings, labelAr: "الإعدادات", labelEn: "Settings" },
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
