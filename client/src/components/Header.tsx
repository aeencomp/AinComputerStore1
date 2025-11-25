import { ShoppingCart, Search, Menu, Languages } from "lucide-react";
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
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import type { StoreSettings } from "@shared/schema";

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

  useEffect(() => {
    setSearchQuery(searchValue);
  }, [searchValue]);

  const { data: storeSettings } = useQuery<StoreSettings>({
    queryKey: ['/api/store-settings'],
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

          <form onSubmit={handleSearch} className="flex-1 max-w-2xl hidden md:flex">
            <div className="relative w-full">
              <Input
                type="search"
                placeholder={t('header.searchPlaceholder')}
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
            <SheetTitle>{t('header.searchTitle')}</SheetTitle>
            <SheetDescription>{t('header.searchDescription')}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSearch} className="mt-4">
            <div className="relative">
              <Input
                type="search"
                placeholder={t('header.searchPlaceholder')}
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
