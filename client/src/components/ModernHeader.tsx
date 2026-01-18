import { ShoppingCart, Search, Menu, X, User, ChevronDown, Globe } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { StoreSettings, User as UserType } from "@shared/schema";
import aeenn from "@assets/aeenn.jpg";

interface ModernHeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
  onSearch: (query: string) => void;
  searchValue?: string;
}

const navLinks = [
  { href: '/', labelAr: 'الرئيسية', labelEn: 'Home' },
  { href: '/?category=laptops', labelAr: 'اللابتوبات', labelEn: 'Laptops' },
  { href: '/?category=pc_components', labelAr: 'قطع الكمبيوتر', labelEn: 'PC Components' },
  { href: '/?category=gaming_accessories', labelAr: 'ملحقات الألعاب', labelEn: 'Gaming Accessories' },
  { href: '/?category=monitors', labelAr: 'الشاشات', labelEn: 'Monitors' },
  { href: '/contact', labelAr: 'تواصل معنا', labelEn: 'Contact Us' },
];

export function ModernHeader({ cartItemsCount, onCartClick, onSearch, searchValue = "" }: ModernHeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const isRTL = language === 'ar';
  const [searchQuery, setSearchQuery] = useState(searchValue);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: storeSettings } = useQuery<StoreSettings>({
    queryKey: ['/api/store-settings'],
  });

  const { data: currentUser } = useQuery<UserType | null>({
    queryKey: ['/api/auth/me'],
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/auth/logout', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      toast({
        title: isRTL ? 'تم تسجيل الخروج' : 'Logged out',
        description: isRTL ? 'تم تسجيل خروجك بنجاح' : 'You have been logged out successfully',
      });
      navigate('/');
    },
  });

  const storeName = storeSettings 
    ? (language === 'ar' ? storeSettings.storeNameAr : storeSettings.storeNameEn)
    : t('header.title');

  const logoUrl = storeSettings?.logoUrl;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/" className="flex items-center gap-3" data-testid="link-logo-home">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={storeName} className="w-full h-full object-cover" />
              ) : (
                <img src={aeenn} alt={storeName} className="w-full h-full object-cover" />
              )}
            </div>
            <span className="font-bold text-lg hidden sm:block" data-testid="text-store-name">
              {storeName}
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button 
                  variant="ghost" 
                  className="text-white/80 hover:text-white hover:bg-white/10"
                  data-testid={`nav-link-${link.labelEn.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {isRTL ? link.labelAr : link.labelEn}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <form onSubmit={handleSearch} className="hidden md:flex items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="search"
                  placeholder={isRTL ? 'البحث...' : 'Search...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 lg:w-64 pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20"
                  data-testid="input-search"
                />
              </div>
            </form>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10">
                  <Globe className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLanguage('ar')}>
                  العربية
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('en')}>
                  English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {currentUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10">
                    <User className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate('/orders')}>
                    {isRTL ? 'طلباتي' : 'My Orders'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
                    {isRTL ? 'تسجيل الخروج' : 'Logout'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10">
                  <User className="w-5 h-5" />
                </Button>
              </Link>
            )}

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onCartClick}
              className="relative text-white/80 hover:text-white hover:bg-white/10"
              data-testid="button-cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartItemsCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center bg-blue-500 text-white text-xs">
                  {cartItemsCount}
                </Badge>
              )}
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => setMobileMenuOpen(true)}
              data-testid="button-mobile-menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side={isRTL ? "right" : "left"} className="w-80 bg-slate-900 text-white border-slate-800">
          <SheetHeader>
            <SheetTitle className="text-white">{storeName}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            <form onSubmit={handleSearch} className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="search"
                  placeholder={isRTL ? 'البحث...' : 'Search...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
            </form>
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {isRTL ? link.labelAr : link.labelEn}
                </Button>
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
