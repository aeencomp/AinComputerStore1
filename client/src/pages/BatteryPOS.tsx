import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Battery, 
  Search, 
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Loader2,
  ArrowRight,
  Check,
  Printer,
  User,
  Phone,
  CreditCard,
  Banknote,
  DollarSign,
  Percent,
  FileText,
  Package,
  ChevronLeft,
  Plug,
  Keyboard,
  Monitor,
  Languages,
  Clock
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { LaptopBattery, AcAdapter, Keyboard as KeyboardItem, Lcd as LcdItem } from "@shared/schema";

interface CartItem {
  productType: 'battery' | 'adapter' | 'keyboard' | 'lcd';
  battery?: LaptopBattery;
  adapter?: AcAdapter;
  keyboard?: KeyboardItem;
  lcd?: LcdItem;
  quantity: number;
  priceType: 'purchase' | 'wholesale' | 'selling';
  unitPrice: number;
}

interface SaleData {
  saleNumber: string;
  saleDate: Date;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  discountType: 'percentage' | 'iqd';
  discountAmount: number;
  total: number;
  paymentMethod: string;
  warrantyEndDate: Date;
}

interface BatteryUserAuth {
  id: string;
  username: string;
  name: string;
  role: string;
}

function formatPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return num.toLocaleString('ar-IQ') + ' د.ع';
}

