import { useState, useRef, useCallback } from "react";
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

export default function SalesInStoreInventory({ user }: Props) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InStoreProduct | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [stockProduct, setStockProduct] = useState<InStoreProduct | null>(null);
  const [stockAdjustment, setStockAdjustment] = useState("0");
  const [deleteConfirm, setDeleteConfirm] = useState<InStoreProduct | null>(null);

  const { data: products = [], isLoading } = useQuery<InStoreProduct[]>({
    queryKey: ['/api/instore/products'],
  });

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

    // Generate QR code as base64 data URL before opening popup
    const qrDataUrl = await QRCode.toDataURL(code, {
      width: 160,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });

    const win = window.open('', '_blank', 'width=420,height=480');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR Label</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; background: #f5f5f5; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 16px; }
  .label {
    background: white;
    border: 1.5px solid #ddd;
    border-radius: 8px;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 210px;
    gap: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  .store-name { font-size: 8px; font-weight: 600; color: #888; letter-spacing: 1.5px; text-transform: uppercase; }
  .product-name { font-size: 11px; font-weight: 700; text-align: center; line-height: 1.4; color: #111; }
  .qr-img { width: 140px; height: 140px; }
  .code { font-size: 9px; color: #666; letter-spacing: 2px; font-family: monospace; }
  .price { font-size: 16px; font-weight: 900; color: #111; }
  .currency { font-size: 10px; font-weight: 600; color: #555; }
  .divider { width: 100%; height: 1px; background: #eee; }
  .controls { display: flex; gap: 8px; }
  button { padding: 9px 22px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
  .btn-print { background: #1d4ed8; color: white; }
  .btn-close { background: #e5e7eb; color: #374151; }
  @media print {
    body { background: white; min-height: unset; gap: 0; padding: 0; }
    .controls { display: none !important; }
    .label { border: 1px solid #ccc; border-radius: 0; box-shadow: none; }
  }
</style>
</head><body>
<div class="label">
  <div class="store-name">AL-AIN STORE</div>
  <div class="divider"></div>
  <div class="product-name">${name}</div>
  <img class="qr-img" src="${qrDataUrl}" alt="QR Code" />
  <div class="code">${code}</div>
  <div class="divider"></div>
  <div class="price">${price} <span class="currency">IQD</span></div>
</div>
<div class="controls">
  <button class="btn-print" onclick="window.print()">&#128424; Print</button>
  <button class="btn-close" onclick="window.close()">Close</button>
</div>
</body></html>`);
    win.document.close();
  }, [formatPrice]);

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
        <Button onClick={openAdd} data-testid="button-add-instore-product">
          <Plus className="h-4 w-4 me-2" />
          {language === 'ar' ? 'إضافة منتج' : 'Add Product'}
        </Button>
      </div>

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
                          <Badge className="text-xs bg-orange-500/15 text-orange-600 border-orange-300">
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
            <DialogTitle className="text-destructive">
              {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {language === 'ar'
              ? `هل أنت متأكد من حذف "${deleteConfirm?.nameAr}"؟ لا يمكن التراجع.`
              : `Are you sure you want to delete "${deleteConfirm?.nameAr}"? This cannot be undone.`}
          </p>
          <div className="flex gap-2 pt-2">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
