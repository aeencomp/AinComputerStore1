import { useEffect, useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, 
  Package, 
  Users, 
  BarChart3, 
  LogOut, 
  Loader2,
  Menu,
  X
} from "lucide-react";
import SalesPOS from "./SalesPOS";
import SalesInventory from "./SalesInventory";
import SalesUsers from "./SalesUsers";
import SalesReports from "./SalesReports";

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
    canApplyDiscount: number;
  };
}

export default function SalesPortal() {
  const { language } = useLanguage();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: currentUser, isLoading, error } = useQuery<SalesUser>({
    queryKey: ['/api/sales/auth/me'],
    retry: false,
  });

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const navItems = [
    { 
      path: "/sales", 
      label: language === 'ar' ? 'نقطة البيع' : 'Point of Sale', 
      icon: ShoppingCart,
      permission: currentUser.permissions.canPos,
    },
    { 
      path: "/sales/inventory", 
      label: language === 'ar' ? 'المخزون' : 'Inventory', 
      icon: Package,
      permission: currentUser.permissions.canInventory,
    },
    { 
      path: "/sales/reports", 
      label: language === 'ar' ? 'التقارير' : 'Reports', 
      icon: BarChart3,
      permission: currentUser.permissions.canViewReports,
    },
    { 
      path: "/sales/users", 
      label: language === 'ar' ? 'المستخدمين' : 'Users', 
      icon: Users,
      permission: currentUser.permissions.canManageUsers,
    },
  ].filter(item => item.permission);

  const isActive = (path: string) => {
    if (path === "/sales") {
      return location === "/sales" || location === "/sales/";
    }
    return location.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-muted/30" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="button-mobile-menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-6 w-6 text-primary" />
                <span className="font-bold text-lg hidden sm:inline">
                  {language === 'ar' ? 'بوابة المبيعات' : 'Sales Portal'}
                </span>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive(item.path) ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                    data-testid={`nav-${item.path.replace('/sales/', '') || 'pos'}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground hidden sm:block">
                {currentUser.name}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="gap-2"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {language === 'ar' ? 'خروج' : 'Logout'}
                </span>
              </Button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background">
            <nav className="container mx-auto px-4 py-2 space-y-1">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive(item.path) ? "secondary" : "ghost"}
                    className="w-full justify-start gap-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="container mx-auto px-4 py-6">
        {location === "/sales" && <SalesPOS user={currentUser} />}
        {location === "/sales/inventory" && <SalesInventory user={currentUser} />}
        {location === "/sales/reports" && <SalesReports user={currentUser} />}
        {location === "/sales/users" && <SalesUsers user={currentUser} />}
      </main>
    </div>
  );
}
