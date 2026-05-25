import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { playBarcodeScanBeep, playStockCountErrorBeep } from "@/lib/scanBeep";
import {
  appendScanKeystroke,
  codesMatch,
  emptyScanBuffer,
  normalizeScannedBarcode,
  resolveScannedCode,
  shouldSuppressScanInput,
} from "@/lib/barcodeKeyboard";
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
  Grid3X3,
  List,
} from "lucide-react";
import QRCode from "qrcode";
import type { InStoreProduct, LaptopBattery, AcAdapter, Laptop as LaptopItem, Desktop as DesktopItem, Keyboard as KeyboardItem, Lcd as LcdItem } from "@shared/schema";

interface SalesUser {
  id: string;
  role?: string;
  canViewInStoreCostPrice?: boolean;
  permissions: {
    canInventory: number;
  };
}

interface InStoreCapabilities {
  canViewCostPrice: boolean;
}

interface Props {
  user: SalesUser;
  salesLocationId?: number;
  readOnly?: boolean;
}

interface ProductForm {
  nameAr: string;
  nameEn: string;
  sku: string;
  barcode: string;
  price: string;
  wholesalePrice: string;
  costPrice: string;
  bulkWholesalePrice: string;
  category: string;
  description: string;
  stockQuantity: string;
  lowStockThreshold: string;
  image: string;
}

const emptyForm: ProductForm = {
  nameAr: "",
  nameEn: "",
  sku: "",
  barcode: "",
  price: "",
  wholesalePrice: "",
  costPrice: "",
  bulkWholesalePrice: "",
  category: "",
  description: "",
  stockQuantity: "0",
  lowStockThreshold: "3",
  image: "",
};

type CountItemSource = "instore" | "battery" | "adapter" | "laptop" | "desktop" | "keyboard" | "lcd";

interface CountableProduct {
  id: number | string;
  source: CountItemSource;
  nameAr: string;
  nameEn?: string | null;
  serialNumber?: string | null;
  sku?: string | null;
  barcode?: string | null;
  stockQuantity: number;
}

interface ScanEntry {
  product: CountableProduct;
  scanned: number;
}

type CountPhase = "scanning" | "review" | "done";

