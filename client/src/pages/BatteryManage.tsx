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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Battery, 
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  Laptop,
  Search,
  AlertTriangle,
  Download,
  Upload,
  Database,
  Plug,
} from "lucide-react";
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
import type { LaptopBattery, AcAdapter } from "@shared/schema";

export default function BatteryManage() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const urlParams = new URLSearchParams(searchParams);
  const editId = urlParams.get('edit');
  const lowstockParam = urlParams.get('lowstock');
  const tabParam = urlParams.get('tab');
  
  const [activeTab, setActiveTab] = useState(tabParam === 'adapters' ? 'adapters' : 'batteries');
  const [showForm, setShowForm] = useState(false);
  const [editingBattery, setEditingBattery] = useState<LaptopBattery | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(lowstockParam === 'true');
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreResult, setRestoreResult] = useState<{
    success: boolean;
    message: string;
    added: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  
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

  // AC Adapter states
  const [showAdapterForm, setShowAdapterForm] = useState(false);
  const [editingAdapter, setEditingAdapter] = useState<AcAdapter | null>(null);
  const [adapterDeleteConfirm, setAdapterDeleteConfirm] = useState<string | null>(null);
  const [adapterSearchQuery, setAdapterSearchQuery] = useState("");
  const [showAdapterLowStockOnly, setShowAdapterLowStockOnly] = useState(false);
  
  const [adapterFormData, setAdapterFormData] = useState({
    serialNumber: "",
    partNumber: "",
    brand: "",
    compatibleLaptops: [] as string[],
    newLaptop: "",
    inputVoltage: "",
    outputVoltage: "",
    amperage: "",
    wattage: "",
    connectorType: "",
    tipSize: "",
    plugType: "",
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

  const { data: adapters = [], isLoading: adaptersLoading } = useQuery<AcAdapter[]>({
    queryKey: ['/api/battery/adapters'],
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
          purchasePrice: battery.purchasePrice ? String(parseFloat(battery.purchasePrice)) : "",
          sellingPrice: battery.sellingPrice ? String(parseFloat(battery.sellingPrice)) : "",
          wholesalePrice: battery.wholesalePrice ? String(parseFloat(battery.wholesalePrice)) : "",
          supplier: battery.supplier || "",
          location: battery.location || "",
          notes: battery.notes || "",
        });
        setShowForm(true);
      }
    }
  }, [editId, batteries]);

  // Battery mutations
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

  // AC Adapter mutations
  const createAdapterMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/battery/adapters', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/battery/adapters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/battery/adapters/low-stock'] });
      toast({ title: language === 'ar' ? 'تم إضافة الشاحن بنجاح' : 'AC Adapter added successfully' });
      resetAdapterForm();
    },
    onError: (error: any) => {
      toast({ title: language === 'ar' ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateAdapterMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PUT', `/api/battery/adapters/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/battery/adapters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/battery/adapters/low-stock'] });
      toast({ title: language === 'ar' ? 'تم تحديث الشاحن بنجاح' : 'AC Adapter updated successfully' });
      resetAdapterForm();
    },
    onError: (error: any) => {
      toast({ title: language === 'ar' ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteAdapterMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/battery/adapters/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/battery/adapters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/battery/adapters/low-stock'] });
      toast({ title: language === 'ar' ? 'تم حذف الشاحن' : 'AC Adapter deleted' });
      setAdapterDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast({ title: language === 'ar' ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (backupData: any) => {
      const res = await apiRequest('POST', '/api/battery/batteries/restore', backupData);
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/battery/batteries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/battery/batteries/low-stock'] });
      setRestoreResult(result);
      setRestoreFile(null);
    },
    onError: (error: any) => {
      toast({ 
        title: language === 'ar' ? 'خطأ في الاستعادة' : 'Restore Error', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const response = await fetch('/api/battery/batteries/backup', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Backup failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `battery-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ 
        title: language === 'ar' ? 'تم إنشاء النسخة الاحتياطية' : 'Backup Created',
        description: language === 'ar' ? 'تم تحميل الملف بنجاح' : 'File downloaded successfully',
      });
    } catch (error) {
      toast({ 
        title: language === 'ar' ? 'خطأ' : 'Error', 
        description: language === 'ar' ? 'فشل في إنشاء النسخة الاحتياطية' : 'Failed to create backup',
        variant: 'destructive' 
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreFile(file);
      setShowRestoreDialog(true);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreFile) return;
    
    try {
      const text = await restoreFile.text();
      const backupData = JSON.parse(text);
      backupData.mode = 'merge';
      restoreMutation.mutate(backupData);
    } catch (error) {
      toast({ 
        title: language === 'ar' ? 'خطأ' : 'Error', 
        description: language === 'ar' ? 'ملف غير صالح' : 'Invalid file format',
        variant: 'destructive' 
      });
    }
  };

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

  const resetAdapterForm = () => {
    setAdapterFormData({
      serialNumber: "",
      partNumber: "",
      brand: "",
      compatibleLaptops: [],
      newLaptop: "",
      inputVoltage: "",
      outputVoltage: "",
      amperage: "",
      wattage: "",
      connectorType: "",
      tipSize: "",
      plugType: "",
      stockQuantity: "0",
      minStockLevel: "2",
      purchasePrice: "",
      sellingPrice: "",
      wholesalePrice: "",
      supplier: "",
      location: "",
      notes: "",
    });
    setEditingAdapter(null);
    setShowAdapterForm(false);
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

  const addAdapterLaptopModel = () => {
    if (adapterFormData.newLaptop.trim() && !adapterFormData.compatibleLaptops.includes(adapterFormData.newLaptop.trim())) {
      setAdapterFormData({
        ...adapterFormData,
        compatibleLaptops: [...adapterFormData.compatibleLaptops, adapterFormData.newLaptop.trim()],
        newLaptop: "",
      });
    }
  };

  const removeAdapterLaptopModel = (index: number) => {
    setAdapterFormData({
      ...adapterFormData,
      compatibleLaptops: adapterFormData.compatibleLaptops.filter((_, i) => i !== index),
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

  const handleAdapterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (adapterFormData.compatibleLaptops.length === 0) {
      toast({ 
        title: language === 'ar' ? 'خطأ' : 'Error', 
        description: language === 'ar' ? 'يجب إضافة موديل لابتوب واحد على الأقل' : 'Add at least one laptop model',
        variant: 'destructive' 
      });
      return;
    }

    const data = {
      serialNumber: adapterFormData.serialNumber,
      partNumber: adapterFormData.partNumber || null,
      brand: adapterFormData.brand,
      compatibleLaptops: adapterFormData.compatibleLaptops,
      inputVoltage: adapterFormData.inputVoltage || null,
      outputVoltage: adapterFormData.outputVoltage ? parseFloat(adapterFormData.outputVoltage) : null,
      amperage: adapterFormData.amperage ? parseFloat(adapterFormData.amperage) : null,
      wattage: adapterFormData.wattage ? parseInt(adapterFormData.wattage) : null,
      connectorType: adapterFormData.connectorType || null,
      tipSize: adapterFormData.tipSize || null,
      plugType: adapterFormData.plugType || null,
      stockQuantity: parseInt(adapterFormData.stockQuantity) || 0,
      minStockLevel: parseInt(adapterFormData.minStockLevel) || 2,
      purchasePrice: adapterFormData.purchasePrice || null,
      sellingPrice: adapterFormData.sellingPrice || null,
      wholesalePrice: adapterFormData.wholesalePrice || null,
      supplier: adapterFormData.supplier || null,
      location: adapterFormData.location || null,
      notes: adapterFormData.notes || null,
    };

    if (editingAdapter) {
      updateAdapterMutation.mutate({ id: editingAdapter.id, data });
    } else {
      createAdapterMutation.mutate(data);
    }
  };

  const editAdapter = (adapter: AcAdapter) => {
    setEditingAdapter(adapter);
    setAdapterFormData({
      serialNumber: adapter.serialNumber,
      partNumber: adapter.partNumber || "",
      brand: adapter.brand,
      compatibleLaptops: adapter.compatibleLaptops,
      newLaptop: "",
      inputVoltage: adapter.inputVoltage || "",
      outputVoltage: adapter.outputVoltage ? String(parseFloat(adapter.outputVoltage)) : "",
      amperage: adapter.amperage ? String(parseFloat(adapter.amperage)) : "",
      wattage: adapter.wattage?.toString() || "",
      connectorType: adapter.connectorType || "",
      tipSize: adapter.tipSize || "",
      plugType: adapter.plugType || "",
      stockQuantity: (adapter.stockQuantity || 0).toString(),
      minStockLevel: (adapter.minStockLevel || 2).toString(),
      purchasePrice: adapter.purchasePrice ? String(parseFloat(adapter.purchasePrice)) : "",
      sellingPrice: adapter.sellingPrice ? String(parseFloat(adapter.sellingPrice)) : "",
      wholesalePrice: adapter.wholesalePrice ? String(parseFloat(adapter.wholesalePrice)) : "",
      supplier: adapter.supplier || "",
      location: adapter.location || "",
      notes: adapter.notes || "",
    });
    setShowAdapterForm(true);
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

  // Filter adapters based on search and low stock filter
  const getFilteredAdapters = () => {
    let filteredAdapters = adapters;
    
    if (showAdapterLowStockOnly) {
      filteredAdapters = filteredAdapters.filter(a => 
        (a.stockQuantity || 0) <= (a.minStockLevel || 2)
      );
    }
    
    if (adapterSearchQuery.trim()) {
      const query = adapterSearchQuery.toLowerCase();
      filteredAdapters = filteredAdapters.filter(a => 
        a.serialNumber.toLowerCase().includes(query) ||
        a.brand.toLowerCase().includes(query) ||
        a.partNumber?.toLowerCase().includes(query) ||
        a.compatibleLaptops.some(laptop => laptop.toLowerCase().includes(query)) ||
        a.wattage?.toString().includes(query)
      );
    }
    
    return filteredAdapters;
  };

  const lowStockAdaptersCount = adapters.filter(a => (a.stockQuantity || 0) <= (a.minStockLevel || 2)).length;

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
              {language === 'ar' ? 'إدارة المنتجات' : 'Manage Products'}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2" data-testid="tabs-list">
            <TabsTrigger value="batteries" data-testid="tab-batteries" className="gap-2">
              <Battery className="h-4 w-4" />
              {language === 'ar' ? 'البطاريات' : 'Batteries'}
            </TabsTrigger>
            <TabsTrigger value="adapters" data-testid="tab-adapters" className="gap-2">
              <Plug className="h-4 w-4" />
              {language === 'ar' ? 'الشواحن' : 'AC Adapters'}
            </TabsTrigger>
          </TabsList>

          {/* Batteries Tab */}
          <TabsContent value="batteries" data-testid="content-batteries">
            {!showForm ? (
              <>
                <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      onClick={() => setShowForm(true)}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-new-battery"
                    >
                      <Plus className="h-4 w-4 me-2" />
                      {language === 'ar' ? 'إضافة بطارية جديدة' : 'Add New Battery'}
                    </Button>
                    
                    <Button 
                      onClick={handleBackup}
                      variant="outline"
                      disabled={isBackingUp}
                      data-testid="button-backup"
                    >
                      {isBackingUp ? (
                        <Loader2 className="h-4 w-4 me-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 me-2" />
                      )}
                      {language === 'ar' ? 'نسخ احتياطي' : 'Backup'}
                    </Button>
                    
                    <div className="relative">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleRestoreFile}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        data-testid="input-restore-file"
                      />
                      <Button 
                        variant="outline"
                        data-testid="button-restore"
                      >
                        <Upload className="h-4 w-4 me-2" />
                        {language === 'ar' ? 'استعادة' : 'Restore'}
                      </Button>
                    </div>
                  </div>
                  
                  {batteries.filter(b => (b.stockQuantity || 0) <= (b.minStockLevel || 2)).length > 0 && (
                    <Button
                      variant={showLowStockOnly ? "destructive" : "outline"}
                      onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                      className="gap-2"
                      data-testid="button-low-stock-filter"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      {language === 'ar' ? 'نقص المخزون' : 'Low Stock'}
                      <Badge variant="secondary" className={showLowStockOnly ? "bg-white/20 text-white" : "bg-red-100 text-red-700"}>
                        {batteries.filter(b => (b.stockQuantity || 0) <= (b.minStockLevel || 2)).length}
                      </Badge>
                    </Button>
                  )}
                </div>

                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                      <CardTitle>
                        {showLowStockOnly 
                          ? (language === 'ar' ? 'بطاريات نقص المخزون' : 'Low Stock Batteries')
                          : (language === 'ar' ? 'جميع البطاريات' : 'All Batteries')
                        }
                      </CardTitle>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="ps-9"
                          data-testid="input-search-batteries"
                        />
                      </div>
                    </div>
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
                    ) : (() => {
                      let filteredBatteries = batteries;
                      
                      if (showLowStockOnly) {
                        filteredBatteries = filteredBatteries.filter(b => 
                          (b.stockQuantity || 0) <= (b.minStockLevel || 2)
                        );
                      }
                      
                      if (searchQuery.trim()) {
                        const query = searchQuery.toLowerCase();
                        filteredBatteries = filteredBatteries.filter(b => 
                          b.serialNumber.toLowerCase().includes(query) ||
                          b.brand.toLowerCase().includes(query) ||
                          b.partNumber?.toLowerCase().includes(query) ||
                          b.compatibleLaptops.some(laptop => laptop.toLowerCase().includes(query))
                        );
                      }
                      
                      if (filteredBatteries.length === 0) {
                        return (
                          <p className="text-center text-muted-foreground py-8">
                            {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
                          </p>
                        );
                      }
                      
                      return (
                        <div className="space-y-3">
                          {filteredBatteries.map((battery) => (
                            <div 
                              key={battery.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                              data-testid={`battery-item-${battery.id}`}
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
                                      purchasePrice: battery.purchasePrice ? String(parseFloat(battery.purchasePrice)) : "",
                                      sellingPrice: battery.sellingPrice ? String(parseFloat(battery.sellingPrice)) : "",
                                      wholesalePrice: battery.wholesalePrice ? String(parseFloat(battery.wholesalePrice)) : "",
                                      supplier: battery.supplier || "",
                                      location: battery.location || "",
                                      notes: battery.notes || "",
                                    });
                                    setShowForm(true);
                                  }}
                                  data-testid={`button-edit-battery-${battery.id}`}
                                >
                                  {language === 'ar' ? 'تعديل' : 'Edit'}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => setDeleteConfirm(battery.id)}
                                  data-testid={`button-delete-battery-${battery.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
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
                    <Button variant="ghost" size="icon" onClick={resetForm} data-testid="button-close-battery-form">
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
                          data-testid="input-battery-serial-number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'رقم القطعة البديل' : 'Part Number'}</Label>
                        <Input
                          value={formData.partNumber}
                          onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                          placeholder="PABAS228"
                          data-testid="input-battery-part-number"
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
                        data-testid="input-battery-brand"
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
                          data-testid="input-battery-new-laptop"
                        />
                        <Button type="button" onClick={addLaptopModel} data-testid="button-add-battery-laptop">
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
                              data-testid={`button-remove-battery-laptop-${index}`}
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
                          data-testid="input-battery-voltage"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'السعة (mAh)' : 'Capacity (mAh)'}</Label>
                        <Input
                          type="number"
                          value={formData.capacity}
                          onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                          placeholder="4400"
                          data-testid="input-battery-capacity"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'عدد الخلايا' : 'Cells'}</Label>
                        <Input
                          type="number"
                          value={formData.cells}
                          onChange={(e) => setFormData({ ...formData, cells: e.target.value })}
                          placeholder="6"
                          data-testid="input-battery-cells"
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
                          data-testid="input-battery-stock-quantity"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'الحد الأدنى للمخزون' : 'Min Stock Level'}</Label>
                        <Input
                          type="number"
                          value={formData.minStockLevel}
                          onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                          data-testid="input-battery-min-stock"
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
                          data-testid="input-battery-purchase-price"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'سعر الجملة (IQD)' : 'Wholesale Price (IQD)'}</Label>
                        <Input
                          type="number"
                          value={formData.wholesalePrice}
                          onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                          data-testid="input-battery-wholesale-price"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'سعر البيع (IQD)' : 'Selling Price (IQD)'}</Label>
                        <Input
                          type="number"
                          value={formData.sellingPrice}
                          onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                          data-testid="input-battery-selling-price"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'المورد' : 'Supplier'}</Label>
                        <Input
                          value={formData.supplier}
                          onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                          data-testid="input-battery-supplier"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'مكان التخزين' : 'Storage Location'}</Label>
                        <Input
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          placeholder={language === 'ar' ? 'رف A-3' : 'Shelf A-3'}
                          data-testid="input-battery-location"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'ملاحظات' : 'Notes'}</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        data-testid="input-battery-notes"
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={resetForm} data-testid="button-cancel-battery">
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
          </TabsContent>

          {/* AC Adapters Tab */}
          <TabsContent value="adapters" data-testid="content-adapters">
            {!showAdapterForm ? (
              <>
                <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      onClick={() => setShowAdapterForm(true)}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-new-adapter"
                    >
                      <Plus className="h-4 w-4 me-2" />
                      {language === 'ar' ? 'إضافة شاحن جديد' : 'Add New Adapter'}
                    </Button>
                  </div>
                  
                  {lowStockAdaptersCount > 0 && (
                    <Button
                      variant={showAdapterLowStockOnly ? "destructive" : "outline"}
                      onClick={() => setShowAdapterLowStockOnly(!showAdapterLowStockOnly)}
                      className="gap-2"
                      data-testid="button-adapter-low-stock-filter"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      {language === 'ar' ? 'نقص المخزون' : 'Low Stock'}
                      <Badge variant="secondary" className={showAdapterLowStockOnly ? "bg-white/20 text-white" : "bg-red-100 text-red-700"}>
                        {lowStockAdaptersCount}
                      </Badge>
                    </Button>
                  )}
                </div>

                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                      <CardTitle>
                        {showAdapterLowStockOnly 
                          ? (language === 'ar' ? 'شواحن نقص المخزون' : 'Low Stock Adapters')
                          : (language === 'ar' ? 'جميع الشواحن' : 'All AC Adapters')
                        }
                      </CardTitle>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
                          value={adapterSearchQuery}
                          onChange={(e) => setAdapterSearchQuery(e.target.value)}
                          className="ps-9"
                          data-testid="input-search-adapters"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {adaptersLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : adapters.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        {language === 'ar' ? 'لا توجد شواحن مضافة' : 'No adapters added'}
                      </p>
                    ) : (() => {
                      const filteredAdapters = getFilteredAdapters();
                      
                      if (filteredAdapters.length === 0) {
                        return (
                          <p className="text-center text-muted-foreground py-8">
                            {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
                          </p>
                        );
                      }
                      
                      return (
                        <div className="space-y-3">
                          {filteredAdapters.map((adapter) => (
                            <div 
                              key={adapter.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                              data-testid={`adapter-item-${adapter.id}`}
                            >
                              <div>
                                <p className="font-mono font-bold">{adapter.serialNumber}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span>{adapter.brand}</span>
                                  {adapter.wattage && (
                                    <Badge variant="outline" className="text-xs">
                                      {adapter.wattage}W
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {adapter.compatibleLaptops.slice(0, 3).map((laptop, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {laptop}
                                    </Badge>
                                  ))}
                                  {adapter.compatibleLaptops.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{adapter.compatibleLaptops.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-end me-4">
                                  <p className={`font-bold ${(adapter.stockQuantity || 0) <= (adapter.minStockLevel || 2) ? 'text-red-600' : ''}`}>
                                    {adapter.stockQuantity || 0}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {language === 'ar' ? 'مخزون' : 'stock'}
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => editAdapter(adapter)}
                                  data-testid={`button-edit-adapter-${adapter.id}`}
                                >
                                  {language === 'ar' ? 'تعديل' : 'Edit'}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => setAdapterDeleteConfirm(adapter.id)}
                                  data-testid={`button-delete-adapter-${adapter.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>
                      {editingAdapter 
                        ? (language === 'ar' ? 'تعديل الشاحن' : 'Edit AC Adapter')
                        : (language === 'ar' ? 'إضافة شاحن جديد' : 'Add New AC Adapter')
                      }
                    </span>
                    <Button variant="ghost" size="icon" onClick={resetAdapterForm} data-testid="button-close-adapter-form">
                      <X className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAdapterSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'الرقم التسلسلي *' : 'Serial Number *'}</Label>
                        <Input
                          value={adapterFormData.serialNumber}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, serialNumber: e.target.value })}
                          placeholder="DA130PM130"
                          required
                          data-testid="input-adapter-serial-number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'رقم القطعة البديل' : 'Part Number'}</Label>
                        <Input
                          value={adapterFormData.partNumber}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, partNumber: e.target.value })}
                          placeholder="0VJCH5"
                          data-testid="input-adapter-part-number"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'العلامة التجارية *' : 'Brand *'}</Label>
                      <Input
                        value={adapterFormData.brand}
                        onChange={(e) => setAdapterFormData({ ...adapterFormData, brand: e.target.value })}
                        placeholder="Dell / HP / Lenovo / Universal"
                        required
                        data-testid="input-adapter-brand"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'الأجهزة المتوافقة *' : 'Compatible Laptops *'}</Label>
                      <div className="flex gap-2">
                        <Input
                          value={adapterFormData.newLaptop}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, newLaptop: e.target.value })}
                          placeholder={language === 'ar' ? 'مثال: Dell Latitude E6420' : 'e.g., Dell Latitude E6420'}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAdapterLaptopModel())}
                          data-testid="input-adapter-new-laptop"
                        />
                        <Button type="button" onClick={addAdapterLaptopModel} data-testid="button-add-adapter-laptop">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {adapterFormData.compatibleLaptops.map((laptop, index) => (
                          <Badge key={index} variant="secondary" className="text-sm py-1 gap-1">
                            <Laptop className="h-3 w-3" />
                            {laptop}
                            <button 
                              type="button" 
                              onClick={() => removeAdapterLaptopModel(index)}
                              className="ms-1 hover:text-destructive"
                              data-testid={`button-remove-adapter-laptop-${index}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'فولتية الدخل' : 'Input Voltage'}</Label>
                        <Input
                          value={adapterFormData.inputVoltage}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, inputVoltage: e.target.value })}
                          placeholder="100-240V AC"
                          data-testid="input-adapter-input-voltage"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'فولتية الخرج (V)' : 'Output Voltage (V)'}</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={adapterFormData.outputVoltage}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, outputVoltage: e.target.value })}
                          placeholder="19.5"
                          data-testid="input-adapter-output-voltage"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'الأمبير (A)' : 'Amperage (A)'}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={adapterFormData.amperage}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, amperage: e.target.value })}
                          placeholder="3.34"
                          data-testid="input-adapter-amperage"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'القدرة (W)' : 'Wattage (W)'}</Label>
                        <Input
                          type="number"
                          value={adapterFormData.wattage}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, wattage: e.target.value })}
                          placeholder="65"
                          data-testid="input-adapter-wattage"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'نوع الموصل' : 'Connector Type'}</Label>
                        <Input
                          value={adapterFormData.connectorType}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, connectorType: e.target.value })}
                          placeholder="7.4mm x 5.0mm"
                          data-testid="input-adapter-connector-type"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'حجم الرأس' : 'Tip Size'}</Label>
                        <Input
                          value={adapterFormData.tipSize}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, tipSize: e.target.value })}
                          placeholder="4.5mm x 3.0mm"
                          data-testid="input-adapter-tip-size"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'نوع القابس' : 'Plug Type'}</Label>
                        <Input
                          value={adapterFormData.plugType}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, plugType: e.target.value })}
                          placeholder="2-prong / 3-prong"
                          data-testid="input-adapter-plug-type"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'الكمية في المخزون' : 'Stock Quantity'}</Label>
                        <Input
                          type="number"
                          value={adapterFormData.stockQuantity}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, stockQuantity: e.target.value })}
                          data-testid="input-adapter-stock-quantity"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'الحد الأدنى للمخزون' : 'Min Stock Level'}</Label>
                        <Input
                          type="number"
                          value={adapterFormData.minStockLevel}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, minStockLevel: e.target.value })}
                          data-testid="input-adapter-min-stock"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'سعر الشراء (IQD)' : 'Purchase Price (IQD)'}</Label>
                        <Input
                          type="number"
                          value={adapterFormData.purchasePrice}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, purchasePrice: e.target.value })}
                          data-testid="input-adapter-purchase-price"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'سعر الجملة (IQD)' : 'Wholesale Price (IQD)'}</Label>
                        <Input
                          type="number"
                          value={adapterFormData.wholesalePrice}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, wholesalePrice: e.target.value })}
                          data-testid="input-adapter-wholesale-price"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'سعر البيع (IQD)' : 'Selling Price (IQD)'}</Label>
                        <Input
                          type="number"
                          value={adapterFormData.sellingPrice}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, sellingPrice: e.target.value })}
                          data-testid="input-adapter-selling-price"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'المورد' : 'Supplier'}</Label>
                        <Input
                          value={adapterFormData.supplier}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, supplier: e.target.value })}
                          data-testid="input-adapter-supplier"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'مكان التخزين' : 'Storage Location'}</Label>
                        <Input
                          value={adapterFormData.location}
                          onChange={(e) => setAdapterFormData({ ...adapterFormData, location: e.target.value })}
                          placeholder={language === 'ar' ? 'رف B-1' : 'Shelf B-1'}
                          data-testid="input-adapter-location"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'ملاحظات' : 'Notes'}</Label>
                      <Textarea
                        value={adapterFormData.notes}
                        onChange={(e) => setAdapterFormData({ ...adapterFormData, notes: e.target.value })}
                        rows={3}
                        data-testid="input-adapter-notes"
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={resetAdapterForm} data-testid="button-cancel-adapter">
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                      <Button 
                        type="submit" 
                        className="bg-green-600 hover:bg-green-700"
                        disabled={createAdapterMutation.isPending || updateAdapterMutation.isPending}
                        data-testid="button-save-adapter"
                      >
                        {(createAdapterMutation.isPending || updateAdapterMutation.isPending) ? (
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
          </TabsContent>
        </Tabs>
      </main>

      {/* Battery Delete Confirmation Dialog */}
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
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} data-testid="button-cancel-delete-battery">
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-battery"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {language === 'ar' ? 'حذف' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adapter Delete Confirmation Dialog */}
      <Dialog open={!!adapterDeleteConfirm} onOpenChange={() => setAdapterDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
            </DialogTitle>
          </DialogHeader>
          <p>
            {language === 'ar' 
              ? 'هل أنت متأكد من حذف هذا الشاحن؟' 
              : 'Are you sure you want to delete this adapter?'
            }
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdapterDeleteConfirm(null)} data-testid="button-cancel-delete-adapter">
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => adapterDeleteConfirm && deleteAdapterMutation.mutate(adapterDeleteConfirm)}
              disabled={deleteAdapterMutation.isPending}
              data-testid="button-confirm-delete-adapter"
            >
              {deleteAdapterMutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {language === 'ar' ? 'حذف' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent className={language === 'ar' ? 'rtl' : ''}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {language === 'ar' ? 'تأكيد الاستعادة' : 'Confirm Restore'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? `سيتم استعادة البيانات من الملف "${restoreFile?.name}". البطاريات الموجودة بنفس الرقم التسلسلي سيتم تحديثها، والجديدة ستضاف.`
                : `Data will be restored from "${restoreFile?.name}". Existing batteries with the same serial number will be updated, new ones will be added.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={language === 'ar' ? 'flex-row-reverse gap-2' : ''}>
            <AlertDialogCancel onClick={() => { setShowRestoreDialog(false); setRestoreFile(null); }}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRestore}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {language === 'ar' ? 'استعادة' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Result Dialog */}
      <Dialog open={!!restoreResult} onOpenChange={() => setRestoreResult(null)}>
        <DialogContent className={language === 'ar' ? 'rtl' : ''}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-green-600" />
              {language === 'ar' ? 'نتيجة الاستعادة' : 'Restore Result'}
            </DialogTitle>
          </DialogHeader>
          {restoreResult && (
            <div className="space-y-4">
              <p className="text-muted-foreground">{restoreResult.message}</p>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{restoreResult.added}</div>
                  <div className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'جديد' : 'Added'}
                  </div>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{restoreResult.updated}</div>
                  <div className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'محدث' : 'Updated'}
                  </div>
                </div>
                <div className="p-3 bg-gray-100 dark:bg-gray-900/30 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">{restoreResult.skipped}</div>
                  <div className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'تخطي' : 'Skipped'}
                  </div>
                </div>
              </div>
              
              {restoreResult.errors.length > 0 && (
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <div className="font-semibold text-red-600 mb-2">
                    {language === 'ar' ? 'أخطاء:' : 'Errors:'}
                  </div>
                  <ul className="text-sm text-red-600 space-y-1">
                    {restoreResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {restoreResult.errors.length > 5 && (
                      <li>... {language === 'ar' ? `و ${restoreResult.errors.length - 5} أخطاء أخرى` : `and ${restoreResult.errors.length - 5} more errors`}</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setRestoreResult(null)}>
              {language === 'ar' ? 'حسناً' : 'OK'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
