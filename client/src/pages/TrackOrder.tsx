import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Package, Search, MapPin, Phone, Mail, CreditCard, ArrowRight, Home } from 'lucide-react';
import { format } from 'date-fns';

interface OrderItem {
  productId: string;
  quantity: number;
  price: string;
  product: {
    nameAr: string;
    nameEn: string;
    image: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerCity: string;
  customerPostal: string;
  paymentMethod: string;
  subtotal: string;
  shipping: string;
  total: string;
  status: string;
  createdAt: string;
  itemsWithProducts: OrderItem[];
}

export default function TrackOrder() {
  const { t, language } = useLanguage();
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const searchMutation = useMutation({
    mutationFn: async (data: { orderNumber: string; phone: string }) => {
      const res = await apiRequest('POST', '/api/orders/lookup', data);
      return res.json();
    },
    onSuccess: (data) => {
      setOrder(data);
      setFormError(null);
    },
    onError: () => {
      setOrder(null);
      setFormError(t('orderTracking.notFoundDesc'));
    },
  });

  const validateForm = (): boolean => {
    const normalizedPhone = phone.replace(/\D/g, '');
    
    if (!orderNumber || !/^ORD-\d{5}$/.test(orderNumber)) {
      setFormError(t('orderTracking.invalidOrderNumber'));
      return false;
    }
    
    if (!normalizedPhone || normalizedPhone.length !== 11 || !normalizedPhone.startsWith('07')) {
      setFormError(t('orderTracking.invalidPhone'));
      return false;
    }
    
    setFormError(null);
    return true;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      searchMutation.mutate({ 
        orderNumber: orderNumber.trim().toUpperCase(), 
        phone: phone.replace(/\D/g, '') 
      });
    }
  };

  const handleTrackAnother = () => {
    setOrder(null);
    setOrderNumber('');
    setPhone('');
    setFormError(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
      case 'processing': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
      case 'shipped': return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20';
      case 'delivered': return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20';
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash_on_delivery': return t('orderConfirmation.cashOnDelivery');
      case 'zain_cash': return t('orderConfirmation.zainCash');
      case 'qicard': return t('orderConfirmation.qiCard');
      default: return method;
    }
  };

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (language === 'ar') {
      return `${numPrice.toLocaleString('ar-IQ')} د.ع`;
    }
    return `${numPrice.toLocaleString('en-IQ')} IQD`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {!order ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-6 w-6 text-primary" />
                <CardTitle data-testid="text-track-order-title">{t('orderTracking.title')}</CardTitle>
              </div>
              <CardDescription>{t('orderTracking.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orderNumber">{t('orderTracking.orderNumber')}</Label>
                  <Input
                    id="orderNumber"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                    placeholder={t('orderTracking.orderNumberPlaceholder')}
                    data-testid="input-order-number"
                    className="font-mono"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('orderTracking.phone')}</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('orderTracking.phonePlaceholder')}
                    data-testid="input-phone"
                  />
                  <p className="text-sm text-muted-foreground">{t('orderTracking.phoneHint')}</p>
                </div>

                {formError && (
                  <div className="text-destructive text-sm" data-testid="text-form-error">
                    {formError}
                  </div>
                )}

                {searchMutation.isError && (
                  <div className="text-destructive text-center py-2" data-testid="text-not-found">
                    {t('orderTracking.notFound')}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button 
                    type="submit" 
                    disabled={searchMutation.isPending} 
                    className="flex-1"
                    data-testid="button-track-order"
                  >
                    <Search className="h-4 w-4 me-2" />
                    {searchMutation.isPending ? t('orderTracking.searching') : t('orderTracking.submit')}
                  </Button>
                  <Link href="/">
                    <Button type="button" variant="outline" data-testid="button-back-home">
                      <Home className="h-4 w-4 me-2" />
                      {t('orderTracking.backToHome')}
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2" data-testid="text-order-number-result">
                      <Package className="h-5 w-5 text-primary" />
                      {order.orderNumber}
                    </CardTitle>
                    <CardDescription>
                      {format(new Date(order.createdAt), 'PPP')}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(order.status)} data-testid="badge-order-status">
                    {t(`orderConfirmation.${order.status}`)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {t('orderConfirmation.shippingInfo')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p className="font-medium">{order.customerName}</p>
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {order.customerEmail}
                      </p>
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {order.customerPhone}
                      </p>
                      <Separator className="my-2" />
                      <p>{order.customerCity}</p>
                      <p>{order.customerPostal}</p>
                      <p>{order.customerAddress}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        {t('orderConfirmation.paymentMethod')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{getPaymentMethodLabel(order.paymentMethod)}</p>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-4">{t('orderConfirmation.orderItems')}</h3>
                  <div className="space-y-3">
                    {order.itemsWithProducts.map((item, index) => (
                      <div 
                        key={index} 
                        className="flex items-center gap-4 p-3 rounded-lg bg-muted/30"
                        data-testid={`order-item-${index}`}
                      >
                        <div className="w-16 h-16 rounded-md bg-background flex items-center justify-center overflow-hidden">
                          {item.product.image ? (
                            <img 
                              src={`/images/${item.product.image}`} 
                              alt={language === 'ar' ? item.product.nameAr : item.product.nameEn}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Package className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">
                            {language === 'ar' ? item.product.nameAr : item.product.nameEn}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t('orderConfirmation.quantity')}: {item.quantity}
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="font-medium">{formatPrice(parseFloat(item.price) * item.quantity)}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatPrice(item.price)} x {item.quantity}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('orderConfirmation.subtotal')}</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('orderConfirmation.shipping')}</span>
                    <span>{parseFloat(order.shipping) === 0 ? t('orderConfirmation.free') : formatPrice(order.shipping)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg" data-testid="text-order-total">
                    <span>{t('orderConfirmation.total')}</span>
                    <span className="text-primary">{formatPrice(order.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleTrackAnother} variant="outline" className="flex-1" data-testid="button-track-another">
                <Search className="h-4 w-4 me-2" />
                {t('orderTracking.trackAnother')}
              </Button>
              <Link href="/">
                <Button className="flex-1" data-testid="button-continue-shopping">
                  {t('orderConfirmation.continueShopping')}
                  <ArrowRight className="h-4 w-4 ms-2" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
