import { ShoppingCart, Search, Menu, Languages, Cpu, LogOut, User as UserIcon, Package, MapPin, Home, Laptop, Monitor, Keyboard, Computer, AppWindow, MemoryStick, HardDrive, ChevronDown, Gamepad2, Briefcase, GraduationCap, Zap, Mouse, Headphones, Camera, Cable, BatteryCharging, Tv, MonitorPlay, Maximize, Square, Box, Wrench, Shield, Palette, Play, Backpack, Printer } from "lucide-react";
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

import aeenn from "@assets/aeenn.jpg";

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
  const [logoError, setLogoError] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
    setMobileSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/" className="flex items-center gap-3 cursor-pointer" data-testid="link-logo-home">
            {(logoUrl && !logoError) ? (
              <img 
                src={logoUrl} 
                alt={storeName} 
                className="h-12 max-w-[180px] object-contain"
                data-testid="logo-image"
                onError={() => setLogoError(true)}
              />
            ) : (
              <img 
                src={aeenn} 
                alt={storeName} 
                className="h-12 max-w-[180px] object-contain"
                data-testid="logo-fallback"
              />
            )}
            <span className="hidden sm:block text-lg font-bold text-foreground whitespace-nowrap" data-testid="text-store-name">
              {storeName}
            </span>
          </Link>

          <form onSubmit={handleSearch} className="flex-1 max-w-lg hidden md:flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                type="search"
                placeholder={t('header.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 ps-10 pe-4 rounded-xl bg-card/80 border-2 border-primary/20 focus:border-primary focus:bg-card shadow-inner placeholder:text-muted-foreground/60"
                data-testid="input-search"
              />
            </div>
            <Button
              type="submit"
              size="default"
              className="rounded-xl px-5"
              data-testid="button-search"
            >
              <Search className="h-4 w-4" />
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

        <nav className="hidden md:flex items-center justify-center flex-wrap gap-1 py-3 border-t bg-muted/30 overflow-x-auto">
          <Link href="/">
            <Button 
              variant="ghost" 
              className="gap-2 px-4 py-2 rounded-full hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors font-bold"
              data-testid="link-home"
            >
              <Home className="h-4 w-4" />
              {t('header.home')}
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="gap-2 px-4 py-2 rounded-full hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/30 dark:hover:text-purple-400 transition-colors font-bold"
                data-testid="link-laptops"
              >
                <Laptop className="h-4 w-4" />
                {t('category.laptops')}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              <Link href="/?category=laptops">
                <DropdownMenuItem className="cursor-pointer font-semibold">
                  <Laptop className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'جميع اللابتوبات' : 'All Laptops'}
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <Link href="/?category=gaming-laptops">
                <DropdownMenuItem className="cursor-pointer">
                  <Gamepad2 className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'لابتوب ألعاب' : 'Gaming Laptops'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=business-laptops">
                <DropdownMenuItem className="cursor-pointer">
                  <Briefcase className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'لابتوب أعمال' : 'Business Laptops'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=student-laptops">
                <DropdownMenuItem className="cursor-pointer">
                  <GraduationCap className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'لابتوب طلاب' : 'Student Laptops'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=ultrabooks">
                <DropdownMenuItem className="cursor-pointer">
                  <Zap className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'ألترابوك' : 'Ultrabooks'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=workstation-laptops">
                <DropdownMenuItem className="cursor-pointer">
                  <Wrench className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'محطات عمل محمولة' : 'Workstation Laptops'}
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="gap-2 px-4 py-2 rounded-full hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 transition-colors font-bold"
                data-testid="link-accessories"
              >
                <Keyboard className="h-4 w-4" />
                {t('category.accessories')}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              <Link href="/?category=accessories">
                <DropdownMenuItem className="cursor-pointer font-semibold">
                  <Keyboard className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'جميع الإكسسوارات' : 'All Accessories'}
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <Link href="/?category=keyboards">
                <DropdownMenuItem className="cursor-pointer">
                  <Keyboard className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'لوحات المفاتيح' : 'Keyboards'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=mice">
                <DropdownMenuItem className="cursor-pointer">
                  <Mouse className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'الماوسات' : 'Mice'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=headphones">
                <DropdownMenuItem className="cursor-pointer">
                  <Headphones className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'سماعات' : 'Headphones'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=webcams">
                <DropdownMenuItem className="cursor-pointer">
                  <Camera className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'كاميرات ويب' : 'Webcams'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=cables">
                <DropdownMenuItem className="cursor-pointer">
                  <Cable className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'كابلات وموزعات' : 'Cables & Hubs'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=bags">
                <DropdownMenuItem className="cursor-pointer">
                  <Backpack className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'حقائب لابتوب' : 'Laptop Bags'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=chargers">
                <DropdownMenuItem className="cursor-pointer">
                  <BatteryCharging className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'شواحن ومحولات' : 'Chargers & Adapters'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=miscellaneous">
                <DropdownMenuItem className="cursor-pointer">
                  <Package className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'منوعات' : 'Miscellaneous'}
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="gap-2 px-4 py-2 rounded-full hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-900/30 dark:hover:text-orange-400 transition-colors font-bold"
                data-testid="link-printers"
              >
                <Printer className="h-4 w-4" />
                {language === 'ar' ? 'الطابعات' : 'Printers'}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              <Link href="/?category=printers">
                <DropdownMenuItem className="cursor-pointer font-semibold">
                  <Printer className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'جميع الطابعات' : 'All Printers'}
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <Link href="/?category=laser-printers">
                <DropdownMenuItem className="cursor-pointer">
                  <Printer className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'طابعات ليزر' : 'Laser Printers'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=inkjet-printers">
                <DropdownMenuItem className="cursor-pointer">
                  <Printer className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'طابعات حبر' : 'Inkjet Printers'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=printer-accessories">
                <DropdownMenuItem className="cursor-pointer">
                  <Package className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'ملحقات الطابعات' : 'Printer Accessories'}
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="gap-2 px-4 py-2 rounded-full hover:bg-teal-100 hover:text-teal-700 dark:hover:bg-teal-900/30 dark:hover:text-teal-400 transition-colors font-bold"
                data-testid="link-monitors"
              >
                <Monitor className="h-4 w-4" />
                {t('category.monitors')}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              <Link href="/?category=monitors">
                <DropdownMenuItem className="cursor-pointer font-semibold">
                  <Monitor className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'جميع الشاشات' : 'All Monitors'}
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <Link href="/?category=gaming-monitors">
                <DropdownMenuItem className="cursor-pointer">
                  <Gamepad2 className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'شاشات ألعاب' : 'Gaming Monitors'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=office-monitors">
                <DropdownMenuItem className="cursor-pointer">
                  <Briefcase className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'شاشات مكتبية' : 'Office Monitors'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=curved-monitors">
                <DropdownMenuItem className="cursor-pointer">
                  <MonitorPlay className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'شاشات منحنية' : 'Curved Monitors'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=4k-monitors">
                <DropdownMenuItem className="cursor-pointer">
                  <Tv className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'شاشات 4K' : '4K/UHD Monitors'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=ultrawide-monitors">
                <DropdownMenuItem className="cursor-pointer">
                  <Maximize className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'شاشات عريضة' : 'Ultrawide Monitors'}
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="gap-2 px-4 py-2 rounded-full hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-900/30 dark:hover:text-rose-400 transition-colors font-bold"
                data-testid="link-desktops"
              >
                <Computer className="h-4 w-4" />
                {t('category.desktops')}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              <Link href="/?category=desktops">
                <DropdownMenuItem className="cursor-pointer font-semibold">
                  <Computer className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'جميع الأجهزة المكتبية' : 'All Desktops'}
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <Link href="/?category=gaming-pcs">
                <DropdownMenuItem className="cursor-pointer">
                  <Gamepad2 className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'أجهزة ألعاب' : 'Gaming PCs'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=office-pcs">
                <DropdownMenuItem className="cursor-pointer">
                  <Briefcase className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'أجهزة مكتبية' : 'Office PCs'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=workstations">
                <DropdownMenuItem className="cursor-pointer">
                  <Wrench className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'محطات عمل' : 'Workstations'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=all-in-one">
                <DropdownMenuItem className="cursor-pointer">
                  <Square className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'الكل في واحد' : 'All-in-One PCs'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=mini-pcs">
                <DropdownMenuItem className="cursor-pointer">
                  <Box className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'أجهزة صغيرة' : 'Mini PCs'}
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/?category=all-in-one">
            <Button 
              variant="ghost" 
              className="gap-2 px-4 py-2 rounded-full hover:bg-cyan-100 hover:text-cyan-700 dark:hover:bg-cyan-900/30 dark:hover:text-cyan-400 transition-colors font-bold"
              data-testid="link-all-in-one"
            >
              <Monitor className="h-4 w-4" />
              {language === 'ar' ? 'الكل في واحد' : 'All-in-One'}
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="gap-2 px-4 py-2 rounded-full hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-900/30 dark:hover:text-orange-400 transition-colors font-bold"
                data-testid="link-pc-components"
              >
                <MemoryStick className="h-4 w-4" />
                {language === 'ar' ? 'قطع الكمبيوتر' : 'PC Components'}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              <DropdownMenuLabel>{language === 'ar' ? 'قطع الكمبيوتر' : 'PC Components'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/?category=ram">
                <DropdownMenuItem className="cursor-pointer" data-testid="link-ram">
                  <MemoryStick className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'ذاكرة الوصول العشوائي (RAM)' : 'RAM Memory'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=ssd">
                <DropdownMenuItem className="cursor-pointer" data-testid="link-ssd">
                  <HardDrive className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'أقراص SSD' : 'SSD Drives'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=hdd">
                <DropdownMenuItem className="cursor-pointer" data-testid="link-hdd">
                  <HardDrive className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'أقراص HDD' : 'HDD Drives'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=processors">
                <DropdownMenuItem className="cursor-pointer" data-testid="link-processors">
                  <Cpu className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'المعالجات' : 'Processors'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=motherboards">
                <DropdownMenuItem className="cursor-pointer" data-testid="link-motherboards">
                  <Cpu className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'اللوحات الأم' : 'Motherboards'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=gpu">
                <DropdownMenuItem className="cursor-pointer" data-testid="link-gpu">
                  <Monitor className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'كروت الشاشة' : 'Graphics Cards'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=psu">
                <DropdownMenuItem className="cursor-pointer" data-testid="link-psu">
                  <Cpu className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'مزودات الطاقة' : 'Power Supplies'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=cases">
                <DropdownMenuItem className="cursor-pointer" data-testid="link-cases">
                  <Computer className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'صناديق الكمبيوتر' : 'PC Cases'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=cooling">
                <DropdownMenuItem className="cursor-pointer" data-testid="link-cooling">
                  <Cpu className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'أنظمة التبريد' : 'Cooling Systems'}
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="gap-2 px-4 py-2 rounded-full hover:bg-cyan-100 hover:text-cyan-700 dark:hover:bg-cyan-900/30 dark:hover:text-cyan-400 transition-colors font-bold"
                data-testid="link-programs"
              >
                <AppWindow className="h-4 w-4" />
                {t('category.programs')}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              <Link href="/?category=programs">
                <DropdownMenuItem className="cursor-pointer font-semibold">
                  <AppWindow className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'جميع البرامج' : 'All Software'}
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <Link href="/?category=operating-systems">
                <DropdownMenuItem className="cursor-pointer">
                  <Computer className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'أنظمة التشغيل' : 'Operating Systems'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=office-software">
                <DropdownMenuItem className="cursor-pointer">
                  <Briefcase className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'برامج المكتب' : 'Office Software'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=antivirus">
                <DropdownMenuItem className="cursor-pointer">
                  <Shield className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'مضادات الفيروسات' : 'Antivirus'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=design-software">
                <DropdownMenuItem className="cursor-pointer">
                  <Palette className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'برامج التصميم' : 'Design Software'}
                </DropdownMenuItem>
              </Link>
              <Link href="/?category=gaming-software">
                <DropdownMenuItem className="cursor-pointer">
                  <Play className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'برامج الألعاب' : 'Gaming Software'}
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
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
            <Link href="/" onClick={() => setMobileMenuOpen(false)}>
              <Button 
                variant="ghost" 
                className="justify-start gap-3 w-full rounded-lg hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 font-bold" 
                data-testid="link-home-mobile"
              >
                <Home className="h-4 w-4" />
                {t('header.home')}
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="justify-start gap-3 w-full rounded-lg hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/30 dark:hover:text-purple-400 font-bold"
                  data-testid="link-laptops-mobile"
                >
                  <Laptop className="h-4 w-4" />
                  {t('category.laptops')}
                  <ChevronDown className="h-3 w-3 ms-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <Link href="/?category=laptops" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer font-semibold">
                    <Laptop className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'جميع اللابتوبات' : 'All Laptops'}
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <Link href="/?category=gaming-laptops" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Gamepad2 className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'لابتوب ألعاب' : 'Gaming Laptops'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=business-laptops" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Briefcase className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'لابتوب أعمال' : 'Business Laptops'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=student-laptops" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <GraduationCap className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'لابتوب طلاب' : 'Student Laptops'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=ultrabooks" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Zap className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'ألترابوك' : 'Ultrabooks'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=workstation-laptops" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Wrench className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'محطات عمل محمولة' : 'Workstation Laptops'}
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="justify-start gap-3 w-full rounded-lg hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 font-bold"
                  data-testid="link-accessories-mobile"
                >
                  <Keyboard className="h-4 w-4" />
                  {t('category.accessories')}
                  <ChevronDown className="h-3 w-3 ms-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <Link href="/?category=accessories" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer font-semibold">
                    <Keyboard className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'جميع الإكسسوارات' : 'All Accessories'}
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <Link href="/?category=keyboards" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Keyboard className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'لوحات المفاتيح' : 'Keyboards'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=mice" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Mouse className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'الماوسات' : 'Mice'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=headphones" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Headphones className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'سماعات' : 'Headphones'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=webcams" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Camera className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'كاميرات ويب' : 'Webcams'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=cables" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Cable className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'كابلات وموزعات' : 'Cables & Hubs'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=bags" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Backpack className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'حقائب لابتوب' : 'Laptop Bags'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=chargers" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <BatteryCharging className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'شواحن ومحولات' : 'Chargers & Adapters'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=miscellaneous" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Package className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'منوعات' : 'Miscellaneous'}
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="justify-start gap-3 w-full rounded-lg hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-900/30 dark:hover:text-orange-400 font-bold"
                  data-testid="link-printers-mobile"
                >
                  <Printer className="h-4 w-4" />
                  {language === 'ar' ? 'الطابعات' : 'Printers'}
                  <ChevronDown className="h-3 w-3 ms-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <Link href="/?category=printers" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer font-semibold">
                    <Printer className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'جميع الطابعات' : 'All Printers'}
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <Link href="/?category=laser-printers" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Printer className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'طابعات ليزر' : 'Laser Printers'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=inkjet-printers" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Printer className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'طابعات حبر' : 'Inkjet Printers'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=printer-accessories" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Package className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'ملحقات الطابعات' : 'Printer Accessories'}
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="justify-start gap-3 w-full rounded-lg hover:bg-teal-100 hover:text-teal-700 dark:hover:bg-teal-900/30 dark:hover:text-teal-400 font-bold"
                  data-testid="link-monitors-mobile"
                >
                  <Monitor className="h-4 w-4" />
                  {t('category.monitors')}
                  <ChevronDown className="h-3 w-3 ms-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <Link href="/?category=monitors" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer font-semibold">
                    <Monitor className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'جميع الشاشات' : 'All Monitors'}
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <Link href="/?category=gaming-monitors" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Gamepad2 className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'شاشات ألعاب' : 'Gaming Monitors'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=office-monitors" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Briefcase className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'شاشات مكتبية' : 'Office Monitors'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=curved-monitors" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <MonitorPlay className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'شاشات منحنية' : 'Curved Monitors'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=4k-monitors" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Tv className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'شاشات 4K' : '4K/UHD Monitors'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=ultrawide-monitors" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Maximize className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'شاشات عريضة' : 'Ultrawide Monitors'}
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="justify-start gap-3 w-full rounded-lg hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-900/30 dark:hover:text-rose-400 font-bold"
                  data-testid="link-desktops-mobile"
                >
                  <Computer className="h-4 w-4" />
                  {t('category.desktops')}
                  <ChevronDown className="h-3 w-3 ms-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <Link href="/?category=desktops" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer font-semibold">
                    <Computer className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'جميع الأجهزة المكتبية' : 'All Desktops'}
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <Link href="/?category=gaming-pcs" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Gamepad2 className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'أجهزة ألعاب' : 'Gaming PCs'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=office-pcs" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Briefcase className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'أجهزة مكتبية' : 'Office PCs'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=workstations" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Wrench className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'محطات عمل' : 'Workstations'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=all-in-one" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Square className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'الكل في واحد' : 'All-in-One PCs'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=mini-pcs" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Box className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'أجهزة صغيرة' : 'Mini PCs'}
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link href="/?category=all-in-one" onClick={() => setMobileMenuOpen(false)}>
              <Button 
                variant="ghost" 
                className="justify-start gap-3 w-full rounded-lg hover:bg-cyan-100 hover:text-cyan-700 dark:hover:bg-cyan-900/30 dark:hover:text-cyan-400 font-bold"
                data-testid="link-all-in-one-mobile"
              >
                <Monitor className="h-4 w-4" />
                {language === 'ar' ? 'الكل في واحد' : 'All-in-One'}
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="justify-start gap-3 w-full rounded-lg hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-900/30 dark:hover:text-orange-400 font-bold"
                  data-testid="link-pc-components-mobile"
                >
                  <MemoryStick className="h-4 w-4" />
                  {language === 'ar' ? 'قطع الكمبيوتر' : 'PC Components'}
                  <ChevronDown className="h-3 w-3 ms-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <Link href="/?category=ram" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <MemoryStick className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'ذاكرة RAM' : 'RAM Memory'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=ssd" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <HardDrive className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'أقراص SSD' : 'SSD Drives'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=hdd" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <HardDrive className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'أقراص HDD' : 'HDD Drives'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=processors" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Cpu className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'المعالجات' : 'Processors'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=motherboards" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Cpu className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'اللوحات الأم' : 'Motherboards'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=gpu" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Monitor className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'كروت الشاشة' : 'Graphics Cards'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=psu" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Cpu className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'مزودات الطاقة' : 'Power Supplies'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=cases" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Computer className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'صناديق الكمبيوتر' : 'PC Cases'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=cooling" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Cpu className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'أنظمة التبريد' : 'Cooling Systems'}
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="justify-start gap-3 w-full rounded-lg hover:bg-cyan-100 hover:text-cyan-700 dark:hover:bg-cyan-900/30 dark:hover:text-cyan-400 font-bold"
                  data-testid="link-programs-mobile"
                >
                  <AppWindow className="h-4 w-4" />
                  {t('category.programs')}
                  <ChevronDown className="h-3 w-3 ms-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <Link href="/?category=programs" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer font-semibold">
                    <AppWindow className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'جميع البرامج' : 'All Software'}
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <Link href="/?category=operating-systems" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Computer className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'أنظمة التشغيل' : 'Operating Systems'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=office-software" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Briefcase className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'برامج المكتب' : 'Office Software'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=antivirus" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Shield className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'مضادات الفيروسات' : 'Antivirus'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=design-software" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Palette className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'برامج التصميم' : 'Design Software'}
                  </DropdownMenuItem>
                </Link>
                <Link href="/?category=gaming-software" onClick={() => setMobileMenuOpen(false)}>
                  <DropdownMenuItem className="cursor-pointer">
                    <Play className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'برامج الألعاب' : 'Gaming Software'}
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
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
            
            <div className="border-t border-border my-2" />
            
            {currentUser ? (
              <>
                <Link href="/my-orders" onClick={() => setMobileMenuOpen(false)}>
                  <Button 
                    variant="ghost" 
                    className="justify-start gap-3 w-full rounded-lg hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-900/30 dark:hover:text-orange-400 font-bold" 
                    data-testid="link-my-orders-mobile"
                  >
                    <Package className="h-4 w-4" />
                    {t('dashboard.myOrders')}
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  className="justify-start gap-3 rounded-lg hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-400 font-bold" 
                  onClick={() => { logoutMutation.mutate(); setMobileMenuOpen(false); }} 
                  data-testid="button-logout-mobile"
                >
                  <LogOut className="h-4 w-4" />
                  {t('header.logout')}
                </Button>
              </>
            ) : (
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button 
                  variant="ghost" 
                  className="justify-start gap-3 w-full rounded-lg hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/30 dark:hover:text-green-400 font-bold" 
                  data-testid="button-login-mobile"
                >
                  <UserIcon className="h-4 w-4" />
                  {t('header.login')}
                </Button>
              </Link>
            )}
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
