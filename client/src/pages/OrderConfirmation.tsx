import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle, Package, MapPin, CreditCard, ArrowRight, ArrowLeft, Mail, Phone } from "lucide-react";

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

interface OrderDetails {
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

export default function OrderConfirmation() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [, setLocation] = useLocation();
  const { language, t } = useLanguage();

  const { data: order, isLoading, error } = useQuery<OrderDetails>({
    queryKey: ['/api/orders/by-number', orderNumber],
    queryFn: async () => {
      const response = await fetch(`/api/orders/by-number/${orderNumber}`);
      if (!response.ok) {
        throw new Error('Order not found');
      }
      return response.json();
    },
    enabled: !!orderNumber,
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: t('orderConfirmation.pending') },
      processing: { variant: "default", label: t('orderConfirmation.processing') },
      shipped: { variant: "default", label: t('orderConfirmation.shipped') },
      delivered: { variant: "default", label: t('orderConfirmation.delivered') },
      cancelled: { variant: "destructive", label: t('orderConfirmation.cancelled') },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      cash_on_delivery: t('orderConfirmation.cashOnDelivery'),
      zaincash: t('orderConfirmation.zainCash'),
      qicard: t('orderConfirmation.qiCard'),
    };
    return methods[method] || method;
  };

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return numPrice.toLocaleString(language === 'ar' ? 'ar-IQ' : 'en-US', { minimumFractionDigits: 0 });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('orderConfirmation.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">{t('orderConfirmation.notFound')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setLocation("/")} 
              className="w-full"
              data-testid="button-back-to-store"
            >
              {t('orderConfirmation.continueShopping')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ArrowIcon = language === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 mb-4">
            <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-green-600 dark:text-green-400 mb-2" data-testid="text-order-confirmed">
            {t('orderConfirmation.title')}
          </h1>
          <p className="text-lg text-muted-foreground mb-2">
            {t('orderConfirmation.thankYou')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('orderConfirmation.contactSoon')}
          </p>
        </div>

        <div className="bg-primary/5 rounded-lg p-4 mb-6 text-center">
          <div className="text-sm text-muted-foreground mb-1">{t('orderConfirmation.orderNumber')}</div>
          <div className="text-2xl font-bold text-primary" data-testid="text-order-number">{order.orderNumber}</div>
          <div className="text-sm text-muted-foreground mt-2">{formatDate(order.createdAt)}</div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5 text-primary" />
                {t('orderConfirmation.shippingInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="font-medium">{order.customerName}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                {order.customerEmail}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4" />
                {order.customerPhone}
              </div>
              <Separator className="my-2" />
              <div className="text-sm">
                <div>{order.customerCity}</div>
                <div>{order.customerPostal}</div>
                <div className="text-muted-foreground">{order.customerAddress}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="w-5 h-5 text-primary" />
                {t('orderConfirmation.paymentMethod')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-medium mb-4">{getPaymentMethodLabel(order.paymentMethod)}</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('orderConfirmation.status')}:</span>
                {getStatusBadge(order.status)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              {t('orderConfirmation.orderItems')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.itemsWithProducts.map((item, index) => (
                <div key={index} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg" data-testid={`order-item-${index}`}>
                  <div className="w-16 h-16 bg-background rounded-md flex items-center justify-center overflow-hidden">
                    <img 
                      src={`/attached_assets/generated_images/${item.product.image}`} 
                      alt={language === 'ar' ? item.product.nameAr : item.product.nameEn}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-product.png';
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {language === 'ar' ? item.product.nameAr : item.product.nameEn}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('orderConfirmation.quantity')}: {item.quantity}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="font-medium">
                      {formatPrice(parseFloat(item.price) * item.quantity)} {t('common.currency')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatPrice(item.price)} × {item.quantity}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('orderConfirmation.subtotal')}</span>
                <span>{formatPrice(order.subtotal)} {t('common.currency')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('orderConfirmation.shipping')}</span>
                <span className={parseFloat(order.shipping) === 0 ? "text-green-600 font-medium" : ""}>
                  {parseFloat(order.shipping) === 0 
                    ? t('orderConfirmation.free') 
                    : `${formatPrice(order.shipping)} ${t('common.currency')}`
                  }
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>{t('orderConfirmation.total')}</span>
                <span className="text-primary" data-testid="text-order-total">
                  {formatPrice(order.total)} {t('common.currency')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button 
            onClick={() => setLocation("/")} 
            size="lg"
            className="gap-2"
            data-testid="button-continue-shopping"
          >
            {t('orderConfirmation.continueShopping')}
            <ArrowIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
