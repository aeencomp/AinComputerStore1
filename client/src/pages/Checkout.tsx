import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CartItem, StoreSettings, User } from "@shared/schema";
import { Banknote, Smartphone, CreditCard, Loader2, Tag, X, Check, Languages } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { DiscountCode } from "@shared/schema";

interface CartItemWithId extends CartItem {
  id: string;
}

// Iraqi governorates (provinces) with Arabic and English names
const iraqiGovernorates = [
  { value: "baghdad", ar: "بغداد", en: "Baghdad" },
  { value: "basra", ar: "البصرة", en: "Basra" },
  { value: "nineveh", ar: "نينوى", en: "Nineveh" },
  { value: "erbil", ar: "أربيل", en: "Erbil" },
  { value: "sulaymaniyah", ar: "السليمانية", en: "Sulaymaniyah" },
  { value: "duhok", ar: "دهوك", en: "Duhok" },
  { value: "kirkuk", ar: "كركوك", en: "Kirkuk" },
  { value: "diyala", ar: "ديالى", en: "Diyala" },
  { value: "anbar", ar: "الأنبار", en: "Anbar" },
  { value: "babylon", ar: "بابل", en: "Babylon" },
  { value: "karbala", ar: "كربلاء", en: "Karbala" },
  { value: "najaf", ar: "النجف", en: "Najaf" },
  { value: "wasit", ar: "واسط", en: "Wasit" },
  { value: "maysan", ar: "ميسان", en: "Maysan" },
  { value: "dhi_qar", ar: "ذي قار", en: "Dhi Qar" },
  { value: "muthanna", ar: "المثنى", en: "Muthanna" },
  { value: "qadisiyyah", ar: "القادسية", en: "Qadisiyyah" },
  { value: "saladin", ar: "صلاح الدين", en: "Saladin" },
];

