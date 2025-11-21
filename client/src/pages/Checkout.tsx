import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CartItem, Product } from "@shared/schema";

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
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: cartItems = [] } = useQuery<CartItemWithId[]>({
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
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: CheckoutFormValues) => {
      const subtotal = cartItems.reduce(
        (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
        0
      );
      const items = cartItems.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
      }));

      return await apiRequest('POST', '/api/orders', {
        ...data,
        items: JSON.stringify(items),
        subtotal: subtotal.toString(),
        shipping: "0",
        total: subtotal.toString(),
        status: "pending",
      });
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      toast({
        title: "تم إنشاء الطلب بنجاح!",
        description: `رقم الطلب: ${order.id}`,
      });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل إنشاء الطلب. حاول مرة أخرى.",
        variant: "destructive",
      });
    },
  });

  const subtotal = cartItems.reduce(
    (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
    0
  );

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>سلة التسوق فارغة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">يرجى إضافة منتجات قبل المتابعة إلى الدفع</p>
            <Button onClick={() => setLocation("/")} className="w-full">
              العودة للمتجر
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        <h1 className="text-4xl font-bold mb-8">إتمام الطلب</h1>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>معلومات التسليم</CardTitle>
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
                            <FormLabel>الاسم الكامل</FormLabel>
                            <FormControl>
                              <Input placeholder="أدخل الاسم الكامل" {...field} data-testid="input-name" />
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
                            <FormLabel>البريد الإلكتروني</FormLabel>
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
                            <FormLabel>رقم الهاتف</FormLabel>
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
                            <FormLabel>المدينة</FormLabel>
                            <FormControl>
                              <Input placeholder="بغداد" {...field} data-testid="input-city" />
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
                          <FormLabel>العنوان</FormLabel>
                          <FormControl>
                            <Textarea placeholder="أدخل عنوانك" {...field} data-testid="input-address" />
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
                          <FormLabel>الرمز البريدي</FormLabel>
                          <FormControl>
                            <Input placeholder="10001" {...field} data-testid="input-postal" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full" disabled={createOrderMutation.isPending} data-testid="button-place-order">
                      {createOrderMutation.isPending ? "جاري إنشاء الطلب..." : "تأكيد الطلب"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>ملخص الطلب</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex justify-between">
                      <span>{item.product.nameAr}</span>
                      <span>x{item.quantity}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{parseFloat(item.product.price).toLocaleString('ar-IQ', { minimumFractionDigits: 2 })} د.ع</span>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>الإجمالي</span>
                  <span>{subtotal.toLocaleString('ar-IQ', { minimumFractionDigits: 2 })} د.ع</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
