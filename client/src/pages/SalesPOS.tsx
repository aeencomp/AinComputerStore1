import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Store
} from "lucide-react";
import type { InStoreProduct } from "@shared/schema";

interface POSProduct {
  id: string;
  nameAr: string;
  nameEn: string | null;
  price: string;
  stockQuantity: number | null;
  sku: string | null;
  image: string | null;
  category: string | null;
  barcode?: string | null;
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

interface SalesPOSProps {
  user: SalesUser;
  orderType?: 'walk-in' | 'in-store';
}

export default function SalesPOS({ user, orderType = 'walk-in' }: SalesPOSProps) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
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

  const { data: mainProducts = [], isLoading: mainLoading } = useQuery<any[]>({
    queryKey: ['/api/products'],
    enabled: orderType === 'walk-in',
  });

  const { data: inStoreRaw = [], isLoading: inStoreLoading } = useQuery<InStoreProduct[]>({
    queryKey: ['/api/instore/products'],
    enabled: orderType === 'in-store',
  });

  const isLoading = orderType === 'in-store' ? inStoreLoading : mainLoading;

  const products: POSProduct[] = orderType === 'in-store'
    ? inStoreRaw
        .filter(p => p.isActive !== 0)
        .map(p => ({
          id: String(p.id),
          nameAr: p.nameAr,
          nameEn: p.nameEn ?? null,
          price: String(p.price),
          stockQuantity: p.stockQuantity,
          sku: p.sku ?? null,
          image: null,
          category: p.category ?? null,
          barcode: p.barcode ?? null,
        }))
    : mainProducts.map(p => ({
        id: p.id,
        nameAr: p.nameAr,
        nameEn: p.nameEn ?? null,
        price: String(p.price),
        stockQuantity: p.stockQuantity,
        sku: p.sku ?? null,
        image: p.image ?? null,
        category: p.category ?? null,
      }));

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    enabled: orderType === 'walk-in',
  });

  const inStoreCategories: { id: string; slug: string; nameAr: string; nameEn?: string }[] =
    orderType === 'in-store'
      ? Array.from(new Set(inStoreRaw.map(p => p.category).filter(Boolean) as string[])).map(cat => ({
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
        items: cart.map(item => ({
          nameAr: item.product.nameAr,
          nameEn: item.product.nameEn,
          sku: item.product.sku,
          category: item.product.category,
          price: item.product.price,
          quantity: item.quantity,
        })),
        subtotal: subtotal.toString(),
        discount: calculatedDiscount.toString(),
        total: total.toString(),
        paymentMethod: paymentMethod,
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
      setDiscount("0");
      setDiscountReason("");
      
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/products'] });
        queryClient.invalidateQueries({ queryKey: ['/api/instore/products'] });
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
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sku.toLowerCase().includes(searchQuery.toLowerCase());
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
      return [...prev, { product, quantity: 1 }];
    });
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

  const clearCart = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setDiscount("0");
    setDiscountReason("");
  };

  const subtotal = cart.reduce((sum, item) => 
    sum + parseFloat(item.product.price) * item.quantity, 0
  );
  
  const discountValue = parseFloat(discount) || 0;
  const calculatedDiscount = discountType === "percent" 
    ? (subtotal * discountValue / 100) 
    : discountValue;
  const total = Math.max(0, subtotal - calculatedDiscount);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: language === 'ar' ? 'السلة فارغة' : 'Cart is empty',
        variant: 'destructive',
      });
      return;
    }

    const orderData = {
      items: cart.map(item => ({
        productId: item.product.id,
        nameAr: item.product.nameAr,
        nameEn: item.product.nameEn,
        price: item.product.price,
        quantity: item.quantity,
      })),
      customerName: customerName || 'عميل في المتجر',
      customerPhone,
      paymentMethod,
      paymentStatus: 'success',
      discount: calculatedDiscount.toString(),
      discountReason,
      orderType,
    };

    createOrderMutation.mutate(orderData);
  };

  const printReceipt = () => {
    if (!lastOrder) return;
    const isAr = language === 'ar';
    const dir = isAr ? 'rtl' : 'ltr';
    const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 0 });

    const payLabel = lastOrder.paymentMethod === 'cash'
      ? (isAr ? 'نقدي' : 'Cash')
      : lastOrder.paymentMethod === 'card'
      ? (isAr ? 'بطاقة' : 'Card')
      : 'ZainCash';

    const rowsHtml = (lastOrder.items || []).map((item: any) => {
      const unitPrice = parseFloat(item.price);
      const lineTotal = unitPrice * item.quantity;
      const name = isAr ? (item.nameAr || '-') : (item.nameEn || item.nameAr || '-');
      return `<tr>
        <td style="padding:4px 2px;border-bottom:1px solid #eee;">${name}${item.sku ? `<br/><span style="font-size:9px;color:#888;">SKU: ${item.sku}</span>` : ''}</td>
        <td style="text-align:center;padding:4px 2px;border-bottom:1px solid #eee;">${item.quantity}</td>
        <td style="text-align:end;padding:4px 2px;border-bottom:1px solid #eee;">${fmt(unitPrice)}</td>
        <td style="text-align:end;padding:4px 2px;border-bottom:1px solid #eee;font-weight:600;">${fmt(lineTotal)}</td>
      </tr>`;
    }).join('');

    const discountNum = parseFloat(lastOrder.discount || '0');
    const subtotalNum = parseFloat(lastOrder.subtotal || '0');
    const totalNum = parseFloat(lastOrder.total || '0');

    const discountRow = discountNum > 0 ? `
      <div style="display:flex;justify-content:space-between;color:#16a34a;">
        <span>${isAr ? 'الخصم' : 'Discount'}</span>
        <span>-${fmt(discountNum)} ${isAr ? 'د.ع' : 'IQD'}</span>
      </div>` : '';

    const customerHtml = (lastOrder.customerName || lastOrder.customerPhone) ? `
      <div style="background:#f9fafb;border-radius:6px;padding:8px 10px;margin-bottom:10px;font-size:12px;">
        ${lastOrder.customerName ? `<div style="display:flex;justify-content:space-between;"><span>${isAr ? 'الزبون:' : 'Customer:'}</span><span>${lastOrder.customerName}</span></div>` : ''}
        ${lastOrder.customerPhone ? `<div style="display:flex;justify-content:space-between;"><span>${isAr ? 'الهاتف:' : 'Phone:'}</span><span dir="ltr">${lastOrder.customerPhone}</span></div>` : ''}
      </div>` : '';

    const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${isAr ? 'ar' : 'en'}">
