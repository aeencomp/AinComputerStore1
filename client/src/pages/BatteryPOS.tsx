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
  ChevronLeft
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { LaptopBattery } from "@shared/schema";

interface SaleData {
  saleNumber: string;
  saleDate: Date;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
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

interface CartItem {
  battery: LaptopBattery;
  quantity: number;
  priceType: 'purchase' | 'wholesale' | 'selling';
  unitPrice: number;
}

function formatPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return num.toLocaleString('ar-IQ') + ' د.ع';
}

export default function BatteryPOS() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
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

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<LaptopBattery[]>({
    queryKey: ['/api/battery/batteries/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(`/api/battery/batteries/search?q=${encodeURIComponent(searchQuery)}&type=all`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: !!currentUser && searchQuery.length > 0,
  });

  const createSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      return await apiRequest('POST', '/api/battery/pos/sales', saleData);
    },
    onSuccess: (data: any) => {
      const saleDate = new Date();
      const warrantyEndDate = new Date(saleDate);
      warrantyEndDate.setMonth(warrantyEndDate.getMonth() + 1);
      
      const discountAmount = subtotal * (discount / 100);
      setLastSaleData({
        saleNumber: data.saleNumber,
        saleDate,
        customerName,
        customerPhone,
        items: [...cart],
        subtotal,
        discount,
        discountAmount,
        total: subtotal - discountAmount,
        paymentMethod,
        warrantyEndDate,
      });
      setShowCheckoutModal(false);
      setShowReceiptModal(true);
      queryClient.invalidateQueries({ queryKey: ['/api/battery/batteries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/battery/batteries/low-stock'] });
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

  const addToCart = (battery: LaptopBattery, priceType: 'purchase' | 'wholesale' | 'selling' = 'selling') => {
    if (battery.stockQuantity <= 0) {
      toast({
        title: isRTL ? "لا يوجد مخزون" : "Out of Stock",
        description: isRTL ? "هذه البطارية غير متوفرة" : "This battery is not available",
        variant: "destructive",
      });
      return;
    }

    const existingIndex = cart.findIndex(item => item.battery.id === battery.id && item.priceType === priceType);
    
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
        battery,
        quantity: 1,
        priceType,
        unitPrice: price,
      }]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    const newQty = item.quantity + delta;
    
    if (newQty <= 0) {
      newCart.splice(index, 1);
    } else if (newQty > item.battery.stockQuantity) {
      toast({
        title: isRTL ? "الحد الأقصى" : "Maximum Reached",
        description: isRTL ? `الكمية المتاحة: ${item.battery.stockQuantity}` : `Available quantity: ${item.battery.stockQuantity}`,
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
    const battery = item.battery;
    
    const price = priceType === 'purchase' 
      ? parseFloat(battery.purchasePrice || '0')
      : priceType === 'wholesale'
      ? parseFloat(battery.wholesalePrice || '0')
      : parseFloat(battery.sellingPrice || '0');
    
    newCart[index].priceType = priceType;
    newCart[index].unitPrice = price;
    setCart(newCart);
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: isRTL ? "السلة فارغة" : "Cart Empty",
        description: isRTL ? "أضف بطاريات للسلة أولاً" : "Add batteries to cart first",
        variant: "destructive",
      });
      return;
    }
    setShowCheckoutModal(true);
  };

  const confirmSale = () => {
    const saleData = {
      customerName: customerName || (isRTL ? 'زبون متجر' : 'Walk-in Customer'),
      customerPhone,
      items: cart.map(item => ({
        batteryId: item.battery.id,
        batteryName: `${item.battery.brand} ${item.battery.serialNumber}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        priceType: item.priceType,
        totalPrice: item.unitPrice * item.quantity,
      })),
      subtotal,
      discount: discountAmount,
      total,
      paymentMethod,
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
    console.log("Print receipt clicked", lastSaleData);
    if (!lastSaleData) {
      console.log("No lastSaleData");
      return;
    }
    
    const formatPriceForPrint = (price: number) => price.toLocaleString('ar-IQ') + ' د.ع';
    
    const itemsHtml = lastSaleData.items.map(item => `
      <tr>
        <td style="padding: 4px 2px; border-bottom: 1px solid #ddd;">
          <div style="font-weight: 500;">${item.battery.brand}</div>
          <div style="font-size: 9px; color: #666;">${item.battery.serialNumber}</div>
        </td>
        <td style="padding: 4px 2px; text-align: center; border-bottom: 1px solid #ddd;">${item.quantity}</td>
        <td style="padding: 4px 2px; text-align: left; border-bottom: 1px solid #ddd;">${formatPriceForPrint(item.unitPrice * item.quantity)}</td>
      </tr>
    `).join('');
    
    const receiptHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>وصل - ${lastSaleData.saleNumber}</title>
<style>
@media print {
  @page { size: 80mm auto; margin: 2mm; }
  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
  font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
  font-size: 11px; 
  line-height: 1.4;
  width: 80mm; 
  max-width: 80mm;
  padding: 8px;
  background: #fff;
  color: #000;
  direction: rtl;
}
.receipt-container { width: 100%; }
.header { text-align: center; border-bottom: 2px dashed #999; padding-bottom: 10px; margin-bottom: 10px; }
.header h2 { font-size: 16px; margin-bottom: 4px; font-weight: bold; }
.header p { font-size: 10px; color: #444; margin: 2px 0; }
.info-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.sale-info p { margin: 2px 0; }
.sale-number { font-family: monospace; font-size: 11px; font-weight: bold; }
.qr-box { width: 55px; height: 55px; border: 1px solid #999; display: flex; align-items: center; justify-content: center; font-size: 7px; text-align: center; background: #f9f9f9; }
.date-section { background: #f0f0f0; padding: 8px; margin-bottom: 10px; font-size: 10px; }
.date-row { display: flex; justify-content: space-between; margin: 2px 0; }
.customer-section { border-top: 1px solid #ddd; padding-top: 8px; margin-bottom: 10px; font-size: 10px; }
.items-section { border-top: 1px solid #999; border-bottom: 1px solid #999; padding: 8px 0; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 10px; }
th { text-align: right; padding: 4px 2px; border-bottom: 2px solid #999; font-weight: bold; }
th:nth-child(2) { text-align: center; }
th:nth-child(3) { text-align: left; }
.totals-section { margin-bottom: 10px; font-size: 11px; }
.total-row { display: flex; justify-content: space-between; padding: 3px 0; }
.total-final { font-weight: bold; font-size: 14px; border-top: 2px solid #999; padding-top: 8px; margin-top: 4px; }
.payment-section { background: #f0f0f0; padding: 8px; text-align: center; margin-bottom: 10px; font-size: 11px; }
.warranty-section { background: #fff8e1; border: 2px solid #ffc107; padding: 10px; text-align: center; margin-bottom: 10px; }
.warranty-title { font-weight: bold; color: #795548; font-size: 13px; margin-bottom: 6px; }
.warranty-text { font-size: 9px; color: #6d4c41; margin-bottom: 8px; }
.warranty-dates { border-top: 1px solid #ffc107; padding-top: 8px; font-size: 10px; }
.warranty-date-row { display: flex; justify-content: space-between; color: #795548; margin: 3px 0; }
.footer { text-align: center; border-top: 2px dashed #999; padding-top: 10px; }
.footer p { font-size: 10px; color: #444; margin: 3px 0; }
.print-btn { display: block; width: 100%; padding: 12px; margin-top: 15px; background: #4CAF50; color: white; border: none; font-size: 14px; cursor: pointer; font-weight: bold; }
.print-btn:hover { background: #45a049; }
@media print { .print-btn { display: none !important; } }
</style>
</head>
<body>
<div class="receipt-container">
  <div class="header">
    <h2>العين لتجارة الحاسبات</h2>
    <p>Al-Ain Computer Trading</p>
    <p>بغداد - العراق</p>
  </div>
  
  <div class="info-section">
    <div class="sale-info">
      <p style="font-weight: bold;">رقم الوصل:</p>
      <p class="sale-number">${lastSaleData.saleNumber}</p>
    </div>
    <div class="qr-box">
      <span>QR<br>${lastSaleData.saleNumber.slice(-6)}</span>
    </div>
  </div>
  
  <div class="date-section">
    <div class="date-row">
      <span>تاريخ البيع:</span>
      <span style="font-weight: bold;">${lastSaleData.saleDate.toLocaleDateString('ar-IQ')}</span>
    </div>
    <div class="date-row">
      <span>الوقت:</span>
      <span>${lastSaleData.saleDate.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  </div>
  
  ${lastSaleData.customerName || lastSaleData.customerPhone ? `
  <div class="customer-section">
    ${lastSaleData.customerName ? `<div class="date-row"><span>الزبون:</span><span>${lastSaleData.customerName}</span></div>` : ''}
    ${lastSaleData.customerPhone ? `<div class="date-row"><span>الهاتف:</span><span dir="ltr">${lastSaleData.customerPhone}</span></div>` : ''}
  </div>
  ` : ''}
  
  <div class="items-section">
    <table>
      <thead>
        <tr>
          <th>المنتج</th>
          <th>الكمية</th>
          <th>السعر</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
  </div>
  
  <div class="totals-section">
    <div class="total-row">
      <span>المجموع:</span>
      <span>${formatPriceForPrint(lastSaleData.subtotal)}</span>
    </div>
    ${lastSaleData.discount > 0 ? `
    <div class="total-row" style="color: green;">
      <span>الخصم (${lastSaleData.discount}%):</span>
      <span>-${formatPriceForPrint(lastSaleData.discountAmount)}</span>
    </div>
    ` : ''}
    <div class="total-row total-final">
      <span>الإجمالي:</span>
      <span>${formatPriceForPrint(lastSaleData.total)}</span>
    </div>
  </div>
  
  <div class="payment-section">
    <span>طريقة الدفع: </span>
    <span style="font-weight: bold;">
      ${lastSaleData.paymentMethod === 'cash' ? 'نقدي' : lastSaleData.paymentMethod === 'card' ? 'بطاقة' : 'زين كاش'}
    </span>
  </div>
  
  <div class="warranty-section">
    <div class="warranty-title">ضمان شهر واحد</div>
    <p class="warranty-text">جميع البطاريات تشمل ضمان لمدة شهر واحد من تاريخ الشراء</p>
    <div class="warranty-dates">
      <div class="warranty-date-row">
        <span>تاريخ الشراء:</span>
        <span style="font-weight: bold;">${lastSaleData.saleDate.toLocaleDateString('ar-IQ')}</span>
      </div>
      <div class="warranty-date-row">
        <span>انتهاء الضمان:</span>
        <span style="font-weight: bold;">${lastSaleData.warrantyEndDate.toLocaleDateString('ar-IQ')}</span>
      </div>
    </div>
  </div>
  
  <div class="footer">
    <p>شكراً لتسوقكم معنا</p>
    <p style="font-size: 8px;">يرجى الاحتفاظ بالوصل لغرض الضمان</p>
  </div>
  
  <button class="print-btn" onclick="window.print()">طباعة الوصل</button>
</div>
</body>
</html>`;
    
    // Try multiple methods
    console.log("Attempting to open receipt...");
    
    // Method 1: Try window.open directly
    try {
      const newWindow = window.open('about:blank', '_blank');
      if (newWindow) {
        console.log("Window opened successfully");
        newWindow.document.write(receiptHtml);
        newWindow.document.close();
        newWindow.focus();
        return;
      }
    } catch (e) {
      console.log("Method 1 failed:", e);
    }
    
    // Method 2: Download as HTML file
    console.log("Falling back to download method");
    const blob = new Blob([receiptHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${lastSaleData.saleNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
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
                <p className="text-xs text-muted-foreground">{isRTL ? 'مبيعات البطاريات' : 'Battery Sales'}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  {isRTL ? 'البحث عن البطاريات' : 'Search Batteries'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} w-4 h-4 text-muted-foreground`} />
                  <Input
                    placeholder={isRTL ? "ابحث بالرقم التسلسلي أو الموديل..." : "Search by serial or model..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`${isRTL ? 'pr-10' : 'pl-10'}`}
                    data-testid="input-search-battery"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {isRTL ? 'البطاريات المتاحة' : 'Available Batteries'}
                  <Badge variant="secondary" className="ms-auto">{displayBatteries.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {batteriesLoading || searchLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : displayBatteries.length === 0 ? (
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
                        onClick={() => addToCart(battery)}
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
                    <p className="text-xs mt-1">{isRTL ? 'اضغط على بطارية لإضافتها' : 'Click a battery to add it'}</p>
                  </div>
                ) : (
                  <div className="divide-y max-h-[40vh] overflow-y-auto">
                    {cart.map((item, index) => (
                      <div key={`${item.battery.id}-${item.priceType}`} className="p-3">
                        <div className="flex items-start gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.battery.brand}</p>
                            <p className="text-xs text-muted-foreground">{item.battery.serialNumber}</p>
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
                            <SelectTrigger className="h-7 text-xs flex-1">
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
                            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
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
                          <span className="font-bold">{formatPrice(item.unitPrice * item.quantity)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {cart.length > 0 && (
                  <div className="border-t p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        placeholder={isRTL ? "خصم %" : "Discount %"}
                        value={discount || ''}
                        onChange={(e) => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                        className="h-8"
                        data-testid="input-discount"
                      />
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</span>
                        <span>{formatPrice(subtotal)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>{isRTL ? 'الخصم' : 'Discount'} ({discount}%)</span>
                          <span>-{formatPrice(discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg pt-2 border-t">
                        <span>{isRTL ? 'الإجمالي' : 'Total'}</span>
                        <span className="text-primary">{formatPrice(total)}</span>
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
              <div className="grid grid-cols-3 gap-2">
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
                <span>{cart.reduce((sum, i) => sum + i.quantity, 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>{isRTL ? 'الخصم' : 'Discount'} ({discount}%)</span>
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

      {/* Receipt Modal with Print Support */}
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
              {/* Store Header */}
              <div className="text-center border-b-2 border-dashed border-gray-300 pb-3 mb-3">
                <h2 className="font-bold text-lg">العين لتجارة الحاسبات</h2>
                <p className="text-xs text-gray-600">Al-Ain Computer Trading</p>
                <p className="text-xs text-gray-500 mt-1">بغداد - العراق</p>
              </div>

              {/* Receipt Info */}
              <div className="flex justify-between items-start mb-3 text-sm">
                <div>
                  <p className="font-semibold">{isRTL ? 'رقم الوصل:' : 'Receipt #:'}</p>
                  <p className="font-mono text-xs">{lastSaleData.saleNumber}</p>
                </div>
                <div className="text-left">
                  <QRCodeSVG 
                    value={`SALE:${lastSaleData.saleNumber}|DATE:${lastSaleData.saleDate.toISOString()}|TOTAL:${lastSaleData.total}`}
                    size={60}
                    level="M"
                  />
                </div>
              </div>

              {/* Date/Time */}
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

              {/* Customer Info */}
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

              {/* Items */}
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
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-1">
                          <div className="font-medium">{item.battery.brand}</div>
                          <div className="text-gray-500 text-[10px]">{item.battery.serialNumber}</div>
                        </td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-end">{formatPrice(item.unitPrice * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm mb-3">
                <div className="flex justify-between">
                  <span>{isRTL ? 'المجموع:' : 'Subtotal:'}</span>
                  <span>{formatPrice(lastSaleData.subtotal)}</span>
                </div>
                {lastSaleData.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{isRTL ? 'الخصم' : 'Discount'} ({lastSaleData.discount}%):</span>
                    <span>-{formatPrice(lastSaleData.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2">
                  <span>{isRTL ? 'الإجمالي:' : 'Total:'}</span>
                  <span>{formatPrice(lastSaleData.total)}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-gray-50 rounded p-2 mb-3 text-xs text-center">
                <span className="text-gray-600">{isRTL ? 'طريقة الدفع:' : 'Payment:'} </span>
                <span className="font-semibold">
                  {lastSaleData.paymentMethod === 'cash' ? (isRTL ? 'نقدي' : 'Cash') :
                   lastSaleData.paymentMethod === 'card' ? (isRTL ? 'بطاقة' : 'Card') :
                   (isRTL ? 'زين كاش' : 'ZainCash')}
                </span>
              </div>

              {/* Warranty Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Battery className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-amber-800 text-sm">
                    {isRTL ? 'ضمان شهر واحد' : '1 Month Warranty'}
                  </span>
                </div>
                <p className="text-xs text-amber-700">
                  {isRTL ? 'جميع البطاريات تشمل ضمان لمدة شهر واحد من تاريخ الشراء' : 
                   'All batteries include 1 month warranty from purchase date'}
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

              {/* Footer */}
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
            <Button className="gap-2" onClick={handlePrintReceipt} data-testid="button-print-receipt">
              <Printer className="w-4 h-4" />
              {isRTL ? 'طباعة الوصل' : 'Print Receipt'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
