import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Package
} from "lucide-react";
import type { Product } from "@shared/schema";

interface SalesUser {
  id: string;
  permissions: {
    canPos: number;
    canApplyDiscount: number;
  };
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface SalesPOSProps {
  user: SalesUser;
}

export default function SalesPOS({ user }: SalesPOSProps) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount, setDiscount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const res = await apiRequest('POST', '/api/sales/pos', orderData);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: language === 'ar' ? 'تم إنشاء الطلب بنجاح' : 'Order created successfully',
      });
      setLastOrder(data.order);
      setShowReceipt(true);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setDiscount("0");
      setDiscountReason("");
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
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
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           sku.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const addToCart = (product: Product) => {
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

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => 
    sum + parseFloat(item.product.price) * item.quantity, 0
  );
  const discountAmount = parseFloat(discount) || 0;
  const total = subtotal - discountAmount;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ar-IQ').format(price);
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
      discount: discount,
      discountReason,
    };

    createOrderMutation.mutate(orderData);
  };

  const printReceipt = () => {
    window.print();
  };

  if (!user.permissions.canPos) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">
          {language === 'ar' ? 'ليس لديك صلاحية الوصول لنقطة البيع' : 'You do not have access to POS'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'ar' ? 'البحث عن منتج...' : 'Search products...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
                data-testid="input-pos-search"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="p-3 border rounded-lg hover:bg-muted/50 transition-colors text-start"
                    disabled={(product.stockQuantity || 0) <= 0}
                    data-testid={`product-card-${product.id}`}
                  >
                    {product.image && (
                      <img 
                        src={product.image} 
                        alt={product.nameAr}
                        className="w-full h-20 object-cover rounded mb-2"
                      />
                    )}
                    <div className="text-sm font-medium line-clamp-2">
                      {language === 'ar' ? product.nameAr : (product.nameEn || product.nameAr)}
                    </div>
                    <div className="text-sm text-primary font-bold mt-1">
                      {formatPrice(parseFloat(product.price))} IQD
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Package className="h-3 w-3" />
                      {product.stockQuantity || 0}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {language === 'ar' ? 'السلة' : 'Cart'}
              {cart.length > 0 && (
                <span className="text-sm bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  {cart.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {language === 'ar' ? 'السلة فارغة' : 'Cart is empty'}
              </p>
            ) : (
              <>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {language === 'ar' ? item.product.nameAr : (item.product.nameEn || item.product.nameAr)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatPrice(parseFloat(item.product.price))} × {item.quantity}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6"
                          onClick={() => updateQuantity(item.product.id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6"
                          onClick={() => updateQuantity(item.product.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive"
                          onClick={() => removeFromCart(item.product.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-3 border-t">
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'اسم العميل' : 'Customer Name'}</Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={language === 'ar' ? 'اختياري' : 'Optional'}
                      data-testid="input-customer-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'رقم الهاتف' : 'Phone'}</Label>
                    <Input
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder={language === 'ar' ? 'اختياري' : 'Optional'}
                      data-testid="input-customer-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger data-testid="select-payment-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">
                          <span className="flex items-center gap-2">
                            <Banknote className="h-4 w-4" />
                            {language === 'ar' ? 'نقداً' : 'Cash'}
                          </span>
                        </SelectItem>
                        <SelectItem value="card">
                          <span className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            {language === 'ar' ? 'بطاقة' : 'Card'}
                          </span>
                        </SelectItem>
                        <SelectItem value="zaincash">ZainCash</SelectItem>
                        <SelectItem value="qicard">QiCard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {user.permissions.canApplyDiscount ? (
                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'الخصم (IQD)' : 'Discount (IQD)'}</Label>
                      <Input
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        min="0"
                        data-testid="input-discount"
                      />
                      {parseFloat(discount) > 0 && (
                        <Input
                          value={discountReason}
                          onChange={(e) => setDiscountReason(e.target.value)}
                          placeholder={language === 'ar' ? 'سبب الخصم' : 'Discount reason'}
                          data-testid="input-discount-reason"
                        />
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 pt-3 border-t">
                  <div className="flex justify-between text-sm">
                    <span>{language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
                    <span>{formatPrice(subtotal)} IQD</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>{language === 'ar' ? 'الخصم' : 'Discount'}</span>
                      <span>-{formatPrice(discountAmount)} IQD</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold">
                    <span>{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
                    <span className="text-primary">{formatPrice(total)} IQD</span>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleCheckout}
                  disabled={createOrderMutation.isPending}
                  data-testid="button-checkout"
                >
                  {createOrderMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 me-2" />
                      {language === 'ar' ? 'إتمام البيع' : 'Complete Sale'}
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md print:shadow-none">
          <DialogHeader>
            <DialogTitle className="text-center">
              {language === 'ar' ? 'إيصال البيع' : 'Sales Receipt'}
            </DialogTitle>
          </DialogHeader>
          {lastOrder && (
            <div className="space-y-4 text-sm" dir="rtl">
              <div className="text-center border-b pb-3">
                <h3 className="font-bold text-lg">العين لتجارة الحاسبات</h3>
                <p className="text-muted-foreground">رقم الطلب: {lastOrder.orderNumber}</p>
                <p className="text-muted-foreground">
                  {new Date(lastOrder.createdAt).toLocaleString('ar-IQ')}
                </p>
              </div>
              
              <div className="space-y-2">
                {lastOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.nameAr} × {item.quantity}</span>
                    <span>{formatPrice(parseFloat(item.price) * item.quantity)} IQD</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between">
                  <span>المجموع الفرعي</span>
                  <span>{formatPrice(parseFloat(lastOrder.subtotal))} IQD</span>
                </div>
                {lastOrder.discount && parseFloat(lastOrder.discount) > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>الخصم</span>
                    <span>-{formatPrice(parseFloat(lastOrder.discount))} IQD</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg">
                  <span>الإجمالي</span>
                  <span>{formatPrice(parseFloat(lastOrder.total))} IQD</span>
                </div>
              </div>

              <div className="text-center text-muted-foreground border-t pt-3">
                <p>شكراً لتسوقكم معنا</p>
              </div>
            </div>
          )}
          <div className="flex gap-2 print:hidden">
            <Button onClick={printReceipt} className="flex-1">
              <Printer className="h-4 w-4 me-2" />
              {language === 'ar' ? 'طباعة' : 'Print'}
            </Button>
            <Button variant="outline" onClick={() => setShowReceipt(false)} className="flex-1">
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