export default function SalesInStoreInventory({ user, salesLocationId = 1, readOnly = false }: Props) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: capabilities } = useQuery<InStoreCapabilities>({
    queryKey: ["/api/instore/capabilities"],
    staleTime: 0,
  });

  /** Server decides from DB role — hidden by default until loaded. */
  const canViewCostPrice = capabilities?.canViewCostPrice === true;

  const [activeTab, setActiveTab] = useState<"inventory" | "stockcount">("inventory");

  const [searchQuery, setSearchQuery] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState<"all" | "in-stock" | "low-stock">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InStoreProduct | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [stockProduct, setStockProduct] = useState<InStoreProduct | null>(null);
  const [stockAdjustment, setStockAdjustment] = useState("0");
  const [deleteConfirm, setDeleteConfirm] = useState<InStoreProduct | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [countPhase, setCountPhase] = useState<CountPhase>("scanning");
  const [scanInput, setScanInput] = useState("");
  const [scanEntries, setScanEntries] = useState<ScanEntry[]>([]);
  const [unknownCodes, setUnknownCodes] = useState<string[]>([]);
  const [showUnknown, setShowUnknown] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [doneStats, setDoneStats] = useState<{ updated: number; matched: number } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const scanStateRef = useRef(emptyScanBuffer());

  const productsUrl = `/api/instore/products?locationId=${salesLocationId}`;
  const otherSalesLocationId = salesLocationId === 1 ? 2 : 1;
  const otherProductsUrl = `/api/instore/products?locationId=${otherSalesLocationId}`;
  const invalidateInventoryQueries = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = String(query.queryKey[0] || "");
        return (
          key.startsWith("/api/instore/products") ||
          key.startsWith("/api/battery/batteries") ||
          key.startsWith("/api/battery/adapters") ||
          key.startsWith("/api/battery/keyboards") ||
          key.startsWith("/api/battery/lcds") ||
          key.startsWith("/api/battery/laptops") ||
          key.startsWith("/api/battery/desktops")
        );
      },
    });
    queryClient.invalidateQueries({ queryKey: [productsUrl] });
    queryClient.invalidateQueries({ queryKey: [otherProductsUrl] });
  };

  const { data: products = [], isLoading } = useQuery<InStoreProduct[]>({
    queryKey: [productsUrl],
  });

  const { data: otherLocationProducts = [] } = useQuery<InStoreProduct[]>({
    queryKey: [otherProductsUrl],
    enabled: showDialog && (salesLocationId === 1 || salesLocationId === 2),
  });

  const { data: batteries = [] } = useQuery<LaptopBattery[]>({
    queryKey: ['/api/battery/batteries'],
    enabled: activeTab === "stockcount",
  });

  const { data: adapters = [] } = useQuery<AcAdapter[]>({
    queryKey: ['/api/battery/adapters'],
    enabled: activeTab === "stockcount",
  });

  const { data: keyboards = [] } = useQuery<KeyboardItem[]>({
    queryKey: ['/api/battery/keyboards'],
    enabled: activeTab === "stockcount",
  });

  const { data: lcds = [] } = useQuery<LcdItem[]>({
    queryKey: ['/api/battery/lcds'],
    enabled: activeTab === "stockcount",
  });

  const { data: laptops = [] } = useQuery<LaptopItem[]>({
    queryKey: ['/api/battery/laptops'],
    enabled: activeTab === "stockcount",
  });

  const { data: desktops = [] } = useQuery<DesktopItem[]>({
    queryKey: ['/api/battery/desktops'],
    enabled: activeTab === "stockcount",
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
      invalidateInventoryQueries();
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
      invalidateInventoryQueries();
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
      invalidateInventoryQueries();
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
      invalidateInventoryQueries();
      setShowStockDialog(false);
      setStockProduct(null);
      setStockAdjustment("0");
      toast({ title: language === 'ar' ? 'تم تحديث المخزون' : 'Stock updated' });
    },
    onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
  });

  const applyCountMutation = useMutation({
    mutationFn: async (updates: { id: number | string; source: CountItemSource; quantity: number }[]) => {
      const res = await apiRequest('POST', '/api/instore/stock-count/apply', { updates });
      return res.json();
    },
    onSuccess: (data) => {
      invalidateInventoryQueries();
      const matched = scanEntries.filter(e => e.scanned === e.product.stockQuantity).length;
      setDoneStats({ updated: data.updated, matched });
      setCountPhase("done");
      setShowApplyConfirm(false);
    },
    onError: (e: any) => {
      let message = e.message || (language === 'ar' ? 'فشل تطبيق الجرد' : 'Failed to apply stock count');
      try {
        const jsonPart = String(e.message).replace(/^\d+:\s*/, "");
        const parsed = JSON.parse(jsonPart);
        if (parsed?.error) message = parsed.error;
      } catch {
        /* keep raw message */
      }
      toast({ title: message, variant: 'destructive' });
      setShowApplyConfirm(false);
    },
  });

  const openAdd = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
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
      wholesalePrice: String(p.wholesalePrice || ""),
      costPrice: canViewCostPrice ? String(p.costPrice || "") : "",
      bulkWholesalePrice: String(p.bulkWholesalePrice || ""),
      category: p.category || "",
      description: p.description || "",
      stockQuantity: String(p.stockQuantity),
      lowStockThreshold: String(p.lowStockThreshold),
      image: p.image || "",
    });
    setImageFile(null);
    setImagePreview(p.image || null);
    setShowDialog(true);
  };

  const openStock = (p: InStoreProduct) => {
    setStockProduct(p);
    setStockAdjustment("0");
    setShowStockDialog(true);
  };

  const normalizeCode = (value?: string | null) => (value || "").trim().toLowerCase();
  const normalizeName = (value?: string | null) => (value || "").trim().replace(/\s+/g, " ").toLowerCase();
  const currentProductId = editingProduct?.id ?? null;
  const enteredCodes = [form.sku, form.barcode].map(normalizeCode).filter(Boolean);
  const exactDuplicateMatches = enteredCodes.length
    ? products.filter((p) =>
        p.id !== currentProductId &&
        [p.sku, p.barcode].map(normalizeCode).some((code) => code && enteredCodes.includes(code))
      )
    : [];
  const nameDuplicateMatches = (() => {
    const ar = normalizeName(form.nameAr);
    const en = normalizeName(form.nameEn);
    if (!ar && !en) return [];
    return products.filter((p) => {
      if (p.id === currentProductId || exactDuplicateMatches.some((dup) => dup.id === p.id)) return false;
      const pAr = normalizeName(p.nameAr);
      const pEn = normalizeName(p.nameEn);
      return (ar && pAr === ar) || (en && pEn === en);
    });
  })();
  const otherLocationCodeMatches = enteredCodes.length
    ? otherLocationProducts.filter((p) =>
        [p.sku, p.barcode].map(normalizeCode).some((code) => code && enteredCodes.includes(code))
      )
    : [];
  const primaryExactDuplicate = exactDuplicateMatches[0];

  const handleSubmit = async () => {
    if (!form.nameAr.trim() || !form.price.trim()) {
      toast({
        title: language === 'ar' ? 'الاسم والسعر مطلوبان' : 'Name and price are required',
        variant: 'destructive',
      });
      return;
    }
    if (primaryExactDuplicate) {
      toast({
        title: language === 'ar' ? 'هذا المنتج موجود مسبقاً' : 'Product already exists',
        description: language === 'ar'
          ? 'استخدم تعديل المخزون أو تعديل المنتج الموجود بدلاً من إضافة منتج مكرر.'
          : 'Use stock adjustment or edit the existing product instead of adding a duplicate.',
        variant: 'destructive',
      });
      return;
    }
    let imageUrl = form.image || null;
    if (imageFile) {
      try {
        const fd = new FormData();
        fd.append("image", imageFile);
        const res = await fetch("/api/sales/upload/image", { method: "POST", body: fd });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        imageUrl = data.url;
      } catch (e: any) {
        toast({ title: language === 'ar' ? 'فشل رفع الصورة' : 'Image upload failed', description: e.message, variant: 'destructive' });
        return;
      }
    }
    const payload: Record<string, unknown> = {
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim() || null,
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      price: form.price,
      wholesalePrice: form.wholesalePrice || null,
      bulkWholesalePrice: form.bulkWholesalePrice || null,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      image: imageUrl,
      stockQuantity: parseInt(form.stockQuantity) || 0,
      lowStockThreshold: parseInt(form.lowStockThreshold) || 3,
      isActive: 1,
      salesLocationId,
    };
    if (canViewCostPrice) {
      payload.costPrice = form.costPrice || null;
    }
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

  const matchesInventoryFilter = (p: InStoreProduct) => {
    if (inventoryFilter === "low-stock") {
      return p.stockQuantity <= p.lowStockThreshold;
    }
    if (inventoryFilter === "in-stock") {
      return p.stockQuantity > 0;
    }
    return true;
  };

  const categoryPool = products.filter(matchesInventoryFilter);
  const categoryNames = Array.from(
    new Set(categoryPool.map(p => (p.category || "").trim()).filter(Boolean))
  );
  const categoryCounts = new Map<string, number>();
  for (const name of categoryNames) {
    categoryCounts.set(name, categoryPool.filter(p => (p.category || "").trim() === name).length);
  }

  const filtered = products.filter(p => {
    if (!matchesInventoryFilter(p)) return false;
    if (selectedCategory !== "all" && (p.category || "").trim() !== selectedCategory) return false;

    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || p.nameAr.toLowerCase().includes(q) ||
      (p.nameEn || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q);
    if (!matchesSearch) return false;
    
    return true;
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

  const countProducts: CountableProduct[] = [
    ...products.map(p => ({
      id: p.id,
      source: "instore" as const,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      serialNumber: null,
      sku: p.sku,
      barcode: p.barcode,
      stockQuantity: p.stockQuantity,
    })),
    ...batteries.map(b => ({
      id: b.id,
      source: "battery" as const,
      nameAr: `${b.brand} ${b.serialNumber}`,
      nameEn: `${b.brand} ${b.serialNumber}`,
      serialNumber: b.serialNumber,
      sku: b.barcode || b.serialNumber,
      barcode: b.barcode,
      stockQuantity: b.stockQuantity || 0,
    })),
    ...adapters.map(a => ({
      id: a.id,
      source: "adapter" as const,
      nameAr: `${a.brand} ${a.serialNumber}`,
      nameEn: `${a.brand} ${a.serialNumber}`,
      serialNumber: a.serialNumber,
      sku: a.barcode || a.serialNumber,
      barcode: a.barcode,
      stockQuantity: a.stockQuantity || 0,
    })),
    ...laptops.map(l => ({
      id: l.id,
      source: "laptop" as const,
      nameAr: `${l.brand} ${l.serialNumber}${l.model ? ` ${l.model}` : ""}`,
      nameEn: `${l.brand} ${l.serialNumber}${l.model ? ` ${l.model}` : ""}`,
      serialNumber: l.serialNumber,
      sku: l.barcode || l.serialNumber,
      barcode: l.barcode,
      stockQuantity: l.stockQuantity || 0,
    })),
    ...desktops.map(d => ({
      id: d.id,
      source: "desktop" as const,
      nameAr: `${d.brand} ${d.serialNumber}${d.model ? ` ${d.model}` : ""}`,
      nameEn: `${d.brand} ${d.serialNumber}${d.model ? ` ${d.model}` : ""}`,
      serialNumber: d.serialNumber,
      sku: d.barcode || d.serialNumber,
      barcode: d.barcode,
      stockQuantity: d.stockQuantity || 0,
    })),
    ...keyboards.map(k => ({
      id: k.id,
      source: "keyboard" as const,
      nameAr: `${k.brand} ${k.serialNumber}`,
      nameEn: `${k.brand} ${k.serialNumber}`,
      serialNumber: k.serialNumber,
      sku: k.barcode || k.serialNumber,
      barcode: k.barcode,
      stockQuantity: k.stockQuantity || 0,
    })),
    ...lcds.map(l => ({
      id: l.id,
      source: "lcd" as const,
      nameAr: `${l.brand} ${l.serialNumber}`,
      nameEn: `${l.brand} ${l.serialNumber}`,
      serialNumber: l.serialNumber,
      sku: l.barcode || l.serialNumber,
      barcode: l.barcode,
      stockQuantity: l.stockQuantity || 0,
    })),
  ];

  const countScopeStats = {
    instore: countProducts.filter(p => p.source === "instore").length,
    batteries: countProducts.filter(p => p.source === "battery").length,
    adapters: countProducts.filter(p => p.source === "adapter").length,
    laptops: countProducts.filter(p => p.source === "laptop").length,
    desktops: countProducts.filter(p => p.source === "desktop").length,
    keyboards: countProducts.filter(p => p.source === "keyboard").length,
    lcds: countProducts.filter(p => p.source === "lcd").length,
  };

  const findProductByCode = useCallback((code: string): CountableProduct | null => {
    const c = normalizeScannedBarcode(code).toLowerCase();
    if (!c) return null;
    return (
      countProducts.find(
        (p) => codesMatch(p.barcode, c) || codesMatch(p.sku, c),
      ) || null
    );
  }, [countProducts]);

  const handleScanSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const code = resolveScannedCode(scanStateRef.current, scanInput);
      scanStateRef.current = emptyScanBuffer();
      if (!code) return;

      if (unknownCodes.length > 0) {
        playStockCountErrorBeep();
        toast({
          title: language === 'ar' ? 'احذف الرموز غير المعروفة أولاً' : 'Remove unknown codes first',
          description: language === 'ar'
            ? 'لا يمكن متابعة المسح حتى حذف كل الرموز غير الموجودة في النظام.'
            : 'Scanning is paused until every unknown code is removed from the list below.',
          variant: 'destructive',
        });
        return;
      }

      setScanInput("");
      setTimeout(() => scanInputRef.current?.focus(), 50);

      const product = findProductByCode(code);
      if (product) {
        playBarcodeScanBeep();
        setScanEntries(prev => {
          const productKey = makeEntryKey(product);
          const existing = prev.find(e => makeEntryKey(e.product) === productKey);
          if (existing) {
            const rest = prev.filter(e => makeEntryKey(e.product) !== productKey);
            return [{ ...existing, scanned: existing.scanned + 1 }, ...rest];
          }
          return [{ product, scanned: 1 }, ...prev];
        });
      } else {
        playStockCountErrorBeep();
        setUnknownCodes(prev => [...prev, code]);
        setShowUnknown(true);
      }
      return;
    }

    const next = appendScanKeystroke(scanStateRef.current, e.nativeEvent);
    scanStateRef.current = next;
    if (shouldSuppressScanInput(next)) {
      e.preventDefault();
    }
  };

  const makeEntryKey = (product: CountableProduct) => `${product.source}:${product.id}`;

  const adjustScanCount = (entryKey: string, delta: number) => {
    setScanEntries(prev =>
      prev.map(e => makeEntryKey(e.product) === entryKey
        ? { ...e, scanned: Math.max(0, e.scanned + delta) }
        : e
      )
    );
  };

  const removeScanEntry = (entryKey: string) => {
    setScanEntries(prev => prev.filter(e => makeEntryKey(e.product) !== entryKey));
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
    const updates = scanEntries.map(e => ({ id: e.product.id, source: e.product.source, quantity: e.scanned }));
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
    ...countProducts
      .filter(p => !scanEntries.find(e => makeEntryKey(e.product) === makeEntryKey(p)))
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
            {salesLocationId === 2
              ? (language === 'ar' ? 'مخزون الموقع 2' : 'Inventory — Location 2')
              : (language === 'ar' ? 'مخزون الموقع 1' : 'Inventory — Location 1')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {readOnly
              ? (language === 'ar' ? 'عرض فقط — يُضاف المخزون عبر النقل من الموقع 1' : 'View only — stock arrives via transfer from Location 1')
              : (salesLocationId === 2
                ? (language === 'ar' ? 'إدارة منتجات الموقع 2' : 'Manage Location 2 products')
                : (language === 'ar' ? 'إدارة منتجات الموقع 1' : 'Manage Location 1 products'))}
          </p>
        </div>
        {activeTab === "inventory" && !readOnly && (
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
            <Card
              className={`cursor-pointer transition-colors ${inventoryFilter === "all" ? "ring-2 ring-primary border-primary/50" : "hover:border-primary/40"}`}
              onClick={() => setInventoryFilter("all")}
              data-testid="card-filter-total-products"
            >
              <CardContent className="pt-4 pb-3">
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'إجمالي المنتجات' : 'Total Products'}</p>
                <p className="text-2xl font-bold">{products.length}</p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-colors ${inventoryFilter === "in-stock" ? "ring-2 ring-primary border-primary/50" : "hover:border-primary/40"}`}
              onClick={() => setInventoryFilter("in-stock")}
              data-testid="card-filter-total-units"
            >
              <CardContent className="pt-4 pb-3">
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'إجمالي الوحدات' : 'Total Units'}</p>
                <p className="text-2xl font-bold">{products.reduce((s, p) => s + p.stockQuantity, 0)}</p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-colors ${inventoryFilter === "low-stock" ? "ring-2 ring-orange-400 border-orange-500" : lowStockCount > 0 ? "border-orange-400 hover:border-orange-500" : "hover:border-primary/40"}`}
              onClick={() => setInventoryFilter("low-stock")}
              data-testid="card-filter-low-stock"
            >
              <CardContent className="pt-4 pb-3">
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'مخزون منخفض' : 'Low Stock'}</p>
                <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-orange-500' : ''}`}>{lowStockCount}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              {inventoryFilter === "all"
                ? (language === 'ar' ? 'عرض كل المنتجات' : 'Showing all products')
                : inventoryFilter === "in-stock"
                ? (language === 'ar' ? 'عرض المنتجات المتوفرة فقط' : 'Showing in-stock products only')
                : (language === 'ar' ? 'عرض المنتجات منخفضة المخزون فقط' : 'Showing low-stock products only')}
            </p>
            {inventoryFilter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setInventoryFilter("all")} data-testid="button-clear-inventory-filter">
                {language === 'ar' ? 'إظهار الكل' : 'Show All'}
              </Button>
            )}
          </div>

          {/* Search + View Mode */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="ps-10"
                placeholder={language === 'ar' ? 'بحث بالاسم، SKU، أو الباركود...' : 'Search by name, SKU, or barcode...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                data-testid="input-instore-search"
              />
            </div>
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                size="icon"
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                className="h-8 w-8"
                onClick={() => setViewMode("grid")}
                data-testid="button-view-grid"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={viewMode === "list" ? "secondary" : "ghost"}
                className="h-8 w-8"
                onClick={() => setViewMode("list")}
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Category quick filters (like POS chips) */}
          <div className="overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max pb-1">
              <Button
                size="sm"
                variant={selectedCategory === "all" ? "default" : "outline"}
                onClick={() => setSelectedCategory("all")}
                className="whitespace-nowrap"
                data-testid="button-category-all"
              >
                {language === 'ar' ? 'الكل' : 'All'}
                <Badge variant="secondary" className="ms-2 text-xs">
                  {categoryPool.length}
                </Badge>
              </Button>
              {categoryNames.map((cat) => (
                <Button
                  key={cat}
                  size="sm"
                  variant={selectedCategory === cat ? "default" : "outline"}
                  onClick={() => setSelectedCategory(cat)}
                  className="whitespace-nowrap"
                  data-testid={`button-category-${cat}`}
                >
                  {cat}
                  <Badge variant="secondary" className="ms-2 text-xs">
                    {categoryCounts.get(cat) || 0}
                  </Badge>
                </Button>
              ))}
            </div>
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
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(product => {
                const isLow = product.stockQuantity <= product.lowStockThreshold;
                const isOut = product.stockQuantity <= 0;
                return (
                  <Card key={product.id} className={isOut ? 'border-destructive/40' : isLow ? 'border-orange-400/60' : ''}>
                    <CardContent className="p-3 space-y-2">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.nameAr}
                          className="h-24 w-full object-cover rounded-md border"
                        />
                      ) : (
                        <div className="h-24 w-full rounded-md border bg-muted/30 flex items-center justify-center">
                          <Package className="h-7 w-7 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="space-y-1 min-w-0">
                        <div className="font-semibold truncate">{product.nameAr}</div>
                        {product.nameEn && <div className="text-xs text-muted-foreground truncate">{product.nameEn}</div>}
                        <div className="flex items-center gap-1 flex-wrap">
                          {product.category && <Badge variant="outline" className="text-[10px]">{product.category}</Badge>}
                          {isOut ? (
                            <Badge variant="destructive" className="text-[10px]">{language === 'ar' ? 'نفذ' : 'Out'}</Badge>
                          ) : isLow ? (
                            <Badge variant="outline" className="text-[10px] bg-orange-500 text-white border-orange-600">
                              {language === 'ar' ? 'منخفض' : 'Low'}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {product.sku ? `SKU: ${product.sku}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{formatPrice(product.price)} {language === 'ar' ? 'د.ع' : 'IQD'}</p>
                          <p className={`text-sm font-bold ${isOut ? 'text-destructive' : isLow ? 'text-orange-500' : ''}`}>
                            {language === 'ar' ? `الكمية: ${product.stockQuantity}` : `Stock: ${product.stockQuantity}`}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {!readOnly && (
                            <Button size="icon" variant="outline" onClick={() => openStock(product)} data-testid={`button-stock-${product.id}`} title={language === 'ar' ? 'تعديل المخزون' : 'Adjust Stock'}>
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                          )}
                          {(product.barcode || product.sku) && (
                            <Button size="icon" variant="outline" onClick={() => printBarcode(product)} data-testid={`button-barcode-${product.id}`} title={language === 'ar' ? 'طباعة الباركود' : 'Print Barcode'}>
                              <Printer className="h-4 w-4" />
                            </Button>
                          )}
                          {!readOnly && (
                            <>
                              <Button size="icon" variant="outline" onClick={() => openEdit(product)} data-testid={`button-edit-${product.id}`}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="outline" onClick={() => setDeleteConfirm(product)} data-testid={`button-delete-${product.id}`} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
                        {product.image && (
                          <img
                            src={product.image}
                            alt={product.nameAr}
                            className="h-12 w-12 object-cover rounded-md border flex-shrink-0"
                          />
                        )}
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
                            {!readOnly && (
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => openStock(product)}
                                data-testid={`button-stock-${product.id}`}
                                title={language === 'ar' ? 'تعديل المخزون' : 'Adjust Stock'}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                            )}
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
                            {!readOnly && (
                              <>
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
                              </>
                            )}
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

              {/* Count scope: show all items included in stock count */}
              <Card>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold text-sm">
                      {language === 'ar' ? 'العناصر المشمولة في الجرد' : 'Items included in stock count'}
                    </p>
                    <div className="flex gap-2 flex-wrap text-xs">
                      <Badge variant="outline">{language === 'ar' ? `المتجر: ${countScopeStats.instore}` : `In-store: ${countScopeStats.instore}`}</Badge>
                      <Badge variant="outline">{language === 'ar' ? `بطاريات: ${countScopeStats.batteries}` : `Batteries: ${countScopeStats.batteries}`}</Badge>
                      <Badge variant="outline">{language === 'ar' ? `شواحن: ${countScopeStats.adapters}` : `Adapters: ${countScopeStats.adapters}`}</Badge>
                      <Badge variant="outline">{language === 'ar' ? `لابتوبات: ${countScopeStats.laptops}` : `Laptops: ${countScopeStats.laptops}`}</Badge>
                      <Badge variant="outline">{language === 'ar' ? `ديسكتوب: ${countScopeStats.desktops}` : `Desktops: ${countScopeStats.desktops}`}</Badge>
                      <Badge variant="outline">{language === 'ar' ? `كيبورد: ${countScopeStats.keyboards}` : `Keyboards: ${countScopeStats.keyboards}`}</Badge>
                      <Badge variant="outline">{language === 'ar' ? `LCD: ${countScopeStats.lcds}` : `LCDs: ${countScopeStats.lcds}`}</Badge>
                    </div>
                  </div>
                  <div className="max-h-56 overflow-auto border rounded-md">
                    {countProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3">
                        {language === 'ar' ? 'لا توجد عناصر للجرد' : 'No items available for count'}
                      </p>
                    ) : (
                      <div className="divide-y">
                        {countProducts.map((p) => (
                          <div key={`${p.source}:${p.id}`} className="px-3 py-2 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{p.nameAr}</p>
                              <p className="text-xs text-muted-foreground font-mono truncate">
                                {`S:${p.serialNumber || '-'} | B:${p.barcode || '-'} | SKU:${p.sku || '-'}`}
                              </p>
                            </div>
                            <div className="text-end">
                              <Badge variant="secondary" className="text-[10px]">
                                {p.source === "instore" ? (language === 'ar' ? 'متجر' : 'In-store')
                                  : p.source === "battery" ? (language === 'ar' ? 'بطارية' : 'Battery')
                                  : p.source === "adapter" ? (language === 'ar' ? 'شاحن' : 'Adapter')
                                  : p.source === "laptop" ? (language === 'ar' ? 'لابتوب' : 'Laptop')
                                  : p.source === "desktop" ? (language === 'ar' ? 'ديسكتوب' : 'Desktop')
                                  : p.source === "keyboard" ? (language === 'ar' ? 'كيبورد' : 'Keyboard')
                                  : 'LCD'}
                              </Badge>
                              <p className="text-xs mt-1">{language === 'ar' ? `مخزون: ${p.stockQuantity}` : `Stock: ${p.stockQuantity}`}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

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
                    lang="en"
                    dir="ltr"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={language === 'ar' ? 'في انتظار المسح...' : 'Waiting for scan...'}
                    className="text-lg font-mono h-12"
                    autoComplete="off"
                    data-testid="input-scan-barcode"
                    disabled={unknownCodes.length > 0}
                  />
                  <p className="text-xs text-muted-foreground">
                    {unknownCodes.length > 0
                      ? (language === 'ar'
                        ? 'المسح متوقف: احذف كل الرموز غير المعروفة أدناه للمتابعة.'
                        : 'Scanning paused: remove every unknown code below to continue.')
                      : (language === 'ar'
                        ? 'اضغط على حقل الإدخال ثم امسح الباركود. كل مسح يضيف وحدة واحدة.'
                        : 'Click the input then scan. Each scan adds 1 unit.')}
                  </p>
                </CardContent>
              </Card>

              {/* Unknown codes — must clear before more scans; shown above scanned list */}
              {unknownCodes.length > 0 && (
                <Card className="border-orange-300 border-2">
                  <CardContent className="pt-3 pb-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full text-start"
                      onClick={() => setShowUnknown(v => !v)}
                    >
                      <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                      <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                        {language === 'ar'
                          ? `${unknownCodes.length} رمز غير معروف — احذفها لمتابعة الجرد`
                          : `${unknownCodes.length} unknown code(s) — delete to continue counting`}
                      </span>
                      {showUnknown ? <ChevronDown className="h-4 w-4 ms-auto shrink-0" /> : <ChevronRight className="h-4 w-4 ms-auto shrink-0" />}
                    </button>
                    {showUnknown && (
                      <div className="mt-2 space-y-1">
                        {unknownCodes.map((c, i) => (
                          <div key={`${c}-${i}`} className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{c}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive"
                              onClick={() => {
                                setUnknownCodes(prev => prev.filter((_, idx) => idx !== i));
                                setTimeout(() => scanInputRef.current?.focus(), 50);
                              }}
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

              {/* Scanned list — newest scans at the top */}
              {scanEntries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {language === 'ar' ? 'المنتجات الممسوحة (الأحدث أولاً):' : 'Scanned products (newest first):'}
                  </p>
                  {scanEntries.map(entry => (
                    <Card key={makeEntryKey(entry.product)}>
                      <CardContent className="py-2 px-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{entry.product.nameAr}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {entry.product.sku || entry.product.barcode || `#${entry.product.id}`}
                            </p>
                            {(entry.product.source !== "instore") && (
                              <p className="text-[11px] text-muted-foreground font-mono">
                                {`Serial: ${entry.product.serialNumber || '-'} | Barcode: ${entry.product.barcode || '-'}`}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => adjustScanCount(makeEntryKey(entry.product), -1)}
                              data-testid={`button-scan-minus-${makeEntryKey(entry.product)}`}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                            <span className="font-bold text-lg w-8 text-center">{entry.scanned}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => adjustScanCount(makeEntryKey(entry.product), 1)}
                              data-testid={`button-scan-plus-${makeEntryKey(entry.product)}`}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeScanEntry(makeEntryKey(entry.product))}
                              className="text-destructive"
                              data-testid={`button-scan-remove-${makeEntryKey(entry.product)}`}
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

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  disabled={scanEntries.length === 0 || unknownCodes.length > 0}
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
                            rowClass = "bg-green-100 dark:bg-green-900/40";
                            statusEl = <Badge className="text-xs bg-green-200 text-green-900 border-green-300 font-bold">{language === 'ar' ? 'مطابق' : 'Match'}</Badge>;
                          } else if (row.diff < 0) {
                            rowClass = "bg-red-100 dark:bg-red-900/40";
                            statusEl = <Badge className="text-xs bg-red-200 text-red-900 border-red-300 font-bold">{language === 'ar' ? 'ناقص' : 'Short'}</Badge>;
                          } else {
                            rowClass = "bg-yellow-100 dark:bg-yellow-900/40";
                            statusEl = <Badge className="text-xs bg-yellow-200 text-yellow-900 border-yellow-300 font-bold">{language === 'ar' ? 'زيادة' : 'Extra'}</Badge>;
                          }
                          return (
                            <tr key={`${row.product.source}-${row.product.id}`} className={`border-b ${rowClass} text-black dark:text-white`} data-testid={`row-compare-${row.product.source}-${row.product.id}`}>
                              <td className="px-3 py-2 font-medium text-black dark:text-white">{row.product.nameAr}</td>
                              <td className="px-3 py-2 text-center font-mono text-xs text-black dark:text-white opacity-80">
                                {row.product.source === "instore"
                                  ? (row.product.sku || row.product.barcode || '-')
                                  : `S:${row.product.serialNumber || '-'} | B:${row.product.barcode || '-'}`
                                }
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-[#121111]">{row.systemQty}</td>
                              <td className="px-3 py-2 text-center font-bold text-[#121111]">{row.scannedQty}</td>
                              <td className="px-3 py-2 text-center font-bold text-[#121111]">
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
      <Dialog open={showDialog} onOpenChange={open => { if (!open) { setShowDialog(false); setEditingProduct(null); setForm(emptyForm); setImageFile(null); setImagePreview(null); } }}>
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
                <Label>{language === 'ar' ? 'سعر الجملة (د.ع)' : 'Wholesale Price (IQD)'}</Label>
                <Input
                  type="number"
                  value={form.wholesalePrice}
                  onChange={e => setForm(f => ({ ...f, wholesalePrice: e.target.value }))}
                  placeholder="0"
                  data-testid="input-product-wholesale-price"
                />
              </div>
              {canViewCostPrice && (
                <div>
                  <Label>{language === 'ar' ? 'سعر الشراء (د.ع)' : 'Cost Price (IQD)'}</Label>
                  <Input
                    type="number"
                    value={form.costPrice}
                    onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))}
                    placeholder="0"
                    data-testid="input-product-cost-price"
                  />
                </div>
              )}
              <div>
                <Label>{language === 'ar' ? 'جملة الجملة (د.ع)' : 'Bulk Wholesale (IQD)'}</Label>
                <Input
                  type="number"
                  value={form.bulkWholesalePrice}
                  onChange={e => setForm(f => ({ ...f, bulkWholesalePrice: e.target.value }))}
                  placeholder="0"
                  data-testid="input-product-bulk-wholesale-price"
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
              <div className="col-span-2">
                <Label>{language === 'ar' ? 'صورة المنتج' : 'Product Image'}</Label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    data-testid="input-product-image"
                    onChange={e => {
                      const file = e.target.files?.[0] || null;
                      setImageFile(file);
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = ev => setImagePreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => imageInputRef.current?.click()}
                    data-testid="button-browse-image"
                  >
                    {language === 'ar' ? 'استعراض...' : 'Browse...'}
                  </Button>
                  {imagePreview && (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="preview"
                        className="h-14 w-14 object-cover rounded-md border"
                      />
                      <button
                        type="button"
                        className="absolute -top-1 -end-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-xs leading-none"
                        onClick={() => { setImageFile(null); setImagePreview(null); setForm(f => ({ ...f, image: "" })); if (imageInputRef.current) imageInputRef.current.value = ""; }}
                        data-testid="button-remove-image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {!imagePreview && (
                    <span className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'لم يتم اختيار صورة' : 'No image selected'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {(exactDuplicateMatches.length > 0 || nameDuplicateMatches.length > 0 || otherLocationCodeMatches.length > 0) && (
              <div className={`rounded-lg border p-3 space-y-3 ${
                exactDuplicateMatches.length > 0
                  ? 'border-destructive/40 bg-destructive/10'
                  : otherLocationCodeMatches.length > 0
                    ? 'border-blue-400/50 bg-blue-50 dark:bg-blue-950/20'
                  : 'border-amber-400/50 bg-amber-50 dark:bg-amber-950/20'
              }`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                    exactDuplicateMatches.length > 0
                      ? 'text-destructive'
                      : otherLocationCodeMatches.length > 0
                        ? 'text-blue-600'
                        : 'text-amber-600'
                  }`} />
                  <div>
                    <p className="font-semibold">
                      {exactDuplicateMatches.length > 0
                        ? (language === 'ar' ? 'منتج بنفس SKU أو الباركود موجود مسبقاً' : 'A product with the same SKU or barcode already exists')
                        : otherLocationCodeMatches.length > 0
                          ? (language === 'ar' ? 'هذا الرمز موجود في موقع آخر' : 'This code exists in another location')
                        : (language === 'ar' ? 'قد يكون المنتج موجوداً بنفس الاسم' : 'This product may already exist with the same name')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {exactDuplicateMatches.length > 0
                        ? (language === 'ar'
                          ? 'لا يمكن حفظ منتج مكرر بنفس الرمز في نفس الموقع. عدّل المنتج الموجود أو أضف كمية للمخزون.'
                          : 'You cannot save a duplicate code in the same location. Edit the existing item or adjust its stock.')
                        : otherLocationCodeMatches.length > 0
                          ? (language === 'ar'
                            ? 'يمكنك حفظه في هذا الموقع، لكن تأكد أن هذا المنتج مقصود للموقع الحالي.'
                            : 'You can save it in this location, but confirm it is intended for the current location.')
                        : (language === 'ar'
                          ? 'يمكنك المتابعة إذا كان منتجاً مختلفاً، أو تعديل المنتج الموجود.'
                          : 'You can continue if it is a different item, or edit the existing product.')}
                    </p>
                  </div>
                </div>

                {[
                  ...exactDuplicateMatches.map((p) => ({ product: p, locationId: salesLocationId, canEditHere: true })),
                  ...nameDuplicateMatches.map((p) => ({ product: p, locationId: salesLocationId, canEditHere: true })),
                  ...otherLocationCodeMatches.map((p) => ({ product: p, locationId: otherSalesLocationId, canEditHere: false })),
                ].slice(0, 3).map(({ product: p, locationId, canEditHere }) => (
                  <div key={`${locationId}-${p.id}`} className="rounded-md border bg-background/80 p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.nameAr}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          SKU: {p.sku || '-'} | {language === 'ar' ? 'باركود' : 'Barcode'}: {p.barcode || '-'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {language === 'ar' ? 'المخزون الحالي' : 'Current stock'}: {p.stockQuantity}
                          {' | '}
                          {language === 'ar' ? `الموقع ${locationId}` : `Location ${locationId}`}
                        </p>
                      </div>
                      {canEditHere && (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(p)}
                            data-testid={`button-edit-duplicate-${p.id}`}
                          >
                            <Pencil className="h-3 w-3 me-1" />
                            {language === 'ar' ? 'تعديل الموجود' : 'Edit Existing'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowDialog(false);
                              openStock(p);
                            }}
                            data-testid={`button-stock-duplicate-${p.id}`}
                          >
                            <ArrowUp className="h-3 w-3 me-1" />
                            {language === 'ar' ? 'إضافة كمية' : 'Adjust Stock'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending || exactDuplicateMatches.length > 0}
                data-testid="button-save-product"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                {editingProduct ? (language === 'ar' ? 'حفظ التغييرات' : 'Save Changes') : (language === 'ar' ? 'إضافة المنتج' : 'Add Product')}
              </Button>
              <Button variant="outline" onClick={() => { setShowDialog(false); setEditingProduct(null); setForm(emptyForm); setImageFile(null); setImagePreview(null); }}>
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
