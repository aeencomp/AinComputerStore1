import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { LogOut, TrendingUp, TrendingDown, Minus, Plus, Edit, Trash2, ArrowRight, MemoryStick, HardDrive, CircuitBoard, Loader2, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import type { MarketPrice } from "@shared/schema";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

const componentTypes = [
  { value: "ram", labelAr: "ذاكرة عشوائية (RAM)", labelEn: "RAM Memory", icon: MemoryStick },
  { value: "ssd", labelAr: "أقراص SSD", labelEn: "SSD Drives", icon: HardDrive },
  { value: "m2", labelAr: "أقراص M.2 NVMe", labelEn: "M.2 NVMe Drives", icon: CircuitBoard },
];

const popularBrands = {
  ram: ["Kingston", "Corsair", "G.Skill", "Crucial", "TeamGroup", "ADATA"],
  ssd: ["Samsung", "Western Digital", "Crucial", "Kingston", "SanDisk", "Seagate"],
  m2: ["Samsung", "Western Digital", "Crucial", "Kingston", "Sabrent", "Seagate"],
};

const commonCapacities = {
  ram: ["4GB", "8GB", "16GB", "32GB", "64GB"],
  ssd: ["128GB", "256GB", "512GB", "1TB", "2TB", "4TB"],
  m2: ["256GB", "512GB", "1TB", "2TB", "4TB"],
};

export default function AdminMarketPrices() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState("ram");
  const [showAddPrice, setShowAddPrice] = useState(false);
  const [showEditPrice, setShowEditPrice] = useState<MarketPrice | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    componentType: "ram",
    nameAr: "",
    nameEn: "",
    brand: "",
    capacity: "",
    specs: "",
    currentPrice: "",
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

  const { data: marketPrices = [], isLoading } = useQuery<MarketPrice[]>({
    queryKey: ['/api/admin/market-prices'],
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
      const response = await apiRequest('POST', '/api/admin/market-prices', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/market-prices'] });
      setShowAddPrice(false);
      resetForm();
      toast({
        title: language === 'ar' ? "تم إضافة السعر" : "Price Added",
        description: language === 'ar' ? "تم إضافة سعر المكون بنجاح" : "Component price added successfully",
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
      const response = await apiRequest('PUT', `/api/admin/market-prices/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/market-prices'] });
      setShowEditPrice(null);
      resetForm();
      toast({
        title: language === 'ar' ? "تم تحديث السعر" : "Price Updated",
        description: language === 'ar' ? "تم تحديث سعر المكون بنجاح" : "Component price updated successfully",
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
      return await apiRequest('DELETE', `/api/admin/market-prices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/market-prices'] });
      setDeleteId(null);
      toast({
        title: language === 'ar' ? "تم الحذف" : "Deleted",
        description: language === 'ar' ? "تم حذف السعر بنجاح" : "Price deleted successfully",
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

  const resetForm = () => {
    setFormData({
      componentType: activeTab,
      nameAr: "",
      nameEn: "",
      brand: "",
      capacity: "",
      specs: "",
      currentPrice: "",
    });
  };

  const handleAddClick = () => {
    setFormData(prev => ({ ...prev, componentType: activeTab }));
    setShowAddPrice(true);
  };

  const handleEditClick = (price: MarketPrice) => {
    setFormData({
      componentType: price.componentType,
      nameAr: price.nameAr,
      nameEn: price.nameEn,
      brand: price.brand,
      capacity: price.capacity,
      specs: price.specs || "",
      currentPrice: price.currentPrice,
    });
    setShowEditPrice(price);
  };

  const handleSubmit = () => {
    if (showEditPrice) {
      updateMutation.mutate({ id: showEditPrice.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getPriceChange = (current: string, previous: string | null) => {
    if (!previous) return { change: 0, percentage: 0 };
    const currentNum = parseFloat(current);
    const previousNum = parseFloat(previous);
    const change = currentNum - previousNum;
    const percentage = ((change / previousNum) * 100);
    return { change, percentage };
  };

  const filterByType = (type: string) => {
    return marketPrices.filter(p => p.componentType === type);
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('ar-IQ').format(parseFloat(price));
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
              {language === 'ar' ? 'تحليل أسعار السوق' : 'Market Price Analysis'}
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">
              {language === 'ar' ? 'أسعار المكونات اليومية' : 'Daily Component Prices'}
            </h2>
            <p className="text-muted-foreground">
              {language === 'ar' ? 'تحديث يومي لأسعار الذاكرة والتخزين في السوق العراقي' : 'Daily price updates for memory and storage in the Iraqi market'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/external-prices">
              <Button variant="outline" data-testid="link-external-prices">
                <Globe className="w-4 h-4 me-2" />
                {language === 'ar' ? 'الأسعار العالمية' : 'International Prices'}
              </Button>
            </Link>
            <Button onClick={handleAddClick} data-testid="button-add-price">
              <Plus className="w-4 h-4 me-2" />
              {language === 'ar' ? 'إضافة سعر' : 'Add Price'}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            {componentTypes.map(type => (
              <TabsTrigger key={type.value} value={type.value} data-testid={`tab-${type.value}`}>
                <type.icon className="w-4 h-4 me-2" />
                {language === 'ar' ? type.labelAr : type.labelEn}
              </TabsTrigger>
            ))}
          </TabsList>

          {componentTypes.map(type => (
            <TabsContent key={type.value} value={type.value}>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : filterByType(type.value).length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <type.icon className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      {language === 'ar' ? 'لا توجد أسعار مسجلة بعد' : 'No prices recorded yet'}
                    </p>
                    <Button variant="outline" className="mt-4" onClick={handleAddClick}>
                      <Plus className="w-4 h-4 me-2" />
                      {language === 'ar' ? 'إضافة أول سعر' : 'Add First Price'}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filterByType(type.value).map(price => {
                    const { change, percentage } = getPriceChange(price.currentPrice, price.previousPrice);
                    const isUp = change > 0;
                    const isDown = change < 0;
                    
                    return (
                      <Card key={price.id} data-testid={`price-card-${price.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-base">
                                {language === 'ar' ? price.nameAr : price.nameEn}
                              </CardTitle>
                              <CardDescription>
                                {price.brand} - {price.capacity}
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
                          {price.specs && (
                            <p className="text-sm text-muted-foreground mb-2">{price.specs}</p>
                          )}
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-2xl font-bold">
                                {formatPrice(price.currentPrice)}
                                <span className="text-sm font-normal text-muted-foreground ms-1">
                                  {language === 'ar' ? 'د.ع' : 'IQD'}
                                </span>
                              </p>
                              {price.previousPrice && (
                                <p className="text-sm text-muted-foreground line-through">
                                  {formatPrice(price.previousPrice)} {language === 'ar' ? 'د.ع' : 'IQD'}
                                </p>
                              )}
                            </div>
                            {price.previousPrice && (
                              <Badge 
                                variant={isDown ? "default" : isUp ? "destructive" : "secondary"}
                                className={`flex items-center gap-1 ${isDown ? 'bg-green-500 hover:bg-green-600' : ''}`}
                              >
                                {isUp ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : isDown ? (
                                  <TrendingDown className="w-3 h-3" />
                                ) : (
                                  <Minus className="w-3 h-3" />
                                )}
                                {percentage.toFixed(1)}%
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {language === 'ar' ? 'آخر تحديث:' : 'Last update:'}{' '}
                            {new Date(price.priceDate).toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US')}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <Dialog open={showAddPrice || !!showEditPrice} onOpenChange={(open) => {
        if (!open) {
          setShowAddPrice(false);
          setShowEditPrice(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {showEditPrice 
                ? (language === 'ar' ? 'تعديل السعر' : 'Edit Price')
                : (language === 'ar' ? 'إضافة سعر جديد' : 'Add New Price')
              }
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? 'أدخل تفاصيل المكون والسعر الحالي'
                : 'Enter component details and current price'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'نوع المكون' : 'Component Type'}</Label>
              <Select
                value={formData.componentType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, componentType: value }))}
              >
                <SelectTrigger data-testid="select-component-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {componentTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {language === 'ar' ? type.labelAr : type.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'}</Label>
                <Input
                  value={formData.nameAr}
                  onChange={(e) => setFormData(prev => ({ ...prev, nameAr: e.target.value }))}
                  placeholder={language === 'ar' ? 'مثال: رام كورسير' : 'e.g., رام كورسير'}
                  data-testid="input-name-ar"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'الاسم بالإنجليزية' : 'English Name'}</Label>
                <Input
                  value={formData.nameEn}
                  onChange={(e) => setFormData(prev => ({ ...prev, nameEn: e.target.value }))}
                  placeholder="e.g., Corsair RAM"
                  data-testid="input-name-en"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'العلامة التجارية' : 'Brand'}</Label>
                <Select
                  value={formData.brand}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, brand: value }))}
                >
                  <SelectTrigger data-testid="select-brand">
                    <SelectValue placeholder={language === 'ar' ? 'اختر العلامة' : 'Select brand'} />
                  </SelectTrigger>
                  <SelectContent>
                    {popularBrands[formData.componentType as keyof typeof popularBrands]?.map(brand => (
                      <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'السعة' : 'Capacity'}</Label>
                <Select
                  value={formData.capacity}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, capacity: value }))}
                >
                  <SelectTrigger data-testid="select-capacity">
                    <SelectValue placeholder={language === 'ar' ? 'اختر السعة' : 'Select capacity'} />
                  </SelectTrigger>
                  <SelectContent>
                    {commonCapacities[formData.componentType as keyof typeof commonCapacities]?.map(cap => (
                      <SelectItem key={cap} value={cap}>{cap}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'المواصفات (اختياري)' : 'Specs (Optional)'}</Label>
              <Input
                value={formData.specs}
                onChange={(e) => setFormData(prev => ({ ...prev, specs: e.target.value }))}
                placeholder={language === 'ar' ? 'مثال: DDR4 3200MHz' : 'e.g., DDR4 3200MHz'}
                data-testid="input-specs"
              />
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'السعر الحالي (د.ع)' : 'Current Price (IQD)'}</Label>
              <Input
                type="number"
                value={formData.currentPrice}
                onChange={(e) => setFormData(prev => ({ ...prev, currentPrice: e.target.value }))}
                placeholder="0"
                data-testid="input-current-price"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddPrice(false);
                setShowEditPrice(null);
                resetForm();
              }}
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || !formData.nameAr || !formData.nameEn || !formData.brand || !formData.capacity || !formData.currentPrice}
              data-testid="button-submit-price"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin me-2" />
              )}
              {showEditPrice 
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
