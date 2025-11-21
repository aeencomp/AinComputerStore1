import { ShoppingCart, Search, Menu, User, LogOut, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useLocation } from "wouter";
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
import { useUser, useLogout } from "@/hooks/use-user";
import { useLanguage } from "@/contexts/LanguageContext";

interface HeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
  onSearch: (query: string) => void;
  onCategorySelect?: (category: string) => void;
}

export function Header({ cartItemsCount, onCartClick, onSearch, onCategorySelect }: HeaderProps) {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useUser();
  const { language, setLanguage, t } = useLanguage();
  const logoutMutation = useLogout();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
    setMobileSearchOpen(false);
  };

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-background border-b">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center border-2 border-border rounded-md h-14 px-4 min-w-[120px]" data-testid="logo-placeholder">
              <span className="text-sm font-bold text-muted-foreground text-center">{t('header.title')}</span>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex-1 max-w-2xl hidden md:flex">
            <div className="relative w-full">
              <Input
                type="search"
                placeholder={t('product.loading')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10"
                data-testid="input-search"
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="absolute left-0 top-0 h-full"
                data-testid="button-search"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
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

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    data-testid="button-user-menu"
                  >
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col gap-1">
                      <p className="font-medium">{user?.name}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    data-testid="button-logout"
                  >
                    <LogOut className="ml-2 h-4 w-4" />
                    {t('header.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => navigate("/login")}
                data-testid="button-login"
              >
                <User className="h-5 w-5" />
              </Button>
            )}

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

        <nav className="hidden md:flex items-center justify-center gap-6 py-3 border-t">
          <Button variant="ghost" onClick={() => { onSearch(""); }} data-testid="link-home">{t('header.home')}</Button>
          <Button variant="ghost" onClick={() => onCategorySelect?.("laptops")} data-testid="link-computers">{t('category.laptops')}</Button>
          <Button variant="ghost" onClick={() => onCategorySelect?.("accessories")} data-testid="link-accessories">{t('category.accessories')}</Button>
          <Button variant="ghost" onClick={() => onCategorySelect?.("monitors")} data-testid="link-monitors">{t('category.monitors')}</Button>
          <Button variant="ghost" onClick={() => onCategorySelect?.("desktops")} data-testid="link-desktops">{t('category.desktops')}</Button>
        </nav>

        {mobileMenuOpen && (
          <nav className="md:hidden flex flex-col gap-2 py-3 border-t">
            <Button variant="ghost" className="justify-start" onClick={() => { onSearch(""); setMobileMenuOpen(false); }} data-testid="link-home-mobile">{t('header.home')}</Button>
            <Button variant="ghost" className="justify-start" onClick={() => { onCategorySelect?.("laptops"); setMobileMenuOpen(false); }} data-testid="link-computers-mobile">{t('category.laptops')}</Button>
            <Button variant="ghost" className="justify-start" onClick={() => { onCategorySelect?.("accessories"); setMobileMenuOpen(false); }} data-testid="link-accessories-mobile">{t('category.accessories')}</Button>
            <Button variant="ghost" className="justify-start" onClick={() => { onCategorySelect?.("monitors"); setMobileMenuOpen(false); }} data-testid="link-monitors-mobile">{t('category.monitors')}</Button>
            <Button variant="ghost" className="justify-start" onClick={() => { onCategorySelect?.("desktops"); setMobileMenuOpen(false); }} data-testid="link-desktops-mobile">{t('category.desktops')}</Button>
          </nav>
        )}
      </div>

      <Sheet open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
        <SheetContent side="top" className="h-auto" data-testid="sheet-mobile-search">
          <SheetHeader>
            <SheetTitle>{language === 'ar' ? 'البحث' : 'Search'}</SheetTitle>
            <SheetDescription>{language === 'ar' ? 'ابحث عن منتجات الحواسيب والملحقات' : 'Search for computers and accessories'}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSearch} className="mt-4">
            <div className="relative">
              <Input
                type="search"
                placeholder={language === 'ar' ? 'ابحث عن المنتجات...' : 'Search for products...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10"
                data-testid="input-search-mobile"
                autoFocus
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="absolute left-0 top-0 h-full"
                data-testid="button-search-mobile"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </header>
  );
}
