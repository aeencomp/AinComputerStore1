import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { 
  Loader2, 
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  User,
  CreditCard,
  Banknote,
  Percent,
  Receipt,
  X,
  Printer
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AdminNav } from "@/components/AdminNav";
import type { Product } from "@shared/schema";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface CartItemPOS {
  product: Product;
  quantity: number;
}

interface CompletedOrder {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  items: CartItemPOS[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  createdAt: Date;
}

export default function AdminPOS() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItemPOS[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);
  
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    email: "",
  });
  
  const [paymentInfo, setPaymentInfo] = useState({
    method: "cash",
    discount: "0",
    discountReason: "",
    notes: "",
  });

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

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['/api/admin/inventory'],
    enabled: !!currentAdmin,
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await apiRequest('POST', '/api/admin/pos/order', orderData);
      return response.json();
    },
    onSuccess: (data) => {
      setCompletedOrder({
        orderNumber: data.orderNumber,
        customerName: customerInfo.name || (language === 'ar' ? 'زبون متجر' : 'Walk-in Customer'),
        customerPhone: customerInfo.phone || '-',
        items: [...cart],
        subtotal: subtotal,
        discount: parseFloat(paymentInfo.discount) || 0,
        total: total,
        paymentMethod: paymentInfo.method,
        createdAt: new Date(),
      });
      setShowCheckout(false);
      setShowReceipt(true);
      setCart([]);
      setCustomerInfo({ name: "", phone: "", email: "" });
      setPaymentInfo({ method: "cash", discount: "0", discountReason: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: language === 'ar' ? "تم البيع بنجاح" : "Sale Completed",
        description: language === 'ar' ? `رقم الطلب: ${data.orderNumber}` : `Order #${data.orderNumber}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: error.message || (language === 'ar' ? "فشل في إتمام البيع" : "Failed to complete sale"),
        variant: "destructive",
      });
    },
  });

  const filteredProducts = products.filter(product => {
    if (!searchQuery) return true;
    const name = language === 'ar' ? product.nameAr : product.nameEn;
    const sku = (product as any).sku || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           sku.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const addToCart = (product: Product) => {
    const stockQty = (product as any).stockQuantity || 0;
    
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
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const subtotal = cart.reduce((sum, item) => 
    sum + (parseFloat(item.product.price) * item.quantity), 0
  );
  
  const discount = parseFloat(paymentInfo.discount) || 0;
  const total = Math.max(0, subtotal - discount);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ar-IQ').format(price);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: language === 'ar' ? "السلة فارغة" : "Cart Empty",
        description: language === 'ar' ? "أضف منتجات للسلة أولاً" : "Add products to cart first",
        variant: "destructive",
      });
      return;
    }
    setShowCheckout(true);
  };

  const handleCompleteOrder = () => {
    const orderData = {
      customerName: customerInfo.name || (language === 'ar' ? 'زبون متجر' : 'Walk-in Customer'),
      customerEmail: customerInfo.email || 'walkin@store.local',
      customerPhone: customerInfo.phone || '0000000000',
      customerAddress: language === 'ar' ? 'متجر' : 'In-Store',
      customerCity: language === 'ar' ? 'بغداد' : 'Baghdad',
      customerPostal: '-',
      items: cart.map(item => ({
        productId: item.product.id,
        name: language === 'ar' ? item.product.nameAr : item.product.nameEn,
        price: item.product.price,
        quantity: item.quantity,
      })),
      subtotal: subtotal.toString(),
      discount: discount.toString(),
      discountReason: paymentInfo.discountReason,
      total: total.toString(),
      shipping: "0",
      paymentMethod: paymentInfo.method,
      paymentStatus: "success",
      orderType: "walk-in",
      notes: paymentInfo.notes,
      salespersonId: currentAdmin?.id,
    };

    createOrderMutation.mutate(orderData);
  };

  const handlePrintReceipt = () => {
    window.print();
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

      <main className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-120px)]">
          {/* Products Section */}
          <div className="lg:col-span-2 flex flex-col">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-lg">
                    {language === 'ar' ? 'المنتجات' : 'Products'}
                  </CardTitle>
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={language === 'ar' ? 'بحث بالاسم أو SKU...' : 'Search by name or SKU...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="ps-9"
                      data-testid="input-pos-search"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredProducts.map((product) => {
                      const productName = language === 'ar' ? product.nameAr : product.nameEn;
                      const stockQty = (product as any).stockQuantity || 0;
                      const isOutOfStock = stockQty === 0;
                      const imageSrc = product.image?.startsWith('/uploads/') || product.image?.startsWith('http') 
                        ? product.image 
                        : `/placeholder.png`;
                      
                      return (
                        <Card 
                          key={product.id}
                          className={`cursor-pointer hover-elevate transition-all ${isOutOfStock ? 'opacity-50' : ''}`}
                          onClick={() => !isOutOfStock && addToCart(product)}
                          data-testid={`pos-product-${product.id}`}
                        >
                          <CardContent className="p-3">
                            <div className="aspect-square bg-muted rounded-md mb-2 overflow-hidden">
                              <img 
                                src={imageSrc} 
                                alt={productName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/placeholder.png';
                                }}
                              />
                            </div>
                            <h3 className="font-medium text-sm line-clamp-2 mb-1">{productName}</h3>
                            <div className="flex items-center justify-between">
                              <span className="text-primary font-bold text-sm">
                                {formatPrice(parseFloat(product.price))}
                              </span>
                              <Badge variant={isOutOfStock ? "destructive" : "secondary"} className="text-xs">
                                {isOutOfStock ? (language === 'ar' ? 'نفد' : 'Out') : stockQty}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Cart Section */}
          <div className="flex flex-col">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    {language === 'ar' ? 'السلة' : 'Cart'}
                    {cart.length > 0 && (
                      <Badge>{cart.length}</Badge>
                    )}
                  </CardTitle>
                  {cart.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearCart}
                      data-testid="button-clear-cart"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <ShoppingCart className="w-12 h-12 mb-2 opacity-50" />
                    <p>{language === 'ar' ? 'السلة فارغة' : 'Cart is empty'}</p>
                    <p className="text-sm">{language === 'ar' ? 'اضغط على منتج لإضافته' : 'Click a product to add it'}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => {
                      const productName = language === 'ar' ? item.product.nameAr : item.product.nameEn;
                      const itemTotal = parseFloat(item.product.price) * item.quantity;
                      
                      return (
                        <div key={item.product.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg" data-testid={`cart-item-${item.product.id}`}>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{productName}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatPrice(parseFloat(item.product.price))} × {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.product.id, -1)}
                              data-testid={`button-decrease-${item.product.id}`}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.product.id, 1)}
                              data-testid={`button-increase-${item.product.id}`}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeFromCart(item.product.id)}
                              data-testid={`button-remove-${item.product.id}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="text-end min-w-[80px]">
                            <p className="font-bold">{formatPrice(itemTotal)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
              
              {cart.length > 0 && (
                <CardFooter className="flex-col border-t pt-4">
                  <div className="w-full space-y-2 mb-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>{language === 'ar' ? 'المجموع' : 'Total'}</span>
                      <span className="text-primary">{formatPrice(subtotal)} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                    </div>
                  </div>
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleCheckout}
                    data-testid="button-checkout"
                  >
                    <CreditCard className="w-5 h-5 me-2" />
                    {language === 'ar' ? 'إتمام البيع' : 'Complete Sale'}
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      </main>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'إتمام البيع' : 'Complete Sale'}</DialogTitle>
            <DialogDescription>
              {language === 'ar' ? 'أدخل معلومات الزبون وطريقة الدفع' : 'Enter customer info and payment method'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'اسم الزبون (اختياري)' : 'Customer Name (Optional)'}</Label>
              <div className="relative">
                <User className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={language === 'ar' ? 'زبون متجر' : 'Walk-in Customer'}
                  className="ps-9"
                  data-testid="input-customer-name"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'رقم الهاتف (اختياري)' : 'Phone (Optional)'}</Label>
              <Input
                value={customerInfo.phone}
                onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="07XX XXX XXXX"
                data-testid="input-customer-phone"
              />
            </div>

            <Separator />
            
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</Label>
              <Select 
                value={paymentInfo.method} 
                onValueChange={(value) => setPaymentInfo(prev => ({ ...prev, method: value }))}
              >
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4" />
                      {language === 'ar' ? 'نقدي' : 'Cash'}
                    </div>
                  </SelectItem>
                  <SelectItem value="card">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      {language === 'ar' ? 'بطاقة' : 'Card'}
                    </div>
                  </SelectItem>
                  <SelectItem value="zaincash">
                    <div className="flex items-center gap-2">
                      ZainCash
                    </div>
                  </SelectItem>
                  <SelectItem value="qicard">
                    <div className="flex items-center gap-2">
                      QiCard
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'الخصم (د.ع)' : 'Discount (IQD)'}</Label>
              <div className="relative">
                <Percent className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={paymentInfo.discount}
                  onChange={(e) => setPaymentInfo(prev => ({ ...prev, discount: e.target.value }))}
                  className="ps-9"
                  min="0"
                  data-testid="input-discount"
                />
              </div>
            </div>

            {parseFloat(paymentInfo.discount) > 0 && (
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'سبب الخصم' : 'Discount Reason'}</Label>
                <Input
                  value={paymentInfo.discountReason}
                  onChange={(e) => setPaymentInfo(prev => ({ ...prev, discountReason: e.target.value }))}
                  placeholder={language === 'ar' ? 'سبب الخصم...' : 'Reason for discount...'}
                  data-testid="input-discount-reason"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (Optional)'}</Label>
              <Textarea
                value={paymentInfo.notes}
                onChange={(e) => setPaymentInfo(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={language === 'ar' ? 'ملاحظات إضافية...' : 'Additional notes...'}
                rows={2}
                data-testid="input-notes"
              />
            </div>

            <Separator />

            <div className="bg-muted p-3 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
                <span>{formatPrice(subtotal)} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{language === 'ar' ? 'الخصم' : 'Discount'}</span>
                  <span>-{formatPrice(discount)} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
                <span className="text-primary">{formatPrice(total)} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCheckout(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleCompleteOrder}
              disabled={createOrderMutation.isPending}
              data-testid="button-complete-order"
            >
              {createOrderMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin me-2" />
              ) : (
                <Receipt className="w-4 h-4 me-2" />
              )}
              {language === 'ar' ? 'إتمام البيع' : 'Complete Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog - Enhanced for Print */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-lg print:fixed print:inset-0 print:max-w-none print:shadow-none print:border-0 print:bg-white print:z-[9999]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <style>{`
            @media print {
              body > *:not([data-radix-portal]) { display: none !important; }
              [data-radix-portal] > *:not([data-state="open"]) { display: none !important; }
              .print-hide { display: none !important; }
              .print-receipt { 
                display: block !important; 
                visibility: visible !important; 
                position: static !important;
                width: 100% !important;
                padding: 10px !important;
                background: white !important;
                color: black !important;
              }
              .print-receipt * { 
                visibility: visible !important; 
                color: black !important;
              }
              [role="dialog"] {
                position: fixed !important;
                inset: 0 !important;
                max-width: none !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
              }
            }
          `}</style>
          
          <div className="print-receipt">
            {/* Store Header */}
            <div className="text-center mb-6 border-b-2 border-dashed pb-4">
              <h2 className="text-2xl font-bold mb-1">
                {language === 'ar' ? 'العين لتجارة الحاسبات' : 'Al-Ain Computer Trading'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'بغداد - العراق' : 'Baghdad - Iraq'}
              </p>
              <p className="text-lg font-semibold mt-2 bg-muted inline-block px-4 py-1 rounded">
                {language === 'ar' ? 'إيصال بيع - في المتجر' : 'Sales Receipt - In-Store'}
              </p>
            </div>
            
            {completedOrder && (
              <div className="space-y-4">
                {/* Order Info */}
                <div className="grid grid-cols-2 gap-2 text-sm bg-muted/50 p-3 rounded">
                  <div>
                    <span className="text-muted-foreground">{language === 'ar' ? 'رقم الطلب:' : 'Order #:'}</span>
                    <p className="font-mono font-bold text-lg">{completedOrder.orderNumber}</p>
                  </div>
                  <div className="text-end">
                    <span className="text-muted-foreground">{language === 'ar' ? 'التاريخ:' : 'Date:'}</span>
                    <p className="font-medium">{completedOrder.createdAt.toLocaleString(language === 'ar' ? 'ar-IQ' : 'en-US')}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">{language === 'ar' ? 'الزبون:' : 'Customer:'}</span>
                    <p className="font-medium">{completedOrder.customerName}</p>
                    {completedOrder.customerPhone !== '-' && (
                      <p className="text-muted-foreground">{completedOrder.customerPhone}</p>
                    )}
                  </div>
                </div>
                
                <Separator />
                
                {/* Products Table */}
                <div>
                  <h3 className="font-bold mb-2 text-sm">
                    {language === 'ar' ? 'تفاصيل المنتجات' : 'Product Details'}
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2">
                        <th className="text-start py-2 font-semibold">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                        <th className="text-center py-2 font-semibold w-16">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                        <th className="text-end py-2 font-semibold w-24">{language === 'ar' ? 'السعر' : 'Price'}</th>
                        <th className="text-end py-2 font-semibold w-28">{language === 'ar' ? 'المجموع' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedOrder.items.map((item, idx) => {
                        const unitPrice = parseFloat(item.product.price);
                        const lineTotal = unitPrice * item.quantity;
                        return (
                          <tr key={idx} className="border-b">
                            <td className="py-2">
                              <div className="font-medium">
                                {language === 'ar' ? item.product.nameAr : (item.product.nameEn || item.product.nameAr)}
                              </div>
                              {item.product.sku ? (
                                <div className="text-xs text-muted-foreground print:text-gray-600">
                                  SKU: {item.product.sku}
                                </div>
                              ) : null}
                              {item.product.category ? (
                                <div className="text-xs text-muted-foreground print:text-gray-600">
                                  {language === 'ar' ? 'الفئة:' : 'Cat:'} {item.product.category}
                                </div>
                              ) : null}
                            </td>
                            <td className="py-2 text-center font-medium">{item.quantity}</td>
                            <td className="py-2 text-end">{formatPrice(unitPrice || 0)}</td>
                            <td className="py-2 text-end font-medium">{formatPrice(lineTotal || 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                <Separator />
                
                {/* Totals */}
                <div className="space-y-2 bg-muted/50 p-3 rounded">
                  <div className="flex justify-between text-sm">
                    <span>{language === 'ar' ? 'عدد المنتجات:' : 'Total Items:'}</span>
                    <span className="font-medium">{completedOrder.items.reduce((sum, i) => sum + i.quantity, 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{language === 'ar' ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                    <span className="font-medium">{formatPrice(completedOrder.subtotal)} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                  </div>
                  {completedOrder.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>{language === 'ar' ? 'الخصم:' : 'Discount:'}</span>
                      <span className="font-medium">-{formatPrice(completedOrder.discount)} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-xl pt-2">
                    <span>{language === 'ar' ? 'الإجمالي المستحق:' : 'Total Due:'}</span>
                    <span className="text-primary">{formatPrice(completedOrder.total)} {language === 'ar' ? 'د.ع' : 'IQD'}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{language === 'ar' ? 'طريقة الدفع:' : 'Payment Method:'}</span>
                    <span className="font-medium">
                      {completedOrder.paymentMethod === 'cash' 
                        ? (language === 'ar' ? 'نقداً' : 'Cash')
                        : completedOrder.paymentMethod === 'card'
                        ? (language === 'ar' ? 'بطاقة' : 'Card')
                        : completedOrder.paymentMethod
                      }
                    </span>
                  </div>
                </div>
                
                {/* Footer */}
                <div className="text-center border-t-2 border-dashed pt-4 mt-4">
                  <p className="font-semibold">{language === 'ar' ? 'شكراً لتسوقكم معنا!' : 'Thank you for shopping with us!'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'ar' ? 'يرجى الاحتفاظ بالإيصال للمراجعة' : 'Please keep this receipt for your records'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 print-hide">
            <Button variant="outline" onClick={() => setShowReceipt(false)}>
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
            <Button onClick={handlePrintReceipt} data-testid="button-print-receipt">
              <Printer className="w-4 h-4 me-2" />
              {language === 'ar' ? 'طباعة' : 'Print'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
