import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Package,
  AlertTriangle,
  Loader2,
  X,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Printer,
  ScanBarcode,
  ClipboardList,
  CheckCircle2,
  XCircle,
  TrendingUp,
  MinusCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import QRCode from "qrcode";
import type { InStoreProduct } from "@shared/schema";

interface SalesUser {
  id: string;
  permissions: {
    canInventory: number;
  };
}

interface Props {
  user: SalesUser;
}

interface ProductForm {
  nameAr: string;
  nameEn: string;
  sku: string;
  barcode: string;
  price: string;
  costPrice: string;
  category: string;
  description: string;
  stockQuantity: string;
  lowStockThreshold: string;
}

const emptyForm: ProductForm = {
  nameAr: "",
  nameEn: "",
  sku: "",
  barcode: "",
  price: "",
  costPrice: "",
  category: "",
  description: "",
  stockQuantity: "0",
  lowStockThreshold: "3",
};

interface ScanEntry {
  product: InStoreProduct;
  scanned: number;
}

type CountPhase = "scanning" | "review" | "done";

export default function SalesInStoreInventory({ user }: Props) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"inventory" | "stockcount">("inventory");

  const [searchQuery, setSearchQuery] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InStoreProduct | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [stockProduct, setStockProduct] = useState<InStoreProduct | null>(null);
  const [stockAdjustment, setStockAdjustment] = useState("0");
  const [deleteConfirm, setDeleteConfirm] = useState<InStoreProduct | null>(null);

  const [countPhase, setCountPhase] = useState<CountPhase>("scanning");
  const [scanInput, setScanInput] = useState("");
  const [scanEntries, setScanEntries] = useState<ScanEntry[]>([]);
  const [unknownCodes, setUnknownCodes] = useState<string[]>([]);
  const [showUnknown, setShowUnknown] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [doneStats, setDoneStats] = useState<{ updated: number; matched: number } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const { data: products = [], isLoading } = useQuery<InStoreProduct[]>({
    queryKey: ['/api/instore/products'],
  });

  useEffect(() => {
    if (activeTab === "stockcount" && countPhase === "scanning") {
      setTimeout(() => scanInputRef.current?.focus(), 100);
    }
  }, [activeTab, countPhase]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/instore/products', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/instore/products'] });
      setShowDialog(false);
      setForm(emptyForm);
      toast({ title: language === 'ar' ? 'تم إضافة المنتج' : 'Product added' });
    },
    onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PUT', `/api/instore/products/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/instore/products'] });
      setShowDialog(false);
      setEditingProduct(null);
      setForm(emptyForm);
      toast({ title: language === 'ar' ? 'تم تحديث المنتج' : 'Product updated' });
    },
    onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/instore/products/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/instore/products'] });
      setDeleteConfirm(null);
      toast({ title: language === 'ar' ? 'تم حذف المنتج' : 'Product deleted' });
    },
    onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
  });

  const stockMutation = useMutation({
    mutationFn: async ({ id, adjustment }: { id: number; adjustment: number }) => {
      const res = await apiRequest('PATCH', `/api/instore/products/${id}/stock`, { adjustment });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/instore/products'] });
      setShowStockDialog(false);
      setStockProduct(null);
      setStockAdjustment("0");
      toast({ title: language === 'ar' ? 'تم تحديث المخزون' : 'Stock updated' });
    },
    onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
  });

  const applyCountMutation = useMutation({
    mutationFn: async (updates: { id: number; quantity: number }[]) => {
      const res = await apiRequest('POST', '/api/instore/stock-count/apply', { updates });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/instore/products'] });
      const matched = scanEntries.filter(e => e.scanned === e.product.stockQuantity).length;
      setDoneStats({ updated: data.updated, matched });
      setCountPhase("done");
      setShowApplyConfirm(false);
    },
    onError: (e: any) => {
      toast({ title: e.message, variant: 'destructive' });
      setShowApplyConfirm(false);
    },
  });

  const openAdd = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setShowDialog(true);
  };

  const openEdit = (p: InStoreProduct) => {
    setEditingProduct(p);
    setForm({
      nameAr: p.nameAr,
      nameEn: p.nameEn || "",
      sku: p.sku || "",
      barcode: p.barcode || "",
      price: String(p.price),
      costPrice: String(p.costPrice || ""),
      category: p.category || "",
      description: p.description || "",
      stockQuantity: String(p.stockQuantity),
      lowStockThreshold: String(p.lowStockThreshold),
    });
    setShowDialog(true);
  };

  const openStock = (p: InStoreProduct) => {
    setStockProduct(p);
    setStockAdjustment("0");
    setShowStockDialog(true);
  };

  const handleSubmit = () => {
    if (!form.nameAr.trim() || !form.price.trim()) {
      toast({
        title: language === 'ar' ? 'الاسم والسعر مطلوبان' : 'Name and price are required',
        variant: 'destructive',
      });
      return;
    }
    const payload = {
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim() || null,
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      price: form.price,
      costPrice: form.costPrice || null,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      stockQuantity: parseInt(form.stockQuantity) || 0,
      lowStockThreshold: parseInt(form.lowStockThreshold) || 3,
      isActive: 1,
    };
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleStockSave = () => {
    if (!stockProduct) return;
    const adj = parseInt(stockAdjustment);
    if (isNaN(adj) || adj === 0) {
      toast({ title: language === 'ar' ? 'أدخل كمية صحيحة' : 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    stockMutation.mutate({ id: stockProduct.id, adjustment: adj });
  };

  const filtered = products.filter(p => {
    const q = searchQuery.toLowerCase();
    return !q || p.nameAr.toLowerCase().includes(q) ||
      (p.nameEn || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q);
  });

  const lowStockCount = products.filter(p => p.stockQuantity <= p.lowStockThreshold).length;

  const formatPrice = (v: string | number) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(parseFloat(String(v)) || 0);

  const getNextSequence = useCallback(() => {
    const pattern = /^SKU-(\d+)$/i;
    let max = 0;
    for (const p of products) {
      for (const val of [p.barcode, p.sku]) {
        if (!val) continue;
        const m = val.match(pattern);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      }
    }
    return `SKU-${String(max + 1).padStart(4, '0')}`;
  }, [products]);

  const printBarcode = useCallback(async (product: InStoreProduct) => {
    const code = product.barcode || product.sku || String(product.id);
    const name = product.nameAr || product.nameEn || '';
    const price = formatPrice(product.price);

    const qrDataUrl = await QRCode.toDataURL(code, { width: 70, margin: 0 });

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
<title>Print Label</title>
<style>
@page{size:50mm 25mm;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
body{width:50mm;height:25mm;display:flex;flex-direction:row;align-items:center;justify-content:center;font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#fff;gap:2mm;padding:1mm}
.info{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:0.5mm}
.store{font-size:5pt;color:#888;direction:rtl}
.title{font-size:7.5pt;font-weight:900;letter-spacing:0.3px;line-height:1.2}
.serial{font-size:6.5pt;font-weight:700;margin-top:0.5mm;letter-spacing:0.3px;color:#555}
.price{font-size:10pt;font-weight:900;margin-top:1mm}
.qr{display:block;flex-shrink:0}
</style>
</head>
<body>
<img class="qr" src="${qrDataUrl}" width="60" height="60" />
<div class="info">
  <div class="store">العين لتجارة الحاسبات</div>
  <div class="title">${name}</div>
  <div class="serial">${code}</div>
  <div class="price">${price} IQD</div>
</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
</body>
</html>`);
    win.document.close();
  }, [formatPrice]);

  const findProductByCode = useCallback((code: string): InStoreProduct | null => {
    const c = code.trim().toLowerCase();
    if (!c) return null;
    return products.find(p =>
      (p.barcode && p.barcode.toLowerCase() === c) ||
      (p.sku && p.sku.toLowerCase() === c)
    ) || null;
  }, [products]);

  const handleScanSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const code = scanInput.trim();
    if (!code) return;
    setScanInput("");
    setTimeout(() => scanInputRef.current?.focus(), 50);

    const product = findProductByCode(code);
    if (product) {
      setScanEntries(prev => {
        const existing = prev.find(e => e.product.id === product.id);
        if (existing) {
          return prev.map(e => e.product.id === product.id ? { ...e, scanned: e.scanned + 1 } : e);
        }
        return [...prev, { product, scanned: 1 }];
      });
    } else {
      setUnknownCodes(prev => [...prev, code]);
    }
  };

  const adjustScanCount = (productId: number, delta: number) => {
    setScanEntries(prev =>
      prev.map(e => e.product.id === productId
        ? { ...e, scanned: Math.max(0, e.scanned + delta) }
        : e
      )
    );
  };

  const removeScanEntry = (productId: number) => {
    setScanEntries(prev => prev.filter(e => e.product.id !== productId));
  };

  const resetCount = () => {
    setScanEntries([]);
    setUnknownCodes([]);
    setScanInput("");
    setCountPhase("scanning");
    setShowResetConfirm(false);
    setDoneStats(null);
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  const applyCount = () => {
    const updates = scanEntries.map(e => ({ id: e.product.id, quantity: e.scanned }));
    applyCountMutation.mutate(updates);
  };

  const totalScannedTypes = scanEntries.length;
  const totalScannedUnits = scanEntries.reduce((s, e) => s + e.scanned, 0);

  const comparisonRows = [
    ...scanEntries.map(e => ({
      product: e.product,
      systemQty: e.product.stockQuantity,
      scannedQty: e.scanned,
      diff: e.scanned - e.product.stockQuantity,
      notScanned: false,
    })),
    ...products
      .filter(p => !scanEntries.find(e => e.product.id === p.id))
      .map(p => ({
        product: p,
        systemQty: p.stockQuantity,
        scannedQty: 0,
        diff: -p.stockQuantity,
        notScanned: true,
      })),
  ];

  const matchCount = comparisonRows.filter(r => !r.notScanned && r.diff === 0).length;
  const shortCount = comparisonRows.filter(r => !r.notScanned && r.diff < 0).length;
  const extraCount = comparisonRows.filter(r => !r.notScanned && r.diff > 0).length;
  const notScannedCount = comparisonRows.filter(r => r.notScanned).length;

  const updatableEntries = scanEntries.filter(e => e.scanned !== e.product.stockQuantity);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {language === 'ar' ? 'مخزون المتجر' : 'In-Store Inventory'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {language === 'ar'
              ? 'إدارة منتجات مبيعات المتجر المنفصلة عن الموقع'
              : 'Manage products separate from the online catalog'}
          </p>
        </div>
        {activeTab === "inventory" && (
          <Button onClick={openAdd} data-testid="button-add-instore-product">
            <Plus className="h-4 w-4 me-2" />
            {language === 'ar' ? 'إضافة منتج' : 'Add Product'}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-0">
        <button
          onClick={() => setActiveTab("inventory")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "inventory"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-inventory"
        >
          <Package className="h-4 w-4 inline me-1" />
          {language === 'ar' ? 'المنتجات' : 'Products'}
        </button>
        <button
          onClick={() => setActiveTab("stockcount")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "stockcount"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-stockcount"
        >
          <ClipboardList className="h-4 w-4 inline me-1" />
          {language === 'ar' ? 'جرد المخزون' : 'Stock Count'}
        </button>
      </div>

      {/* ===== INVENTORY TAB ===== */}
      {activeTab === "inventory" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'إجمالي المنتجات' : 'Total Products'}</p>
                <p className="text-2xl font-bold">{products.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'إجمالي الوحدات' : 'Total Units'}</p>
                <p className="text-2xl font-bold">{products.reduce((s, p) => s + p.stockQuantity, 0)}</p>
              </CardContent>
            </Card>
            <Card className={lowStockCount > 0 ? 'border-orange-400' : ''}>
              <CardContent className="pt-4 pb-3">
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'مخزون منخفض' : 'Low Stock'}</p>
                <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-orange-500' : ''}`}>{lowStockCount}</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="ps-10"
              placeholder={language === 'ar' ? 'بحث بالاسم، SKU، أو الباركود...' : 'Search by name, SKU, or barcode...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              data-testid="input-instore-search"
            />
          </div>

          {/* Product List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
              <Package className="h-12 w-12 opacity-30" />
              <p>{language === 'ar' ? 'لا توجد منتجات' : 'No products found'}</p>
              {products.length === 0 && (
                <Button variant="outline" onClick={openAdd}>
                  <Plus className="h-4 w-4 me-2" />
                  {language === 'ar' ? 'أضف أول منتج' : 'Add your first product'}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(product => {
                const isLow = product.stockQuantity <= product.lowStockThreshold;
                const isOut = product.stockQuantity <= 0;
                return (
                  <Card key={product.id} className={isOut ? 'border-destructive/40' : isLow ? 'border-orange-400/60' : ''}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{product.nameAr}</span>
                            {product.nameEn && (
                              <span className="text-sm text-muted-foreground">{product.nameEn}</span>
                            )}
                            {product.category && (
                              <Badge variant="outline" className="text-xs">{product.category}</Badge>
                            )}
                            {isOut ? (
                              <Badge variant="destructive" className="text-xs">
                                {language === 'ar' ? 'نفذ' : 'Out of Stock'}
                              </Badge>
                            ) : isLow ? (
                              <Badge variant="outline" className="text-xs bg-orange-500 text-white border-orange-600">
                                <AlertTriangle className="h-3 w-3 me-1" />
                                {language === 'ar' ? 'مخزون منخفض' : 'Low Stock'}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                            {product.sku && <span className="font-mono">SKU: {product.sku}</span>}
                            {product.barcode && <span className="font-mono">{language === 'ar' ? 'باركود' : 'Barcode'}: {product.barcode}</span>}
                            <span className="text-foreground font-medium">
                              {formatPrice(product.price)} {language === 'ar' ? 'د.ع' : 'IQD'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <p className={`text-xl font-bold ${isOut ? 'text-destructive' : isLow ? 'text-orange-500' : ''}`}>
                              {product.stockQuantity}
                            </p>
                            <p className="text-xs text-muted-foreground">{language === 'ar' ? 'وحدة' : 'units'}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => openStock(product)}
                              data-testid={`button-stock-${product.id}`}
                              title={language === 'ar' ? 'تعديل المخزون' : 'Adjust Stock'}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            {(product.barcode || product.sku) && (
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => printBarcode(product)}
                                data-testid={`button-barcode-${product.id}`}
                                title={language === 'ar' ? 'طباعة الباركود' : 'Print Barcode'}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => openEdit(product)}
                              data-testid={`button-edit-${product.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => setDeleteConfirm(product)}
                              data-testid={`button-delete-${product.id}`}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== STOCK COUNT TAB ===== */}
      {activeTab === "stockcount" && (
        <div className="space-y-4">

          {/* PHASE: SCANNING */}
          {countPhase === "scanning" && (
            <>
              {/* Counter Strip */}
              <div className="flex gap-3 flex-wrap">
                <Card className="flex-1 min-w-[130px]">
                  <CardContent className="pt-3 pb-3 flex items-center gap-2">
                    <ScanBarcode className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">{language === 'ar' ? 'أصناف ممسوحة' : 'Types Scanned'}</p>
                      <p className="text-xl font-bold">{totalScannedTypes}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="flex-1 min-w-[130px]">
                  <CardContent className="pt-3 pb-3 flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">{language === 'ar' ? 'وحدة إجمالي' : 'Total Units'}</p>
                      <p className="text-xl font-bold">{totalScannedUnits}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Scan Input */}
              <Card>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ScanBarcode className="h-5 w-5 text-primary flex-shrink-0" />
                    <p className="font-semibold text-sm">
                      {language === 'ar'
                        ? 'امسح الباركود أو اكتب الرمز واضغط Enter'
                        : 'Scan barcode or type code and press Enter'}
                    </p>
                  </div>
                  <Input
                    ref={scanInputRef}
                    value={scanInput}
                    onChange={e => setScanInput(e.target.value)}
                    onKeyDown={handleScanSubmit}
                    placeholder={language === 'ar' ? 'في انتظار المسح...' : 'Waiting for scan...'}
                    className="text-lg font-mono h-12"
                    autoComplete="off"
                    data-testid="input-scan-barcode"
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar'
                      ? 'اضغط على حقل الإدخال ثم امسح الباركود. كل مسح يضيف وحدة واحدة.'
                      : 'Click the input then scan. Each scan adds 1 unit.'}
                  </p>
                </CardContent>
              </Card>

              {/* Scanned List */}
              {scanEntries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {language === 'ar' ? 'المنتجات الممسوحة:' : 'Scanned Products:'}
                  </p>
                  {scanEntries.map(entry => (
                    <Card key={entry.product.id}>
                      <CardContent className="py-2 px-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{entry.product.nameAr}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {entry.product.sku || entry.product.barcode || `#${entry.product.id}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => adjustScanCount(entry.product.id, -1)}
                              data-testid={`button-scan-minus-${entry.product.id}`}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                            <span className="font-bold text-lg w-8 text-center">{entry.scanned}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => adjustScanCount(entry.product.id, 1)}
                              data-testid={`button-scan-plus-${entry.product.id}`}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeScanEntry(entry.product.id)}
                              className="text-destructive"
                              data-testid={`button-scan-remove-${entry.product.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Unknown codes */}
              {unknownCodes.length > 0 && (
                <Card className="border-orange-300">
                  <CardContent className="pt-3 pb-3">
                    <button
                      className="flex items-center gap-2 w-full text-start"
                      onClick={() => setShowUnknown(v => !v)}
                    >
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium text-orange-700">
                        {language === 'ar'
                          ? `${unknownCodes.length} رمز غير معروف`
                          : `${unknownCodes.length} unknown code(s)`}
                      </span>
                      {showUnknown ? <ChevronDown className="h-4 w-4 ms-auto" /> : <ChevronRight className="h-4 w-4 ms-auto" />}
                    </button>
                    {showUnknown && (
                      <div className="mt-2 space-y-1">
                        {unknownCodes.map((c, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{c}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive"
                              onClick={() => setUnknownCodes(prev => prev.filter((_, idx) => idx !== i))}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  disabled={scanEntries.length === 0}
                  onClick={() => setCountPhase("review")}
                  data-testid="button-review-results"
                >
                  <ClipboardList className="h-4 w-4 me-2" />
                  {language === 'ar' ? 'مراجعة النتائج' : 'Review Results'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={scanEntries.length === 0 && unknownCodes.length === 0}
                  data-testid="button-reset-count"
                >
                  <RefreshCw className="h-4 w-4 me-2" />
                  {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
                </Button>
              </div>
            </>
          )}

          {/* PHASE: REVIEW */}
          {countPhase === "review" && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-green-400">
                  <CardContent className="pt-3 pb-3 text-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-green-700">{matchCount}</p>
                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'مطابق' : 'Match'}</p>
                  </CardContent>
                </Card>
                <Card className="border-red-400">
                  <CardContent className="pt-3 pb-3 text-center">
                    <MinusCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-red-700">{shortCount}</p>
                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'ناقص' : 'Short'}</p>
                  </CardContent>
                </Card>
                <Card className="border-yellow-400">
                  <CardContent className="pt-3 pb-3 text-center">
                    <TrendingUp className="h-6 w-6 text-yellow-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-yellow-700">{extraCount}</p>
                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'زيادة' : 'Extra'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-3 text-center">
                    <XCircle className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-2xl font-bold">{notScannedCount}</p>
                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'غير ممسوح' : 'Not Scanned'}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Comparison Table */}
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted text-muted-foreground text-xs uppercase border-b">
                          <th className="text-start px-3 py-2">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                          <th className="text-center px-3 py-2">SKU</th>
                          <th className="text-center px-3 py-2">{language === 'ar' ? 'النظام' : 'System'}</th>
                          <th className="text-center px-3 py-2">{language === 'ar' ? 'الجرد' : 'Counted'}</th>
                          <th className="text-center px-3 py-2">{language === 'ar' ? 'الفرق' : 'Diff'}</th>
                          <th className="text-center px-3 py-2">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonRows.map((row, i) => {
                          let rowClass = "";
                          let statusEl = null;
                          if (row.notScanned) {
                            rowClass = "bg-muted/30";
                            statusEl = <Badge variant="outline" className="text-xs text-muted-foreground">{language === 'ar' ? 'غير ممسوح' : 'Not Scanned'}</Badge>;
                          } else if (row.diff === 0) {
                            rowClass = "bg-green-50 dark:bg-green-950/20";
                            statusEl = <Badge className="text-xs bg-green-100 text-green-700 border-green-300">{language === 'ar' ? 'مطابق' : 'Match'}</Badge>;
                          } else if (row.diff < 0) {
                            rowClass = "bg-red-50 dark:bg-red-950/20";
                            statusEl = <Badge className="text-xs bg-red-100 text-red-700 border-red-300">{language === 'ar' ? 'ناقص' : 'Short'}</Badge>;
                          } else {
                            rowClass = "bg-yellow-50 dark:bg-yellow-950/20";
                            statusEl = <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300">{language === 'ar' ? 'زيادة' : 'Extra'}</Badge>;
                          }
                          return (
                            <tr key={row.product.id} className={`border-b ${rowClass}`} data-testid={`row-compare-${row.product.id}`}>
                              <td className="px-3 py-2 font-medium">{row.product.nameAr}</td>
                              <td className="px-3 py-2 text-center font-mono text-xs text-muted-foreground">
                                {row.product.sku || row.product.barcode || '-'}
                              </td>
                              <td className="px-3 py-2 text-center font-bold">{row.systemQty}</td>
                              <td className="px-3 py-2 text-center font-bold">{row.scannedQty}</td>
                              <td className="px-3 py-2 text-center font-bold">
                                {row.notScanned ? '—' : (row.diff > 0 ? `+${row.diff}` : row.diff)}
                              </td>
                              <td className="px-3 py-2 text-center">{statusEl}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground">
                {language === 'ar'
                  ? 'ملاحظة: المنتجات "غير الممسوحة" لن يتم تحديثها عند تطبيق الجرد.'
                  : 'Note: "Not Scanned" products will NOT be updated when applying the count.'}
              </p>

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setCountPhase("scanning")}
                  data-testid="button-back-to-scan"
                >
                  {language === 'ar' ? '← رجوع للمسح' : '← Back to Scan'}
                </Button>
                <Button
                  className="flex-1"
                  disabled={updatableEntries.length === 0 || applyCountMutation.isPending}
                  onClick={() => setShowApplyConfirm(true)}
                  data-testid="button-apply-count"
                >
                  {applyCountMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  <CheckCircle2 className="h-4 w-4 me-2" />
                  {language === 'ar'
                    ? `تطبيق الجرد (${updatableEntries.length} منتج)`
                    : `Apply Stock Count (${updatableEntries.length} products)`}
                </Button>
              </div>
            </>
          )}

          {/* PHASE: DONE */}
          {countPhase === "done" && doneStats && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-green-700">
                  {language === 'ar' ? 'تم تطبيق الجرد بنجاح!' : 'Stock Count Applied!'}
                </h2>
                <p className="text-muted-foreground mt-1">
                  {language === 'ar'
                    ? `تم تحديث ${doneStats.updated} منتج • ${doneStats.matched} منتج مطابق (لم يتغير)`
                    : `${doneStats.updated} products updated • ${doneStats.matched} matched (no change needed)`}
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={resetCount} data-testid="button-new-count">
                  <ScanBarcode className="h-4 w-4 me-2" />
                  {language === 'ar' ? 'جرد جديد' : 'New Count'}
                </Button>
                <Button variant="outline" onClick={() => { setActiveTab("inventory"); resetCount(); }} data-testid="button-back-inventory">
                  <Package className="h-4 w-4 me-2" />
                  {language === 'ar' ? 'العودة للمخزون' : 'Back to Inventory'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={open => { if (!open) { setShowDialog(false); setEditingProduct(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct
                ? (language === 'ar' ? 'تعديل المنتج' : 'Edit Product')
                : (language === 'ar' ? 'إضافة منتج جديد' : 'Add New Product')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>{language === 'ar' ? 'الاسم (عربي) *' : 'Name (Arabic) *'}</Label>
                <Input
                  value={form.nameAr}
                  onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))}
                  placeholder="اسم المنتج"
                  data-testid="input-product-name-ar"
                />
              </div>
              <div className="col-span-2">
                <Label>{language === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
                <Input
                  value={form.nameEn}
                  onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))}
                  placeholder="Product name"
                  data-testid="input-product-name-en"
                />
              </div>
              <div>
                <Label>{language === 'ar' ? 'السعر (د.ع) *' : 'Price (IQD) *'}</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0"
                  data-testid="input-product-price"
                />
              </div>
              <div>
                <Label>{language === 'ar' ? 'سعر الشراء (د.ع)' : 'Cost Price (IQD)'}</Label>
                <Input
                  type="number"
                  value={form.costPrice}
                  onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>SKU</Label>
                <Input
                  value={form.sku}
                  onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  placeholder="SKU-001"
                />
              </div>
              <div>
                <Label>{language === 'ar' ? 'الباركود' : 'Barcode'}</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={form.barcode}
                    onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                    placeholder="STR..."
                    className="font-mono text-sm"
                    data-testid="input-product-barcode"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const next = getNextSequence();
                      setForm(f => ({ ...f, barcode: next, sku: f.sku || next }));
                    }}
                    title={language === 'ar' ? 'توليد باركود تسلسلي' : 'Generate sequential barcode'}
                    data-testid="button-generate-barcode"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                {form.barcode && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{form.barcode}</p>
                )}
              </div>
              <div>
                <Label>{language === 'ar' ? 'الفئة' : 'Category'}</Label>
                <Input
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder={language === 'ar' ? 'مثال: إكسسوارات' : 'e.g. Accessories'}
                />
              </div>
              <div>
                <Label>{language === 'ar' ? 'الكمية الحالية' : 'Stock Quantity'}</Label>
                <Input
                  type="number"
                  value={form.stockQuantity}
                  onChange={e => setForm(f => ({ ...f, stockQuantity: e.target.value }))}
                  placeholder="0"
                  disabled={!!editingProduct}
                  data-testid="input-product-stock"
                />
                {editingProduct && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'ar' ? 'لتعديل المخزون استخدم زر تعديل المخزون' : 'Use stock adjust button to change stock'}
                  </p>
                )}
              </div>
              <div>
                <Label>{language === 'ar' ? 'حد التنبيه المنخفض' : 'Low Stock Threshold'}</Label>
                <Input
                  type="number"
                  value={form.lowStockThreshold}
                  onChange={e => setForm(f => ({ ...f, lowStockThreshold: e.target.value }))}
                  placeholder="3"
                />
              </div>
              <div className="col-span-2">
                <Label>{language === 'ar' ? 'الوصف' : 'Description'}</Label>
                <Input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={language === 'ar' ? 'وصف اختياري' : 'Optional description'}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-product"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                {editingProduct ? (language === 'ar' ? 'حفظ التغييرات' : 'Save Changes') : (language === 'ar' ? 'إضافة المنتج' : 'Add Product')}
              </Button>
              <Button variant="outline" onClick={() => { setShowDialog(false); setEditingProduct(null); setForm(emptyForm); }}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={showStockDialog} onOpenChange={open => { if (!open) { setShowStockDialog(false); setStockProduct(null); setStockAdjustment("0"); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'تعديل المخزون' : 'Adjust Stock'}
            </DialogTitle>
          </DialogHeader>
          {stockProduct && (
            <div className="space-y-4 pt-2">
              <div className="text-center">
                <p className="font-semibold">{stockProduct.nameAr}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'المخزون الحالي:' : 'Current Stock:'}{' '}
                  <span className="font-bold text-foreground">{stockProduct.stockQuantity}</span>
                </p>
              </div>
              <div>
                <Label>
                  {language === 'ar'
                    ? 'الكمية (موجب لإضافة، سالب لخصم)'
                    : 'Quantity (+ to add, − to remove)'}
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setStockAdjustment(v => String(parseInt(v || "0") - 1))}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={stockAdjustment}
                    onChange={e => setStockAdjustment(e.target.value)}
                    className="text-center text-lg font-bold"
                    data-testid="input-stock-adjustment"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setStockAdjustment(v => String(parseInt(v || "0") + 1))}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  {language === 'ar' ? 'المخزون الجديد:' : 'New Stock:'}{' '}
                  <span className="font-bold text-foreground">
                    {Math.max(0, stockProduct.stockQuantity + (parseInt(stockAdjustment) || 0))}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handleStockSave}
                  disabled={stockMutation.isPending}
                  data-testid="button-save-stock"
                >
                  {stockMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {language === 'ar' ? 'حفظ' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => { setShowStockDialog(false); setStockProduct(null); setStockAdjustment("0"); }}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</DialogTitle>
          </DialogHeader>
          {deleteConfirm && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                {language === 'ar'
                  ? `هل تريد حذف "${deleteConfirm.nameAr}"؟ لا يمكن التراجع.`
                  : `Delete "${deleteConfirm.nameAr}"? This cannot be undone.`}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-confirm-delete"
                >
                  {deleteMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {language === 'ar' ? 'حذف' : 'Delete'}
                </Button>
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Confirm Dialog */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'إعادة تعيين الجرد' : 'Reset Count'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {language === 'ar'
                ? 'سيتم مسح جميع بيانات المسح. هل أنت متأكد؟'
                : 'All scan data will be cleared. Are you sure?'}
            </p>
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1" onClick={resetCount} data-testid="button-confirm-reset">
                {language === 'ar' ? 'نعم، إعادة تعيين' : 'Yes, Reset'}
              </Button>
              <Button variant="outline" onClick={() => setShowResetConfirm(false)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply Count Confirm Dialog */}
      <Dialog open={showApplyConfirm} onOpenChange={setShowApplyConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تطبيق الجرد' : 'Apply Stock Count'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {language === 'ar'
                ? `سيتم تحديث كميات ${updatableEntries.length} منتج في قاعدة البيانات. هل أنت متأكد؟`
                : `${updatableEntries.length} product quantities will be updated in the database. Are you sure?`}
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={applyCount}
                disabled={applyCountMutation.isPending}
                data-testid="button-confirm-apply"
              >
                {applyCountMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                {language === 'ar' ? 'تأكيد التطبيق' : 'Confirm Apply'}
              </Button>
              <Button variant="outline" onClick={() => setShowApplyConfirm(false)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
