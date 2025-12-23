import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Battery, 
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  Laptop
} from "lucide-react";
import type { LaptopBattery } from "@shared/schema";

export default function BatteryManage() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const editId = new URLSearchParams(searchParams).get('edit');
  
  const [showForm, setShowForm] = useState(false);
  const [editingBattery, setEditingBattery] = useState<LaptopBattery | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    serialNumber: "",
    partNumber: "",
    brand: "",
    compatibleLaptops: [] as string[],
    newLaptop: "",
    voltage: "",
    capacity: "",
    cells: "",
    stockQuantity: "0",
    minStockLevel: "2",
    purchasePrice: "",
    sellingPrice: "",
    wholesalePrice: "",
    supplier: "",
    location: "",
    notes: "",
  });

  const { data: currentUser, isLoading: authLoading } = useQuery({
    queryKey: ['/api/battery/auth/me'],
    retry: false,
  });

  const { data: batteries = [], isLoading: batteriesLoading } = useQuery<LaptopBattery[]>({
    queryKey: ['/api/battery/batteries'],
    enabled: !!currentUser,
  });

  useEffect(() => {
    if (editId && batteries.length > 0) {
      const battery = batteries.find(b => b.id === editId);
      if (battery) {
        setEditingBattery(battery);
        setFormData({
          serialNumber: battery.serialNumber,
          partNumber: battery.partNumber || "",
          brand: battery.brand,
          compatibleLaptops: battery.compatibleLaptops,
          newLaptop: "",
          voltage: battery.voltage?.toString() || "",
          capacity: battery.capacity?.toString() || "",
          cells: battery.cells?.toString() || "",
          stockQuantity: (battery.stockQuantity || 0).toString(),
          minStockLevel: (battery.minStockLevel || 2).toString(),
          purchasePrice: battery.purchasePrice?.toString().replace(/\.00$/, '') || "",
          sellingPrice: battery.sellingPrice?.toString().replace(/\.00$/, '') || "",
          wholesalePrice: battery.wholesalePrice?.toString().replace(/\.00$/, '') || "",
          supplier: battery.supplier || "",
          location: battery.location || "",
          notes: battery.notes || "",
        });
        setShowForm(true);
      }
    }
  }, [editId, batteries]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/battery/batteries', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/battery/batteries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/battery/batteries/low-stock'] });
      toast({ title: language === 'ar' ? 'تم إضافة البطارية بنجاح' : 'Battery added successfully' });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: language === 'ar' ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PUT', `/api/battery/batteries/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/battery/batteries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/battery/batteries/low-stock'] });
      toast({ title: language === 'ar' ? 'تم تحديث البطارية بنجاح' : 'Battery updated successfully' });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: language === 'ar' ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/battery/batteries/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/battery/batteries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/battery/batteries/low-stock'] });
      toast({ title: language === 'ar' ? 'تم حذف البطارية' : 'Battery deleted' });
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast({ title: language === 'ar' ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      serialNumber: "",
      partNumber: "",
      brand: "",
      compatibleLaptops: [],
      newLaptop: "",
      voltage: "",
      capacity: "",
      cells: "",
      stockQuantity: "0",
      minStockLevel: "2",
      purchasePrice: "",
      sellingPrice: "",
      wholesalePrice: "",
      supplier: "",
      location: "",
      notes: "",
    });
    setEditingBattery(null);
    setShowForm(false);
    setLocation("/battery/manage");
  };

  const addLaptopModel = () => {
    if (formData.newLaptop.trim() && !formData.compatibleLaptops.includes(formData.newLaptop.trim())) {
      setFormData({
        ...formData,
        compatibleLaptops: [...formData.compatibleLaptops, formData.newLaptop.trim()],
        newLaptop: "",
      });
    }
  };

  const removeLaptopModel = (index: number) => {
    setFormData({
      ...formData,
      compatibleLaptops: formData.compatibleLaptops.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.compatibleLaptops.length === 0) {
      toast({ 
        title: language === 'ar' ? 'خطأ' : 'Error', 
        description: language === 'ar' ? 'يجب إضافة موديل لابتوب واحد على الأقل' : 'Add at least one laptop model',
        variant: 'destructive' 
      });
      return;
    }

    const data = {
      serialNumber: formData.serialNumber,
      partNumber: formData.partNumber || null,
      brand: formData.brand,
      compatibleLaptops: formData.compatibleLaptops,
      voltage: formData.voltage ? parseFloat(formData.voltage) : null,
      capacity: formData.capacity ? parseInt(formData.capacity) : null,
      cells: formData.cells ? parseInt(formData.cells) : null,
      stockQuantity: parseInt(formData.stockQuantity) || 0,
      minStockLevel: parseInt(formData.minStockLevel) || 2,
      purchasePrice: formData.purchasePrice || null,
      sellingPrice: formData.sellingPrice || null,
      wholesalePrice: formData.wholesalePrice || null,
      supplier: formData.supplier || null,
      location: formData.location || null,
      notes: formData.notes || null,
    };

    if (editingBattery) {
      updateMutation.mutate({ id: editingBattery.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

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

  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen bg-muted/30" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="bg-green-600 text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/battery")}
            className="text-white hover:bg-green-700"
            data-testid="button-back-dashboard"
          >
            <BackIcon className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Battery className="h-6 w-6" />
            <h1 className="text-xl font-bold">
              {language === 'ar' ? 'إدارة البطاريات' : 'Manage Batteries'}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {!showForm ? (
          <>
            <Button 
              onClick={() => setShowForm(true)}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-new-battery"
            >
              <Plus className="h-4 w-4 me-2" />
              {language === 'ar' ? 'إضافة بطارية جديدة' : 'Add New Battery'}
            </Button>

            <Card>
              <CardHeader>
                <CardTitle>
                  {language === 'ar' ? 'جميع البطاريات' : 'All Batteries'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {batteriesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : batteries.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {language === 'ar' ? 'لا توجد بطاريات مضافة' : 'No batteries added'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {batteries.map((battery) => (
                      <div 
                        key={battery.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                      >
                        <div>
                          <p className="font-mono font-bold">{battery.serialNumber}</p>
                          <p className="text-sm text-muted-foreground">{battery.brand}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {battery.compatibleLaptops.slice(0, 3).map((laptop, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {laptop}
                              </Badge>
                            ))}
                            {battery.compatibleLaptops.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{battery.compatibleLaptops.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-end me-4">
                            <p className={`font-bold ${(battery.stockQuantity || 0) <= (battery.minStockLevel || 2) ? 'text-red-600' : ''}`}>
                              {battery.stockQuantity || 0}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {language === 'ar' ? 'مخزون' : 'stock'}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingBattery(battery);
                              setFormData({
                                serialNumber: battery.serialNumber,
                                partNumber: battery.partNumber || "",
                                brand: battery.brand,
                                compatibleLaptops: battery.compatibleLaptops,
                                newLaptop: "",
                                voltage: battery.voltage?.toString() || "",
                                capacity: battery.capacity?.toString() || "",
                                cells: battery.cells?.toString() || "",
                                stockQuantity: (battery.stockQuantity || 0).toString(),
                                minStockLevel: (battery.minStockLevel || 2).toString(),
                                purchasePrice: battery.purchasePrice?.toString().replace(/\.00$/, '') || "",
                                sellingPrice: battery.sellingPrice?.toString().replace(/\.00$/, '') || "",
                                wholesalePrice: battery.wholesalePrice?.toString().replace(/\.00$/, '') || "",
                                supplier: battery.supplier || "",
                                location: battery.location || "",
                                notes: battery.notes || "",
                              });
                              setShowForm(true);
                            }}
                            data-testid={`button-edit-${battery.id}`}
                          >
                            {language === 'ar' ? 'تعديل' : 'Edit'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => setDeleteConfirm(battery.id)}
                            data-testid={`button-delete-${battery.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {editingBattery 
                    ? (language === 'ar' ? 'تعديل البطارية' : 'Edit Battery')
                    : (language === 'ar' ? 'إضافة بطارية جديدة' : 'Add New Battery')
                  }
                </span>
                <Button variant="ghost" size="icon" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'الرقم التسلسلي *' : 'Serial Number *'}</Label>
                    <Input
                      value={formData.serialNumber}
                      onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      placeholder="PA3817U-1BRS"
                      required
                      disabled={!!editingBattery}
                      data-testid="input-serial-number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'رقم القطعة البديل' : 'Part Number'}</Label>
                    <Input
                      value={formData.partNumber}
                      onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                      placeholder="PABAS228"
                      data-testid="input-part-number"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'العلامة التجارية *' : 'Brand *'}</Label>
                  <Input
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Toshiba / Dell / HP / OEM"
                    required
                    data-testid="input-brand"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'الأجهزة المتوافقة *' : 'Compatible Laptops *'}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.newLaptop}
                      onChange={(e) => setFormData({ ...formData, newLaptop: e.target.value })}
                      placeholder={language === 'ar' ? 'مثال: Dell Latitude E6420' : 'e.g., Dell Latitude E6420'}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLaptopModel())}
                      data-testid="input-new-laptop"
                    />
                    <Button type="button" onClick={addLaptopModel} data-testid="button-add-laptop">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.compatibleLaptops.map((laptop, index) => (
                      <Badge key={index} variant="secondary" className="text-sm py-1 gap-1">
                        <Laptop className="h-3 w-3" />
                        {laptop}
                        <button 
                          type="button" 
                          onClick={() => removeLaptopModel(index)}
                          className="ms-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'الفولتية (V)' : 'Voltage (V)'}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.voltage}
                      onChange={(e) => setFormData({ ...formData, voltage: e.target.value })}
                      placeholder="10.8"
                      data-testid="input-voltage"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'السعة (mAh)' : 'Capacity (mAh)'}</Label>
                    <Input
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      placeholder="4400"
                      data-testid="input-capacity"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'عدد الخلايا' : 'Cells'}</Label>
                    <Input
                      type="number"
                      value={formData.cells}
                      onChange={(e) => setFormData({ ...formData, cells: e.target.value })}
                      placeholder="6"
                      data-testid="input-cells"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'الكمية في المخزون' : 'Stock Quantity'}</Label>
                    <Input
                      type="number"
                      value={formData.stockQuantity}
                      onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                      data-testid="input-stock-quantity"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'الحد الأدنى للمخزون' : 'Min Stock Level'}</Label>
                    <Input
                      type="number"
                      value={formData.minStockLevel}
                      onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                      data-testid="input-min-stock"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'سعر الشراء (IQD)' : 'Purchase Price (IQD)'}</Label>
                    <Input
                      type="number"
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                      data-testid="input-purchase-price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'سعر الجملة (IQD)' : 'Wholesale Price (IQD)'}</Label>
                    <Input
                      type="number"
                      value={formData.wholesalePrice}
                      onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                      data-testid="input-wholesale-price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'سعر البيع (IQD)' : 'Selling Price (IQD)'}</Label>
                    <Input
                      type="number"
                      value={formData.sellingPrice}
                      onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                      data-testid="input-selling-price"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'المورد' : 'Supplier'}</Label>
                    <Input
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      data-testid="input-supplier"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'مكان التخزين' : 'Storage Location'}</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder={language === 'ar' ? 'رف A-3' : 'Shelf A-3'}
                      data-testid="input-location"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'ملاحظات' : 'Notes'}</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    data-testid="input-notes"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-green-600 hover:bg-green-700"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-battery"
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? (
                      <Loader2 className="h-4 w-4 animate-spin me-2" />
                    ) : (
                      <Save className="h-4 w-4 me-2" />
                    )}
                    {language === 'ar' ? 'حفظ' : 'Save'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
            </DialogTitle>
          </DialogHeader>
          <p>
            {language === 'ar' 
              ? 'هل أنت متأكد من حذف هذه البطارية؟' 
              : 'Are you sure you want to delete this battery?'
            }
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {language === 'ar' ? 'حذف' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
