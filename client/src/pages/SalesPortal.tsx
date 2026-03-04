import { useEffect, useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
  Settings,
  Bell,
  ChevronDown,
  Languages
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SalesDashboard from "./SalesDashboard";
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
  const { language, setLanguage } = useLanguage();
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

  const navItems = [
    { 
      path: "/sales", 
      exactMatch: true,
      label: language === 'ar' ? 'لوحة التحكم' : 'Dashboard', 
      icon: LayoutDashboard,
      permission: true,
      color: 'text-primary',
    },
    { 
      path: "/sales/pos", 
      label: language === 'ar' ? 'POS عام' : 'General POS', 
      icon: ShoppingCart,
      permission: currentUser.permissions.canPos,
      color: 'text-green-500',
    },
    { 
      path: "/sales/instore-pos", 
      label: language === 'ar' ? 'مبيعات المتجر' : 'In-Store', 
      icon: Store,
      permission: currentUser.permissions.canPos,
      color: 'text-violet-500',
    },
    { 
      path: "/sales/inventory", 
      label: language === 'ar' ? 'المخزون' : 'Inventory', 
      icon: Package,
      permission: currentUser.permissions.canInventory,
      color: 'text-blue-500',
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
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive(item.path, item.exactMatch) ? "default" : "ghost"}
                    size="sm"
                    className={`gap-2 transition-all ${
                      isActive(item.path, item.exactMatch) 
                        ? 'shadow-sm' 
                        : 'hover:bg-background'
                    }`}
                    data-testid={`nav-${item.path.replace('/sales/', '') || 'dashboard'}`}
                  >
                    <item.icon className={`h-4 w-4 ${!isActive(item.path, item.exactMatch) ? item.color : ''}`} />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Button>
                </Link>
              ))}
            </nav>

            {/* User Menu & Actions */}
            <div className="flex items-center gap-2">
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
              <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 end-1 h-2 w-2 rounded-full bg-red-500" />
              </Button>

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
        {location === "/sales/pos" && <SalesPOS user={currentUser} orderType="walk-in" />}
        {location === "/sales/instore-pos" && <SalesPOS user={currentUser} orderType="in-store" />}
        {location === "/sales/inventory" && <SalesInventory user={currentUser} />}
        {location === "/sales/reports" && <SalesReports user={currentUser} />}
        {location === "/sales/users" && <SalesUsers user={currentUser} />}
      </main>
    </div>
  );
}