const checkoutSchema = z.object({
  customerName: z.string().min(2, "الاسم مطلوب"),
  customerEmail: z.string().email("البريد الإلكتروني غير صحيح"),
  customerPhone: z.string().min(10, "رقم الهاتف يجب أن يكون على الأقل 10 أرقام"),
  customerAddress: z.string().min(5, "العنوان مطلوب"),
  customerCity: z.string().min(2, "المحافظة مطلوبة"),
  customerPostal: z.string().min(2, "المنطقة/الحي مطلوب"),
  paymentMethod: z.string().min(1, "طريقة الدفع مطلوبة"),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { language, setLanguage, t } = useLanguage();

  // Check authentication
  const { data: currentUser, isLoading: userLoading } = useQuery<User | null>({
    queryKey: ['/api/auth/me'],
  });

  const { data: cartItems = [], isLoading: cartLoading } = useQuery<CartItemWithId[]>({
    queryKey: ['/api/cart'],
  });

  const { data: settings } = useQuery<StoreSettings>({
    queryKey: ['/api/store-settings'],
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!userLoading && !currentUser) {
      toast({
        title: t('cart.loginRequired'),
        description: t('cart.loginRequiredDesc'),
        variant: "destructive",
      });
      setLocation('/login');
    }
  }, [currentUser, userLoading, setLocation, toast, t]);

  // Calculate shipping based on settings
  const shippingCost = settings ? parseFloat(settings.shippingCost || "5000") : 5000;
  const freeShippingThreshold = settings ? parseFloat(settings.freeShippingThreshold || "100000") : 100000;
  const enableFreeShipping = settings ? settings.enableFreeShipping === 1 : true;

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: currentUser?.name || "",
      customerEmail: currentUser?.email || "",
      customerPhone: currentUser?.phone || "",
      customerAddress: "",
      customerCity: "",
      customerPostal: "",
      paymentMethod: "cash_on_delivery",
    },
  });

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: DiscountCode;
    discountAmount: number;
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  const createOrderMutation = useMutation({
    mutationFn: async (data: CheckoutFormValues) => {
      try {
        // Product prices are stored in thousands (e.g., 340 = 340,000 IQD)
        // Multiply by 1000 to get full IQD value for calculation with shipping (which is in full IQD)
        const subtotal = cartItems.reduce(
          (sum, item) => sum + parseFloat(item.product.price) * 1000 * item.quantity,
          0
        );
        
        // Calculate shipping - free if above threshold
        const calculatedShipping = enableFreeShipping && subtotal >= freeShippingThreshold 
          ? 0 
          : shippingCost;
        
        const items = cartItems.map(item => JSON.stringify({
          productId: item.product.id,
          nameAr: item.product.nameAr,
          nameEn: item.product.nameEn,
          quantity: item.quantity,
          price: item.product.price,
        }));

        // Get the governorate display name for storage
        const selectedGovernorate = iraqiGovernorates.find(g => g.value === data.customerCity);
        const cityName = selectedGovernorate 
          ? (language === 'ar' ? selectedGovernorate.ar : selectedGovernorate.en)
          : data.customerCity;

        // Calculate discount from appliedDiscount state
        const discountAmt = appliedDiscount?.discountAmount || 0;
        const orderTotal = subtotal - discountAmt + calculatedShipping;

        const orderPayload = {
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          customerAddress: data.customerAddress,
          customerCity: cityName,
          customerPostal: data.customerPostal, // This now stores neighborhood/area
          paymentMethod: data.paymentMethod,
          items: items,
          subtotal: subtotal.toString(),
          shipping: calculatedShipping.toString(),
          discount: discountAmt.toString(),
          discountCode: appliedDiscount?.code.code || null,
          total: orderTotal.toString(),
          status: (data.paymentMethod === 'zaincash' || data.paymentMethod === 'qicard') ? 'awaiting_payment' : 'pending',
        };

        console.log("Submitting order:", orderPayload);
        const response = await apiRequest('POST', '/api/orders', orderPayload);
        const result = await response.json();
        console.log("Order created successfully:", result);
        return { order: result, paymentMethod: data.paymentMethod };
      } catch (error) {
        console.error("Error in mutationFn:", error);
        throw error;
      }
    },
    onSuccess: async ({ order, paymentMethod }: { order: any; paymentMethod: string }) => {
      console.log("Order success handler:", order, "Payment method:", paymentMethod);
      
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      
      // If Zain Cash payment, redirect to payment page
      if (paymentMethod === 'zaincash') {
        setIsProcessingPayment(true);
        try {
          const paymentResponse = await apiRequest('POST', '/api/zaincash/init', {
            orderId: order.id,
          });
          const paymentResult = await paymentResponse.json();
          
          if (paymentResult.success && paymentResult.paymentUrl) {
            toast({
              title: language === 'ar' ? 'جاري التحويل للدفع...' : 'Redirecting to payment...',
              description: language === 'ar' 
                ? 'سيتم تحويلك إلى زين كاش للدفع'
                : 'You will be redirected to Zain Cash to complete payment',
              duration: 3000,
            });
            // Redirect to Zain Cash payment page
            window.location.href = paymentResult.paymentUrl;
          } else {
            throw new Error(paymentResult.error || 'Payment initialization failed');
          }
        } catch (paymentError: any) {
          console.error("Payment initialization error:", paymentError);
          setIsProcessingPayment(false);
          toast({
            title: language === 'ar' ? 'خطأ في الدفع' : 'Payment Error',
            description: language === 'ar'
              ? 'فشل في تهيئة الدفع. يرجى المحاولة مرة أخرى أو اختيار طريقة دفع أخرى.'
              : 'Failed to initialize payment. Please try again or choose another payment method.',
            variant: "destructive",
            duration: 6000,
          });
          // Still redirect to order confirmation so user can see their order
          setLocation(`/order-confirmation/${order.orderNumber}?payment=pending`);
        }
        return;
      }

      // If QiCard payment, redirect to payment page
      if (paymentMethod === 'qicard') {
        setIsProcessingPayment(true);
        try {
          const paymentResponse = await apiRequest('POST', '/api/qicard/init', {
            orderId: order.id,
          });
          const paymentResult = await paymentResponse.json();
          
          if (paymentResult.success && paymentResult.paymentUrl) {
            toast({
              title: language === 'ar' ? 'جاري التحويل للدفع...' : 'Redirecting to payment...',
              description: language === 'ar' 
                ? 'سيتم تحويلك إلى كي كارد للدفع'
                : 'You will be redirected to QiCard to complete payment',
              duration: 3000,
            });
            // Redirect to QiCard payment page
            window.location.href = paymentResult.paymentUrl;
          } else {
            throw new Error(paymentResult.error || 'Payment initialization failed');
          }
        } catch (paymentError: any) {
          console.error("QiCard payment initialization error:", paymentError);
          setIsProcessingPayment(false);
          toast({
            title: language === 'ar' ? 'خطأ في الدفع' : 'Payment Error',
            description: language === 'ar'
              ? 'فشل في تهيئة الدفع. يرجى المحاولة مرة أخرى أو اختيار طريقة دفع أخرى.'
              : 'Failed to initialize payment. Please try again or choose another payment method.',
            variant: "destructive",
            duration: 6000,
          });
          // Still redirect to order confirmation so user can see their order
          setLocation(`/order-confirmation/${order.orderNumber}?payment=pending`);
        }
        return;
      }
      
      toast({
        title: t('checkout.orderSuccess'),
        description: language === 'ar' 
          ? `رقم طلبك: ${order.orderNumber}`
          : `Your order number: ${order.orderNumber}`,
        duration: 4000,
      });
      
      setLocation(`/order-confirmation/${order.orderNumber}`);
    },
    onError: (error: any) => {
      console.error("Order creation error:", error);
      toast({
        title: t('common.error'),
        description: t('checkout.orderError'),
        variant: "destructive",
        duration: 6000,
      });
    },
  });

  // Product prices are stored in thousands (e.g., 340 = 340,000 IQD)
  // Multiply by 1000 to get full IQD value for calculation with shipping (which is in full IQD)
  const subtotal = cartItems.reduce(
    (sum, item) => sum + parseFloat(item.product.price) * 1000 * item.quantity,
    0
  );

  const validateDiscountCode = async () => {
    if (!discountCode.trim()) return;
    
    setIsValidatingCode(true);
    setDiscountError(null);
    
    // Calculate the pre-discount order total (subtotal + shipping) for minimum order validation
    const calculatedShipping = enableFreeShipping && subtotal >= freeShippingThreshold ? 0 : shippingCost;
    const preDiscountTotal = subtotal + calculatedShipping;
    
    try {
      const response = await apiRequest('POST', '/api/discount-codes/validate', { 
        code: discountCode, 
        orderTotal: preDiscountTotal 
      });
      
      const result = await response.json();
      
      if (response.ok && result.valid) {
        setAppliedDiscount({
          code: result.discountCode,
          discountAmount: result.discountAmount,
        });
        setDiscountCode("");
        toast({
          title: language === 'ar' ? "تم تطبيق الخصم!" : "Discount Applied!",
          description: language === 'ar' 
            ? `تم خصم ${result.discountAmount.toLocaleString()} د.ع من طلبك`
            : `${result.discountAmount.toLocaleString()} IQD discount applied to your order`,
        });
      } else {
        setDiscountError(result.error);
      }
    } catch (error) {
      setDiscountError(language === 'ar' ? 'فشل في التحقق من الكود' : 'Failed to validate code');
    } finally {
      setIsValidatingCode(false);
    }
  };

  const removeDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode("");
  };

  // Invalidate discount code when cart changes (items added/removed or quantities changed)
  useEffect(() => {
    if (appliedDiscount && cartItems.length > 0) {
      // Recalculate subtotal from current cart
      // Product prices are stored in thousands (e.g., 340 = 340,000 IQD)
      const newSubtotal = cartItems.reduce(
        (sum, item) => sum + parseFloat(item.product.price) * 1000 * item.quantity,
        0
      );
      const newShipping = enableFreeShipping && newSubtotal >= freeShippingThreshold ? 0 : shippingCost;
      const newOrderTotal = newSubtotal + newShipping;
      
      // Check if minimum order amount is still met
      if (appliedDiscount.code.minOrderAmount && 
          newOrderTotal < parseFloat(appliedDiscount.code.minOrderAmount)) {
        setAppliedDiscount(null);
        toast({
          title: language === 'ar' ? 'تم إزالة الخصم' : 'Discount Removed',
          description: language === 'ar' 
            ? 'لم يعد طلبك يستوفي الحد الأدنى لهذا الكود'
            : 'Your order no longer meets the minimum amount for this discount',
          variant: "destructive",
        });
      }
    }
    // Also remove discount if cart becomes empty
    if (appliedDiscount && cartItems.length === 0) {
      setAppliedDiscount(null);
    }
  }, [cartItems, appliedDiscount, enableFreeShipping, freeShippingThreshold, shippingCost, language, toast]);

  const discountAmount = appliedDiscount?.discountAmount || 0;
  const shippingAmount = enableFreeShipping && subtotal >= freeShippingThreshold ? 0 : shippingCost;
  const total = subtotal - discountAmount + shippingAmount;

  if (userLoading || cartLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('checkout.loading')}</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!currentUser) {
    return null;
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('cart.empty')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">{t('checkout.addProductsFirst')}</p>
            <Button onClick={() => setLocation("/")} className="w-full" data-testid="button-back-to-store">
              {t('checkout.backToStore')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold" data-testid="text-checkout-title">{t('checkout.title')}</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="gap-1"
            data-testid="button-language-switch"
          >
            <Languages className="h-4 w-4" />
            {language === 'ar' ? 'EN' : 'عربي'}
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('checkout.customerInfo')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => createOrderMutation.mutate(data))} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="customerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('checkout.fullName')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('checkout.fullNamePlaceholder')} {...field} data-testid="input-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="customerEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('checkout.email')}</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="example@email.com" {...field} data-testid="input-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="customerPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('checkout.phone')}</FormLabel>
                            <FormControl>
                              <Input placeholder="07XXXXXXXXX" {...field} data-testid="input-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="customerCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('checkout.governorate')}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-city">
                                  <SelectValue placeholder={t('checkout.selectGovernorate')} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {iraqiGovernorates.map((gov) => (
                                  <SelectItem key={gov.value} value={gov.value}>
                                    {language === 'ar' ? gov.ar : gov.en}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="customerAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('checkout.address')}</FormLabel>
                          <FormControl>
                            <Textarea placeholder={t('checkout.addressPlaceholder')} {...field} data-testid="input-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customerPostal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('checkout.neighborhood')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('checkout.neighborhoodPlaceholder')} {...field} data-testid="input-neighborhood" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator className="my-6" />

                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-lg font-semibold">{t('checkout.paymentMethod')}</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="space-y-3"
                              data-testid="radio-payment-method"
                            >
                              <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-4 hover-elevate cursor-pointer">
                                <RadioGroupItem value="cash_on_delivery" id="cash" data-testid="radio-cash-on-delivery" />
                                <Label htmlFor="cash" className="flex items-center gap-3 cursor-pointer flex-1">
                                  <Banknote className="w-5 h-5 text-primary" />
                                  <div>
                                    <div className="font-medium">{t('checkout.cashOnDelivery')}</div>
                                    <div className="text-sm text-muted-foreground">{t('checkout.cashOnDeliveryDesc')}</div>
                                  </div>
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-4 hover-elevate cursor-pointer">
                                <RadioGroupItem value="zaincash" id="zaincash" data-testid="radio-zaincash" />
                                <Label htmlFor="zaincash" className="flex items-center gap-3 cursor-pointer flex-1">
                                  <Smartphone className="w-5 h-5 text-green-600" />
                                  <div>
                                    <div className="font-medium">{t('checkout.zainCash')}</div>
                                    <div className="text-sm text-muted-foreground">{t('checkout.zainCashDesc')}</div>
                                  </div>
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-4 hover-elevate cursor-pointer">
                                <RadioGroupItem value="qicard" id="qicard" data-testid="radio-qicard" />
                                <Label htmlFor="qicard" className="flex items-center gap-3 cursor-pointer flex-1">
                                  <CreditCard className="w-5 h-5 text-blue-600" />
                                  <div>
                                    <div className="font-medium">{t('checkout.qiCard')}</div>
                                    <div className="text-sm text-muted-foreground">{t('checkout.qiCardDesc')}</div>
                                  </div>
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full" disabled={createOrderMutation.isPending || isProcessingPayment} data-testid="button-place-order">
                      {(createOrderMutation.isPending || isProcessingPayment) ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin ltr:mr-2 rtl:ml-2" />
                          {isProcessingPayment ? (language === 'ar' ? 'جاري تهيئة الدفع...' : 'Initializing payment...') : t('checkout.processing')}
                        </>
                      ) : t('checkout.confirmOrder')}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>{t('checkout.orderSummary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="space-y-2" data-testid={`cart-item-${item.id}`}>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? item.product.nameAr : item.product.nameEn}</span>
                      <span>x{item.quantity}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{(parseFloat(item.product.price) * 1000).toLocaleString('en-US', { minimumFractionDigits: 0 })} {t('common.currency')}</span>
                    </div>
                  </div>
                ))}
                <Separator />
                
                {/* Discount Code Input */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Tag className="h-4 w-4" />
                    {language === 'ar' ? 'كود الخصم' : 'Discount Code'}
                  </Label>
                  {appliedDiscount ? (
                    <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-700 dark:text-green-400">
                          {appliedDiscount.code.code}
                        </span>
                        <span className="text-sm text-green-600">
                          (-{appliedDiscount.discountAmount.toLocaleString('en-US')} {t('common.currency')})
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={removeDiscount}
                        className="h-6 w-6"
                        data-testid="button-remove-discount"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={discountCode}
                        onChange={(e) => {
                          setDiscountCode(e.target.value.toUpperCase());
                          setDiscountError(null);
                        }}
                        placeholder={language === 'ar' ? 'أدخل كود الخصم' : 'Enter code'}
                        className="uppercase"
                        data-testid="input-discount-code"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={validateDiscountCode}
                        disabled={isValidatingCode || !discountCode.trim()}
                        data-testid="button-apply-discount"
                      >
                        {isValidatingCode ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          language === 'ar' ? 'تطبيق' : 'Apply'
                        )}
                      </Button>
                    </div>
                  )}
                  {discountError && (
                    <p className="text-sm text-destructive">{discountError}</p>
                  )}
                </div>

                <Separator />
                <div className="flex justify-between">
                  <span>{t('checkout.subtotal')}</span>
                  <span data-testid="text-subtotal">{subtotal.toLocaleString('en-US', { minimumFractionDigits: 0 })} {t('common.currency')}</span>
                </div>
                {appliedDiscount && (
                  <div className="flex justify-between text-green-600">
                    <span>{language === 'ar' ? 'الخصم' : 'Discount'}</span>
                    <span data-testid="text-discount">-{discountAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })} {t('common.currency')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{t('checkout.shipping')}</span>
                  <span data-testid="text-shipping" className={enableFreeShipping && subtotal >= freeShippingThreshold ? "text-green-600 font-medium" : ""}>
                    {enableFreeShipping && subtotal >= freeShippingThreshold 
                      ? t('checkout.freeShipping')
                      : `${shippingCost.toLocaleString('en-US', { minimumFractionDigits: 0 })} ${t('common.currency')}`
                    }
                  </span>
                </div>
                {enableFreeShipping && subtotal < freeShippingThreshold && (
                  <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    {t('checkout.freeShippingThreshold', { amount: freeShippingThreshold.toLocaleString('en-US', { minimumFractionDigits: 0 }) })}
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>{t('cart.total')}</span>
                  <span data-testid="text-order-total">
                    {total.toLocaleString('en-US', { minimumFractionDigits: 0 })} {t('common.currency')}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