export default function BatteryPOS() {
  const { language, setLanguage } = useLanguage();
  const isRTL = language === 'ar';
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [productType, setProductType] = useState<'battery' | 'adapter' | 'keyboard' | 'lcd'>('battery');
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'iqd'>('percentage');
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [notes, setNotes] = useState("");
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<SaleData | null>(null);

  const { data: currentUser, isLoading: authLoading } = useQuery<BatteryUserAuth>({
    queryKey: ['/api/battery/auth/me'],
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && !currentUser) {
      setLocation("/battery/login");
    }
  }, [currentUser, authLoading, setLocation]);

  const { data: batteries = [], isLoading: batteriesLoading } = useQuery<LaptopBattery[]>({
    queryKey: ['/api/battery/batteries'],
    enabled: !!currentUser,
  });

  const { data: adapters = [], isLoading: adaptersLoading } = useQuery<AcAdapter[]>({
    queryKey: ['/api/battery/adapters'],
    enabled: !!currentUser,
  });

  const { data: keyboards = [], isLoading: keyboardsLoading } = useQuery<KeyboardItem[]>({
    queryKey: ['/api/battery/keyboards'],
    enabled: !!currentUser,
  });

  const { data: lcds = [], isLoading: lcdsLoading } = useQuery<LcdItem[]>({
    queryKey: ['/api/battery/lcds'],
    enabled: !!currentUser,
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<LaptopBattery[]>({
    queryKey: ['/api/battery/batteries/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(`/api/battery/batteries/search?q=${encodeURIComponent(searchQuery)}&type=all`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: !!currentUser && searchQuery.length > 0 && productType === 'battery',
  });

  const { data: adapterSearchResults = [], isLoading: adapterSearchLoading } = useQuery<AcAdapter[]>({
    queryKey: ['/api/battery/adapters/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(`/api/battery/adapters/search?q=${encodeURIComponent(searchQuery)}&type=all`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: !!currentUser && searchQuery.length > 0 && productType === 'adapter',
  });

  const { data: keyboardSearchResults = [], isLoading: keyboardSearchLoading } = useQuery<KeyboardItem[]>({
    queryKey: ['/api/battery/keyboards/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(`/api/battery/keyboards/search?q=${encodeURIComponent(searchQuery)}&type=all`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: !!currentUser && searchQuery.length > 0 && productType === 'keyboard',
  });

  const { data: lcdSearchResults = [], isLoading: lcdSearchLoading } = useQuery<LcdItem[]>({
    queryKey: ['/api/battery/lcds/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(`/api/battery/lcds/search?q=${encodeURIComponent(searchQuery)}&type=all`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: !!currentUser && searchQuery.length > 0 && productType === 'lcd',
  });

  const createSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      return await apiRequest('POST', '/api/battery/pos/sales', saleData);
    },
    onSuccess: (data: any) => {
      const saleDate = new Date();
      const warrantyEndDate = new Date(saleDate);
      warrantyEndDate.setMonth(warrantyEndDate.getMonth() + 1);
      
      const calculatedDiscountAmount = discountType === 'percentage' 
        ? subtotal * (discount / 100) 
        : Math.min(discount, subtotal);
      setLastSaleData({
        saleNumber: data.saleNumber,
        saleDate,
        customerName,
        customerPhone,
        items: [...cart],
        subtotal,
        discount,
        discountType,
        discountAmount: calculatedDiscountAmount,
        total: subtotal - calculatedDiscountAmount,
        paymentMethod,
        warrantyEndDate,
      });
      setShowCheckoutModal(false);
      setShowReceiptModal(true);
      queryClient.invalidateQueries({ queryKey: ['/api/battery/batteries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/battery/batteries/low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['/api/battery/adapters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/battery/keyboards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/battery/lcds'] });
    },
    onError: (error: any) => {
      toast({
        title: isRTL ? "خطأ" : "Error",
        description: error.message || (isRTL ? "فشل في إنشاء عملية البيع" : "Failed to create sale"),
        variant: "destructive",
      });
    },
  });

  const displayBatteries = searchQuery.trim() ? searchResults : batteries.filter(b => b.stockQuantity > 0).slice(0, 20);
  const displayAdapters = searchQuery.trim() ? adapterSearchResults : adapters.filter(a => a.stockQuantity > 0).slice(0, 20);
  const displayKeyboards = searchQuery.trim() ? keyboardSearchResults : keyboards.filter(k => k.stockQuantity > 0).slice(0, 20);
  const displayLcds = searchQuery.trim() ? lcdSearchResults : lcds.filter(l => l.stockQuantity > 0).slice(0, 20);

  const addBatteryToCart = (battery: LaptopBattery, priceType: 'purchase' | 'wholesale' | 'selling' = 'selling') => {
    if (battery.stockQuantity <= 0) {
      toast({
        title: isRTL ? "لا يوجد مخزون" : "Out of Stock",
        description: isRTL ? "هذه البطارية غير متوفرة" : "This battery is not available",
        variant: "destructive",
      });
      return;
    }

    const existingIndex = cart.findIndex(item => 
      item.productType === 'battery' && 
      item.battery?.id === battery.id && 
      item.priceType === priceType
    );
    
    if (existingIndex >= 0) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty >= battery.stockQuantity) {
        toast({
          title: isRTL ? "الحد الأقصى" : "Maximum Reached",
          description: isRTL ? `الكمية المتاحة: ${battery.stockQuantity}` : `Available quantity: ${battery.stockQuantity}`,
          variant: "destructive",
        });
        return;
      }
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      const price = priceType === 'purchase' 
        ? parseFloat(battery.purchasePrice || '0')
        : priceType === 'wholesale'
        ? parseFloat(battery.wholesalePrice || '0')
        : parseFloat(battery.sellingPrice || '0');
      
      setCart([...cart, {
        productType: 'battery',
        battery,
        quantity: 1,
        priceType,
        unitPrice: price,
      }]);
    }
  };

  const addAdapterToCart = (adapter: AcAdapter, priceType: 'purchase' | 'wholesale' | 'selling' = 'selling') => {
    if (adapter.stockQuantity <= 0) {
      toast({
        title: isRTL ? "لا يوجد مخزون" : "Out of Stock",
        description: isRTL ? "هذا الشاحن غير متوفر" : "This adapter is not available",
        variant: "destructive",
      });
      return;
    }

    const existingIndex = cart.findIndex(item => 
      item.productType === 'adapter' && 
      item.adapter?.id === adapter.id && 
      item.priceType === priceType
    );
    
    if (existingIndex >= 0) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty >= adapter.stockQuantity) {
        toast({
          title: isRTL ? "الحد الأقصى" : "Maximum Reached",
          description: isRTL ? `الكمية المتاحة: ${adapter.stockQuantity}` : `Available quantity: ${adapter.stockQuantity}`,
          variant: "destructive",
        });
        return;
      }
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      const price = priceType === 'purchase' 
        ? parseFloat(adapter.purchasePrice || '0')
        : priceType === 'wholesale'
        ? parseFloat(adapter.wholesalePrice || '0')
        : parseFloat(adapter.sellingPrice || '0');
      
      setCart([...cart, {
        productType: 'adapter',
        adapter,
        quantity: 1,
        priceType,
        unitPrice: price,
      }]);
    }
  };

  const addKeyboardToCart = (keyboard: KeyboardItem, priceType: 'purchase' | 'wholesale' | 'selling' = 'selling') => {
    if (keyboard.stockQuantity <= 0) {
      toast({ title: isRTL ? "لا يوجد مخزون" : "Out of Stock", description: isRTL ? "لوحة المفاتيح غير متوفرة" : "Keyboard is not available", variant: "destructive" });
      return;
    }
    const existingIndex = cart.findIndex(item =>
      item.productType === 'keyboard' &&
      item.keyboard?.id === keyboard.id &&
      item.priceType === priceType
    );
    if (existingIndex >= 0) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty >= keyboard.stockQuantity) {
        toast({ title: isRTL ? "الحد الأقصى" : "Maximum Reached", description: isRTL ? `الكمية المتاحة: ${keyboard.stockQuantity}` : `Available quantity: ${keyboard.stockQuantity}`, variant: "destructive" });
        return;
      }
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      const price = priceType === 'purchase'
        ? parseFloat(keyboard.purchasePrice || '0')
        : priceType === 'wholesale'
        ? parseFloat(keyboard.wholesalePrice || '0')
        : parseFloat(keyboard.sellingPrice || '0');
      setCart([...cart, { productType: 'keyboard', keyboard, quantity: 1, priceType, unitPrice: price }]);
    }
  };

  const addLcdToCart = (lcd: LcdItem, priceType: 'purchase' | 'wholesale' | 'selling' = 'selling') => {
    if (lcd.stockQuantity <= 0) {
      toast({ title: isRTL ? "لا يوجد مخزون" : "Out of Stock", description: isRTL ? "شاشة LCD غير متوفرة" : "LCD is not available", variant: "destructive" });
      return;
    }
    const existingIndex = cart.findIndex(item =>
      item.productType === 'lcd' &&
      item.lcd?.id === lcd.id &&
      item.priceType === priceType
    );
    if (existingIndex >= 0) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty >= lcd.stockQuantity) {
        toast({ title: isRTL ? "الحد الأقصى" : "Maximum Reached", description: isRTL ? `الكمية المتاحة: ${lcd.stockQuantity}` : `Available quantity: ${lcd.stockQuantity}`, variant: "destructive" });
        return;
      }
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      const price = priceType === 'purchase'
        ? parseFloat(lcd.purchasePrice || '0')
        : priceType === 'wholesale'
        ? parseFloat(lcd.wholesalePrice || '0')
        : parseFloat(lcd.sellingPrice || '0');
      setCart([...cart, { productType: 'lcd', lcd, quantity: 1, priceType, unitPrice: price }]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    const newQty = item.quantity + delta;
    
    const maxStock = item.productType === 'battery'
      ? item.battery?.stockQuantity || 0
      : item.productType === 'adapter'
      ? item.adapter?.stockQuantity || 0
      : item.productType === 'keyboard'
      ? item.keyboard?.stockQuantity || 0
      : item.lcd?.stockQuantity || 0;
    
    if (newQty <= 0) {
      newCart.splice(index, 1);
    } else if (newQty > maxStock) {
      toast({
        title: isRTL ? "الحد الأقصى" : "Maximum Reached",
        description: isRTL ? `الكمية المتاحة: ${maxStock}` : `Available quantity: ${maxStock}`,
        variant: "destructive",
      });
      return;
    } else {
      newCart[index].quantity = newQty;
    }
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const changePriceType = (index: number, priceType: 'purchase' | 'wholesale' | 'selling') => {
    const newCart = [...cart];
    const item = newCart[index];
    
    let price: number;
    if (item.productType === 'battery' && item.battery) {
      price = priceType === 'purchase' 
        ? parseFloat(item.battery.purchasePrice || '0')
        : priceType === 'wholesale'
        ? parseFloat(item.battery.wholesalePrice || '0')
        : parseFloat(item.battery.sellingPrice || '0');
    } else if (item.productType === 'adapter' && item.adapter) {
      price = priceType === 'purchase' 
        ? parseFloat(item.adapter.purchasePrice || '0')
        : priceType === 'wholesale'
        ? parseFloat(item.adapter.wholesalePrice || '0')
        : parseFloat(item.adapter.sellingPrice || '0');
    } else if (item.productType === 'keyboard' && item.keyboard) {
      price = priceType === 'purchase'
        ? parseFloat(item.keyboard.purchasePrice || '0')
        : priceType === 'wholesale'
        ? parseFloat(item.keyboard.wholesalePrice || '0')
        : parseFloat(item.keyboard.sellingPrice || '0');
    } else if (item.productType === 'lcd' && item.lcd) {
      price = priceType === 'purchase'
        ? parseFloat(item.lcd.purchasePrice || '0')
        : priceType === 'wholesale'
        ? parseFloat(item.lcd.wholesalePrice || '0')
        : parseFloat(item.lcd.sellingPrice || '0');
    } else {
      return;
    }
    
    newCart[index].priceType = priceType;
    newCart[index].unitPrice = price;
    setCart(newCart);
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const discountAmount = discountType === 'percentage' 
    ? (subtotal * discount) / 100 
    : Math.min(discount, subtotal);
  const total = subtotal - discountAmount;

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: isRTL ? "السلة فارغة" : "Cart Empty",
        description: isRTL ? "أضف منتجات للسلة أولاً" : "Add products to cart first",
        variant: "destructive",
      });
      return;
    }
    setShowCheckoutModal(true);
  };

  const confirmSale = () => {
    const batteryItems = cart.filter(item => item.productType === 'battery');
    const adapterItems = cart.filter(item => item.productType === 'adapter');
    const keyboardItems = cart.filter(item => item.productType === 'keyboard');
    const lcdItems = cart.filter(item => item.productType === 'lcd');

    const saleData = {
      customerName: customerName || (isRTL ? 'زبون متجر' : 'Walk-in Customer'),
      customerPhone,
      items: batteryItems.map(item => ({
        batteryId: item.battery!.id,
        batteryName: `${item.battery!.brand} ${item.battery!.serialNumber}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        priceType: item.priceType,
        totalPrice: item.unitPrice * item.quantity,
      })),
      adapterItems: adapterItems.map(item => ({
        adapterId: item.adapter!.id,
        adapterName: `${item.adapter!.brand} ${item.adapter!.serialNumber}${item.adapter!.wattage ? ` ${item.adapter!.wattage}W` : ''}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        priceType: item.priceType,
        totalPrice: item.unitPrice * item.quantity,
      })),
      keyboardItems: keyboardItems.map(item => ({
        keyboardId: item.keyboard!.id,
        keyboardName: `${item.keyboard!.brand} ${item.keyboard!.serialNumber}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        priceType: item.priceType,
        totalPrice: item.unitPrice * item.quantity,
      })),
      lcdItems: lcdItems.map(item => ({
        lcdId: item.lcd!.id,
        lcdName: `${item.lcd!.brand} ${item.lcd!.serialNumber}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        priceType: item.priceType,
        totalPrice: item.unitPrice * item.quantity,
      })),
      subtotal,
      discount: discountAmount,
      total,
      paymentMethod,
      paymentStatus: paymentMethod === 'deferred' ? 'deferred' : 'paid',
      notes,
    };
    
    createSaleMutation.mutate(saleData);
  };

  const resetAfterSale = () => {
    setCart([]);
    setDiscount(0);
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMethod("cash");
    setNotes("");
    setShowReceiptModal(false);
    setLastSaleData(null);
    setSearchQuery("");
  };

  const handlePrintReceipt = () => {
    if (!lastSaleData) return;
    
    const receiptData = {
      saleNumber: lastSaleData.saleNumber,
      saleDate: lastSaleData.saleDate.toISOString(),
      customerName: lastSaleData.customerName,
      customerPhone: lastSaleData.customerPhone,
      items: lastSaleData.items.map(item => {
        if (item.productType === 'battery' && item.battery) {
          return {
            type: 'battery',
            brand: item.battery.brand,
            serialNumber: item.battery.serialNumber,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          };
        } else if (item.productType === 'adapter' && item.adapter) {
          return {
            type: 'adapter',
            brand: item.adapter.brand,
            serialNumber: item.adapter.serialNumber,
            wattage: item.adapter.wattage,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          };
        } else if (item.productType === 'keyboard' && item.keyboard) {
          return {
            type: 'keyboard',
            brand: item.keyboard.brand,
            serialNumber: item.keyboard.serialNumber,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          };
        } else if (item.productType === 'lcd' && item.lcd) {
          return {
            type: 'lcd',
            brand: item.lcd.brand,
            serialNumber: item.lcd.serialNumber,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          };
        }
        return null;
      }).filter(Boolean),
      subtotal: lastSaleData.subtotal,
      discount: lastSaleData.discount,
      discountAmount: lastSaleData.discountAmount,
      total: lastSaleData.total,
      paymentMethod: lastSaleData.paymentMethod,
      warrantyEndDate: lastSaleData.warrantyEndDate.toISOString(),
    };
    
    sessionStorage.setItem("battery_receipt_print", JSON.stringify(receiptData));
    setLocation("/battery/pos/print");
  };

  const getCartItemName = (item: CartItem): string => {
    if (item.productType === 'battery' && item.battery) {
      return item.battery.brand;
    } else if (item.productType === 'adapter' && item.adapter) {
      return `${item.adapter.brand}${item.adapter.wattage ? ` ${item.adapter.wattage}W` : ''}`;
    } else if (item.productType === 'keyboard' && item.keyboard) {
      return item.keyboard.brand;
    } else if (item.productType === 'lcd' && item.lcd) {
      return `${item.lcd.brand}${item.lcd.sizeInch ? ` ${item.lcd.sizeInch}"` : ''}`;
    }
    return '';
  };

  const getCartItemSerial = (item: CartItem): string => {
    if (item.productType === 'battery' && item.battery) {
      return item.battery.serialNumber;
    } else if (item.productType === 'adapter' && item.adapter) {
      return item.adapter.serialNumber;
    } else if (item.productType === 'keyboard' && item.keyboard) {
      return item.keyboard.serialNumber;
    } else if (item.productType === 'lcd' && item.lcd) {
      return item.lcd.serialNumber;
    }
    return '';
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const isLoading = productType === 'battery'
    ? batteriesLoading || searchLoading
    : productType === 'adapter'
    ? adaptersLoading || adapterSearchLoading
    : productType === 'keyboard'
    ? keyboardsLoading || keyboardSearchLoading
    : lcdsLoading || lcdSearchLoading;

  return (
    <div className={`min-h-screen bg-muted/30 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation("/battery")}
              data-testid="button-back-dashboard"
            >
              <ChevronLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">{isRTL ? 'نقطة البيع' : 'Point of Sale'}</h1>
                <p className="text-xs text-muted-foreground">{isRTL ? 'مبيعات البطاريات والشواحن' : 'Battery & Adapter Sales'}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="gap-1"
              data-testid="button-language-switch"
            >
              <Languages className="w-4 h-4" />
              {language === 'ar' ? 'EN' : 'عربي'}
            </Button>
            <Badge variant="outline" className="gap-1">
              <User className="w-3 h-3" />
              {currentUser.name}
            </Badge>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4">
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    {isRTL ? 'البحث عن المنتجات' : 'Search Products'}
                  </CardTitle>
                  <div className="flex border rounded-lg overflow-hidden">
                    <Button
                      variant={productType === 'battery' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-none gap-1"
                      onClick={() => { setProductType('battery'); setSearchQuery(''); }}
                      data-testid="toggle-product-type-battery"
                    >
                      <Battery className="w-4 h-4" />
                      {isRTL ? 'البطاريات' : 'Batteries'}
                    </Button>
                    <Button
                      variant={productType === 'adapter' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-none gap-1"
                      onClick={() => { setProductType('adapter'); setSearchQuery(''); }}
                      data-testid="toggle-product-type-adapter"
                    >
                      <Plug className="w-4 h-4" />
                      {isRTL ? 'الشواحن' : 'AC Adapters'}
                    </Button>
                    <Button
                      variant={productType === 'keyboard' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-none gap-1"
                      onClick={() => { setProductType('keyboard'); setSearchQuery(''); }}
                      data-testid="toggle-product-type-keyboard"
                    >
                      <Keyboard className="w-4 h-4" />
                      {isRTL ? 'كيبورد' : 'Keyboards'}
                    </Button>
                    <Button
                      variant={productType === 'lcd' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-none gap-1"
                      onClick={() => { setProductType('lcd'); setSearchQuery(''); }}
                      data-testid="toggle-product-type-lcd"
                    >
                      <Monitor className="w-4 h-4" />
                      {isRTL ? 'LCD' : 'LCDs'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} w-4 h-4 text-muted-foreground`} />
                  <Input
                    placeholder={productType === 'battery' 
                      ? (isRTL ? "ابحث بالرقم التسلسلي أو الموديل..." : "Search by serial or model...")
                      : productType === 'adapter'
                      ? (isRTL ? "ابحث بالرقم التسلسلي أو العلامة التجارية..." : "Search by serial or brand...")
                      : productType === 'keyboard'
                      ? (isRTL ? "ابحث بالرقم التسلسلي أو النوع..." : "Search keyboard by serial or type...")
                      : (isRTL ? "ابحث بالشاشة أو الدقة..." : "Search LCD by serial or resolution...")
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`${isRTL ? 'pr-10' : 'pl-10'}`}
                    data-testid="input-search-product"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {productType === 'battery' 
                    ? (isRTL ? 'البطاريات المتاحة' : 'Available Batteries')
                    : productType === 'adapter'
                    ? (isRTL ? 'الشواحن المتاحة' : 'Available AC Adapters')
                    : productType === 'keyboard'
                    ? (isRTL ? 'الكيبوردات المتاحة' : 'Available Keyboards')
                    : (isRTL ? 'شاشات LCD المتاحة' : 'Available LCDs')
                  }
                  <Badge variant="secondary" className="ms-auto">
                    {productType === 'battery' ? displayBatteries.length : productType === 'adapter' ? displayAdapters.length : productType === 'keyboard' ? displayKeyboards.length : displayLcds.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : productType === 'battery' ? (
                  displayBatteries.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Battery className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>{isRTL ? 'لا توجد بطاريات' : 'No batteries found'}</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
                      {displayBatteries.map((battery) => (
                        <div
                          key={battery.id}
                          className="p-3 border rounded-lg hover-elevate cursor-pointer transition-all"
                          onClick={() => addBatteryToCart(battery)}
                          data-testid={`battery-item-${battery.id}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{battery.brand}</p>
                              <p className="text-xs text-muted-foreground truncate">{battery.serialNumber}</p>
                            </div>
                            <Badge variant={battery.stockQuantity <= (battery.minStockLevel || 2) ? "destructive" : "secondary"} className="shrink-0">
                              {battery.stockQuantity}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-muted-foreground truncate">{battery.partNumber}</span>
                            <span className="font-bold text-primary">{formatPrice(battery.sellingPrice || '0')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : productType === 'adapter' ? (
                  displayAdapters.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Plug className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>{isRTL ? 'لا توجد شواحن' : 'No adapters found'}</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
                      {displayAdapters.map((adapter) => (
                        <div
                          key={adapter.id}
                          className="p-3 border rounded-lg hover-elevate cursor-pointer transition-all"
                          onClick={() => addAdapterToCart(adapter)}
                          data-testid={`adapter-item-${adapter.id}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {adapter.brand}
                                {adapter.wattage && <span className="text-primary ms-1">{adapter.wattage}W</span>}
                              </p>
                            </div>
                            <Badge variant={adapter.stockQuantity <= (adapter.minStockLevel || 2) ? "destructive" : "secondary"} className="shrink-0">
                              {adapter.stockQuantity}
                            </Badge>
                          </div>
                          {adapter.compatibleLaptops && adapter.compatibleLaptops.length > 0 && (
                            <p className="text-xs text-muted-foreground truncate mb-1">
                              {adapter.compatibleLaptops.slice(0, 2).join(', ')}
                              {adapter.compatibleLaptops.length > 2 && ` +${adapter.compatibleLaptops.length - 2}`}
                            </p>
                          )}
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-muted-foreground truncate">{adapter.connectorType || adapter.partNumber}</span>
                            <span className="font-bold text-primary">{formatPrice(adapter.sellingPrice || '0')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : productType === 'keyboard' ? (
                  displayKeyboards.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Keyboard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>{isRTL ? 'لا توجد كيبوردات' : 'No keyboards found'}</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
                      {displayKeyboards.map((keyboard) => (
                        <div key={keyboard.id} className="p-3 border rounded-lg hover-elevate cursor-pointer transition-all" onClick={() => addKeyboardToCart(keyboard)} data-testid={`keyboard-item-${keyboard.id}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{keyboard.brand}</p>
                              <p className="text-xs text-muted-foreground truncate">{keyboard.serialNumber}</p>
                            </div>
                            <Badge variant={keyboard.stockQuantity <= (keyboard.minStockLevel || 2) ? "destructive" : "secondary"} className="shrink-0">{keyboard.stockQuantity}</Badge>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-muted-foreground truncate">{keyboard.keyboardType || keyboard.layout || keyboard.partNumber}</span>
                            <span className="font-bold text-primary">{formatPrice(keyboard.sellingPrice || '0')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  displayLcds.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Monitor className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>{isRTL ? 'لا توجد شاشات LCD' : 'No LCDs found'}</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
                      {displayLcds.map((lcd) => (
                        <div key={lcd.id} className="p-3 border rounded-lg hover-elevate cursor-pointer transition-all" onClick={() => addLcdToCart(lcd)} data-testid={`lcd-item-${lcd.id}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{lcd.brand}{lcd.sizeInch ? ` ${lcd.sizeInch}"` : ''}</p>
                              <p className="text-xs text-muted-foreground truncate">{lcd.serialNumber}</p>
                            </div>
                            <Badge variant={lcd.stockQuantity <= (lcd.minStockLevel || 2) ? "destructive" : "secondary"} className="shrink-0">{lcd.stockQuantity}</Badge>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-muted-foreground truncate">{lcd.resolution || lcd.connectorType || lcd.partNumber}</span>
                            <span className="font-bold text-primary">{formatPrice(lcd.sellingPrice || '0')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-20">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  {isRTL ? 'سلة المبيعات' : 'Sales Cart'}
                  {cart.length > 0 && (
                    <Badge variant="default" className="ms-auto">{cart.reduce((sum, i) => sum + i.quantity, 0)}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{isRTL ? 'السلة فارغة' : 'Cart is empty'}</p>
                    <p className="text-xs mt-1">{isRTL ? 'اضغط على منتج لإضافته' : 'Click a product to add it'}</p>
                  </div>
                ) : (
                  <div className="divide-y max-h-[40vh] overflow-y-auto">
                    {cart.map((item, index) => (
                      <div key={`${item.productType}-${item.productType === 'battery' ? item.battery?.id : item.productType === 'adapter' ? item.adapter?.id : item.productType === 'keyboard' ? item.keyboard?.id : item.lcd?.id}-${item.priceType}`} className="p-3">
                        <div className="flex items-start gap-2 mb-2">
                          <div className="flex items-center gap-1">
                            {item.productType === 'battery' ? (
                              <Battery className="w-3 h-3 text-muted-foreground" />
                            ) : item.productType === 'adapter' ? (
                              <Plug className="w-3 h-3 text-muted-foreground" />
                            ) : item.productType === 'keyboard' ? (
                              <Keyboard className="w-3 h-3 text-muted-foreground" />
                            ) : (
                              <Monitor className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" data-testid={`cart-item-name-${index}`}>
                              {getCartItemName(item)}
                            </p>
                            <p className="text-xs text-muted-foreground" data-testid={`cart-item-serial-${index}`}>
                              {getCartItemSerial(item)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeFromCart(index)}
                            data-testid={`button-remove-${index}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-2">
                          <Select
                            value={item.priceType}
                            onValueChange={(val) => changePriceType(index, val as any)}
                          >
                            <SelectTrigger className="h-7 text-xs flex-1" data-testid={`select-price-type-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="selling">{isRTL ? 'مفرد' : 'Retail'}</SelectItem>
                              <SelectItem value="wholesale">{isRTL ? 'جملة' : 'Wholesale'}</SelectItem>
                              <SelectItem value="purchase">{isRTL ? 'شراء' : 'Cost'}</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex items-center border rounded-md">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(index, -1)}
                              data-testid={`button-decrease-${index}`}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium" data-testid={`text-quantity-${index}`}>{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(index, 1)}
                              data-testid={`button-increase-${index}`}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{formatPrice(item.unitPrice)} × {item.quantity}</span>
                          <span className="font-bold" data-testid={`text-item-total-${index}`}>{formatPrice(item.unitPrice * item.quantity)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {cart.length > 0 && (
                  <div className="border-t p-3 space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant={discountType === 'percentage' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => { setDiscountType('percentage'); setDiscount(0); }}
                          className="flex-1"
                          data-testid="button-discount-percentage"
                        >
                          <Percent className="w-3 h-3 mr-1" />
                          {isRTL ? 'نسبة %' : '%'}
                        </Button>
                        <Button
                          variant={discountType === 'iqd' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => { setDiscountType('iqd'); setDiscount(0); }}
                          className="flex-1"
                          data-testid="button-discount-iqd"
                        >
                          {isRTL ? 'د.ع' : 'IQD'}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        {discountType === 'percentage' ? (
                          <Percent className="w-4 h-4 text-muted-foreground" />
                        ) : null}
                        <Input
                          type="number"
                          min="0"
                          max={discountType === 'percentage' ? 100 : subtotal}
                          placeholder={discountType === 'percentage' 
                            ? (isRTL ? "خصم %" : "Discount %") 
                            : (isRTL ? "مبلغ الخصم" : "Discount Amount")}
                          value={discount || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            if (discountType === 'percentage') {
                              setDiscount(Math.min(100, Math.max(0, value)));
                            } else {
                              setDiscount(Math.max(0, value));
                            }
                          }}
                          className="h-8"
                          data-testid="input-discount"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</span>
                        <span data-testid="text-subtotal">{formatPrice(subtotal)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>
                            {isRTL ? 'الخصم' : 'Discount'} 
                            {discountType === 'percentage' ? ` (${discount}%)` : ''}
                          </span>
                          <span data-testid="text-discount-amount">-{formatPrice(discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg pt-2 border-t">
                        <span>{isRTL ? 'الإجمالي' : 'Total'}</span>
                        <span className="text-primary" data-testid="text-total">{formatPrice(total)}</span>
                      </div>
                    </div>

                    <Button 
                      className="w-full gap-2" 
                      size="lg"
                      onClick={handleCheckout}
                      data-testid="button-checkout"
                    >
                      <Receipt className="w-4 h-4" />
                      {isRTL ? 'إتمام البيع' : 'Complete Sale'}
                      <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={showCheckoutModal} onOpenChange={setShowCheckoutModal}>
        <DialogContent className={`${isRTL ? 'rtl' : ''}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              {isRTL ? 'إتمام عملية البيع' : 'Complete Sale'}
            </DialogTitle>
            <DialogDescription>
              {isRTL ? 'أدخل معلومات الزبون وطريقة الدفع' : 'Enter customer info and payment method'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{isRTL ? 'اسم الزبون' : 'Customer Name'}</Label>
                <div className="relative">
                  <User className={`absolute top-2.5 ${isRTL ? 'right-3' : 'left-3'} w-4 h-4 text-muted-foreground`} />
                  <Input
                    placeholder={isRTL ? "اختياري" : "Optional"}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={`${isRTL ? 'pr-9' : 'pl-9'}`}
                    data-testid="input-customer-name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'رقم الهاتف' : 'Phone'}</Label>
                <div className="relative">
                  <Phone className={`absolute top-2.5 ${isRTL ? 'right-3' : 'left-3'} w-4 h-4 text-muted-foreground`} />
                  <Input
                    placeholder={isRTL ? "اختياري" : "Optional"}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className={`${isRTL ? 'pr-9' : 'pl-9'}`}
                    data-testid="input-customer-phone"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{isRTL ? 'طريقة الدفع' : 'Payment Method'}</Label>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  type="button"
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  className="gap-2"
                  onClick={() => setPaymentMethod('cash')}
                  data-testid="button-payment-cash"
                >
                  <Banknote className="w-4 h-4" />
                  {isRTL ? 'نقدي' : 'Cash'}
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  className="gap-2"
                  onClick={() => setPaymentMethod('card')}
                  data-testid="button-payment-card"
                >
                  <CreditCard className="w-4 h-4" />
                  {isRTL ? 'بطاقة' : 'Card'}
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'zain' ? 'default' : 'outline'}
                  className="gap-2"
                  onClick={() => setPaymentMethod('zain')}
                  data-testid="button-payment-zain"
                >
                  <DollarSign className="w-4 h-4" />
                  ZainCash
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'deferred' ? 'default' : 'outline'}
                  className="gap-2"
                  onClick={() => setPaymentMethod('deferred')}
                  data-testid="button-payment-deferred"
                >
                  <Clock className="w-4 h-4" />
                  {isRTL ? 'أجل' : 'Deferred'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
              <Textarea
                placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                data-testid="input-notes"
              />
            </div>

            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>{isRTL ? 'عدد الأصناف' : 'Items'}</span>
                <span data-testid="text-checkout-items-count">{cart.reduce((sum, i) => sum + i.quantity, 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>
                    {isRTL ? 'الخصم' : 'Discount'}
                    {discountType === 'percentage' ? ` (${discount}%)` : ''}
                  </span>
                  <span>-{formatPrice(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
                <span>{isRTL ? 'الإجمالي' : 'Total'}</span>
                <span className="text-primary">{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCheckoutModal(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              onClick={confirmSale} 
              disabled={createSaleMutation.isPending}
              className="gap-2"
              data-testid="button-confirm-sale"
            >
              {createSaleMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {isRTL ? 'تأكيد البيع' : 'Confirm Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
        <DialogContent className={`${isRTL ? 'rtl' : ''} max-w-md max-h-[90vh] overflow-y-auto`}>
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              {isRTL ? 'تمت عملية البيع بنجاح!' : 'Sale Completed!'}
            </DialogTitle>
          </DialogHeader>

          {lastSaleData && (
            <div id="receipt-content" className="bg-white text-black p-4 rounded-lg border print:border-0 print:p-0">
              <div className="text-center border-b-2 border-dashed border-gray-300 pb-3 mb-3">
                <h2 className="font-bold text-lg">العين لتجارة الحاسبات</h2>
                <p className="text-xs text-gray-600">AEEN COMPUTER TRADING</p>
                <p className="text-xs text-gray-500 mt-1">بغداد - العراق</p>
              </div>

              <div className="flex justify-between items-start mb-3 text-sm">
                <div>
                  <p className="font-semibold">{isRTL ? 'رقم الوصل:' : 'Receipt #:'}</p>
                  <p className="font-mono text-xs" data-testid="text-receipt-number">{lastSaleData.saleNumber}</p>
                </div>
                <div className="text-left">
                  <QRCodeSVG 
                    value={`SALE:${lastSaleData.saleNumber}|DATE:${lastSaleData.saleDate.toISOString()}|TOTAL:${lastSaleData.total}`}
                    size={60}
                    level="M"
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded p-2 mb-3 text-xs">
                <div className="flex justify-between">
                  <span>{isRTL ? 'تاريخ البيع:' : 'Sale Date:'}</span>
                  <span className="font-semibold">
                    {lastSaleData.saleDate.toLocaleDateString('ar-IQ', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{isRTL ? 'الوقت:' : 'Time:'}</span>
                  <span>
                    {lastSaleData.saleDate.toLocaleTimeString('ar-IQ', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>

              {(lastSaleData.customerName || lastSaleData.customerPhone) && (
                <div className="border-t border-gray-200 pt-2 mb-3 text-xs">
                  {lastSaleData.customerName && (
                    <div className="flex justify-between">
                      <span>{isRTL ? 'الزبون:' : 'Customer:'}</span>
                      <span>{lastSaleData.customerName}</span>
                    </div>
                  )}
                  {lastSaleData.customerPhone && (
                    <div className="flex justify-between">
                      <span>{isRTL ? 'الهاتف:' : 'Phone:'}</span>
                      <span dir="ltr">{lastSaleData.customerPhone}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-b border-gray-300 py-2 mb-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-start pb-1">{isRTL ? 'المنتج' : 'Product'}</th>
                      <th className="text-center pb-1">{isRTL ? 'الكمية' : 'Qty'}</th>
                      <th className="text-end pb-1">{isRTL ? 'السعر' : 'Price'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastSaleData.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100" data-testid={`receipt-item-${idx}`}>
                        <td className="py-1">
                          <div className="flex items-center gap-1">
                            {item.productType === 'battery' ? (
                              <Battery className="w-3 h-3 text-gray-400" />
                            ) : item.productType === 'adapter' ? (
                              <Plug className="w-3 h-3 text-gray-400" />
                            ) : item.productType === 'keyboard' ? (
                              <Keyboard className="w-3 h-3 text-gray-400" />
                            ) : (
                              <Monitor className="w-3 h-3 text-gray-400" />
                            )}
                            <div>
                              <div className="font-medium">
                                {item.productType === 'battery' && item.battery
                                  ? item.battery.brand
                                  : item.productType === 'adapter' && item.adapter
                                  ? `${item.adapter.brand}${item.adapter.wattage ? ` ${item.adapter.wattage}W` : ''}`
                                  : item.productType === 'keyboard' && item.keyboard
                                  ? item.keyboard.brand
                                  : item.productType === 'lcd' && item.lcd
                                  ? `${item.lcd.brand}${item.lcd.sizeInch ? ` ${item.lcd.sizeInch}"` : ''}`
                                  : ''
                                }
                              </div>
                              <div className="text-gray-500 text-[10px]">
                                {item.productType === 'battery' && item.battery
                                  ? item.battery.serialNumber
                                  : item.productType === 'adapter' && item.adapter
                                  ? item.adapter.serialNumber
                                  : item.productType === 'keyboard' && item.keyboard
                                  ? item.keyboard.serialNumber
                                  : item.productType === 'lcd' && item.lcd
                                  ? item.lcd.serialNumber
                                  : ''
                                }
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-end">{formatPrice(item.unitPrice * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 text-sm mb-3">
                <div className="flex justify-between">
                  <span>{isRTL ? 'المجموع:' : 'Subtotal:'}</span>
                  <span>{formatPrice(lastSaleData.subtotal)}</span>
                </div>
                {lastSaleData.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>
                      {isRTL ? 'الخصم' : 'Discount'}
                      {lastSaleData.discountType === 'percentage' ? ` (${lastSaleData.discount}%)` : ''}:
                    </span>
                    <span>-{formatPrice(lastSaleData.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2">
                  <span>{isRTL ? 'الإجمالي:' : 'Total:'}</span>
                  <span data-testid="text-receipt-total">{formatPrice(lastSaleData.total)}</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded p-2 mb-3 text-xs text-center">
                <span className="text-gray-600">{isRTL ? 'طريقة الدفع:' : 'Payment:'} </span>
                <span className="font-semibold">
                  {lastSaleData.paymentMethod === 'cash' ? (isRTL ? 'نقدي' : 'Cash') :
                   lastSaleData.paymentMethod === 'card' ? (isRTL ? 'بطاقة' : 'Card') :
                   lastSaleData.paymentMethod === 'deferred' ? (isRTL ? 'أجل - غير مدفوع' : 'Deferred - Unpaid') :
                   (isRTL ? 'زين كاش' : 'ZainCash')}
                </span>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Battery className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-amber-800 text-sm">
                    {isRTL ? 'ضمان شهر واحد' : '1 Month Warranty'}
                  </span>
                </div>
                <p className="text-xs text-amber-700">
                  {isRTL ? 'جميع المنتجات تشمل ضمان لمدة شهر واحد من تاريخ الشراء' : 
                   'All products include 1 month warranty from purchase date'}
                </p>
                <div className="mt-2 pt-2 border-t border-amber-200 text-xs">
                  <div className="flex justify-between text-amber-800">
                    <span>{isRTL ? 'تاريخ الشراء:' : 'Purchase Date:'}</span>
                    <span className="font-semibold">
                      {lastSaleData.saleDate.toLocaleDateString('ar-IQ')}
                    </span>
                  </div>
                  <div className="flex justify-between text-amber-800">
                    <span>{isRTL ? 'انتهاء الضمان:' : 'Warranty Until:'}</span>
                    <span className="font-semibold">
                      {lastSaleData.warrantyEndDate.toLocaleDateString('ar-IQ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-center mt-3 pt-3 border-t border-dashed border-gray-300">
                <p className="text-xs text-gray-500">
                  {isRTL ? 'شكراً لتسوقكم معنا' : 'Thank you for your purchase'}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {isRTL ? 'يرجى الاحتفاظ بالوصل لغرض الضمان' : 'Please keep this receipt for warranty purposes'}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3 print:hidden pt-2">
            <Button variant="outline" className="gap-2" onClick={resetAfterSale} data-testid="button-new-sale">
              {isRTL ? 'عملية جديدة' : 'New Sale'}
            </Button>
            <Button 
              className="gap-2" 
              onClick={handlePrintReceipt}
              data-testid="button-print-receipt"
              type="button"
            >
              <Printer className="w-4 h-4" />
              {isRTL ? 'طباعة الوصل' : 'Print Receipt'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
