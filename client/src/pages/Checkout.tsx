import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CartItem } from "@shared/schema";
import { Banknote, CreditCard } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface CartItemWithId extends CartItem {
  id: string;
}

const checkoutSchema = z.object({
  customerName: z.string().min(2, "الاسم مطلوب"),
  customerEmail: z.string().email("البريد الإلكتروني غير صحيح"),
  customerPhone: z.string().min(8, "رقم الهاتف مطلوب"),
  customerAddress: z.string().min(5, "العنوان مطلوب"),
  customerCity: z.string().min(2, "المدينة مطلوبة"),
  customerPostal: z.string().min(2, "الرمز البريدي مطلوب"),
  paymentMethod: z.string().min(1, "طريقة الدفع مطلوبة"),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { language, t } = useLanguage();

  const { data: cartItems = [], isLoading: cartLoading } = useQuery<CartItemWithId[]>({
    queryKey: ['/api/cart'],
  });

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      customerAddress: "",
      customerCity: "",
      customerPostal: "",
      paymentMethod: "cash_on_delivery",
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: CheckoutFormValues) => {
      try {
        const subtotal = cartItems.reduce(
          (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
          0
        );
        const items = cartItems.map(item => JSON.stringify({
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
        }));

        const orderPayload = {
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          customerAddress: data.customerAddress,
          customerCity: data.customerCity,
          customerPostal: data.customerPostal,
          paymentMethod: data.paymentMethod,
          items: items,
          subtotal: subtotal.toString(),
          shipping: "0",
          total: subtotal.toString(),
          status: "pending",
        };

        console.log("Submitting order:", orderPayload);
        const response = await apiRequest('POST', '/api/orders', orderPayload);
        const result = await response.json();
        console.log("Order created successfully:", result);
        return result;
      } catch (error) {
        console.error("Error in mutationFn:", error);
        throw error;
      }
    },
    onSuccess: (order: any) => {
      console.log("Order success handler:", order);
      
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      
      toast({
        title: t('checkout.orderSuccess'),
        description: language === 'ar' 
          ? `رقم طلبك: ${order.orderNumber}\nسيتم التواصل معك قريباً لتأكيد الطلب`
          : `Your order number: ${order.orderNumber}\nWe will contact you soon to confirm your order`,
        duration: 6000,
      });
      
      setTimeout(() => {
        setLocation("/");
      }, 2000);
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

  const subtotal = cartItems.reduce(
    (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
    0
  );

  if (cartLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('checkout.loading')}</p>
        </div>
      </div>
    );
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
        <h1 className="text-4xl font-bold mb-8" data-testid="text-checkout-title">{t('checkout.title')}</h1>

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
                              <Input placeholder="+964..." {...field} data-testid="input-phone" />
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
                            <FormLabel>{t('checkout.city')}</FormLabel>
                            <FormControl>
                              <Input placeholder={language === 'ar' ? 'بغداد' : 'Baghdad'} {...field} data-testid="input-city" />
                            </FormControl>
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
                          <FormLabel>{t('checkout.postalCode')}</FormLabel>
                          <FormControl>
                            <Input placeholder="10001" {...field} data-testid="input-postal" />
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
                              <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-4 opacity-50 cursor-not-allowed">
                                <RadioGroupItem value="online" id="online" disabled />
                                <Label htmlFor="online" className="flex items-center gap-3 flex-1">
                                  <CreditCard className="w-5 h-5" />
                                  <div>
                                    <div className="font-medium">{t('checkout.onlinePayment')}</div>
                                    <div className="text-sm text-muted-foreground">{t('checkout.comingSoon')}</div>
                                  </div>
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full" disabled={createOrderMutation.isPending} data-testid="button-place-order">
                      {createOrderMutation.isPending ? t('checkout.processing') : t('checkout.confirmOrder')}
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
                      <span>{parseFloat(item.product.price).toLocaleString(language === 'ar' ? 'ar-IQ' : 'en-US', { minimumFractionDigits: 2 })} {t('common.currency')}</span>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>{t('cart.total')}</span>
                  <span data-testid="text-order-total">{subtotal.toLocaleString(language === 'ar' ? 'ar-IQ' : 'en-US', { minimumFractionDigits: 2 })} {t('common.currency')}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
