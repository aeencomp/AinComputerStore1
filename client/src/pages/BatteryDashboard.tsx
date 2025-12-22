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
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] font-mono selection:bg-green-500/30" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded border border-green-500/20">
              <Battery className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white uppercase">
                {language === 'ar' ? 'نظام البطاريات' : 'Battery.OS'}
              </h1>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                {currentUser.name} // SESSION_ACTIVE
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/battery/manage")}
              className="bg-transparent border-white/10 text-xs hover:bg-white/5 hover:text-white"
              data-testid="button-manage-batteries"
            >
              <Settings className="h-3.5 w-3.5 me-1.5" />
              {language === 'ar' ? 'إدارة' : 'CONFIG'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              className="bg-transparent border-white/10 text-xs hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20"
              data-testid="button-battery-logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-black/40 border-white/5 backdrop-blur-sm overflow-hidden group">
            <CardContent className="pt-6 relative">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/5 rounded group-hover:bg-green-500/10 transition-colors border border-white/5 group-hover:border-green-500/20">
                  <Battery className="h-5 w-5 text-muted-foreground group-hover:text-green-500 transition-colors" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    {language === 'ar' ? 'إجمالي البطاريات' : 'TOTAL_INDEXED'}
                  </p>
                  <p className="text-2xl font-bold text-white mt-1 font-mono">{formatNumber(batteries.length)}</p>
                </div>
              </div>
              <div className="absolute top-0 right-0 p-2 opacity-5">
                <Battery className="h-16 w-16 rotate-12" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-black/40 border-white/5 backdrop-blur-sm group">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/5 rounded group-hover:bg-blue-500/10 transition-colors border border-white/5 group-hover:border-blue-500/20">
                  <Package className="h-5 w-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    {language === 'ar' ? 'إجمالي المخزون' : 'AVAILABLE_UNITS'}
                  </p>
                  <p className="text-2xl font-bold text-white mt-1 font-mono">{formatNumber(totalStock)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={`bg-black/40 backdrop-blur-sm border-white/5 transition-all ${lowStockBatteries.length > 0 ? 'ring-1 ring-red-500/20 bg-red-500/5' : ''}`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded border ${lowStockBatteries.length > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/5'}`}>
                  <AlertTriangle className={`h-5 w-5 ${lowStockBatteries.length > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    {language === 'ar' ? 'مخزون منخفض' : 'CRITICAL_LEVEL'}
                  </p>
                  <p className={`text-2xl font-bold mt-1 font-mono ${lowStockBatteries.length > 0 ? 'text-red-500' : 'text-white'}`}>{formatNumber(lowStockBatteries.length)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex gap-1.5 p-1 bg-white/5 rounded-lg border border-white/5 self-start">
              {[
                { id: 'all', label: language === 'ar' ? 'الكل' : 'ALL' },
                { id: 'serial', label: language === 'ar' ? 'رقم البطارية' : 'SERIAL' },
                { id: 'laptop', label: language === 'ar' ? 'موديل اللابتوب' : 'LAPTOP' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSearchType(type.id as any)}
                  className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                    searchType === type.id 
                      ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]' 
                      : 'text-muted-foreground hover:text-white hover:bg-white/5'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            
            <div className="relative flex-1 md:max-w-md group">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-green-500 transition-colors" />
              <Input
                placeholder={
                  searchType === 'serial' 
                    ? (language === 'ar' ? 'أدخل رقم البطارية...' : 'SERIAL_NUMBER...')
                    : searchType === 'laptop'
                    ? (language === 'ar' ? 'أدخل موديل اللابتوب...' : 'LAPTOP_MODEL...')
                    : (language === 'ar' ? 'ابحث...' : 'QUERY_DATABASE...')
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-10 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50 focus-visible:ring-green-500/20 focus-visible:border-green-500/50 rounded-lg h-11"
                data-testid="input-battery-search"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchLoading && <Loader2 className="h-3 w-3 animate-spin text-green-500" />}
                <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] text-muted-foreground">
                  CMD K
                </kbd>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {searchQuery ? 'SEARCH_RESULTS' : 'PRIMARY_INDEX'} 
              <span className="ms-2 text-green-500/50">[{formatNumber(displayBatteries.length)}]</span>
            </h2>
            <Button 
              onClick={() => setLocation("/battery/manage")}
              className="bg-green-500 hover:bg-green-400 text-black font-bold text-[10px] uppercase tracking-tighter h-8"
              data-testid="button-add-battery"
            >
              <Plus className="h-3 w-3 me-1.5" />
              {language === 'ar' ? 'إضافة بطارية' : 'NEW_ENTRY'}
            </Button>
          </div>

          {batteriesLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-green-500" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Synchronizing Database...</p>
            </div>
          ) : displayBatteries.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-white/5 rounded-xl bg-white/2">
              <div className="bg-white/5 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">No records found matching query</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayBatteries.map((battery) => (
                <Card 
                  key={battery.id} 
                  className={`bg-black/20 border-white/5 hover:border-green-500/30 hover:bg-black/40 transition-all cursor-pointer group relative overflow-hidden ${
                    (battery.stockQuantity || 0) <= (battery.minStockLevel || 2) 
                      ? 'border-red-500/20 bg-red-500/5' 
                      : ''
                  }`}
                  onClick={() => setLocation(`/battery/manage?edit=${battery.id}`)}
                  data-testid={`card-battery-${battery.id}`}
                >
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-green-500 group-hover:text-green-400 uppercase tracking-tighter">
                          {battery.brand}
                        </div>
                        <h3 className="text-lg font-bold text-white font-mono tracking-tight leading-none">
                          {battery.serialNumber}
                        </h3>
                        {battery.partNumber && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            PN: {battery.partNumber}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-bold font-mono ${
                          (battery.stockQuantity || 0) <= (battery.minStockLevel || 2) 
                            ? 'text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                            : 'text-green-500'
                        }`}>
                          {formatNumber(battery.stockQuantity || 0)}
                        </div>
                        <div className="text-[8px] uppercase tracking-widest text-muted-foreground">STOCK_LVL</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="bg-white/5 border border-white/5 rounded p-1.5 text-center">
                        <div className="text-[8px] text-muted-foreground uppercase">VOLT</div>
                        <div className="text-[10px] font-bold text-white">{battery.voltage ? `${battery.voltage}V` : 'N/A'}</div>
                      </div>
                      <div className="bg-white/5 border border-white/5 rounded p-1.5 text-center">
                        <div className="text-[8px] text-muted-foreground uppercase">CAP</div>
                        <div className="text-[10px] font-bold text-white">{battery.capacity ? `${formatNumber(battery.capacity)}mAh` : 'N/A'}</div>
                      </div>
                      <div className="bg-white/5 border border-white/5 rounded p-1.5 text-center">
                        <div className="text-[8px] text-muted-foreground uppercase">PRC</div>
                        <div className="text-[10px] font-bold text-green-500">{battery.sellingPrice ? formatNumber(Number(battery.sellingPrice)) : 'N/A'}</div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[8px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        <Laptop className="h-2 w-2" />
                        COMPATIBILITY_MAP
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {battery.compatibleLaptops.slice(0, 3).map((laptop, idx) => (
                          <span key={idx} className="bg-white/5 text-[9px] px-2 py-0.5 rounded-sm border border-white/5 text-muted-foreground truncate max-w-[100px]">
                            {laptop}
                          </span>
                        ))}
                        {battery.compatibleLaptops.length > 3 && (
                          <span className="text-[9px] text-muted-foreground/50 self-center">
                            +{formatNumber(battery.compatibleLaptops.length - 3)}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  <div className="absolute bottom-0 left-0 h-0.5 bg-green-500/50 w-0 group-hover:w-full transition-all duration-500" />
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
