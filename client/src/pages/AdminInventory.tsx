import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCategoryName } from "@/lib/categoryNames";
import { 
  Loader2, 
  Package, 
  AlertTriangle, 
  Plus, 
  Minus, 
  History,
  Search,
  Edit,
  Save,
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AdminNav } from "@/components/AdminNav";
import type { Product, InventoryMovement } from "@shared/schema";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface ProductWithInventory extends Product {
  stockQuantity: number;
  lowStockThreshold: number;
  sku: string | null;
}

export default function AdminInventory() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdjustDialog, setShowAdjustDialog] = useState<ProductWithInventory | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState<ProductWithInventory | null>(null);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ stockQuantity: "", lowStockThreshold: "", sku: "" });
  
  const [adjustmentData, setAdjustmentData] = useState({
    type: "adjustment" as "adjustment" | "purchase" | "return",
    quantity: "",
    reason: "",
  });
  
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<{
    totalRows: number;
    results: {
      success: number;
      failed: number;
      created: number;
      updated: number;
      errors: Array<{ row: number; error: string }>;
    };
  } | null>(null);

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

  const { data: products = [], isLoading } = useQuery<ProductWithInventory[]>({
    queryKey: ['/api/admin/inventory'],
    enabled: !!currentAdmin,
  });

  const { data: lowStockProducts = [] } = useQuery<ProductWithInventory[]>({
    queryKey: ['/api/admin/inventory/low-stock'],
    enabled: !!currentAdmin,
  });

  const { data: movements = [] } = useQuery<InventoryMovement[]>({
    queryKey: ['/api/admin/inventory/movements', showHistoryDialog?.id],
    queryFn: async () => {
      if (!showHistoryDialog?.id) return [];
      const response = await fetch(`/api/admin/inventory/movements?productId=${showHistoryDialog.id}`);
      if (!response.ok) throw new Error('Failed to fetch movements');
      return response.json();
    },
    enabled: !!showHistoryDialog,
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ productId, data }: { productId: string; data: { stockQuantity?: number; lowStockThreshold?: number; sku?: string } }) => {
      const response = await apiRequest('PUT', `/api/admin/inventory/${productId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/inventory/low-stock'] });
      setEditingProduct(null);
      toast({
        title: language === 'ar' ? "تم التحديث" : "Updated",
        description: language === 'ar' ? "تم تحديث المخزون بنجاح" : "Inventory updated successfully",
      });
    },
    onError: () => {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل في تحديث المخزون" : "Failed to update inventory",
        variant: "destructive",
      });
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: async ({ productId, data }: { productId: string; data: { movementType: string; quantityChange: number; reason?: string } }) => {
      const response = await apiRequest('POST', `/api/admin/inventory/${productId}/adjust`, data);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/inventory/low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/inventory/movements', variables.productId] });
      setShowAdjustDialog(null);
      setAdjustmentData({ type: "adjustment", quantity: "", reason: "" });
      toast({
        title: language === 'ar' ? "تم التعديل" : "Adjusted",
        description: language === 'ar' ? "تم تعديل المخزون بنجاح" : "Stock adjusted successfully",
      });
    },
    onError: () => {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل في تعديل المخزون" : "Failed to adjust stock",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (csvData: string) => {
      const response = await apiRequest('POST', '/api/admin/inventory/import', { csvData });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/inventory/low-stock'] });
      setImportResults(data);
      setCsvFile(null);
      toast({
        title: language === 'ar' ? "تم الاستيراد" : "Import Complete",
        description: language === 'ar' 
          ? `تم استيراد ${data.results.success} منتج بنجاح`
          : `Successfully imported ${data.results.success} products`,
      });
    },
    onError: (error: any) => {
      toast({
        title: language === 'ar' ? "خطأ في الاستيراد" : "Import Error",
        description: error.message || (language === 'ar' ? "فشل استيراد البيانات" : "Failed to import data"),
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      setImportResults(null);
    }
  };

  const handleImportSubmit = async () => {
    if (!csvFile) return;
    
    const text = await csvFile.text();
    importMutation.mutate(text);
  };

  const handleDownloadTemplate = () => {
    window.open('/api/admin/inventory/import/template', '_blank');
  };

  const handleStartEdit = (product: ProductWithInventory) => {
    setEditingProduct(product.id);
    setEditValues({
      stockQuantity: String(product.stockQuantity),
      lowStockThreshold: String(product.lowStockThreshold),
      sku: product.sku || "",
    });
  };

  const handleSaveEdit = (productId: string) => {
    updateStockMutation.mutate({
      productId,
      data: {
        stockQuantity: parseInt(editValues.stockQuantity) || 0,
        lowStockThreshold: parseInt(editValues.lowStockThreshold) || 5,
        sku: editValues.sku || undefined,
      },
    });
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setEditValues({ stockQuantity: "", lowStockThreshold: "", sku: "" });
  };

  const handleAdjustSubmit = () => {
    if (!showAdjustDialog || !adjustmentData.quantity) return;
    
    const quantity = parseInt(adjustmentData.quantity);
    if (isNaN(quantity) || quantity === 0) return;

    adjustStockMutation.mutate({
      productId: showAdjustDialog.id,
      data: {
        movementType: adjustmentData.type,
        quantityChange: quantity,
        reason: adjustmentData.reason || undefined,
      },
    });
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = searchQuery === "" || 
      (language === 'ar' ? product.nameAr : product.nameEn).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.sku || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "low-stock") {
      return matchesSearch && product.stockQuantity <= product.lowStockThreshold;
    }
    if (activeTab === "out-of-stock") {
      return matchesSearch && product.stockQuantity === 0;
    }
    return matchesSearch;
  });

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat('ar-IQ').format(typeof price === 'string' ? parseFloat(price) : price);
  };

  const getMovementTypeLabel = (type: string) => {
    const types: Record<string, { ar: string; en: string }> = {
      adjustment: { ar: "تعديل", en: "Adjustment" },
      sale: { ar: "بيع", en: "Sale" },
      purchase: { ar: "شراء", en: "Purchase" },
      return: { ar: "إرجاع", en: "Return" },
      import: { ar: "استيراد", en: "Import" },
    };
    return types[type]?.[language === 'ar' ? 'ar' : 'en'] || type;
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
      <AdminNav currentAdmin={currentAdmin} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === 'ar' ? 'إجمالي المنتجات' : 'Total Products'}
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{products.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === 'ar' ? 'مخزون منخفض' : 'Low Stock'}
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{lowStockProducts.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === 'ar' ? 'نفد من المخزون' : 'Out of Stock'}
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {products.filter(p => p.stockQuantity === 0).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>{language === 'ar' ? 'قائمة المخزون' : 'Inventory List'}</CardTitle>
                <CardDescription>
                  {language === 'ar' ? 'إدارة مستويات المخزون للمنتجات' : 'Manage product stock levels'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ps-9 w-64"
                    data-testid="input-search"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowImportDialog(true);
                    setImportResults(null);
                    setCsvFile(null);
                  }}
                  data-testid="button-import"
                >
                  <Upload className="w-4 h-4 me-2" />
                  {language === 'ar' ? 'استيراد CSV' : 'Import CSV'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all" data-testid="tab-all">
                  <Package className="w-4 h-4 me-2" />
                  {language === 'ar' ? 'الكل' : 'All'}
                </TabsTrigger>
                <TabsTrigger value="low-stock" data-testid="tab-low-stock">
                  <AlertTriangle className="w-4 h-4 me-2" />
                  {language === 'ar' ? 'مخزون منخفض' : 'Low Stock'}
                  {lowStockProducts.length > 0 && (
                    <Badge variant="destructive" className="ms-2">{lowStockProducts.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="out-of-stock" data-testid="tab-out-of-stock">
                  <AlertTriangle className="w-4 h-4 me-2" />
                  {language === 'ar' ? 'نفد' : 'Out'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{language === 'ar' ? 'لا توجد منتجات' : 'No products found'}</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{language === 'ar' ? 'المنتج' : 'Product'}</TableHead>
                          <TableHead>{language === 'ar' ? 'SKU' : 'SKU'}</TableHead>
                          <TableHead>{language === 'ar' ? 'السعر' : 'Price'}</TableHead>
                          <TableHead>{language === 'ar' ? 'الكمية' : 'Quantity'}</TableHead>
                          <TableHead>{language === 'ar' ? 'حد التنبيه' : 'Alert Threshold'}</TableHead>
                          <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                          <TableHead>{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.map((product) => {
                          const isEditing = editingProduct === product.id;
                          const isLowStock = product.stockQuantity <= product.lowStockThreshold && product.stockQuantity > 0;
                          const isOutOfStock = product.stockQuantity === 0;
                          
                          return (
                            <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {product.image && (
                                    <img 
                                      src={product.image} 
                                      alt={language === 'ar' ? product.nameAr : product.nameEn}
                                      className="w-10 h-10 rounded object-cover"
                                    />
                                  )}
                                  <div>
                                    <p className="font-medium">
                                      {language === 'ar' ? product.nameAr : product.nameEn}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{getCategoryName(product.category, language)}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    value={editValues.sku}
                                    onChange={(e) => setEditValues(prev => ({ ...prev, sku: e.target.value }))}
                                    className="w-24"
                                    placeholder="SKU"
                                    data-testid={`input-sku-${product.id}`}
                                  />
                                ) : (
                                  <span className="text-muted-foreground">{product.sku || "-"}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {formatPrice(product.price)} {language === 'ar' ? 'د.ع' : 'IQD'}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    value={editValues.stockQuantity}
                                    onChange={(e) => setEditValues(prev => ({ ...prev, stockQuantity: e.target.value }))}
                                    className="w-20"
                                    min="0"
                                    data-testid={`input-quantity-${product.id}`}
                                  />
                                ) : (
                                  <span className={isOutOfStock ? "text-red-600 font-bold" : isLowStock ? "text-yellow-600 font-bold" : ""}>
                                    {product.stockQuantity}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    value={editValues.lowStockThreshold}
                                    onChange={(e) => setEditValues(prev => ({ ...prev, lowStockThreshold: e.target.value }))}
                                    className="w-20"
                                    min="0"
                                    data-testid={`input-threshold-${product.id}`}
                                  />
                                ) : (
                                  product.lowStockThreshold
                                )}
                              </TableCell>
                              <TableCell>
                                {isOutOfStock ? (
                                  <Badge variant="destructive">{language === 'ar' ? 'نفد' : 'Out of Stock'}</Badge>
                                ) : isLowStock ? (
                                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                    {language === 'ar' ? 'منخفض' : 'Low Stock'}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    {language === 'ar' ? 'متوفر' : 'In Stock'}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {isEditing ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleSaveEdit(product.id)}
                                        disabled={updateStockMutation.isPending}
                                        data-testid={`button-save-${product.id}`}
                                      >
                                        {updateStockMutation.isPending ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Save className="h-4 w-4 text-green-600" />
                                        )}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleCancelEdit}
                                        data-testid={`button-cancel-${product.id}`}
                                      >
                                        <X className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleStartEdit(product)}
                                        data-testid={`button-edit-${product.id}`}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setShowAdjustDialog(product)}
                                        data-testid={`button-adjust-${product.id}`}
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setShowHistoryDialog(product)}
                                        data-testid={`button-history-${product.id}`}
                                      >
                                        <History className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!showAdjustDialog} onOpenChange={(open) => {
        if (!open) {
          setShowAdjustDialog(null);
          setAdjustmentData({ type: "adjustment", quantity: "", reason: "" });
        }
      }}>
        <DialogContent className="max-w-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'تعديل المخزون' : 'Adjust Stock'}
            </DialogTitle>
            <DialogDescription>
              {showAdjustDialog && (language === 'ar' ? showAdjustDialog.nameAr : showAdjustDialog.nameEn)}
              <br />
              {language === 'ar' ? 'الكمية الحالية:' : 'Current quantity:'} {showAdjustDialog?.stockQuantity}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'نوع الحركة' : 'Movement Type'}</Label>
              <Select
                value={adjustmentData.type}
                onValueChange={(value: "adjustment" | "purchase" | "return") => setAdjustmentData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger data-testid="select-movement-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adjustment">{language === 'ar' ? 'تعديل' : 'Adjustment'}</SelectItem>
                  <SelectItem value="purchase">{language === 'ar' ? 'شراء / إضافة' : 'Purchase / Add'}</SelectItem>
                  <SelectItem value="return">{language === 'ar' ? 'إرجاع' : 'Return'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'الكمية (موجب للإضافة، سالب للخصم)' : 'Quantity (positive to add, negative to subtract)'}</Label>
              <Input
                type="number"
                value={adjustmentData.quantity}
                onChange={(e) => setAdjustmentData(prev => ({ ...prev, quantity: e.target.value }))}
                placeholder="e.g., 10 or -5"
                data-testid="input-adjust-quantity"
              />
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'السبب (اختياري)' : 'Reason (optional)'}</Label>
              <Textarea
                value={adjustmentData.reason}
                onChange={(e) => setAdjustmentData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder={language === 'ar' ? 'سبب التعديل...' : 'Reason for adjustment...'}
                data-testid="input-adjust-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAdjustDialog(null);
                setAdjustmentData({ type: "adjustment", quantity: "", reason: "" });
              }}
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleAdjustSubmit}
              disabled={adjustStockMutation.isPending || !adjustmentData.quantity}
              data-testid="button-submit-adjustment"
            >
              {adjustStockMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {language === 'ar' ? 'تطبيق' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showHistoryDialog} onOpenChange={(open) => {
        if (!open) setShowHistoryDialog(null);
      }}>
        <DialogContent className="max-w-2xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'سجل حركات المخزون' : 'Inventory Movement History'}
            </DialogTitle>
            <DialogDescription>
              {showHistoryDialog && (language === 'ar' ? showHistoryDialog.nameAr : showHistoryDialog.nameEn)}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto">
            {movements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{language === 'ar' ? 'لا توجد حركات مسجلة' : 'No movements recorded'}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                    <TableHead>{language === 'ar' ? 'التغيير' : 'Change'}</TableHead>
                    <TableHead>{language === 'ar' ? 'من → إلى' : 'From → To'}</TableHead>
                    <TableHead>{language === 'ar' ? 'السبب' : 'Reason'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="text-sm">
                        {new Date(movement.createdAt).toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getMovementTypeLabel(movement.movementType)}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={movement.quantityChange > 0 ? "text-green-600" : "text-red-600"}>
                          {movement.quantityChange > 0 ? '+' : ''}{movement.quantityChange}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {movement.previousQuantity} → {movement.newQuantity}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                        {movement.reason || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(null)}>
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={(open) => {
        if (!open) {
          setShowImportDialog(false);
          setCsvFile(null);
          setImportResults(null);
        }
      }}>
        <DialogContent className="max-w-lg" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              {language === 'ar' ? 'استيراد المنتجات من CSV' : 'Import Products from CSV'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? 'قم برفع ملف CSV لإضافة أو تحديث المنتجات بشكل مجمع'
                : 'Upload a CSV file to add or update products in bulk'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} data-testid="button-download-template">
                <Download className="w-4 h-4 me-2" />
                {language === 'ar' ? 'تحميل قالب CSV' : 'Download CSV Template'}
              </Button>
            </div>

            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
                id="csv-file-input"
                data-testid="input-csv-file"
              />
              <label htmlFor="csv-file-input" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {csvFile 
                    ? csvFile.name 
                    : (language === 'ar' ? 'اضغط لاختيار ملف CSV' : 'Click to select CSV file')}
                </p>
              </label>
            </div>

            {importResults && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm">
                      {language === 'ar' ? 'نجح:' : 'Success:'} {importResults.results.success}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950 rounded">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm">
                      {language === 'ar' ? 'فشل:' : 'Failed:'} {importResults.results.failed}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>{language === 'ar' ? 'جديد:' : 'Created:'} {importResults.results.created}</p>
                  <p>{language === 'ar' ? 'محدث:' : 'Updated:'} {importResults.results.updated}</p>
                </div>
                {importResults.results.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto text-sm">
                    <p className="font-medium text-red-600 mb-1">
                      {language === 'ar' ? 'الأخطاء:' : 'Errors:'}
                    </p>
                    {importResults.results.errors.slice(0, 5).map((err, i) => (
                      <p key={i} className="text-red-500">
                        {language === 'ar' ? `صف ${err.row}: ${err.error}` : `Row ${err.row}: ${err.error}`}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false);
                setCsvFile(null);
                setImportResults(null);
              }}
            >
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
            <Button
              onClick={handleImportSubmit}
              disabled={!csvFile || importMutation.isPending}
              data-testid="button-submit-import"
            >
              {importMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {language === 'ar' ? 'استيراد' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
