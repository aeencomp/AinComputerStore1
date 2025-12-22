import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Battery, 
  Search, 
  Laptop, 
  Hash,
  AlertTriangle,
  Package,
  LogOut,
  Plus,
  Loader2,
  Settings
} from "lucide-react";
import type { LaptopBattery } from "@shared/schema";

interface BatteryUserAuth {
  id: string;
  username: string;
  name: string;
  role: string;
}

export default function BatteryDashboard() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<'all' | 'serial' | 'laptop'>('all');

  const { data: currentUser, isLoading: authLoading } = useQuery<BatteryUserAuth>({
    queryKey: ['/api/battery/auth/me'],
    retry: false,
  });

  const { data: batteries = [], isLoading: batteriesLoading } = useQuery<LaptopBattery[]>({
    queryKey: ['/api/battery/batteries'],
    enabled: !!currentUser,
  });

  const { data: lowStockBatteries = [] } = useQuery<LaptopBattery[]>({
    queryKey: ['/api/battery/batteries/low-stock'],
    enabled: !!currentUser,
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<LaptopBattery[]>({
    queryKey: ['/api/battery/batteries/search', searchQuery, searchType],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(`/api/battery/batteries/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: !!currentUser && searchQuery.length > 0,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/battery/auth/logout');
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/battery/login");
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    setLocation("/battery/login");
    return null;
  }

  const displayBatteries = searchQuery.trim() ? searchResults : batteries;
  const totalStock = batteries.reduce((sum, b) => sum + (b.stockQuantity || 0), 0);

  const formatNumber = (num: number) => {
    if (language === 'ar') {
      return num.toString().replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
    }
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-muted/30" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="bg-green-600 text-white p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Battery className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">
                {language === 'ar' ? 'نظام البطاريات' : 'Battery System'}
              </h1>
              <p className="text-green-100 text-sm">{currentUser.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/battery/manage")}
              className="text-white hover:bg-green-700"
              data-testid="button-manage-batteries"
            >
              <Settings className="h-4 w-4 me-1" />
              {language === 'ar' ? 'إدارة' : 'Manage'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              className="text-white hover:bg-green-700"
              data-testid="button-battery-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <Battery className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">
                    {language === 'ar' ? 'إجمالي البطاريات' : 'Total Batteries'}
                  </p>
                  <p className="text-2xl font-bold">{formatNumber(batteries.length)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">
                    {language === 'ar' ? 'إجمالي المخزون' : 'Total Stock'}
                  </p>
                  <p className="text-2xl font-bold">{formatNumber(totalStock)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={lowStockBatteries.length > 0 ? 'border-red-300 bg-red-50' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${lowStockBatteries.length > 0 ? 'bg-red-100' : 'bg-orange-100'}`}>
                  <AlertTriangle className={`h-6 w-6 ${lowStockBatteries.length > 0 ? 'text-red-600' : 'text-orange-600'}`} />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">
                    {language === 'ar' ? 'مخزون منخفض' : 'Low Stock'}
                  </p>
                  <p className="text-2xl font-bold">{formatNumber(lowStockBatteries.length)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              {language === 'ar' ? 'البحث عن بطارية' : 'Search Battery'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={searchType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('all')}
                data-testid="button-search-all"
              >
                {language === 'ar' ? 'الكل' : 'All'}
              </Button>
              <Button
                variant={searchType === 'serial' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('serial')}
                data-testid="button-search-serial"
              >
                <Hash className="h-4 w-4 me-1" />
                {language === 'ar' ? 'رقم البطارية' : 'Battery Serial'}
              </Button>
              <Button
                variant={searchType === 'laptop' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('laptop')}
                data-testid="button-search-laptop"
              >
                <Laptop className="h-4 w-4 me-1" />
                {language === 'ar' ? 'موديل اللابتوب' : 'Laptop Model'}
              </Button>
            </div>
            
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  searchType === 'serial' 
                    ? (language === 'ar' ? 'أدخل رقم البطارية...' : 'Enter battery serial number...')
                    : searchType === 'laptop'
                    ? (language === 'ar' ? 'أدخل موديل اللابتوب (مثال: Dell Latitude E6420)...' : 'Enter laptop model (e.g., Dell Latitude E6420)...')
                    : (language === 'ar' ? 'ابحث برقم البطارية أو موديل اللابتوب...' : 'Search by battery serial or laptop model...')
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-10"
                data-testid="input-battery-search"
              />
            </div>
          </CardContent>
        </Card>

        {lowStockBatteries.length > 0 && !searchQuery && (
          <Card className="border-red-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-red-600 flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5" />
                {language === 'ar' ? 'تنبيه المخزون المنخفض' : 'Low Stock Alert'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {lowStockBatteries.map((battery) => (
                  <Badge key={battery.id} variant="destructive" className="text-sm py-1">
                    {battery.serialNumber} - {formatNumber(battery.stockQuantity || 0)} {language === 'ar' ? 'قطعة' : 'pcs'}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <CardTitle>
              {searchQuery 
                ? (language === 'ar' ? 'نتائج البحث' : 'Search Results')
                : (language === 'ar' ? 'جميع البطاريات' : 'All Batteries')
              }
              <span className="text-muted-foreground font-normal ms-2">
                ({formatNumber(displayBatteries.length)})
              </span>
            </CardTitle>
            <Button 
              onClick={() => setLocation("/battery/manage")}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-add-battery"
            >
              <Plus className="h-4 w-4 me-1" />
              {language === 'ar' ? 'إضافة بطارية' : 'Add Battery'}
            </Button>
          </CardHeader>
          <CardContent>
            {batteriesLoading || searchLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : displayBatteries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery 
                  ? (language === 'ar' ? 'لا توجد نتائج للبحث' : 'No search results')
                  : (language === 'ar' ? 'لا توجد بطاريات مضافة' : 'No batteries added')
                }
              </div>
            ) : (
              <div className="grid gap-4">
                {displayBatteries.map((battery) => (
                  <div 
                    key={battery.id} 
                    className={`p-4 border rounded-lg hover-elevate cursor-pointer ${
                      (battery.stockQuantity || 0) <= (battery.minStockLevel || 2) 
                        ? 'border-red-300 bg-red-50' 
                        : ''
                    }`}
                    onClick={() => setLocation(`/battery/manage?edit=${battery.id}`)}
                    data-testid={`card-battery-${battery.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-lg">{battery.serialNumber}</span>
                          {battery.partNumber && (
                            <span className="text-muted-foreground text-sm">({battery.partNumber})</span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">{battery.brand}</span>
                          {battery.voltage && ` • ${battery.voltage}V`}
                          {battery.capacity && ` • ${formatNumber(battery.capacity)}mAh`}
                          {battery.cells && ` • ${formatNumber(battery.cells)} ${language === 'ar' ? 'خلية' : 'cells'}`}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {battery.compatibleLaptops.slice(0, 5).map((laptop, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              <Laptop className="h-3 w-3 me-1" />
                              {laptop}
                            </Badge>
                          ))}
                          {battery.compatibleLaptops.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{formatNumber(battery.compatibleLaptops.length - 5)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-end">
                        <div className={`text-2xl font-bold ${
                          (battery.stockQuantity || 0) <= (battery.minStockLevel || 2) 
                            ? 'text-red-600' 
                            : 'text-green-600'
                        }`}>
                          {formatNumber(battery.stockQuantity || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {language === 'ar' ? 'في المخزون' : 'in stock'}
                        </div>
                        {battery.sellingPrice && (
                          <div className="text-sm font-medium mt-1">
                            {formatNumber(Number(battery.sellingPrice))} {language === 'ar' ? 'د.ع' : 'IQD'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