<head>
<meta charset="UTF-8"/>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Cairo', Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 8px; width: 80mm; }
  h2 { margin: 0 0 2px; font-size: 16px; }
  p { margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { border-bottom: 2px solid #333; padding: 4px 2px; font-weight: 600; }
  .dashed { border-top: 1px dashed #aaa; margin: 8px 0; }
  .section { background: #f9fafb; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 12px; }
  .row { display: flex; justify-content: space-between; }
  .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; border-top: 2px solid #333; padding-top: 6px; margin-top: 4px; }
  .footer { text-align: center; margin-top: 10px; font-size: 11px; color: #666; }
</style>
</head>
<body>
  <div style="text-align:center;border-bottom:2px dashed #aaa;padding-bottom:10px;margin-bottom:10px;">
    <h2>العين لتجارة الحاسبات</h2>
    <p style="font-size:11px;color:#666;">Al-Ain Computer Trading — العراق، كربلاء</p>
    <p style="font-size:10px;color:#999;margin-top:4px;">${isAr ? 'إيصال بيع' : 'Sales Receipt'}</p>
  </div>

  <div class="section" style="margin-bottom:10px;">
    <div class="row"><span>${isAr ? 'رقم الطلب:' : 'Order #:'}</span><span style="font-weight:700;font-family:monospace;">${lastOrder.orderNumber}</span></div>
    <div class="row"><span>${isAr ? 'التاريخ:' : 'Date:'}</span><span>${new Date(lastOrder.createdAt).toLocaleString(isAr ? 'ar-IQ' : 'en-US')}</span></div>
    ${lastOrder.paymentMethod ? `<div class="row"><span>${isAr ? 'طريقة الدفع:' : 'Payment:'}</span><span style="font-weight:600;">${payLabel}</span></div>` : ''}
  </div>

  ${customerHtml}

  <table>
    <thead>
      <tr>
        <th style="text-align:start;">${isAr ? 'المنتج' : 'Product'}</th>
        <th style="text-align:center;">${isAr ? 'الكمية' : 'Qty'}</th>
        <th style="text-align:end;">${isAr ? 'السعر' : 'Price'}</th>
        <th style="text-align:end;">${isAr ? 'المجموع' : 'Total'}</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="dashed"></div>

  <div style="font-size:12px;margin-bottom:8px;">
    <div class="row"><span>${isAr ? 'المجموع الفرعي:' : 'Subtotal:'}</span><span>${fmt(subtotalNum)} ${isAr ? 'د.ع' : 'IQD'}</span></div>
    ${discountRow}
    <div class="total-row"><span>${isAr ? 'الإجمالي:' : 'Total:'}</span><span>${fmt(totalNum)} ${isAr ? 'د.ع' : 'IQD'}</span></div>
  </div>

  <div class="footer">
    <div class="dashed"></div>
    <p>${isAr ? 'شكراً لتسوقكم معنا!' : 'Thank you for your purchase!'}</p>
    <p style="margin-top:4px;font-size:10px;">${isAr ? 'يرجى الاحتفاظ بالوصل' : 'Please keep this receipt'}</p>
  </div>

  <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };</script>
</body>
</html>`;

    const popup = window.open('', '_blank', 'width=400,height=650');
    if (popup) {
      popup.document.write(html);
      popup.document.close();
    }
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
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-10 h-11 text-base"
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
          <CardContent className="flex-1 p-4 overflow-auto">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredProducts.map(product => {
                  const inCart = cart.find(item => item.product.id === product.id);
                  const isOutOfStock = (product.stockQuantity || 0) <= 0;
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock}
                      className={`relative p-4 border-2 rounded-xl transition-all text-start group ${
                        inCart 
                          ? 'border-primary bg-primary/5 shadow-md' 
                          : 'border-transparent bg-card hover:border-primary/30 hover:shadow-md'
                      } ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                      data-testid={`product-card-${product.id}`}
                    >
                      {/* Stock Badge */}
                      <div className="absolute top-2 end-2 z-10">
                        {isOutOfStock ? (
                          <Badge variant="destructive" className="text-xs">
                            {language === 'ar' ? 'نفذ' : 'Out'}
                          </Badge>
                        ) : (product.stockQuantity || 0) < 5 ? (
                          <Badge className="text-xs bg-orange-500/20 text-orange-600">
                            {product.stockQuantity}
                          </Badge>
                        ) : null}
                      </div>
                      
                      {/* Cart Quantity Badge */}
                      {inCart && (
                        <div className="absolute top-2 start-2 z-10">
                          <Badge className="text-xs">
                            {inCart.quantity}x
                          </Badge>
                        </div>
                      )}
                      
                      {/* Product Image */}
                      <div className="aspect-square rounded-lg bg-muted mb-3 overflow-hidden">
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.nameAr}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-10 w-10 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      
                      {/* Product Info */}
                      <div className="space-y-1">
                        <p className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">
                          {language === 'ar' ? product.nameAr : (product.nameEn || product.nameAr)}
                        </p>
                        {product.sku && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Barcode className="h-3 w-3" />
                            {product.sku}
                          </p>
                        )}
                        <p className="text-lg font-bold text-primary">
                          {formatPrice(parseFloat(product.price))}
                          <span className="text-xs font-normal text-muted-foreground me-1">
                            {language === 'ar' ? 'د.ع' : 'IQD'}
                          </span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProducts.map(product => {
                  const inCart = cart.find(item => item.product.id === product.id);
                  const isOutOfStock = (product.stockQuantity || 0) <= 0;
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock}
                      className={`w-full flex items-center gap-4 p-3 border-2 rounded-xl transition-all text-start ${
                        inCart 
                          ? 'border-primary bg-primary/5' 
                          : 'border-transparent bg-card hover:border-primary/30'
                      } ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                      data-testid={`product-list-${product.id}`}
                    >
                      {/* Product Image */}
                      <div className="h-16 w-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.nameAr}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {language === 'ar' ? product.nameAr : (product.nameEn || product.nameAr)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.sku} • {language === 'ar' ? 'متوفر:' : 'Stock:'} {product.stockQuantity || 0}
                        </p>
                      </div>
                      
                      {/* Price & Cart Badge */}
                      <div className="text-end flex-shrink-0">
                        <p className="text-lg font-bold text-primary">
                          {formatPrice(parseFloat(product.price))}
                        </p>
                        {inCart && (
                          <Badge className="text-xs">{inCart.quantity}x</Badge>
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
      <div className="w-full lg:w-[420px] flex flex-col">
        <Card className="flex-1 flex flex-col overflow-hidden">
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
          
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
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
                {/* Cart Items */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div 
                        key={item.product.id} 
                        className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border"
                      >
                        {/* Product Image */}
                        <div className="h-14 w-14 rounded-lg bg-background overflow-hidden flex-shrink-0">
                          {item.product.image ? (
                            <img 
                              src={item.product.image} 
                              alt={item.product.nameAr}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-6 w-6 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        
                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-1">
                            {language === 'ar' ? item.product.nameAr : (item.product.nameEn || item.product.nameAr)}
                          </p>
                          <p className="text-sm text-primary font-bold">
                            {formatPrice(parseFloat(item.product.price))} × {item.quantity}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            = {formatPrice(parseFloat(item.product.price) * item.quantity)} {language === 'ar' ? 'د.ع' : 'IQD'}
                          </p>
                        </div>
                        
                        {/* Quantity Controls */}
                        <div className="flex flex-col items-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <div className="flex items-center gap-1 bg-background rounded-lg border p-0.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.product.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => setQuantity(item.product.id, parseInt(e.target.value) || 1)}
                              className="w-10 h-7 text-center p-0 border-0 text-sm"
                              min="1"
                              max={item.product.stockQuantity || 99}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.product.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

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
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder={language === 'ar' ? 'الاسم' : 'Name'}
                        className="h-9"
                        data-testid="input-customer-name"
                      />
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder={language === 'ar' ? 'الهاتف' : 'Phone'}
                        className="h-9"
                        data-testid="input-customer-phone"
                      />
                    </div>
                  </div>
                  
                  {/* Payment Method - Quick Buttons */}
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Wallet className="h-3 w-3" />
                      {language === 'ar' ? 'طريقة الدفع' : 'Payment'}
                    </Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: 'cash', label: language === 'ar' ? 'نقداً' : 'Cash', icon: Banknote },
                        { value: 'card', label: language === 'ar' ? 'بطاقة' : 'Card', icon: CreditCard },
                        { value: 'zaincash', label: 'ZainCash', icon: Wallet },
                        { value: 'qicard', label: 'QiCard', icon: CreditCard },
                      ].map(method => (
                        <Button
                          key={method.value}
                          variant={paymentMethod === method.value ? "default" : "outline"}
                          size="sm"
                          className="h-auto py-2 px-2 flex-col gap-1"
                          onClick={() => setPaymentMethod(method.value)}
                        >
                          <method.icon className="h-4 w-4" />
                          <span className="text-xs">{method.label}</span>
                        </Button>
                      ))}
                    </div>
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
                </div>

                {/* Totals & Checkout */}
                <div className="p-4 space-y-3 border-t bg-card">
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
              {/* Store Header */}
              <div className="text-center border-b-2 border-dashed border-gray-300 pb-3 mb-3">
                <h2 className="font-bold text-lg">العين لتجارة الحاسبات</h2>
                <p className="text-xs text-gray-600">Al-Ain Computer Trading</p>
                <p className="text-xs text-gray-500 mt-1">العراق — كربلاء</p>
              </div>

              {/* Order number + date */}
              <div className="bg-gray-50 rounded p-2 mb-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="font-semibold">{language === 'ar' ? 'رقم الطلب:' : 'Order #:'}</span>
                  <span className="font-mono font-bold">{lastOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>{language === 'ar' ? 'التاريخ:' : 'Date:'}</span>
                  <span>{new Date(lastOrder.createdAt).toLocaleString(language === 'ar' ? 'ar-IQ' : 'en-US')}</span>
                </div>
                {lastOrder.paymentMethod && (
                  <div className="flex justify-between">
                    <span>{language === 'ar' ? 'طريقة الدفع:' : 'Payment:'}</span>
                    <span className="font-semibold">
                      {lastOrder.paymentMethod === 'cash' ? (language === 'ar' ? 'نقدي' : 'Cash')
                        : lastOrder.paymentMethod === 'card' ? (language === 'ar' ? 'بطاقة' : 'Card')
                        : 'ZainCash'}
                    </span>
                  </div>
                )}
              </div>

              {/* Customer */}
              {(lastOrder.customerName || lastOrder.customerPhone) && (
                <div className="border-t border-gray-200 pt-2 mb-3 text-xs space-y-1">
                  {lastOrder.customerName && (
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'الزبون:' : 'Customer:'}</span>
                      <span>{lastOrder.customerName}</span>
                    </div>
                  )}
                  {lastOrder.customerPhone && (
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'الهاتف:' : 'Phone:'}</span>
                      <span dir="ltr">{lastOrder.customerPhone}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Items Table */}
              <div className="border-t border-b border-gray-300 py-2 mb-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-start pb-1">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                      <th className="text-center pb-1">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                      <th className="text-end pb-1">{language === 'ar' ? 'السعر' : 'Price'}</th>
                      <th className="text-end pb-1">{language === 'ar' ? 'المجموع' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastOrder.items?.map((item: any, idx: number) => {
                      const unitPrice = parseFloat(item.price);
                      const lineTotal = unitPrice * item.quantity;
                      return (
                        <tr key={idx} className="border-b border-gray-100" data-testid={`receipt-item-${idx}`}>
                          <td className="py-1">
                            <div className="font-medium">{language === 'ar' ? (item.nameAr || '-') : (item.nameEn || item.nameAr || '-')}</div>
                            {item.sku && <div className="text-gray-400 text-[10px]">SKU: {item.sku}</div>}
                          </td>
                          <td className="text-center">{item.quantity}</td>
                          <td className="text-end">{formatPrice(unitPrice)}</td>
                          <td className="text-end font-medium">{formatPrice(lineTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm mb-3">
                <div className="flex justify-between">
                  <span>{language === 'ar' ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                  <span>{formatPrice(parseFloat(lastOrder.subtotal))}</span>
                </div>
                {parseFloat(lastOrder.discount) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{language === 'ar' ? 'الخصم:' : 'Discount:'}</span>
                    <span>-{formatPrice(parseFloat(lastOrder.discount))}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2">
                  <span>{language === 'ar' ? 'الإجمالي:' : 'Total:'}</span>
                  <span data-testid="text-receipt-total">{formatPrice(parseFloat(lastOrder.total))} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center pt-3 border-t border-dashed border-gray-300">
                <p className="text-xs text-gray-500">{language === 'ar' ? 'شكراً لتسوقكم معنا!' : 'Thank you for your purchase!'}</p>
                <p className="text-[10px] text-gray-400 mt-1">{language === 'ar' ? 'يرجى الاحتفاظ بالوصل' : 'Please keep this receipt'}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" className="gap-2" onClick={() => setShowReceipt(false)} data-testid="button-new-sale">
              {language === 'ar' ? 'عملية جديدة' : 'New Sale'}
            </Button>
            <Button className="gap-2" onClick={printReceipt} data-testid="button-print-receipt">
              <Printer className="w-4 h-4" />
              {language === 'ar' ? 'طباعة الوصل' : 'Print Receipt'}
            </Button>
          </div>
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
