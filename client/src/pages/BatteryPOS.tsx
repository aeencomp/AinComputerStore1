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
import type { LaptopBattery } from "@shared/schema";

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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSaleNumber, setLastSaleNumber] = useState("");

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
      setLastSaleNumber(data.saleNumber);
      setShowCheckoutModal(false);
      setShowSuccessModal(true);
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
    setShowSuccessModal(false);
    setSearchQuery("");
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

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className={`${isRTL ? 'rtl' : ''} text-center`}>
          <div className="py-6">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto mb-4 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <DialogTitle className="text-xl mb-2">
              {isRTL ? 'تمت عملية البيع بنجاح!' : 'Sale Completed!'}
            </DialogTitle>
            <DialogDescription className="text-base">
              {isRTL ? 'رقم الفاتورة:' : 'Receipt Number:'} <span className="font-bold text-foreground">{lastSaleNumber}</span>
            </DialogDescription>
          </div>

          <div className="flex justify-center gap-3">
            <Button variant="outline" className="gap-2" onClick={resetAfterSale}>
              {isRTL ? 'عملية جديدة' : 'New Sale'}
            </Button>
            <Button className="gap-2" onClick={() => {
              resetAfterSale();
              window.print();
            }}>
              <Printer className="w-4 h-4" />
              {isRTL ? 'طباعة' : 'Print'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
