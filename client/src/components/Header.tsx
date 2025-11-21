import { ShoppingCart, Search, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface HeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
  onSearch: (query: string) => void;
}

export function Header({ cartItemsCount, onCartClick, onSearch }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

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
            <div className="flex items-center justify-center border-2 border-border rounded-md h-14 px-4 min-w-[120px]" data-testid="logo-placeholder">
              <span className="text-sm font-bold text-muted-foreground text-center">العين لتجارة الحاسبات</span>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex-1 max-w-2xl hidden md:flex">
            <div className="relative w-full">
              <Input
                type="search"
                placeholder="ابحث عن المنتجات..."
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
              className="md:hidden"
              onClick={() => setMobileSearchOpen(true)}
              data-testid="button-mobile-search"
            >
              <Search className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              data-testid="button-user-account"
            >
              <User className="h-5 w-5" />
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
          <Button variant="ghost" data-testid="link-home">الرئيسية</Button>
          <Button variant="ghost" data-testid="link-computers">أجهزة كمبيوتر</Button>
          <Button variant="ghost" data-testid="link-accessories">ملحقات</Button>
          <Button variant="ghost" data-testid="link-monitors">الشاشات</Button>
          <Button variant="ghost" data-testid="link-offers">العروض</Button>
        </nav>

        {mobileMenuOpen && (
          <nav className="md:hidden flex flex-col gap-2 py-3 border-t">
            <Button variant="ghost" className="justify-start" data-testid="link-home-mobile">الرئيسية</Button>
            <Button variant="ghost" className="justify-start" data-testid="link-computers-mobile">أجهزة كمبيوتر</Button>
            <Button variant="ghost" className="justify-start" data-testid="link-accessories-mobile">ملحقات</Button>
            <Button variant="ghost" className="justify-start" data-testid="link-monitors-mobile">الشاشات</Button>
            <Button variant="ghost" className="justify-start" data-testid="link-offers-mobile">العروض</Button>
          </nav>
        )}

        <div className="hidden md:flex items-center justify-center gap-8 py-2 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-2" data-testid="trust-shipping">
            <span>✓</span>
            <span>شحن مجاني</span>
          </div>
          <div className="flex items-center gap-2" data-testid="trust-warranty">
            <span>✓</span>
            <span>ضمان سنتين</span>
          </div>
          <div className="flex items-center gap-2" data-testid="trust-support">
            <span>✓</span>
            <span>خدمة العملاء 24/7</span>
          </div>
        </div>
      </div>

      <Sheet open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
        <SheetContent side="top" className="h-auto" data-testid="sheet-mobile-search">
          <SheetHeader>
            <SheetTitle>البحث</SheetTitle>
            <SheetDescription>ابحث عن منتجات الحواسيب والملحقات</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSearch} className="mt-4">
            <div className="relative">
              <Input
                type="search"
                placeholder="ابحث عن المنتجات..."
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
