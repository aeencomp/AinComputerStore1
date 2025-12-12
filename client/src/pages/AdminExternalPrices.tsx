import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LogOut, Plus, Edit, Trash2, ArrowRight, Globe, DollarSign, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import type { MarketPrice, ExternalPriceSource } from "@shared/schema";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface ExchangeRateData {
  id?: string;
  rate: string;
  fromCurrency: string;
  toCurrency: string;
  lastUpdated?: string;
}

const sourceOptions = [
  { value: "newegg", labelAr: "نيو إيغ", labelEn: "Newegg", color: "bg-orange-500" },
  { value: "amazon", labelAr: "أمازون", labelEn: "Amazon", color: "bg-yellow-500" },
  { value: "aliexpress", labelAr: "علي إكسبريس", labelEn: "AliExpress", color: "bg-red-500" },
];

export default function AdminExternalPrices() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [showAddExternal, setShowAddExternal] = useState(false);
  const [showEditExternal, setShowEditExternal] = useState<ExternalPriceSource | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState(false);
  const [newRate, setNewRate] = useState("");
  
  const [formData, setFormData] = useState({
    marketPriceId: "",
    source: "newegg",
    sourceProductUrl: "",
    sourceProductName: "",
    priceUSD: "",
  });

  const { data: currentAdmin, isLoading: authLoading, isError: authError } = useQuery<AdminUser>({
    queryKey: ['/api/admin/auth/me'],
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && (authError || !currentAdmin)) {
      localStorage.removeItem("adminAuth");
      setLocation("/admin/login");
    }
  }, [authLoading, authError, currentAdmin, setLocation]);

  const { data: marketPrices = [] } = useQuery<MarketPrice[]>({
    queryKey: ['/api/admin/market-prices'],
    enabled: !!currentAdmin,
  });

  const { data: externalPrices = [], isLoading } = useQuery<ExternalPriceSource[]>({
    queryKey: ['/api/admin/external-prices'],
    enabled: !!currentAdmin,
  });

  const { data: exchangeRate } = useQuery<ExchangeRateData>({
    queryKey: ['/api/admin/exchange-rate'],
    enabled: !!currentAdmin,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/auth/logout');
    },
    onSuccess: () => {
      localStorage.removeItem("adminAuth");
      queryClient.clear();
      setLocation("/admin/login");
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('POST', '/api/admin/external-prices', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/external-prices'] });
      setShowAddExternal(false);
      resetForm();
      toast({
        title: language === 'ar' ? "تم إضافة السعر الخارجي" : "External Price Added",
        description: language === 'ar' ? "تم إضافة مرجع السعر العالمي بنجاح" : "International price reference added successfully",
      });
    },
    onError: () => {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل في إضافة السعر" : "Failed to add price",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const response = await apiRequest('PUT', `/api/admin/external-prices/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/external-prices'] });
      setShowEditExternal(null);
      resetForm();
      toast({
        title: language === 'ar' ? "تم تحديث السعر" : "Price Updated",
        description: language === 'ar' ? "تم تحديث السعر الخارجي بنجاح" : "External price updated successfully",
      });
    },
    onError: () => {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل في تحديث السعر" : "Failed to update price",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/admin/external-prices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/external-prices'] });
      setDeleteId(null);
      toast({
        title: language === 'ar' ? "تم الحذف" : "Deleted",
        description: language === 'ar' ? "تم حذف السعر الخارجي بنجاح" : "External price deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل في حذف السعر" : "Failed to delete price",
        variant: "destructive",
      });
    },
  });

  const updateRateMutation = useMutation({
    mutationFn: async (rate: string) => {
      const response = await apiRequest('PUT', '/api/admin/exchange-rate', { rate });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/exchange-rate'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/external-prices'] });
      setEditingRate(false);
      toast({
        title: language === 'ar' ? "تم تحديث سعر الصرف" : "Exchange Rate Updated",
        description: language === 'ar' ? "تم تحديث سعر صرف الدولار بنجاح" : "USD exchange rate updated successfully",
      });
    },
    onError: () => {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل في تحديث سعر الصرف" : "Failed to update exchange rate",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      marketPriceId: "",
      source: "newegg",
      sourceProductUrl: "",
      sourceProductName: "",
      priceUSD: "",
    });
  };

  const handleEditClick = (price: ExternalPriceSource) => {
    setFormData({
      marketPriceId: price.marketPriceId || "",
      source: price.source,
      sourceProductUrl: price.sourceProductUrl || "",
      sourceProductName: price.sourceProductName || "",
      priceUSD: price.priceUSD || "",
    });
    setShowEditExternal(price);
  };

  const handleSubmit = () => {
    if (showEditExternal) {
      updateMutation.mutate({ id: showEditExternal.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getMarketPriceName = (id: string | null) => {
    if (!id) return language === 'ar' ? 'غير محدد' : 'Not specified';
    const price = marketPrices.find(p => p.id === id);
    if (!price) return language === 'ar' ? 'غير موجود' : 'Not found';
    return language === 'ar' ? price.nameAr : price.nameEn;
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('ar-IQ').format(parseFloat(price));
  };

  const formatUSD = (price: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(price));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!currentAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" data-testid="link-back-dashboard">
                <ArrowRight className="w-4 h-4 ms-2" />
                {language === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
              </Button>
            </Link>
            <h1 className="text-xl font-bold">
              {language === 'ar' ? 'الأسعار العالمية' : 'International Prices'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {language === 'ar' ? 'مرحباً،' : 'Welcome,'} {currentAdmin.name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              {logoutMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin ms-2" />
              ) : (
                <LogOut className="w-4 h-4 ms-2" />
              )}
              {language === 'ar' ? 'خروج' : 'Logout'}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              {language === 'ar' ? 'سعر صرف الدولار' : 'USD Exchange Rate'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' 
                ? 'سعر صرف الدولار الأمريكي مقابل الدينار العراقي المستخدم لتحويل الأسعار العالمية'
                : 'USD to IQD exchange rate used for converting international prices'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-3xl font-bold" data-testid="text-exchange-rate">
                  $1 = {formatPrice(exchangeRate?.rate || "1310")} {language === 'ar' ? 'د.ع' : 'IQD'}
                </div>
                {exchangeRate?.lastUpdated && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === 'ar' ? 'آخر تحديث:' : 'Last updated:'}{' '}
                    {new Date(exchangeRate.lastUpdated).toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US')}
                  </p>
                )}
              </div>
              {editingRate ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    placeholder="1310"
                    className="w-32"
                    data-testid="input-exchange-rate"
                  />
                  <Button
                    size="sm"
                    onClick={() => updateRateMutation.mutate(newRate)}
                    disabled={updateRateMutation.isPending || !newRate}
                    data-testid="button-save-rate"
                  >
                    {updateRateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                    {language === 'ar' ? 'حفظ' : 'Save'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingRate(false)}
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewRate(exchangeRate?.rate || "1310");
                    setEditingRate(true);
                  }}
                  data-testid="button-edit-rate"
                >
                  <RefreshCw className="w-4 h-4 me-2" />
                  {language === 'ar' ? 'تحديث السعر' : 'Update Rate'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Globe className="w-6 h-6" />
              {language === 'ar' ? 'مراجع الأسعار العالمية' : 'International Price References'}
            </h2>
            <p className="text-muted-foreground">
              {language === 'ar' 
                ? 'أسعار المنتجات من المتاجر العالمية للمقارنة مع السوق المحلي'
                : 'Product prices from international stores for comparison with local market'
              }
            </p>
          </div>
          <Button onClick={() => setShowAddExternal(true)} data-testid="button-add-external">
            <Plus className="w-4 h-4 me-2" />
            {language === 'ar' ? 'إضافة سعر' : 'Add Price'}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : externalPrices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Globe className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {language === 'ar' ? 'لا توجد أسعار خارجية مسجلة بعد' : 'No external prices recorded yet'}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => setShowAddExternal(true)}>
                <Plus className="w-4 h-4 me-2" />
                {language === 'ar' ? 'إضافة أول سعر' : 'Add First Price'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {externalPrices.map(price => {
              const sourceInfo = sourceOptions.find(s => s.value === price.source.toLowerCase());
              return (
                <Card key={price.id} data-testid={`external-price-card-${price.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${sourceInfo?.color || 'bg-gray-500'}`} />
                          {sourceInfo ? (language === 'ar' ? sourceInfo.labelAr : sourceInfo.labelEn) : price.source}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {getMarketPriceName(price.marketPriceId)}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleEditClick(price)}
                          data-testid={`button-edit-${price.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteId(price.id)}
                          data-testid={`button-delete-${price.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {price.sourceProductName && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                        {price.sourceProductName}
                      </p>
                    )}
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">
                        {price.priceUSD ? formatUSD(price.priceUSD) : '-'}
                      </p>
                      {price.priceIQD && (
                        <p className="text-sm text-muted-foreground">
                          ≈ {formatPrice(price.priceIQD)} {language === 'ar' ? 'د.ع' : 'IQD'}
                        </p>
                      )}
                    </div>
                    {price.sourceProductUrl && (
                      <a
                        href={price.sourceProductUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-primary hover:underline mt-3"
                        data-testid={`link-source-${price.id}`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {language === 'ar' ? 'عرض المنتج' : 'View Product'}
                      </a>
                    )}
                    <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                      {language === 'ar' ? 'آخر تحديث:' : 'Last update:'}{' '}
                      {new Date(price.lastUpdated).toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US')}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={showAddExternal || !!showEditExternal} onOpenChange={(open) => {
        if (!open) {
          setShowAddExternal(false);
          setShowEditExternal(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {showEditExternal 
                ? (language === 'ar' ? 'تعديل السعر الخارجي' : 'Edit External Price')
                : (language === 'ar' ? 'إضافة سعر خارجي' : 'Add External Price')
              }
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? 'أدخل تفاصيل السعر من المتجر العالمي'
                : 'Enter price details from the international store'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'المنتج المحلي' : 'Local Product'}</Label>
              <Select
                value={formData.marketPriceId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, marketPriceId: value }))}
              >
                <SelectTrigger data-testid="select-market-price">
                  <SelectValue placeholder={language === 'ar' ? 'اختر المنتج' : 'Select product'} />
                </SelectTrigger>
                <SelectContent>
                  {marketPrices.map(price => (
                    <SelectItem key={price.id} value={price.id}>
                      {language === 'ar' ? price.nameAr : price.nameEn} - {price.brand} {price.capacity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'المتجر' : 'Store'}</Label>
              <Select
                value={formData.source}
                onValueChange={(value) => setFormData(prev => ({ ...prev, source: value }))}
              >
                <SelectTrigger data-testid="select-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map(source => (
                    <SelectItem key={source.value} value={source.value}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${source.color}`} />
                        {language === 'ar' ? source.labelAr : source.labelEn}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'اسم المنتج (اختياري)' : 'Product Name (Optional)'}</Label>
              <Input
                value={formData.sourceProductName}
                onChange={(e) => setFormData(prev => ({ ...prev, sourceProductName: e.target.value }))}
                placeholder={language === 'ar' ? 'اسم المنتج في المتجر' : 'Product name in store'}
                data-testid="input-product-name"
              />
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'رابط المنتج (اختياري)' : 'Product URL (Optional)'}</Label>
              <Input
                value={formData.sourceProductUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, sourceProductUrl: e.target.value }))}
                placeholder="https://..."
                dir="ltr"
                data-testid="input-product-url"
              />
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'السعر بالدولار ($)' : 'Price in USD ($)'}</Label>
              <Input
                type="number"
                value={formData.priceUSD}
                onChange={(e) => setFormData(prev => ({ ...prev, priceUSD: e.target.value }))}
                placeholder="0.00"
                dir="ltr"
                data-testid="input-price-usd"
              />
              {formData.priceUSD && exchangeRate?.rate && (
                <p className="text-sm text-muted-foreground">
                  ≈ {formatPrice((parseFloat(formData.priceUSD) * parseFloat(exchangeRate.rate)).toFixed(0))} {language === 'ar' ? 'د.ع' : 'IQD'}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddExternal(false);
                setShowEditExternal(null);
                resetForm();
              }}
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || !formData.marketPriceId || !formData.priceUSD}
              data-testid="button-submit-external"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin me-2" />
              )}
              {showEditExternal 
                ? (language === 'ar' ? 'تحديث' : 'Update')
                : (language === 'ar' ? 'إضافة' : 'Add')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? 'هل أنت متأكد من حذف هذا السعر؟ لا يمكن التراجع عن هذا الإجراء.'
                : 'Are you sure you want to delete this price? This action cannot be undone.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
