import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Settings,
  ChevronRight
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
    <div className="min-h-screen bg-slate-50 text-slate-900" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 px-4 h-16 flex items-center">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/5 rounded-lg">
              <Battery className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {language === 'ar' ? 'نظام البطاريات' : 'Battery Center'}
              </h1>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {currentUser.name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/battery/manage")}
              className="text-slate-600 hover:text-slate-900"
              data-testid="button-manage-batteries"
            >
              <Settings className="h-4 w-4 me-2" />
              {language === 'ar' ? 'إدارة' : 'Settings'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              className="text-slate-600 hover:text-red-600 hover:bg-red-50"
              data-testid="button-battery-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { 
              label: language === 'ar' ? 'إجمالي الأنواع' : 'Total Types', 
              value: batteries.length, 
              icon: Battery, 
              color: 'text-primary',
              bg: 'bg-primary/5'
            },
            { 
              label: language === 'ar' ? 'إجمالي المخزون' : 'Total Units', 
              value: totalStock, 
              icon: Package, 
              color: 'text-blue-600',
              bg: 'bg-blue-50'
            },
            { 
              label: language === 'ar' ? 'نقص المخزون' : 'Low Stock', 
              value: lowStockBatteries.length, 
              icon: AlertTriangle, 
              color: lowStockBatteries.length > 0 ? 'text-red-600' : 'text-slate-400',
              bg: lowStockBatteries.length > 0 ? 'bg-red-50' : 'bg-slate-50'
            }
          ].map((stat, i) => (
            <Card key={i} className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-bold text-slate-900 mt-0.5">
                      {formatNumber(stat.value)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 w-fit">
              {[
                { id: 'all', label: language === 'ar' ? 'الكل' : 'All' },
                { id: 'serial', label: language === 'ar' ? 'بالرقم' : 'By Serial' },
                { id: 'laptop', label: language === 'ar' ? 'بالجهاز' : 'By Laptop' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSearchType(type.id as any)}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                    searchType === type.id 
                      ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            
            <div className="relative flex-1 max-w-xl group">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder={
                  searchType === 'serial' 
                    ? (language === 'ar' ? 'ابحث برقم البطارية...' : 'Search by battery serial...')
                    : searchType === 'laptop'
                    ? (language === 'ar' ? 'ابحث بموديل اللابتوب...' : 'Search by laptop model...')
                    : (language === 'ar' ? 'ابحث عن أي شيء...' : 'Search anything...')
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-12 h-12 bg-white border-slate-200 text-slate-900 focus-visible:ring-primary rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900">
              {searchQuery ? (language === 'ar' ? 'نتائج البحث' : 'Search Results') : (language === 'ar' ? 'المخزون المتوفر' : 'Available Inventory')}
              <span className="ms-2 font-normal text-slate-400">({formatNumber(displayBatteries.length)})</span>
            </h2>
            <Button 
              onClick={() => setLocation("/battery/manage")}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl px-6"
            >
              <Plus className="h-4 w-4 me-2" />
              {language === 'ar' ? 'إضافة بطارية' : 'Add New Entry'}
            </Button>
          </div>

          {batteriesLoading || searchLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-slate-500">Loading your database...</p>
            </div>
          ) : displayBatteries.length === 0 ? (
            <div className="text-center py-24 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
              <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No results found</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayBatteries.map((battery) => (
                <Card 
                  key={battery.id} 
                  className={`border-slate-200 hover:border-primary/40 hover:shadow-xl transition-all duration-300 cursor-pointer group bg-white ${
                    (battery.stockQuantity || 0) <= (battery.minStockLevel || 2) 
                      ? 'ring-1 ring-red-500/20 bg-red-50/10' 
                      : ''
                  }`}
                  onClick={() => setLocation(`/battery/manage?edit=${battery.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold border-none px-2.5">
                          {battery.brand}
                        </Badge>
                        <h3 className="text-xl font-bold text-slate-900 truncate">
                          {battery.serialNumber}
                        </h3>
                        {battery.partNumber && (
                          <div className="text-xs font-medium text-slate-400 flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {battery.partNumber}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${
                          (battery.stockQuantity || 0) <= (battery.minStockLevel || 2) 
                            ? 'text-red-600' 
                            : 'text-primary'
                        }`}>
                          {formatNumber(battery.stockQuantity || 0)}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">In Stock</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Specs</div>
                        <div className="text-sm font-bold text-slate-700 mt-0.5">
                          {battery.voltage ? `${battery.voltage}V` : '-'}{battery.capacity ? ` • ${formatNumber(battery.capacity)}mAh` : ''}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Price</div>
                        <div className="text-sm font-bold text-primary mt-0.5">
                          {battery.sellingPrice ? `${formatNumber(Number(battery.sellingPrice))} د.ع` : 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Laptop className="h-3 w-3" />
                        Compatible Systems
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {battery.compatibleLaptops.slice(0, 3).map((laptop, idx) => (
                          <span key={idx} className="bg-white text-[11px] font-medium px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 shadow-sm">
                            {laptop}
                          </span>
                        ))}
                        {battery.compatibleLaptops.length > 3 && (
                          <span className="text-xs font-bold text-slate-400 self-center ps-1">
                            +{formatNumber(battery.compatibleLaptops.length - 3)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-bold text-primary flex items-center gap-1">
                        View Details <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
