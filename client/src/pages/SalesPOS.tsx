import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { playBarcodeScanBeep } from "@/lib/scanBeep";
import {
  appendScanKeystroke,
  codesMatch,
  emptyScanBuffer,
  resolveScannedCode,
  shouldSuppressScanInput,
} from "@/lib/barcodeKeyboard";
import { getInventoryScanCode, inventoryItemMatchesScan } from "@/lib/inventoryScanCode";
import { formatPosPaymentLabel } from "@/lib/posPayment";
import { cn } from "@/lib/utils";
import { openA4InvoicePrint, STORE_BRAND_RED, STORE_WEBSITE } from "@/lib/a4InvoicePrint";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  CreditCard, 
  Banknote,
  Printer,
  Loader2,
  Package,
  User,
  Phone,
  Percent,
  Check,
  CheckCircle2,
  X,
  Grid3X3,
  List,
  Tag,
  Barcode,
  Wallet,
  Receipt,
  PauseCircle,
  PlayCircle,
  Clock,
  RotateCcw,
  History,
  UserSearch,
  Store,
  Battery,
  Plug,
  Keyboard,
  Monitor,
  Laptop as LaptopIcon,
  Computer,
  FileText,
  Edit3,
  Save,
  Split,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { InStoreProduct, LaptopBattery, AcAdapter, Keyboard as KeyboardItem, Lcd as LcdItem, Laptop, Desktop } from "@shared/schema";

interface POSProduct {
  id: string;
  nameAr: string;
  nameEn: string | null;
  price: string;
  wholesalePrice?: string | null;
  stockQuantity: number | null;
  sku: string | null;
  image: string | null;
  category: string | null;
  barcode?: string | null;
  scanCode?: string | null;
  serialNumber?: string | null;
  partNumber?: string | null;
  productSource?: 'instore' | 'battery' | 'adapter' | 'keyboard' | 'lcd' | 'laptop' | 'desktop';
  sourceId?: string;
  printSpecs?: string[];
}

const SERIAL_INVENTORY_SOURCES = new Set<POSProduct["productSource"]>([
  "battery",
  "adapter",
  "keyboard",
  "lcd",
  "laptop",
  "desktop",
]);

function isSerialInventoryProduct(product: POSProduct): boolean {
  return !!product.productSource && SERIAL_INVENTORY_SOURCES.has(product.productSource);
}

function productMatchesScanCode(product: POSProduct, code: string): boolean {
  if (!isSerialInventoryProduct(product)) {
    return codesMatch(product.sku, code) || codesMatch(product.barcode, code);
  }
  return inventoryItemMatchesScan(
    {
      scanCode: product.scanCode ?? product.sku,
      barcode: product.barcode,
      serialNumber: product.serialNumber,
      partNumber: product.partNumber,
    },
    code,
  );
}

interface Category {
  id: string;
  slug: string;
  nameAr: string;
  nameEn?: string;
}

interface SalesUser {
  id: string;
  permissions: {
    canPos: number;
    canApplyDiscount: number;
  };
}

interface CartItem {
  product: POSProduct;
  quantity: number;
  useWholesale: boolean;
}

interface HeldOrder {
  id: string;
  holdNumber: string;
  salesUserName: string;
  customerName: string | null;
  customerPhone: string | null;
  items: string;
  subtotal: string;
  notes: string | null;
  createdAt: string;
}

type ProductSourceFilter = 'instore' | 'battery' | 'adapter' | 'keyboard' | 'lcd' | 'laptop' | 'desktop';

interface SalesPOSProps {
  user: SalesUser;
  orderType?: 'walk-in' | 'in-store';
  salesLocationId?: number;
  productSources?: ProductSourceFilter[];
}

