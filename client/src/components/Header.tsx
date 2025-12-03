import { ShoppingCart, Search, Menu, Languages, Cpu, LogOut, User as UserIcon, Package, MapPin, Home, Laptop, Monitor, Keyboard, Computer } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { StoreSettings, User } from "@shared/schema";

interface HeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
  onSearch: (query: string) => void;
  onCategorySelect?: (category: string) => void;
  searchValue?: string;
}

export function Header({ cartItemsCount, onCartClick, onSearch, onCategorySelect, searchValue = "" }: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState(searchValue);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    setSearchQuery(searchValue);
  }, [searchValue]);

  const { data: storeSettings } = useQuery<StoreSettings>({
    queryKey: ['/api/store-settings'],
  });

  const { data: currentUser } = useQuery<User | null>({
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
        title: t('header.logout'),
        description: 'تم تسجيل خروجك بنجاح',
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
    setMobileSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-background border-b">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={storeName} 
                className="h-12 max-w-[180px] object-contain"
                data-testid="logo-image"
              />
            ) : (
              <div className="flex items-center justify-center border-2 border-border rounded-md h-14 px-4 min-w-[120px]" data-testid="logo-placeholder">
                <span className="text-sm font-bold text-muted-foreground text-center">{storeName}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden md:flex mt-4 gap-2">
            <Input
              type="search"
              placeholder={t('header.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 h-12 px-5 rounded-xl border-2 border-muted-foreground/20 bg-muted/40 focus:border-primary focus:bg-background transition-all shadow-md placeholder:text-muted-foreground/60 text-base"
              data-testid="input-search"
            />
            <Button
              type="submit"
              className="h-12 px-6 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg shadow-primary/25 font-bold gap-2"
              data-testid="button-search"
            >
              <Search className="h-5 w-5" />
              {t('header.search')}
            </Button>
          </form>

          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              data-testid="button-language-toggle"
            >
              <Languages className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="md:hidden"
              onClick={() => setMobileSearchOpen(true)}
              data-testid="button-mobile-search"
            >
              <Search className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="relative"
              onClick={onCartClick}
              data-testid="button-cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemsCount > 0 && (
                <Badge 
                  className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 px-1.5 text-xs"
                  data-testid="badge-cart-count"
                >
                  {cartItemsCount}
                </Badge>
              )}
            </Button>

            {currentUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    size="icon" 
                    variant="ghost"
                    data-testid="button-user-menu"
                  >
                    <UserIcon className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel data-testid="text-user-name">
                    {currentUser.name}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <Link href="/my-orders">
                    <DropdownMenuItem data-testid="link-my-orders">
                      <Package className="h-4 w-4 mr-2" />
                      {t('dashboard.myOrders')}
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem 
                    onClick={() => logoutMutation.mutate()}
                    data-testid="button-logout"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {t('header.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button 
                  size="sm" 
                  variant="default"
                  data-testid="button-login"
                >
                  {t('header.login')}
                </Button>
              </Link>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <nav className="hidden md:flex items-center justify-center gap-1 py-2 border-t bg-muted/30">
          <Button 
            variant="ghost" 
            onClick={() => { onSearch(""); }} 
            className="gap-2 px-4 py-2 rounded-full hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors font-bold"
            data-testid="link-home"
          >
            <Home className="h-4 w-4" />
            {t('header.home')}
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => onCategorySelect?.("laptops")} 
            className="gap-2 px-4 py-2 rounded-full hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/30 dark:hover:text-purple-400 transition-colors font-bold"
            data-testid="link-computers"
          >
            <Laptop className="h-4 w-4" />
            {t('category.laptops')}
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => onCategorySelect?.("accessories")} 
            className="gap-2 px-4 py-2 rounded-full hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 transition-colors font-bold"
            data-testid="link-accessories"
          >
            <Keyboard className="h-4 w-4" />
            {t('category.accessories')}
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => onCategorySelect?.("monitors")} 
            className="gap-2 px-4 py-2 rounded-full hover:bg-teal-100 hover:text-teal-700 dark:hover:bg-teal-900/30 dark:hover:text-teal-400 transition-colors font-bold"
            data-testid="link-monitors"
          >
            <Monitor className="h-4 w-4" />
            {t('category.monitors')}
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => onCategorySelect?.("desktops")} 
            className="gap-2 px-4 py-2 rounded-full hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-900/30 dark:hover:text-rose-400 transition-colors font-bold"
            data-testid="link-desktops"
          >
            <Computer className="h-4 w-4" />
            {t('category.desktops')}
          </Button>
          <Link href="/pc-builder">
            <Button 
              variant="ghost" 
              className="gap-2 px-4 py-2 rounded-full hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 transition-colors font-bold"
              data-testid="link-pc-builder"
            >
              <Cpu className="h-4 w-4" />
              {t('header.pcBuilder')}
            </Button>
          </Link>
          <Link href="/track-order">
            <Button 
              variant="ghost" 
              className="gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 transition-colors font-bold border border-emerald-200 dark:border-emerald-800"
              data-testid="link-track-order"
            >
              <MapPin className="h-4 w-4" />
              {t('header.trackOrder')}
            </Button>
          </Link>
        </nav>

        {mobileMenuOpen && (
          <nav className="md:hidden flex flex-col gap-1 py-3 border-t bg-muted/30 px-2">
            <Button 
              variant="ghost" 
              className="justify-start gap-3 rounded-lg hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 font-bold" 
              onClick={() => { onSearch(""); setMobileMenuOpen(false); }} 
              data-testid="link-home-mobile"
            >
              <Home className="h-4 w-4" />
              {t('header.home')}
            </Button>
            <Button 
              variant="ghost" 
              className="justify-start gap-3 rounded-lg hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/30 dark:hover:text-purple-400 font-bold" 
              onClick={() => { onCategorySelect?.("laptops"); setMobileMenuOpen(false); }} 
              data-testid="link-computers-mobile"
            >
              <Laptop className="h-4 w-4" />
              {t('category.laptops')}
            </Button>
            <Button 
              variant="ghost" 
              className="justify-start gap-3 rounded-lg hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 font-bold" 
              onClick={() => { onCategorySelect?.("accessories"); setMobileMenuOpen(false); }} 
              data-testid="link-accessories-mobile"
            >
              <Keyboard className="h-4 w-4" />
              {t('category.accessories')}
            </Button>
            <Button 
              variant="ghost" 
              className="justify-start gap-3 rounded-lg hover:bg-teal-100 hover:text-teal-700 dark:hover:bg-teal-900/30 dark:hover:text-teal-400 font-bold" 
              onClick={() => { onCategorySelect?.("monitors"); setMobileMenuOpen(false); }} 
              data-testid="link-monitors-mobile"
            >
              <Monitor className="h-4 w-4" />
              {t('category.monitors')}
            </Button>
            <Button 
              variant="ghost" 
              className="justify-start gap-3 rounded-lg hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-900/30 dark:hover:text-rose-400 font-bold" 
              onClick={() => { onCategorySelect?.("desktops"); setMobileMenuOpen(false); }} 
              data-testid="link-desktops-mobile"
            >
              <Computer className="h-4 w-4" />
              {t('category.desktops')}
            </Button>
            <Link href="/pc-builder" onClick={() => setMobileMenuOpen(false)}>
              <Button 
                variant="ghost" 
                className="justify-start gap-3 w-full rounded-lg hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 font-bold" 
                data-testid="link-pc-builder-mobile"
              >
                <Cpu className="h-4 w-4" />
                {t('header.pcBuilder')}
              </Button>
            </Link>
            <Link href="/track-order" onClick={() => setMobileMenuOpen(false)}>
              <Button 
                variant="ghost" 
                className="justify-start gap-3 w-full rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 font-bold border border-emerald-200 dark:border-emerald-800" 
                data-testid="link-track-order-mobile"
              >
                <MapPin className="h-4 w-4" />
                {t('header.trackOrder')}
              </Button>
            </Link>
          </nav>
        )}
      </div>

      <Sheet open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
        <SheetContent side="top" className="h-auto" data-testid="sheet-mobile-search">
          <SheetHeader>
            <SheetTitle>{t('header.searchTitle')}</SheetTitle>
            <SheetDescription>{t('header.searchDescription')}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSearch} className="mt-4 flex gap-2">
            <Input
              type="search"
              placeholder={t('header.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 h-12 px-5 rounded-xl border-2 border-muted-foreground/20 bg-muted/40 focus:border-primary focus:bg-background transition-all shadow-md placeholder:text-muted-foreground/60 text-base"
              data-testid="input-search-mobile"
              autoFocus
            />
            <Button
              type="submit"
              className="h-12 px-6 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg shadow-primary/25 font-bold gap-2"
              data-testid="button-search-mobile"
            >
              <Search className="h-5 w-5" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </header>
  );
}