export default function SalesPOS({
  user,
  orderType = 'walk-in',
  salesLocationId = 1,
  productSources,
}: SalesPOSProps) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [splitCardAmount, setSplitCardAmount] = useState("");
  const [discount, setDiscount] = useState("0");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [discountReason, setDiscountReason] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showHeldOrders, setShowHeldOrders] = useState(false);
  const [holdNote, setHoldNote] = useState("");
  const [showCustomerLookup, setShowCustomerLookup] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [receiptNote, setReceiptNote] = useState("");
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReceiptEditor, setShowReceiptEditor] = useState(false);
  const [receiptDraft, setReceiptDraft] = useState<any>(null);
  const [scanPickOpen, setScanPickOpen] = useState(false);
  const [scanPickOptions, setScanPickOptions] = useState<POSProduct[]>([]);
  const scanStateRef = useRef(emptyScanBuffer());

  const { data: mainProducts = [], isLoading: mainLoading } = useQuery<any[]>({
    queryKey: ['/api/products'],
    enabled: orderType === 'walk-in',
  });

  const locQuery = `?locationId=${salesLocationId}`;
  const includeSource = (s: ProductSourceFilter) =>
    !productSources || productSources.includes(s);
  const invalidatePosStockQueries = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = String(query.queryKey[0] || "");
        return (
          key === "/api/products" ||
          key.startsWith("/api/instore/products") ||
          key.startsWith("/api/battery/batteries") ||
          key.startsWith("/api/battery/adapters") ||
          key.startsWith("/api/battery/keyboards") ||
          key.startsWith("/api/battery/lcds") ||
          key.startsWith("/api/battery/laptops") ||
          key.startsWith("/api/battery/desktops") ||
          key === "/api/orders" ||
          key.startsWith("/api/sales/shifts/current") ||
          key.startsWith("/api/sales/shifts/active-snapshot")
        );
      },
    });
    queryClient.invalidateQueries({ queryKey: [`/api/instore/products${locQuery}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/battery/batteries${locQuery}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/battery/adapters${locQuery}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/battery/keyboards${locQuery}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/battery/lcds${locQuery}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/battery/laptops${locQuery}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/battery/desktops${locQuery}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/orders", salesLocationId] });
  };

  const { data: inStoreRaw = [], isLoading: inStoreLoading } = useQuery<InStoreProduct[]>({
    queryKey: [`/api/instore/products${locQuery}`],
    enabled: orderType === 'in-store' && includeSource('instore'),
  });

  const { data: batteriesRaw = [], isLoading: batteriesLoading } = useQuery<LaptopBattery[]>({
    queryKey: [`/api/battery/batteries${locQuery}`],
    enabled: orderType === 'in-store' && includeSource('battery'),
  });

  const { data: adaptersRaw = [], isLoading: adaptersLoading } = useQuery<AcAdapter[]>({
    queryKey: [`/api/battery/adapters${locQuery}`],
    enabled: orderType === 'in-store' && includeSource('adapter'),
  });

  const { data: keyboardsRaw = [], isLoading: keyboardsLoading } = useQuery<KeyboardItem[]>({
    queryKey: [`/api/battery/keyboards${locQuery}`],
    enabled: orderType === 'in-store' && includeSource('keyboard'),
  });

  const { data: lcdsRaw = [], isLoading: lcdsLoading } = useQuery<LcdItem[]>({
    queryKey: [`/api/battery/lcds${locQuery}`],
    enabled: orderType === 'in-store' && includeSource('lcd'),
  });

  const { data: laptopsRaw = [], isLoading: laptopsLoading } = useQuery<Laptop[]>({
    queryKey: [`/api/battery/laptops${locQuery}`],
    enabled: orderType === 'in-store' && includeSource('laptop'),
  });

  const { data: desktopsRaw = [], isLoading: desktopsLoading } = useQuery<Desktop[]>({
    queryKey: [`/api/battery/desktops${locQuery}`],
    enabled: orderType === 'in-store' && includeSource('desktop'),
  });

  const isLoading = orderType === 'in-store'
    ? (inStoreLoading || batteriesLoading || adaptersLoading || keyboardsLoading || lcdsLoading || laptopsLoading || desktopsLoading)
    : mainLoading;

  const skipSyncedBatteryMirrors =
    includeSource('battery') || includeSource('adapter');

  const instoreProducts: POSProduct[] = orderType === 'in-store'
    ? inStoreRaw
        .filter(p => p.isActive !== 0)
        .filter(
          (p) =>
            !skipSyncedBatteryMirrors ||
            (!p.sku?.startsWith('SYNC-BAT:') && !p.sku?.startsWith('SYNC-ADP:')),
        )
        .map(p => ({
          id: String(p.id),
          nameAr: p.nameAr,
          nameEn: p.nameEn ?? null,
          price: String(p.price),
          wholesalePrice: p.wholesalePrice ? String(p.wholesalePrice) : null,
          stockQuantity: p.stockQuantity,
          sku: p.sku ?? null,
          image: null,
          category: p.category ?? null,
          barcode: p.barcode ?? null,
          productSource: 'instore' as const,
        }))
    : [];

  const batteryProducts: POSProduct[] = orderType === 'in-store'
    ? batteriesRaw
        .filter(b => (b.stockQuantity || 0) >= 0)
        .map(b => {
          const scanCode = getInventoryScanCode(b);
          return {
          id: `bat-${b.id}`,
          nameAr: `${b.brand} ${b.serialNumber}`,
          nameEn: `${b.brand} ${b.serialNumber}`,
          price: String(b.sellingPrice || '0'),
          wholesalePrice: b.wholesalePrice ? String(b.wholesalePrice) : null,
          stockQuantity: b.stockQuantity,
          sku: scanCode,
          barcode: scanCode,
          scanCode,
          serialNumber: b.serialNumber,
          partNumber: b.partNumber ?? null,
          image: null,
          category: language === 'ar' ? 'بطاريات' : 'Batteries',
          productSource: 'battery' as const,
          sourceId: b.id,
        };
        })
    : [];

  const adapterProducts: POSProduct[] = orderType === 'in-store'
    ? adaptersRaw
        .filter(a => (a.stockQuantity || 0) >= 0)
        .map(a => {
          const scanCode = getInventoryScanCode(a);
          return {
          id: `ada-${a.id}`,
          nameAr: `${a.brand} ${a.serialNumber}${a.wattage ? ` ${a.wattage}W` : ''}`,
          nameEn: `${a.brand} ${a.serialNumber}${a.wattage ? ` ${a.wattage}W` : ''}`,
          price: String(a.sellingPrice || '0'),
          wholesalePrice: a.wholesalePrice ? String(a.wholesalePrice) : null,
          stockQuantity: a.stockQuantity,
          sku: scanCode,
          barcode: scanCode,
          scanCode,
          serialNumber: a.serialNumber,
          partNumber: a.partNumber ?? null,
          image: null,
          category: language === 'ar' ? 'شواحن' : 'Chargers',
          productSource: 'adapter' as const,
          sourceId: a.id,
        };
        })
    : [];

  const keyboardProducts: POSProduct[] = orderType === 'in-store'
    ? keyboardsRaw
        .filter(k => (k.stockQuantity || 0) >= 0)
        .map(k => {
          const scanCode = getInventoryScanCode(k);
          return {
          id: `kbd-${k.id}`,
          nameAr: `${k.brand} ${k.serialNumber}`,
          nameEn: `${k.brand} ${k.serialNumber}`,
          price: String(k.sellingPrice || '0'),
          wholesalePrice: k.wholesalePrice ? String(k.wholesalePrice) : null,
          stockQuantity: k.stockQuantity,
          sku: scanCode,
          barcode: scanCode,
          scanCode,
          serialNumber: k.serialNumber,
          partNumber: k.partNumber ?? null,
          image: null,
          category: language === 'ar' ? 'كيبورد' : 'Keyboards',
          productSource: 'keyboard' as const,
          sourceId: k.id,
        };
        })
    : [];

  const lcdProducts: POSProduct[] = orderType === 'in-store'
    ? lcdsRaw
        .filter(l => (l.stockQuantity || 0) >= 0)
        .map(l => {
          const scanCode = getInventoryScanCode(l);
          return {
          id: `lcd-${l.id}`,
          nameAr: `${l.brand} ${l.serialNumber}`,
          nameEn: `${l.brand} ${l.serialNumber}`,
          price: String(l.sellingPrice || '0'),
          wholesalePrice: l.wholesalePrice ? String(l.wholesalePrice) : null,
          stockQuantity: l.stockQuantity,
          sku: scanCode,
          barcode: scanCode,
          scanCode,
          serialNumber: l.serialNumber,
          partNumber: l.partNumber ?? null,
          image: null,
          category: language === 'ar' ? 'شاشات LCD' : 'LCDs',
          productSource: 'lcd' as const,
          sourceId: l.id,
        };
        })
    : [];

  const laptopProducts: POSProduct[] = orderType === 'in-store'
    ? laptopsRaw
        .filter(l => (l.stockQuantity || 0) >= 0 && l.isActive !== 0)
        .map(l => {
          const scanCode = getInventoryScanCode(l);
          const sizeLabel = l.sizeInch ? ` ${l.sizeInch}"` : "";
          const ramLabel = l.ram && !(l.model || "").toLowerCase().includes((l.ram || "").toLowerCase())
            ? ` ${l.ram}`
            : "";
          return {
          id: `lap-${l.id}`,
          nameAr: `${l.brand} ${l.model || ''}${ramLabel}${sizeLabel}`.trim(),
          nameEn: `${l.brand} ${l.model || ''}${ramLabel}${sizeLabel}`.trim(),
          price: String(l.sellingPrice || '0'),
          wholesalePrice: l.wholesalePrice ? String(l.wholesalePrice) : null,
          stockQuantity: l.stockQuantity,
          sku: scanCode,
          barcode: scanCode,
          scanCode,
          serialNumber: l.serialNumber,
          partNumber: l.partNumber ?? null,
          image: null,
          category: language === 'ar' ? 'لابتوبات' : 'Laptops',
          productSource: 'laptop' as const,
          sourceId: l.id,
          printSpecs: [
            scanCode ? `Barcode: ${scanCode}` : null,
            l.serialNumber && l.serialNumber !== scanCode ? `Serial: ${l.serialNumber}` : null,
            l.cpu ? `CPU: ${l.cpu}` : null,
            l.ram ? `RAM: ${l.ram}` : null,
            l.storage ? `Storage: ${l.storage}` : null,
            l.gpu ? `GPU: ${l.gpu}` : null,
            l.sizeInch ? `Screen: ${l.sizeInch}"` : null,
            l.partNumber ? `Part No: ${l.partNumber}` : null,
          ].filter(Boolean) as string[],
        };
        })
    : [];

  const desktopProducts: POSProduct[] = orderType === 'in-store'
    ? desktopsRaw
        .filter(d => (d.stockQuantity || 0) >= 0 && d.isActive !== 0)
        .map(d => {
          const scanCode = getInventoryScanCode(d);
          return {
          id: `des-${d.id}`,
          nameAr: `${d.brand} ${d.model || ''}`.trim(),
          nameEn: `${d.brand} ${d.model || ''}`.trim(),
          price: String(d.sellingPrice || '0'),
          wholesalePrice: d.wholesalePrice ? String(d.wholesalePrice) : null,
          stockQuantity: d.stockQuantity,
          sku: scanCode,
          barcode: scanCode,
          scanCode,
          serialNumber: d.serialNumber,
          partNumber: d.partNumber ?? null,
          image: null,
          category: language === 'ar' ? 'ديسكتوب' : 'Desktops',
          productSource: 'desktop' as const,
          sourceId: d.id,
          printSpecs: [
            scanCode ? `Barcode: ${scanCode}` : null,
            d.serialNumber && d.serialNumber !== scanCode ? `Serial: ${d.serialNumber}` : null,
            d.cpu ? `CPU: ${d.cpu}` : null,
            d.ram ? `RAM: ${d.ram}` : null,
            d.storage ? `Storage: ${d.storage}` : null,
            d.gpu ? `GPU: ${d.gpu}` : null,
            d.partNumber ? `Part No: ${d.partNumber}` : null,
          ].filter(Boolean) as string[],
        };
        })
    : [];

  const products: POSProduct[] = orderType === 'in-store'
    ? [...instoreProducts, ...batteryProducts, ...adapterProducts, ...keyboardProducts, ...lcdProducts, ...laptopProducts, ...desktopProducts]
    : mainProducts.map(p => ({
        id: p.id,
        nameAr: p.nameAr,
        nameEn: p.nameEn ?? null,
        price: String(p.price),
        stockQuantity: p.stockQuantity,
        sku: p.sku ?? null,
        barcode: (p as { barcode?: string | null }).barcode ?? null,
        image: p.image ?? null,
        category: p.category ?? null,
        productSource: 'instore' as const,
      }));

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    enabled: orderType === 'walk-in',
  });

  const inStoreCategories: { id: string; slug: string; nameAr: string; nameEn?: string }[] =
    orderType === 'in-store'
      ? Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[])).map(cat => ({
          id: cat,
          slug: cat,
          nameAr: cat,
          nameEn: cat,
        }))
      : [];

  const { data: heldOrders = [] } = useQuery<HeldOrder[]>({
    queryKey: ['/api/sales/held-orders'],
  });

  // Fetch customers for lookup
  interface CustomerData {
    phone: string;
    name: string;
    orderCount: number;
    totalSpent: number;
  }
  
  const { data: customers = [] } = useQuery<CustomerData[]>({
    queryKey: ['/api/sales/customers'],
  });

  // Filter customers by search query
  const filteredCustomers = customerSearchQuery
    ? customers.filter(c => 
        c.phone.includes(customerSearchQuery) || 
        c.name.toLowerCase().includes(customerSearchQuery.toLowerCase())
      )
    : customers.slice(0, 10); // Show top 10 customers by default

  const selectCustomer = (customer: { phone: string; name: string }) => {
    setCustomerPhone(customer.phone);
    setCustomerName(customer.name);
    setShowCustomerLookup(false);
    setCustomerSearchQuery("");
  };

  const holdOrderMutation = useMutation({
    mutationFn: async (data: { items: any[]; customerName: string; customerPhone: string; subtotal: number; notes: string }) => {
      const res = await apiRequest('POST', '/api/sales/held-orders', data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: language === 'ar' ? 'تم تعليق الطلب' : 'Order on hold',
        description: data.heldOrder?.holdNumber,
      });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDiscount("0");
      setHoldNote("");
      queryClient.invalidateQueries({ queryKey: ['/api/sales/held-orders'] });
    },
    onError: () => {
      toast({
        title: language === 'ar' ? 'فشل تعليق الطلب' : 'Failed to hold order',
        variant: 'destructive',
      });
    },
  });

  const recallOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/sales/held-orders/${id}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.heldOrder) {
        try {
          const parsedItems = typeof data.heldOrder.items === 'string' 
            ? JSON.parse(data.heldOrder.items) 
            : data.heldOrder.items;
          
          // Convert held items back to cart items
          const cartItems: CartItem[] = parsedItems.map((item: any) => ({
            product: item.product || item,
            quantity: item.quantity || 1,
          }));
          
          setCart(cartItems);
          setCustomerName(data.heldOrder.customerName || "");
          setCustomerPhone(data.heldOrder.customerPhone || "");
        } catch (e) {
          console.error("Failed to parse held order items:", e);
        }
      }
      toast({
        title: language === 'ar' ? 'تم استرجاع الطلب' : 'Order recalled',
      });
      setShowHeldOrders(false);
      queryClient.invalidateQueries({ queryKey: ['/api/sales/held-orders'] });
    },
    onError: () => {
      toast({
        title: language === 'ar' ? 'فشل استرجاع الطلب' : 'Failed to recall order',
        variant: 'destructive',
      });
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const res = await apiRequest('POST', '/api/sales/pos', orderData);
      return res.json();
    },
    onSuccess: (data, variables) => {
      const receiptOrder = {
        orderNumber: data.order?.orderNumber || `TEMP-${Date.now()}`,
        createdAt: new Date().toISOString(),
        customerName: customerName || (language === 'ar' ? 'عميل في المتجر' : 'Walk-in Customer'),
        customerPhone: customerPhone || '',
        customerAddress: orderType === 'in-store' ? customerAddress.trim() : '',
        items: cart.map(item => ({
          nameAr: item.product.nameAr,
          nameEn: item.product.nameEn,
          sku: item.product.sku,
          category: item.product.category,
          price: getEffectivePrice(item),
          quantity: item.quantity,
          specs: item.product.printSpecs || [],
        })),
        subtotal: subtotal.toString(),
        discount: calculatedDiscount.toString(),
        total: total.toString(),
        paymentMethod: paymentMethod,
        cashPaidAmount: paymentMethod === "split" ? splitCashAmount : undefined,
        cardPaidAmount: paymentMethod === "split" ? splitCardAmount : undefined,
        notes: receiptNote || null,
        issuedBy: user.name,
      };
      
      setLastOrder(receiptOrder);
      setShowReceipt(true);
      
      toast({
        title: language === 'ar' ? 'تم إنشاء الطلب بنجاح' : 'Order created successfully',
        description: language === 'ar' ? `رقم الطلب: ${receiptOrder.orderNumber}` : `Order #: ${receiptOrder.orderNumber}`,
      });
      
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDiscount("0");
      setDiscountReason("");
      setReceiptNote("");
      setPaymentMethod("cash");
      setSplitCashAmount("");
      setSplitCardAmount("");
      setShowCheckoutModal(false);
      
      setTimeout(() => {
        invalidatePosStockQueries();
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: language === 'ar' ? 'فشل إنشاء الطلب' : 'Failed to create order',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const filteredProducts = products.filter(p => {
    const name = language === 'ar' ? p.nameAr : (p.nameEn || p.nameAr);
    const sku = p.sku || '';
    const barcode = p.barcode || '';
    const serial = p.serialNumber || '';
    const part = p.partNumber || '';
    const q = searchQuery.toLowerCase();
    const matchesSearch = name.toLowerCase().includes(q) ||
                          sku.toLowerCase().includes(q) ||
                          barcode.toLowerCase().includes(q) ||
                          serial.toLowerCase().includes(q) ||
                          part.toLowerCase().includes(q);
    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: POSProduct) => {
    const stockQty = product.stockQuantity || 0;
    
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      const currentQty = existing ? existing.quantity : 0;
      
      if (currentQty >= stockQty) {
        toast({
          title: language === 'ar' ? 'المخزون غير كافٍ' : 'Insufficient Stock',
          description: language === 'ar' ? `الكمية المتوفرة: ${stockQty}` : `Available: ${stockQty}`,
          variant: 'destructive',
        });
        return prev;
      }
      
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, useWholesale: false }];
    });
  };

  /** Barcode scanner: uses physical key codes so Arabic Windows layout does not break scans. */
  const handlePosSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const code = resolveScannedCode(scanStateRef.current, searchQuery);
      scanStateRef.current = emptyScanBuffer();
      if (!code) return;

      const scanMatches = products.filter((p) => productMatchesScanCode(p, code));
      let product: POSProduct | undefined = scanMatches.length === 1 ? scanMatches[0] : undefined;

      if (scanMatches.length > 1) {
        e.preventDefault();
        setScanPickOptions(scanMatches);
        setScanPickOpen(true);
        setSearchQuery("");
        return;
      }

      if (!product) {
        if (filteredProducts.length === 1) {
          product = filteredProducts[0];
        } else {
          const q = code.toLowerCase();
          const nameMatches = filteredProducts.filter((p) => {
            const name = (language === 'ar' ? p.nameAr : (p.nameEn || p.nameAr)).toLowerCase();
            return name === q || productMatchesScanCode(p, code);
          });
          if (nameMatches.length === 1) {
            product = nameMatches[0];
          } else if (nameMatches.length > 1) {
            e.preventDefault();
            setScanPickOptions(nameMatches);
            setScanPickOpen(true);
            setSearchQuery("");
            return;
          } else if (filteredProducts.length > 1) {
            e.preventDefault();
            toast({
              title: language === 'ar' ? 'أكثر من منتج' : 'Multiple products',
              description: language === 'ar'
                ? 'اختر المنتج من القائمة أو اكتب اسماً أدق'
                : 'Select from the list or type a more specific name',
            });
            return;
          }
        }
      }

      if (!product) return;

      const stockQty = product.stockQuantity || 0;
      const existing = cart.find(item => item.product.id === product.id);
      const currentQty = existing ? existing.quantity : 0;
      if (currentQty >= stockQty) {
        e.preventDefault();
        toast({
          title: language === 'ar' ? 'المخزون غير كافٍ' : 'Insufficient Stock',
          description: language === 'ar' ? `الكمية المتوفرة: ${stockQty}` : `Available: ${stockQty}`,
          variant: 'destructive',
        });
        return;
      }

      e.preventDefault();
      playBarcodeScanBeep();
      addToCart(product);
      setSearchQuery("");
      return;
    }

    const next = appendScanKeystroke(scanStateRef.current, e.nativeEvent);
    scanStateRef.current = next;
    if (shouldSuppressScanInput(next)) {
      e.preventDefault();
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        const stockQty = item.product.stockQuantity || 0;
        
        if (newQty > stockQty) {
          toast({
            title: language === 'ar' ? 'المخزون غير كافٍ' : 'Insufficient Stock',
            variant: 'destructive',
          });
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const setQuantity = (productId: string, quantity: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const stockQty = item.product.stockQuantity || 0;
        const newQty = Math.min(Math.max(1, quantity), stockQty);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const toggleWholesale = (productId: string) => {
    setCart(prev => prev.map(item =>
      item.product.id === productId
        ? { ...item, useWholesale: !item.useWholesale }
        : item
    ));
  };

  const getEffectivePrice = (item: CartItem): string => {
    if (item.useWholesale && item.product.wholesalePrice) return item.product.wholesalePrice;
    return item.product.price;
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setDiscount("0");
    setDiscountReason("");
    setReceiptNote("");
  };

  const subtotal = cart.reduce((sum, item) =>
    sum + parseFloat(getEffectivePrice(item)) * item.quantity, 0
  );
  
  const discountValue = parseFloat(discount) || 0;
  const calculatedDiscount = discountType === "percent" 
    ? (subtotal * discountValue / 100) 
    : discountValue;
  const total = Math.max(0, subtotal - calculatedDiscount);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const isInStoreCatalog = orderType === "in-store";

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price);
  };

  const buildOrderData = () => ({
    items: cart.map(item => ({
      productId: item.product.id,
      nameAr: item.product.nameAr,
      nameEn: item.product.nameEn,
      price: getEffectivePrice(item),
      quantity: item.quantity,
      productSource: item.product.productSource || 'instore',
      batteryId: item.product.productSource === 'battery' ? item.product.sourceId : undefined,
      adapterId: item.product.productSource === 'adapter' ? item.product.sourceId : undefined,
      keyboardId: item.product.productSource === 'keyboard' ? item.product.sourceId : undefined,
      lcdId: item.product.productSource === 'lcd' ? item.product.sourceId : undefined,
      laptopId: item.product.productSource === 'laptop' ? item.product.sourceId : undefined,
      desktopId: item.product.productSource === 'desktop' ? item.product.sourceId : undefined,
    })),
    customerName: customerName || (language === 'ar' ? 'عميل في المتجر' : 'Walk-in Customer'),
    customerPhone: customerPhone.trim(),
    ...(orderType === 'in-store' ? { customerAddress: customerAddress.trim() } : {}),
    paymentMethod,
    paymentStatus: paymentMethod === 'deferred' ? 'deferred' : 'success',
    ...(paymentMethod === 'split'
      ? {
          cashPaidAmount: String(parseFloat(splitCashAmount) || 0),
          cardPaidAmount: String(parseFloat(splitCardAmount) || 0),
        }
      : {}),
    discount: calculatedDiscount.toString(),
    discountReason,
    notes: receiptNote || null,
    orderType,
    salesLocationId,
  });

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: language === 'ar' ? 'السلة فارغة' : 'Cart is empty',
        variant: 'destructive',
      });
      return;
    }
    setShowCheckoutModal(true);
  };

  const confirmCheckout = () => {
    if (paymentMethod === "split") {
      const cash = parseFloat(splitCashAmount) || 0;
      const card = parseFloat(splitCardAmount) || 0;
      if (cash <= 0 || card <= 0) {
        toast({
          title: language === "ar" ? "مبالغ الدفع" : "Payment amounts",
          description: language === "ar"
            ? "أدخل مبلغ النقد ومبلغ البطاقة"
            : "Enter both cash and card amounts",
          variant: "destructive",
        });
        return;
      }
      if (Math.abs(cash + card - total) > 0.5) {
        toast({
          title: language === "ar" ? "مجموع غير صحيح" : "Invalid total",
          description: language === "ar"
            ? `يجب أن يساوي النقد + البطاقة الإجمالي (${formatPrice(total)} د.ع)`
            : `Cash + card must equal total (${formatPrice(total)} IQD)`,
          variant: "destructive",
        });
        return;
      }
    }
    createOrderMutation.mutate(buildOrderData());
  };

  const splitPaidTotal =
    (parseFloat(splitCashAmount) || 0) + (parseFloat(splitCardAmount) || 0);
  const splitRemaining = total - splitPaidTotal;

  const selectPaymentMethod = (value: string) => {
    setPaymentMethod(value);
    if (value === "split") {
      if (!splitCashAmount && !splitCardAmount) {
        setSplitCashAmount(String(Math.round(total)));
        setSplitCardAmount("0");
      }
    } else {
      setSplitCashAmount("");
      setSplitCardAmount("");
    }
  };

  const openReceiptEditor = () => {
    if (!lastOrder) return;
    setReceiptDraft({
      ...lastOrder,
      items: (lastOrder.items || []).map((item: any) => ({ ...item })),
    });
    setShowReceiptEditor(true);
  };

  const updateReceiptDraftItem = (index: number, field: string, value: string) => {
    setReceiptDraft((prev: any) => {
      if (!prev) return prev;
      const items = [...(prev.items || [])];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const saveReceiptEdits = () => {
    if (!receiptDraft) return;
    const items = (receiptDraft.items || []).map((item: any) => ({
      ...item,
      price: String(Math.max(0, parseFloat(item.price || '0') || 0)),
      quantity: Math.max(1, parseInt(String(item.quantity || '1'), 10) || 1),
    }));
    const nextSubtotal = items.reduce((sum: number, item: any) => {
      return sum + (parseFloat(item.price || '0') || 0) * (parseInt(String(item.quantity || '1'), 10) || 1);
    }, 0);
    const nextDiscount = Math.min(parseFloat(receiptDraft.discount || '0') || 0, nextSubtotal);
    const nextOrder = {
      ...receiptDraft,
      items,
      subtotal: nextSubtotal.toString(),
      discount: nextDiscount.toString(),
      total: Math.max(0, nextSubtotal - nextDiscount).toString(),
    };

    setLastOrder(nextOrder);
    setShowReceiptEditor(false);
    toast({
      title: language === 'ar' ? 'تم تحديث الوصل' : 'Receipt updated',
      description: language === 'ar' ? 'يمكنك الآن طباعة الوصل المعدل' : 'You can now print the edited receipt',
    });
  };

  const printReceipt = async () => {
    if (!lastOrder) return;
    const { toDataURL } = await import('qrcode');
    const qrDataUrl = await toDataURL(
      `ORDER:${lastOrder.orderNumber}|TOTAL:${lastOrder.total}`,
      { width: 70, margin: 0 }
    );

    const fmt = (v: number) => v.toLocaleString('ar-IQ') + ' \u062f.\u0639';
    const subtotalNum = parseFloat(lastOrder.subtotal || '0');
    const discountNum = parseFloat(lastOrder.discount || '0');
    const totalNum = parseFloat(lastOrder.total || '0');
    const saleDate = new Date(lastOrder.createdAt);

    const payLabel = formatPosPaymentLabel(lastOrder, "ar");

    const items: any[] = lastOrder.items || [];

    const itemRowsHtml = items.map((item: any) => {
      const unitPrice = parseFloat(item.price) || 0;
      const qty = parseInt(item.quantity) || 1;
      const lineTotal = unitPrice * qty;
      const name = item.nameAr || item.nameEn || item.name || '-';
      const nameEn = item.nameEn && item.nameEn !== item.nameAr ? item.nameEn : '';
      const skuLine = item.sku ? `<div style="font-size:9px;color:#333;font-weight:700;">SKU: ${item.sku}</div>` : '';
      const catLine = item.category ? `<div style="font-size:9px;color:#333;font-weight:700;">${item.category}</div>` : '';
      const nameLine = nameEn ? `<div style="font-size:9px;color:#333;font-weight:700;">${nameEn}</div>` : '';
      const specsLines = Array.isArray(item.specs) && item.specs.length > 0
        ? item.specs.map((s: string) => `<div style="font-size:9px;color:#222;font-weight:700;">${s}</div>`).join('')
        : '';
      const unitPriceLine = `<div style="font-size:9px;color:#333;font-weight:700;">${fmt(unitPrice)} x ${qty}</div>`;
      return `<div style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;">
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:4px;align-items:start;">
          <div>
            <div style="font-weight:800;color:#000;">${name}</div>
            ${nameLine}
            ${catLine}
            ${skuLine}
            ${specsLines}
            ${unitPriceLine}
          </div>
          <div style="text-align:center;font-weight:800;color:#000;padding:0 6px;min-width:24px;">${qty}</div>
          <div style="text-align:left;font-weight:800;color:#000;white-space:nowrap;">${fmt(lineTotal)}</div>
        </div>
      </div>`;
    }).join('');

    const customerHtml = (lastOrder.customerName || lastOrder.customerPhone || lastOrder.customerAddress) ? `
      <div style="border-bottom:1px solid #d1d5db;padding:8px 12px;font-size:12px;">
        ${lastOrder.customerName ? `<div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="font-weight:700;">\u0627\u0644\u0632\u0628\u0648\u0646:</span><span style="font-weight:800;">${lastOrder.customerName}</span></div>` : ''}
        ${lastOrder.customerPhone ? `<div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="font-weight:700;">\u0627\u0644\u0647\u0627\u062a\u0641:</span><span style="font-weight:800;" dir="ltr">${lastOrder.customerPhone}</span></div>` : ''}
        ${lastOrder.customerAddress ? `<div style="display:flex;justify-content:space-between;gap:8px;"><span style="font-weight:700;flex-shrink:0;">\u0627\u0644\u0639\u0646\u0648\u0627\u0646:</span><span style="font-weight:800;text-align:left;">${lastOrder.customerAddress}</span></div>` : ''}
      </div>` : '';

    const discountHtml = discountNum > 0 ? `
      <div style="display:flex;justify-content:space-between;font-weight:700;color:#000;margin-bottom:4px;">
        <span>\u0627\u0644\u062e\u0635\u0645:</span><span>-${fmt(discountNum)}</span>
      </div>` : '';

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
  @page { size: 72.1mm auto; margin: 2mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  body { font-family: 'Cairo', 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; width: 72.1mm; background: white !important; color: #000; }
  .bg-black { background-color: #000 !important; }
  .text-white { color: #fff !important; }
</style>
</head>
<body>
  <div class="bg-black text-white" style="padding:14px;text-align:center;">
    <div style="font-size:18px;font-weight:900;letter-spacing:0.5px;">\u0627\u0644\u0639\u064a\u0646 \u0644\u062a\u062c\u0627\u0631\u0629 \u0627\u0644\u062d\u0627\u0633\u0628\u0627\u062a</div>
    <div style="font-size:12px;font-weight:700;margin-top:2px;opacity:0.9;">AEEN COMPUTER TRADING</div>
    <div style="font-size:10px;margin-top:2px;opacity:0.75;">\u0643\u0631\u0628\u0644\u0627\u0621 - \u0627\u0644\u0639\u0631\u0627\u0642</div>
    <div style="font-size:11px;font-weight:800;margin-top:4px;opacity:0.95;direction:ltr;">${STORE_WEBSITE}</div>
  </div>

  <div style="padding:10px 12px;border-bottom:2px solid #000;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:10px;font-weight:700;letter-spacing:1px;">\u0631\u0642\u0645 \u0627\u0644\u0648\u0635\u0644</div>
      <div style="font-family:monospace;font-weight:900;font-size:13px;">${lastOrder.orderNumber}</div>
    </div>
    <img src="${qrDataUrl}" width="50" height="50" style="display:block;"/>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:8px 12px;border-bottom:1px solid #d1d5db;font-size:12px;">
    <div>
      <div style="font-weight:700;">\u0627\u0644\u062a\u0627\u0631\u064a\u062e</div>
      <div style="font-weight:800;">${saleDate.toLocaleDateString('ar-IQ')}</div>
    </div>
    <div style="text-align:left;">
      <div style="font-weight:700;">\u0627\u0644\u0648\u0642\u062a</div>
      <div style="font-weight:800;">${saleDate.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>

  ${customerHtml}

  <div style="border:2px solid #000;border-radius:6px;overflow:hidden;margin:8px;">
    <div class="bg-black text-white" style="display:grid;grid-template-columns:1fr auto auto;gap:4px;padding:6px 8px;font-size:11px;font-weight:700;">
      <div>\u0627\u0644\u0645\u0646\u062a\u062c</div>
      <div style="padding:0 6px;">\u0627\u0644\u0643\u0645\u064a\u0629</div>
      <div>\u0627\u0644\u0633\u0639\u0631</div>
    </div>
    ${items.length > 0 ? itemRowsHtml : '<div style="padding:10px;text-align:center;font-size:11px;color:#666;">\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0646\u062a\u062c\u0627\u062a</div>'}
  </div>

  <div style="padding:8px 12px;font-size:12px;">
    <div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:4px;">
      <span>\u0627\u0644\u0645\u062c\u0645\u0648\u0639:</span><span>${fmt(subtotalNum)}</span>
    </div>
    ${discountHtml}
    <div class="bg-black text-white" style="display:flex;justify-content:space-between;padding:8px 10px;border-radius:6px;margin-top:4px;font-size:15px;font-weight:900;">
      <span>\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a:</span><span>${fmt(totalNum)}</span>
    </div>
  </div>

  <div style="text-align:center;padding:6px 12px;border-top:1px solid #d1d5db;border-bottom:1px solid #d1d5db;font-size:12px;">
    <span style="font-weight:700;">\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062f\u0641\u0639: </span>
    <span style="font-weight:800;">${payLabel}</span>
  </div>

  ${lastOrder.notes ? `<div style="padding:8px 12px;border-bottom:1px solid #d1d5db;font-size:11px;"><span style="font-weight:700;">\u0645\u0644\u0627\u062d\u0638\u0629: </span><span style="font-weight:800;">${lastOrder.notes}</span></div>` : ''}

  <div style="text-align:center;padding:10px 12px;border-top:2px dashed #000;margin-top:4px;">
    <div style="font-weight:800;font-size:13px;">\u0634\u0643\u0631\u0627\u064b \u0644\u062a\u0633\u0648\u0642\u0643\u0645 \u0645\u0639\u0646\u0627</div>
    <div style="font-size:10px;font-weight:700;margin-top:4px;">\u064a\u0631\u062c\u0649 \u0627\u0644\u0627\u062d\u062a\u0641\u0627\u0638 \u0628\u0627\u0644\u0648\u0635\u0644 \u0644\u063a\u0631\u0636 \u0627\u0644\u0636\u0645\u0627\u0646</div>
    <div style="font-weight:900;font-size:14px;margin-top:6px;" dir="ltr">07850006977</div>
    <div style="font-size:11px;font-weight:800;margin-top:6px;color:${STORE_BRAND_RED};direction:ltr;">${STORE_WEBSITE}</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      }, 500);
    };
  </script>
</body>
</html>`;

    const popup = window.open('', '_blank', 'width=420,height=700');
    if (popup) { popup.document.write(html); popup.document.close(); }
  };

  const printA4Invoice = async () => {
    if (!lastOrder) return;
    await openA4InvoicePrint(lastOrder, {
      issuedBy: lastOrder.issuedBy || user.name,
    });
  };


  const handleHoldOrder = () => {
    if (cart.length === 0) {
      toast({
        title: language === 'ar' ? 'السلة فارغة' : 'Cart is empty',
        variant: 'destructive',
      });
      return;
    }

    const holdData = {
      items: cart.map(item => ({
        product: item.product,
        quantity: item.quantity,
      })),
      customerName,
      customerPhone,
      subtotal,
      notes: holdNote,
    };

    holdOrderMutation.mutate(holdData);
  };

  if (!user.permissions.canPos) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <ShoppingCart className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'ليس لديك صلاحية الوصول لنقطة البيع' : 'You do not have access to POS'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-180px)]">
      {/* Left Column - Products Catalog */}
      <div className="flex-1 flex flex-col min-w-0">
        <Card className="flex-1 flex flex-col overflow-hidden">
          {/* Search & Filter Header */}
          <CardHeader className="pb-3 space-y-3 border-b bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              {orderType === 'in-store' ? (
                <Store className="h-5 w-5 text-violet-500" />
              ) : (
                <ShoppingCart className="h-5 w-5 text-green-500" />
              )}
              <h2 className="font-bold text-base">
                {orderType === 'in-store'
                  ? (language === 'ar' ? 'مبيعات المتجر' : 'In-Store Sales')
                  : (language === 'ar' ? 'نقطة البيع' : 'Point of Sale')}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === 'ar' ? 'بحث بالاسم أو الباركود...' : 'Search by name or barcode...'}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    scanStateRef.current = emptyScanBuffer();
                  }}
                  onKeyDown={handlePosSearchKeyDown}
                  className="ps-10 h-11 text-base"
                  lang="en"
                  dir="ltr"
                  autoComplete="off"
                  spellCheck={false}
                  data-testid="input-pos-search"
                />
              </div>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button 
                  variant={viewMode === "grid" ? "secondary" : "ghost"} 
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button 
                  variant={viewMode === "list" ? "secondary" : "ghost"} 
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Category Tabs */}
            <div className="overflow-x-auto">
              <div className="flex items-center gap-2 pb-1 min-w-max">
                <Button
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory("all")}
                  className="whitespace-nowrap"
                >
                  {language === 'ar' ? 'الكل' : 'All'}
                  <Badge variant="secondary" className="ms-2 text-xs">
                    {products.length}
                  </Badge>
                </Button>
                {(orderType === 'in-store' ? inStoreCategories : categories).map(cat => {
                  const catName = language === 'ar' ? cat.nameAr : (cat.nameEn || cat.nameAr);
                  const count = products.filter(p => p.category === cat.slug).length;
                  return (
                    <Button
                      key={cat.id}
                      variant={selectedCategory === cat.slug ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(cat.slug)}
                      className="whitespace-nowrap"
                    >
                      {catName}
                      <Badge variant="secondary" className="ms-2 text-xs">
                        {count}
                      </Badge>
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          
          {/* Products Grid */}
          <CardContent className={cn("flex-1 overflow-auto", isInStoreCatalog ? "p-2" : "p-4")}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                  <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground">
                    {language === 'ar' ? 'جاري تحميل المنتجات...' : 'Loading products...'}
                  </p>
                </div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                  <Package className="h-16 w-16 mx-auto text-muted-foreground/30" />
                  <p className="text-muted-foreground">
                    {language === 'ar' ? 'لا توجد منتجات' : 'No products found'}
                  </p>
                </div>
              </div>
            ) : viewMode === "grid" ? (
              <div
                className={cn(
                  "grid gap-2",
                  isInStoreCatalog
                    ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6"
                    : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3",
                )}
              >
                {filteredProducts.map(product => {
                  const inCart = cart.find(item => item.product.id === product.id);
                  const isOutOfStock = (product.stockQuantity || 0) <= 0;
                  const placeholderIconClass = isInStoreCatalog ? "h-6 w-6" : "h-10 w-10";
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock}
                      className={cn(
                        "relative border-2 transition-all text-start group",
                        isInStoreCatalog ? "p-2 rounded-lg" : "p-4 rounded-xl",
                        inCart
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-transparent bg-card hover:border-primary/30 hover:shadow-md",
                        isOutOfStock && "opacity-50 cursor-not-allowed",
                      )}
                      data-testid={`product-card-${product.id}`}
                    >
                      {/* Stock Badge */}
                      <div className={cn("absolute z-10", isInStoreCatalog ? "top-1 end-1" : "top-2 end-2")}>
                        {isOutOfStock ? (
                          <Badge variant="destructive" className={isInStoreCatalog ? "text-[10px] px-1 py-0" : "text-xs"}>
                            {language === 'ar' ? 'نفذ' : 'Out'}
                          </Badge>
                        ) : (product.stockQuantity || 0) < 5 ? (
                          <Badge className={cn("bg-orange-500/20 text-orange-600", isInStoreCatalog ? "text-[10px] px-1 py-0" : "text-xs")}>
                            {product.stockQuantity}
                          </Badge>
                        ) : null}
                      </div>
                      
                      {/* Cart Quantity Badge */}
                      {inCart && (
                        <div className={cn("absolute z-10", isInStoreCatalog ? "top-1 start-1" : "top-2 start-2")}>
                          <Badge className={isInStoreCatalog ? "text-[10px] px-1 py-0" : "text-xs"}>
                            {inCart.quantity}x
                          </Badge>
                        </div>
                      )}
                      
                      {/* Product Image */}
                      <div
                        className={cn(
                          "rounded-md bg-muted overflow-hidden",
                          isInStoreCatalog ? "h-14 mb-1.5" : "aspect-square rounded-lg mb-3",
                        )}
                      >
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.nameAr}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {product.productSource === 'battery' ? (
                              <Battery className={cn(placeholderIconClass, "text-primary/40")} />
                            ) : product.productSource === 'adapter' ? (
                              <Plug className={cn(placeholderIconClass, "text-primary/40")} />
                            ) : product.productSource === 'keyboard' ? (
                              <Keyboard className={cn(placeholderIconClass, "text-primary/40")} />
                            ) : product.productSource === 'lcd' ? (
                              <Monitor className={cn(placeholderIconClass, "text-primary/40")} />
                            ) : product.productSource === 'laptop' ? (
                              <LaptopIcon className={cn(placeholderIconClass, "text-primary/40")} />
                            ) : product.productSource === 'desktop' ? (
                              <Computer className={cn(placeholderIconClass, "text-primary/40")} />
                            ) : (
                              <Package className={cn(placeholderIconClass, "text-muted-foreground/30")} />
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Product Info */}
                      <div className={isInStoreCatalog ? "space-y-0.5" : "space-y-1"}>
                        <p
                          className={cn(
                            "font-semibold line-clamp-2",
                            isInStoreCatalog ? "text-[11px] leading-tight" : "text-sm min-h-[2.5rem]",
                          )}
                        >
                          {language === 'ar' ? product.nameAr : (product.nameEn || product.nameAr)}
                        </p>
                        {(product.productSource === 'battery' || product.productSource === 'adapter' || product.productSource === 'keyboard' || product.productSource === 'lcd' || product.productSource === 'laptop' || product.productSource === 'desktop') && (
                          <Badge variant="outline" className="text-[10px]">
                            {product.productSource === 'battery'
                              ? (language === 'ar' ? 'بطارية' : 'Battery')
                              : product.productSource === 'adapter'
                              ? (language === 'ar' ? 'شاحن' : 'Adapter')
                              : product.productSource === 'keyboard'
                              ? (language === 'ar' ? 'كيبورد' : 'Keyboard')
                              : product.productSource === 'lcd'
                              ? (language === 'ar' ? 'LCD' : 'LCD')
                              : product.productSource === 'laptop'
                              ? (language === 'ar' ? 'لابتوب' : 'Laptop')
                              : (language === 'ar' ? 'ديسكتوب' : 'Desktop')}
                          </Badge>
                        )}
                        {product.sku && !isInStoreCatalog && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                            <Barcode className="h-3 w-3 shrink-0" />
                            <span>
                              {language === 'ar' ? 'باركود:' : 'Barcode:'} {product.sku}
                              {product.serialNumber && product.serialNumber !== product.sku && (
                                <span className="text-muted-foreground/80">
                                  {' '}
                                  · {language === 'ar' ? 'سيريال:' : 'Serial:'} {product.serialNumber}
                                </span>
                              )}
                            </span>
                          </p>
                        )}
                        <p
                          className={cn(
                            "font-bold text-primary",
                            isInStoreCatalog ? "text-xs" : "text-lg",
                          )}
                        >
                          {formatPrice(parseFloat(product.price))}
                          <span className={cn("font-normal text-muted-foreground me-1", isInStoreCatalog ? "text-[10px]" : "text-xs")}>
                            {language === 'ar' ? 'د.ع' : 'IQD'}
                          </span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={isInStoreCatalog ? "space-y-1" : "space-y-2"}>
                {filteredProducts.map(product => {
                  const inCart = cart.find(item => item.product.id === product.id);
                  const isOutOfStock = (product.stockQuantity || 0) <= 0;
                  const listIconClass = isInStoreCatalog ? "h-5 w-5" : "h-6 w-6";
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock}
                      className={cn(
                        "w-full flex items-center border-2 transition-all text-start",
                        isInStoreCatalog ? "gap-2 p-2 rounded-lg" : "gap-4 p-3 rounded-xl",
                        inCart
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-card hover:border-primary/30",
                        isOutOfStock && "opacity-50 cursor-not-allowed",
                      )}
                      data-testid={`product-list-${product.id}`}
                    >
                      {/* Product Image */}
                      <div
                        className={cn(
                          "rounded-md bg-muted overflow-hidden flex-shrink-0",
                          isInStoreCatalog ? "h-11 w-11" : "h-16 w-16 rounded-lg",
                        )}
                      >
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.nameAr}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {product.productSource === 'battery' ? (
                              <Battery className={cn(listIconClass, "text-primary/40")} />
                            ) : product.productSource === 'adapter' ? (
                              <Plug className={cn(listIconClass, "text-primary/40")} />
                            ) : product.productSource === 'keyboard' ? (
                              <Keyboard className={cn(listIconClass, "text-primary/40")} />
                            ) : product.productSource === 'lcd' ? (
                              <Monitor className={cn(listIconClass, "text-primary/40")} />
                            ) : product.productSource === 'laptop' ? (
                              <LaptopIcon className={cn(listIconClass, "text-primary/40")} />
                            ) : product.productSource === 'desktop' ? (
                              <Computer className={cn(listIconClass, "text-primary/40")} />
                            ) : (
                              <Package className={cn(listIconClass, "text-muted-foreground/30")} />
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <p className={cn("font-semibold truncate", isInStoreCatalog ? "text-xs" : "text-sm")}>
                          {language === 'ar' ? product.nameAr : (product.nameEn || product.nameAr)}
                        </p>
                        {(product.productSource === 'battery' || product.productSource === 'adapter' || product.productSource === 'keyboard' || product.productSource === 'lcd' || product.productSource === 'laptop' || product.productSource === 'desktop') && (
                          <Badge variant="outline" className="text-[10px] mb-1">
                            {product.productSource === 'battery'
                              ? (language === 'ar' ? 'بطارية' : 'Battery')
                              : product.productSource === 'adapter'
                              ? (language === 'ar' ? 'شاحن' : 'Adapter')
                              : product.productSource === 'keyboard'
                              ? (language === 'ar' ? 'كيبورد' : 'Keyboard')
                              : product.productSource === 'lcd'
                              ? (language === 'ar' ? 'LCD' : 'LCD')
                              : product.productSource === 'laptop'
                              ? (language === 'ar' ? 'لابتوب' : 'Laptop')
                              : (language === 'ar' ? 'ديسكتوب' : 'Desktop')}
                          </Badge>
                        )}
                        <p className="text-xs text-muted-foreground font-mono">
                          {isSerialInventoryProduct(product) ? (
                            <>
                              {language === 'ar' ? 'باركود:' : 'Barcode:'} {product.sku}
                              {product.serialNumber && product.serialNumber !== product.sku && (
                                <> · {language === 'ar' ? 'سيريال:' : 'Serial:'} {product.serialNumber}</>
                              )}
                              {' · '}
                            </>
                          ) : (
                            <>{product.sku} · </>
                          )}
                          {language === 'ar' ? 'متوفر:' : 'Stock:'} {product.stockQuantity || 0}
                        </p>
                      </div>
                      
                      {/* Price & Cart Badge */}
                      <div className="text-end flex-shrink-0">
                        <p className={cn("font-bold text-primary", isInStoreCatalog ? "text-sm" : "text-lg")}>
                          {formatPrice(parseFloat(product.price))}
                        </p>
                        {inCart && (
                          <Badge className={isInStoreCatalog ? "text-[10px] px-1 py-0" : "text-xs"}>{inCart.quantity}x</Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Cart & Payment */}
      <div className="w-full lg:w-[420px] flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Cart Header */}
          <CardHeader className="pb-3 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="text-base">{language === 'ar' ? 'السلة' : 'Cart'}</span>
                  {totalItems > 0 && (
                    <Badge className="ms-2">{totalItems}</Badge>
                  )}
                </div>
              </CardTitle>
              <div className="flex items-center gap-1">
                {/* Held Orders Button */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowHeldOrders(true)}
                  className="gap-1 relative"
                  data-testid="button-held-orders"
                >
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">{language === 'ar' ? 'معلقة' : 'Held'}</span>
                  {heldOrders.length > 0 && (
                    <Badge variant="destructive" className="absolute -top-2 -end-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {heldOrders.length}
                    </Badge>
                  )}
                </Button>
                
                {/* Hold Order Button */}
                {cart.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleHoldOrder}
                    disabled={holdOrderMutation.isPending}
                    className="gap-1"
                    data-testid="button-hold-order"
                  >
                    {holdOrderMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PauseCircle className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{language === 'ar' ? 'تعليق' : 'Hold'}</span>
                  </Button>
                )}
                
                {/* Clear Button */}
                {cart.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive hover:text-destructive"
                    onClick={clearCart}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col min-h-0 p-0 overflow-hidden">
            {cart.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center space-y-3">
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto">
                    <ShoppingCart className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                  <p className="text-muted-foreground">
                    {language === 'ar' ? 'السلة فارغة' : 'Cart is empty'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'اختر منتجات لإضافتها' : 'Select products to add'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Cart items + customer/payment — scrollable; totals stay pinned below */}
                <ScrollArea className="flex-1 min-h-0">
                  <div className={cn(isInStoreCatalog ? "p-2 space-y-2" : "p-4 space-y-3")}>
                    {cart.map(item => (
                      <div 
                        key={item.product.id} 
                        className={cn(
                          "flex items-start bg-muted/50 border",
                          isInStoreCatalog ? "gap-2 p-2 rounded-lg" : "gap-3 p-3 rounded-xl",
                        )}
                      >
                        {/* Product Image */}
                        <div
                          className={cn(
                            "rounded-md bg-background overflow-hidden flex-shrink-0",
                            isInStoreCatalog ? "h-10 w-10" : "h-14 w-14 rounded-lg",
                          )}
                        >
                          {item.product.image ? (
                            <img 
                              src={item.product.image} 
                              alt={item.product.nameAr}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {item.product.productSource === 'battery' ? (
                                <Battery className="h-6 w-6 text-primary/40" />
                              ) : item.product.productSource === 'adapter' ? (
                                <Plug className="h-6 w-6 text-primary/40" />
                              ) : item.product.productSource === 'keyboard' ? (
                                <Keyboard className="h-6 w-6 text-primary/40" />
                              ) : item.product.productSource === 'lcd' ? (
                                <Monitor className="h-6 w-6 text-primary/40" />
                              ) : item.product.productSource === 'laptop' ? (
                                <LaptopIcon className="h-6 w-6 text-primary/40" />
                              ) : item.product.productSource === 'desktop' ? (
                                <Computer className="h-6 w-6 text-primary/40" />
                              ) : (
                                <Package className="h-6 w-6 text-muted-foreground/30" />
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-medium line-clamp-1", isInStoreCatalog ? "text-xs" : "text-sm")}>
                            {language === 'ar' ? item.product.nameAr : (item.product.nameEn || item.product.nameAr)}
                          </p>
                          {(item.product.productSource === 'battery' || item.product.productSource === 'adapter' || item.product.productSource === 'keyboard' || item.product.productSource === 'lcd' || item.product.productSource === 'laptop' || item.product.productSource === 'desktop') && (
                            <Badge variant="outline" className="text-[10px] mb-0.5">
                              {item.product.productSource === 'battery'
                                ? (language === 'ar' ? 'بطارية' : 'Battery')
                                : item.product.productSource === 'adapter'
                                ? (language === 'ar' ? 'شاحن' : 'Adapter')
                                : item.product.productSource === 'keyboard'
                                ? (language === 'ar' ? 'كيبورد' : 'Keyboard')
                                : item.product.productSource === 'lcd'
                                ? (language === 'ar' ? 'LCD' : 'LCD')
                                : item.product.productSource === 'laptop'
                                ? (language === 'ar' ? 'لابتوب' : 'Laptop')
                                : (language === 'ar' ? 'ديسكتوب' : 'Desktop')}
                            </Badge>
                          )}
                          <div className="flex items-center gap-1 flex-wrap">
                            <p className={cn("text-primary font-bold", isInStoreCatalog ? "text-xs" : "text-sm")}>
                              {formatPrice(parseFloat(getEffectivePrice(item)))} × {item.quantity}
                            </p>
                            {item.product.wholesalePrice && (orderType === 'in-store' || item.product.productSource === 'battery' || item.product.productSource === 'adapter') && (
                              <button
                                onClick={() => toggleWholesale(item.product.id)}
                                className={`text-xs px-1.5 py-0.5 rounded font-medium border transition-colors ${
                                  item.useWholesale
                                    ? 'bg-amber-500 text-white border-amber-500'
                                    : 'bg-transparent text-amber-600 border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950'
                                }`}
                                data-testid={`button-wholesale-toggle-${item.product.id}`}
                              >
                                {language === 'ar' ? 'جملة' : 'Wholesale'}
                              </button>
                            )}
                          </div>
                          <p className={cn("text-muted-foreground", isInStoreCatalog ? "text-[10px]" : "text-xs")}>
                            = {formatPrice(parseFloat(getEffectivePrice(item)) * item.quantity)} {language === 'ar' ? 'د.ع' : 'IQD'}
                          </p>
                        </div>
                        
                        {/* Quantity Controls */}
                        <div className={cn("flex flex-col items-end", isInStoreCatalog ? "gap-1" : "gap-2")}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                              "text-destructive hover:text-destructive hover:bg-destructive/10",
                              isInStoreCatalog ? "h-5 w-5" : "h-6 w-6",
                            )}
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            <X className={isInStoreCatalog ? "h-3 w-3" : "h-4 w-4"} />
                          </Button>
                          <div className="flex items-center gap-0.5 bg-background rounded-md border p-0.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              className={isInStoreCatalog ? "h-6 w-6" : "h-7 w-7"}
                              onClick={() => updateQuantity(item.product.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => setQuantity(item.product.id, parseInt(e.target.value) || 1)}
                              className={cn(
                                "text-center p-0 border-0",
                                isInStoreCatalog ? "w-8 h-6 text-xs" : "w-10 h-7 text-sm",
                              )}
                              min="1"
                              max={item.product.stockQuantity || 99}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className={isInStoreCatalog ? "h-6 w-6" : "h-7 w-7"}
                              onClick={() => updateQuantity(item.product.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                {/* Customer & Payment Section */}
                <div className="p-4 space-y-4 border-t bg-muted/30">
                  {/* Customer Info */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {language === 'ar' ? 'معلومات العميل' : 'Customer Info'}
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={() => setShowCustomerLookup(true)}
                        data-testid="button-customer-lookup"
                      >
                        <UserSearch className="h-3 w-3" />
                        {language === 'ar' ? 'بحث' : 'Lookup'}
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{language === 'ar' ? 'الاسم' : 'Name'}</Label>
                        <div className="relative">
                          <User className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder={language === 'ar' ? 'اختياري' : 'Optional'}
                            className="h-9 ps-9"
                            data-testid="input-customer-name"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</Label>
                        <div className="relative">
                          <Phone className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            type="tel"
                            inputMode="tel"
                            dir="ltr"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="07XX XXX XXXX"
                            className="h-9 ps-9"
                            data-testid="input-customer-phone"
                          />
                        </div>
                      </div>
                    </div>
                    {orderType === 'in-store' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">{language === 'ar' ? 'العنوان' : 'Address'}</Label>
                        <Textarea
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                          placeholder={language === 'ar' ? 'عنوان العميل (اختياري)' : 'Customer address (optional)'}
                          className="min-h-[60px] text-sm resize-none"
                          data-testid="input-customer-address"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Payment Method - Quick Buttons */}
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Wallet className="h-3 w-3" />
                      {language === 'ar' ? 'طريقة الدفع' : 'Payment'}
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'cash', label: language === 'ar' ? 'نقداً' : 'Cash', icon: Banknote },
                        { value: 'card', label: language === 'ar' ? 'بطاقة' : 'Card', icon: CreditCard },
                        { value: 'split', label: language === 'ar' ? 'نقد+بطاقة' : 'Cash+Card', icon: Split },
                        { value: 'zaincash', label: 'ZainCash', icon: Wallet },
                        { value: 'qicard', label: 'QiCard', icon: CreditCard },
                        { value: 'deferred', label: 'أجل', icon: Clock },
                      ].map(method => (
                        <Button
                          key={method.value}
                          variant={paymentMethod === method.value ? "default" : "outline"}
                          size="sm"
                          className="h-auto py-2 px-2 flex-col gap-1"
                          onClick={() => selectPaymentMethod(method.value)}
                        >
                          <method.icon className="h-4 w-4" />
                          <span className="text-xs">{method.label}</span>
                        </Button>
                      ))}
                    </div>
                    {paymentMethod === "split" && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="space-y-1">
                          <Label className="text-xs">
                            {language === "ar" ? "مبلغ النقد" : "Cash amount"}
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            value={splitCashAmount}
                            onChange={(e) => setSplitCashAmount(e.target.value)}
                            className="h-9"
                            data-testid="input-split-cash"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">
                            {language === "ar" ? "مبلغ البطاقة" : "Card amount"}
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            value={splitCardAmount}
                            onChange={(e) => setSplitCardAmount(e.target.value)}
                            className="h-9"
                            data-testid="input-split-card"
                          />
                        </div>
                        <p
                          className={cn(
                            "col-span-2 text-xs",
                            Math.abs(splitRemaining) <= 0.5
                              ? "text-green-600"
                              : "text-destructive",
                          )}
                        >
                          {language === "ar"
                            ? `المتبقي: ${formatPrice(Math.max(0, splitRemaining))} د.ع (الإجمالي ${formatPrice(total)} د.ع)`
                            : `Remaining: ${formatPrice(Math.max(0, splitRemaining))} IQD (total ${formatPrice(total)} IQD)`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Discount */}
                  {user.permissions.canApplyDiscount ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        {language === 'ar' ? 'الخصم' : 'Discount'}
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                          <Input
                            type="number"
                            value={discount}
                            onChange={(e) => setDiscount(e.target.value)}
                            min="0"
                            className="h-9 pe-16"
                            placeholder="0"
                            data-testid="input-discount"
                          />
                          <div className="absolute end-1 top-1/2 -translate-y-1/2">
                            <Select 
                              value={discountType} 
                              onValueChange={(v) => setDiscountType(v as "fixed" | "percent")}
                            >
                              <SelectTrigger className="h-7 w-14 border-0 bg-muted text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fixed">IQD</SelectItem>
                                <SelectItem value="percent">%</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      {discountValue > 0 && (
                        <Input
                          value={discountReason}
                          onChange={(e) => setDiscountReason(e.target.value)}
                          placeholder={language === 'ar' ? 'سبب الخصم (اختياري)' : 'Reason (optional)'}
                          className="h-8 text-xs"
                          data-testid="input-discount-reason"
                        />
                      )}
                    </div>
                  ) : null}

                  {/* Receipt Note */}
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {language === 'ar' ? 'ملاحظة على الوصل' : 'Receipt Note'}
                    </Label>
                    <Textarea
                      value={receiptNote}
                      onChange={(e) => setReceiptNote(e.target.value)}
                      placeholder={language === 'ar' ? 'ملاحظة اختيارية تظهر على الوصل...' : 'Optional note on receipt...'}
                      className="text-xs min-h-[52px] resize-none"
                      data-testid="textarea-receipt-note"
                    />
                  </div>
                </div>
                </ScrollArea>

                {/* Totals & Checkout */}
                <div className="flex-shrink-0 p-4 space-y-3 border-t bg-card">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
                      <span>{formatPrice(subtotal)} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                    </div>
                    {calculatedDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>{language === 'ar' ? 'الخصم' : 'Discount'}</span>
                        <span>-{formatPrice(calculatedDiscount)} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                      </div>
                    )}
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatPrice(total)}
                      <span className="text-sm font-normal text-muted-foreground me-1">
                        {language === 'ar' ? 'د.ع' : 'IQD'}
                      </span>
                    </span>
                  </div>
                  
                  <Button 
                    className="w-full h-12 text-lg font-bold gap-2" 
                    size="lg"
                    onClick={handleCheckout}
                    disabled={createOrderMutation.isPending || cart.length === 0}
                    data-testid="button-checkout"
                  >
                    {createOrderMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        {language === 'ar' ? 'إتمام البيع' : 'Complete Sale'}
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Barcode scan: multiple products share same code */}
      <Dialog open={scanPickOpen} onOpenChange={setScanPickOpen}>
        <DialogContent className="max-w-lg" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "اختر المنتج" : "Choose product"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "نفس الباركود مرتبط بأكثر من جهاز. اختر الموديل الصحيح."
                : "This barcode matches more than one item. Pick the correct one."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {scanPickOptions.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                className="w-full h-auto py-3 flex flex-col items-start gap-1 text-start"
                onClick={() => {
                  setScanPickOpen(false);
                  setScanPickOptions([]);
                  addToCart(p);
                }}
              >
                <span className="font-semibold">
                  {language === "ar" ? p.nameAr : (p.nameEn || p.nameAr)}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  {language === "ar" ? "باركود:" : "Barcode:"} {p.sku}
                  {p.serialNumber && p.serialNumber !== p.sku
                    ? ` · ${language === "ar" ? "سيريال:" : "Serial:"} ${p.serialNumber}`
                    : ""}
                </span>
                <span className="text-sm text-primary font-bold">
                  {formatPrice(parseFloat(p.price))} {language === "ar" ? "د.ع" : "IQD"}
                  {" · "}
                  {language === "ar" ? "متوفر:" : "Stock:"} {p.stockQuantity ?? 0}
                </span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt} modal={true}>
        <DialogContent
          className="max-w-md max-h-[90vh] overflow-y-auto"
          dir={language === 'ar' ? 'rtl' : 'ltr'}
          data-testid="receipt-dialog"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              {language === 'ar' ? 'تمت عملية البيع بنجاح!' : 'Sale Completed!'}
            </DialogTitle>
          </DialogHeader>

          {lastOrder && (
            <div className="bg-white text-black p-4 rounded-lg border">
              {/* Black Header */}
              <div className="bg-black text-white p-4 text-center -mx-4 -mt-4 mb-4">
                <h2 className="font-extrabold text-xl tracking-wide">العين لتجارة الحاسبات</h2>
                <p className="text-sm font-semibold mt-1 opacity-90">AEEN COMPUTER TRADING</p>
                <p className="text-xs mt-1 opacity-75">كربلاء - العراق</p>
              </div>

              {/* Receipt Number + QR */}
              <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide">رقم الطلب</p>
                  <p className="font-mono font-extrabold text-base">{lastOrder.orderNumber}</p>
                </div>
                <QRCodeSVG
                  value={`ORDER:${lastOrder.orderNumber}|TOTAL:${lastOrder.total}`}
                  size={50}
                  level="H"
                />
              </div>

              {/* Date / Time */}
              <div className="grid grid-cols-2 gap-2 text-sm border-b border-gray-300 pb-3 mb-3">
                <div>
                  <p className="text-xs font-bold">التاريخ</p>
                  <p className="font-extrabold">{new Date(lastOrder.createdAt).toLocaleDateString('ar-IQ')}</p>
                </div>
                <div>
                  <p className="text-xs font-bold">الوقت</p>
                  <p className="font-extrabold">{new Date(lastOrder.createdAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>

              {/* Customer */}
              {(lastOrder.customerName || lastOrder.customerPhone || lastOrder.customerAddress) && (
                <div className="border-b border-gray-300 pb-3 mb-3 text-sm space-y-1">
                  {lastOrder.customerName && (
                    <div className="flex justify-between">
                      <span className="font-bold">الزبون:</span>
                      <span className="font-extrabold">{lastOrder.customerName}</span>
                    </div>
                  )}
                  {lastOrder.customerPhone && (
                    <div className="flex justify-between">
                      <span className="font-bold">الهاتف:</span>
                      <span className="font-extrabold" dir="ltr">{lastOrder.customerPhone}</span>
                    </div>
                  )}
                  {lastOrder.customerAddress && (
                    <div className="flex justify-between gap-2">
                      <span className="font-bold shrink-0">العنوان:</span>
                      <span className="font-extrabold text-end">{lastOrder.customerAddress}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Items Table */}
              <div className="border-2 border-black rounded-lg overflow-hidden mb-3">
                <div className="bg-black text-white px-2 py-1">
                  <div className="grid grid-cols-12 text-xs font-bold">
                    <div className="col-span-6">المنتج</div>
                    <div className="col-span-2 text-center">الكمية</div>
                    <div className="col-span-4 text-start">المجموع</div>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {(lastOrder.items && lastOrder.items.length > 0) ? lastOrder.items.map((item: any, idx: number) => {
                    const unitPrice = parseFloat(item.price) || 0;
                    const qty = parseInt(item.quantity) || 1;
                    const lineTotal = unitPrice * qty;
                    const itemName = item.nameAr || item.nameEn || item.name || '-';
                    const itemNameEn = item.nameEn && item.nameEn !== item.nameAr ? item.nameEn : null;
                    const itemSpecs = Array.isArray(item.specs) ? item.specs : [];
                    return (
                      <div key={idx} className="px-2 py-2 grid grid-cols-12 text-sm items-start" data-testid={`receipt-item-${idx}`}>
                        <div className="col-span-6">
                          <div className="font-extrabold text-black">{itemName}</div>
                          {itemNameEn && <div className="text-xs font-bold text-gray-600">{itemNameEn}</div>}
                          {item.category && <div className="text-xs font-bold text-gray-600">{item.category}</div>}
                          {item.sku && (
                            <div className="text-xs font-bold text-gray-600 font-mono">
                              {language === 'ar' ? 'باركود:' : 'Barcode:'} {item.sku}
                            </div>
                          )}
                          {itemSpecs.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {itemSpecs.map((spec: string, specIdx: number) => (
                                <span
                                  key={`${idx}-spec-${specIdx}`}
                                  className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700"
                                >
                                  {spec}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="text-xs font-bold text-gray-600">{formatPrice(unitPrice)} د.ع × {qty}</div>
                        </div>
                        <div className="col-span-2 text-center font-extrabold text-black">{qty}</div>
                        <div className="col-span-4 text-start font-extrabold text-black">{formatPrice(lineTotal)} د.ع</div>
                      </div>
                    );
                  }) : (
                    <div className="px-2 py-4 text-center text-sm text-gray-500">لا توجد منتجات</div>
                  )}
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-2 text-sm mb-3">
                <div className="flex justify-between font-bold">
                  <span>المجموع:</span>
                  <span>{formatPrice(parseFloat(lastOrder.subtotal || lastOrder.total))}</span>
                </div>
                {parseFloat(lastOrder.discount || '0') > 0 && (
                  <div className="flex justify-between font-bold">
                    <span>الخصم:</span>
                    <span>-{formatPrice(parseFloat(lastOrder.discount))}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-lg bg-black text-white px-3 py-2 rounded-lg -mx-1" data-testid="text-receipt-total">
                  <span>الإجمالي:</span>
                  <span>{formatPrice(parseFloat(lastOrder.total))} د.ع</span>
                </div>
              </div>

              {/* Payment */}
              <div className="text-center py-2 border-y border-gray-300 text-sm mb-3">
                <span className="font-bold">طريقة الدفع: </span>
                <span className="font-extrabold">
                  {formatPosPaymentLabel(lastOrder, "ar")}
                </span>
              </div>

              {/* Note */}
              {lastOrder.notes && (
                <div className="text-sm py-2 border-y border-gray-300 mb-3">
                  <span className="font-bold">ملاحظة: </span>
                  <span className="font-extrabold">{lastOrder.notes}</span>
                </div>
              )}

              {/* Footer */}
              <div className="text-center pt-2 border-t-2 border-dashed border-black">
                <p className="font-extrabold text-sm">شكراً لتسوقكم معنا</p>
                <p className="text-xs font-bold text-gray-600 mt-1">يرجى الاحتفاظ بالوصل</p>
                <p className="font-extrabold text-base mt-2" dir="ltr">07850006977</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button variant="outline" className="gap-2" onClick={() => setShowReceipt(false)} data-testid="button-new-sale">
              {language === 'ar' ? 'عملية جديدة' : 'New Sale'}
            </Button>
            <Button variant="outline" className="gap-2" onClick={openReceiptEditor} data-testid="button-edit-receipt">
              <Edit3 className="w-4 h-4" />
              {language === 'ar' ? 'تعديل الوصل' : 'Edit Receipt'}
            </Button>
            <Button className="gap-2" onClick={printReceipt} data-testid="button-print-receipt">
              <Printer className="w-4 h-4" />
              {language === 'ar' ? 'طباعة الوصل' : 'Print Receipt'}
            </Button>
            <Button variant="secondary" className="gap-2" onClick={printA4Invoice} data-testid="button-print-a4-invoice">
              <FileText className="w-4 h-4" />
              {language === 'ar' ? 'طباعة A4' : 'Print A4'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Editor Dialog */}
      <Dialog open={showReceiptEditor} onOpenChange={setShowReceiptEditor}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              {language === 'ar' ? 'تعديل الوصل قبل الطباعة' : 'Edit Receipt Before Printing'}
            </DialogTitle>
          </DialogHeader>

          {receiptDraft && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                {language === 'ar'
                  ? 'هذا التعديل يؤثر على الوصل المطبوع فقط، ولا يغير المخزون أو سجل البيع المحفوظ.'
                  : 'These changes affect the printed receipt only. They do not change stock or the saved sale record.'}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{language === 'ar' ? 'اسم الزبون' : 'Customer Name'}</Label>
                  <Input
                    value={receiptDraft.customerName || ''}
                    onChange={(e) => setReceiptDraft((prev: any) => ({ ...prev, customerName: e.target.value }))}
                    data-testid="input-edit-receipt-customer"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{language === 'ar' ? 'رقم الهاتف' : 'Phone'}</Label>
                  <Input
                    value={receiptDraft.customerPhone || ''}
                    onChange={(e) => setReceiptDraft((prev: any) => ({ ...prev, customerPhone: e.target.value }))}
                    data-testid="input-edit-receipt-phone"
                  />
                </div>
                {orderType === 'in-store' && (
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>{language === 'ar' ? 'العنوان' : 'Address'}</Label>
                    <Textarea
                      value={receiptDraft.customerAddress || ''}
                      onChange={(e) => setReceiptDraft((prev: any) => ({ ...prev, customerAddress: e.target.value }))}
                      className="min-h-[72px] resize-none"
                      data-testid="input-edit-receipt-address"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</Label>
                  <Select
                    value={receiptDraft.paymentMethod || 'cash'}
                    onValueChange={(value) => setReceiptDraft((prev: any) => ({ ...prev, paymentMethod: value }))}
                  >
                    <SelectTrigger data-testid="select-edit-receipt-payment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{language === 'ar' ? 'نقدي' : 'Cash'}</SelectItem>
                      <SelectItem value="card">{language === 'ar' ? 'بطاقة' : 'Card'}</SelectItem>
                      <SelectItem value="zaincash">{language === 'ar' ? 'زين كاش' : 'ZainCash'}</SelectItem>
                      <SelectItem value="qicard">{language === 'ar' ? 'كي كارد' : 'QiCard'}</SelectItem>
                      <SelectItem value="split">{language === 'ar' ? 'نقد + بطاقة' : 'Cash + Card'}</SelectItem>
                      <SelectItem value="deferred">{language === 'ar' ? 'أجل' : 'Deferred'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{language === 'ar' ? 'الخصم' : 'Discount'}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={receiptDraft.discount || '0'}
                    onChange={(e) => setReceiptDraft((prev: any) => ({ ...prev, discount: e.target.value }))}
                    data-testid="input-edit-receipt-discount"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{language === 'ar' ? 'المنتجات على الوصل' : 'Receipt Items'}</Label>
                <div className="space-y-3">
                  {(receiptDraft.items || []).map((item: any, index: number) => (
                    <div key={index} className="rounded-lg border p-3 space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">{language === 'ar' ? 'اسم المنتج عربي' : 'Arabic Name'}</Label>
                          <Input
                            value={item.nameAr || ''}
                            onChange={(e) => updateReceiptDraftItem(index, 'nameAr', e.target.value)}
                            data-testid={`input-edit-receipt-item-name-ar-${index}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{language === 'ar' ? 'اسم المنتج إنكليزي' : 'English Name'}</Label>
                          <Input
                            value={item.nameEn || ''}
                            onChange={(e) => updateReceiptDraftItem(index, 'nameEn', e.target.value)}
                            data-testid={`input-edit-receipt-item-name-en-${index}`}
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="space-y-1.5 md:col-span-2">
                          <Label className="text-xs">SKU</Label>
                          <Input
                            value={item.sku || ''}
                            onChange={(e) => updateReceiptDraftItem(index, 'sku', e.target.value)}
                            data-testid={`input-edit-receipt-item-sku-${index}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{language === 'ar' ? 'الكمية' : 'Qty'}</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity || 1}
                            onChange={(e) => updateReceiptDraftItem(index, 'quantity', e.target.value)}
                            data-testid={`input-edit-receipt-item-qty-${index}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{language === 'ar' ? 'السعر' : 'Price'}</Label>
                          <Input
                            type="number"
                            min="0"
                            value={item.price || '0'}
                            onChange={(e) => updateReceiptDraftItem(index, 'price', e.target.value)}
                            data-testid={`input-edit-receipt-item-price-${index}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{language === 'ar' ? 'ملاحظة الوصل' : 'Receipt Note'}</Label>
                <Textarea
                  value={receiptDraft.notes || ''}
                  onChange={(e) => setReceiptDraft((prev: any) => ({ ...prev, notes: e.target.value }))}
                  className="min-h-[80px]"
                  data-testid="textarea-edit-receipt-note"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowReceiptEditor(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button onClick={saveReceiptEdits} className="gap-2" data-testid="button-save-receipt-edits">
                  <Save className="h-4 w-4" />
                  {language === 'ar' ? 'حفظ التعديل' : 'Save Edits'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Held Orders Dialog */}
      <Dialog open={showHeldOrders} onOpenChange={setShowHeldOrders}>
        <DialogContent className="sm:max-w-lg" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {language === 'ar' ? 'الطلبات المعلقة' : 'Held Orders'}
              {heldOrders.length > 0 && (
                <Badge>{heldOrders.length}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {heldOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <PauseCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>{language === 'ar' ? 'لا توجد طلبات معلقة' : 'No held orders'}</p>
              </div>
            ) : (
              heldOrders.map((order) => {
                const items = typeof order.items === 'string' 
                  ? JSON.parse(order.items) 
                  : order.items;
                const itemCount = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
                
                return (
                  <Card key={order.id} className="p-4" data-testid={`held-order-${order.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono">
                            {order.holdNumber}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleTimeString(language === 'ar' ? 'ar-IQ' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        {order.customerName && (
                          <p className="text-sm font-medium truncate">
                            <User className="h-3 w-3 inline me-1" />
                            {order.customerName}
                          </p>
                        )}
                        
                        <p className="text-sm text-muted-foreground">
                          {itemCount} {language === 'ar' ? 'منتج' : 'items'} • {formatPrice(parseFloat(order.subtotal))} {language === 'ar' ? 'د.ع' : 'IQD'}
                        </p>
                        
                        {order.notes && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {order.notes}
                          </p>
                        )}
                      </div>
                      
                      <Button
                        onClick={() => recallOrderMutation.mutate(order.id)}
                        disabled={recallOrderMutation.isPending}
                        size="sm"
                        className="gap-1"
                        data-testid={`button-recall-${order.id}`}
                      >
                        {recallOrderMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        {language === 'ar' ? 'استرجاع' : 'Recall'}
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={showCheckoutModal} onOpenChange={setShowCheckoutModal}>
        <DialogContent className="sm:max-w-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {language === 'ar' ? 'إتمام البيع' : 'Complete Sale'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar'
                ? 'أدخل معلومات العميل ثم أكّد البيع'
                : 'Enter customer details and confirm the sale'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'اسم العميل' : 'Customer Name'}</Label>
              <div className="relative">
                <User className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={language === 'ar' ? 'اختياري' : 'Optional'}
                  className="ps-9"
                  data-testid="input-checkout-customer-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</Label>
              <div className="relative">
                <Phone className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="07XX XXX XXXX"
                  className="ps-9"
                  data-testid="input-checkout-customer-phone"
                />
              </div>
            </div>

            {orderType === 'in-store' && (
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'العنوان' : 'Address'}</Label>
                <Textarea
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder={language === 'ar' ? 'عنوان العميل (اختياري)' : 'Customer address (optional)'}
                  className="min-h-[72px] resize-none"
                  data-testid="input-checkout-customer-address"
                />
              </div>
            )}

            <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{language === 'ar' ? 'الأصناف' : 'Items'}</span>
                <span>{totalItems}</span>
              </div>
              <div className="flex justify-between font-bold text-base">
                <span>{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
                <span className="text-primary">
                  {formatPrice(total)} {language === 'ar' ? 'د.ع' : 'IQD'}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowCheckoutModal(false)}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                type="button"
                className="flex-1 gap-2"
                onClick={confirmCheckout}
                disabled={createOrderMutation.isPending}
                data-testid="button-confirm-checkout"
              >
                {createOrderMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {language === 'ar' ? 'تأكيد البيع' : 'Confirm Sale'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Lookup Dialog */}
      <Dialog open={showCustomerLookup} onOpenChange={setShowCustomerLookup}>
        <DialogContent className="sm:max-w-lg" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserSearch className="h-5 w-5" />
              {language === 'ar' ? 'بحث عن عميل' : 'Customer Lookup'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                placeholder={language === 'ar' ? 'بحث بالاسم أو رقم الهاتف...' : 'Search by name or phone...'}
                className="ps-9"
                data-testid="input-customer-search"
              />
            </div>
            
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserSearch className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>{language === 'ar' ? 'لم يتم العثور على عملاء' : 'No customers found'}</p>
                </div>
              ) : (
                filteredCustomers.map((customer, index) => (
                  <button
                    key={`${customer.phone}-${index}`}
                    className="w-full text-start p-3 rounded-lg border bg-muted/30 hover:bg-muted transition-colors"
                    onClick={() => selectCustomer(customer)}
                    data-testid={`customer-${index}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{customer.name || (language === 'ar' ? 'بدون اسم' : 'No Name')}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </p>
                      </div>
                      <div className="text-end flex-shrink-0">
                        <Badge variant="outline" className="text-xs mb-1">
                          {customer.orderCount} {language === 'ar' ? 'طلب' : 'orders'}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(customer.totalSpent)} {language === 'ar' ? 'د.ع' : 'IQD'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
