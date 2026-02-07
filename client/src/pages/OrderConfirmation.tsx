import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  CheckCircle, 
  Package, 
  MapPin, 
  CreditCard, 
  ArrowRight, 
  ArrowLeft, 
  Mail, 
  Phone,
  Printer,
  Copy,
  Clock,
  Truck,
  Home,
  ShoppingBag,
  Sparkles,
  Calendar,
  Receipt,
  Check
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";

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
  discount?: string;
  discountCode?: string;
  total: string;
  status: string;
  createdAt: string;
  itemsWithProducts: OrderItem[];
}

export default function OrderConfirmation() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [, setLocation] = useLocation();
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const [showConfetti, setShowConfetti] = useState(true);
  const [animateCheck, setAnimateCheck] = useState(false);

  useEffect(() => {
    // Trigger animation on mount
    setTimeout(() => setAnimateCheck(true), 100);
    // Hide confetti after 3 seconds
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

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

  const getStatusStep = (status: string): number => {
    const steps: Record<string, number> = {
      pending: 0,
      processing: 1,
      shipped: 2,
      delivered: 3,
      cancelled: -1,
    };
    return steps[status] ?? 0;
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
    // Always use English numerals for prices
    return numPrice.toLocaleString('en-US', { minimumFractionDigits: 0 });
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

  const getEstimatedDelivery = () => {
    if (!order) return '';
    const orderDate = new Date(order.createdAt);
    const minDays = 2;
    const maxDays = 5;
    const minDate = new Date(orderDate);
    minDate.setDate(minDate.getDate() + minDays);
    const maxDate = new Date(orderDate);
    maxDate.setDate(maxDate.getDate() + maxDays);
    
    const formatShortDate = (date: Date) => {
      return date.toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US', {
        month: 'short',
        day: 'numeric',
      });
    };
    
    return `${formatShortDate(minDate)} - ${formatShortDate(maxDate)}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyOrderNumber = () => {
    if (order) {
      navigator.clipboard.writeText(order.orderNumber);
      toast({
        title: language === 'ar' ? 'تم النسخ!' : 'Copied!',
        description: language === 'ar' ? 'تم نسخ رقم الطلب' : 'Order number copied to clipboard',
      });
    }
  };

  const handleShareWhatsApp = () => {
    if (order) {
      const message = language === 'ar' 
        ? `تم تأكيد طلبي رقم ${order.orderNumber} بقيمة ${formatPrice(order.total)} د.ع`
        : `My order #${order.orderNumber} has been confirmed. Total: ${formatPrice(order.total)} IQD`;
      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">{t('orderConfirmation.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <CardTitle className="text-center text-destructive">{t('orderConfirmation.notFound')}</CardTitle>
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
  const currentStep = getStatusStep(order.status);
  const discountAmount = order.discount ? parseFloat(order.discount) : 0;

  const orderSteps = [
    { icon: Receipt, label: language === 'ar' ? 'تم الاستلام' : 'Received', status: 'pending' },
    { icon: Package, label: language === 'ar' ? 'قيد التجهيز' : 'Processing', status: 'processing' },
    { icon: Truck, label: language === 'ar' ? 'تم الشحن' : 'Shipped', status: 'shipped' },
    { icon: Home, label: language === 'ar' ? 'تم التوصيل' : 'Delivered', status: 'delivered' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/50 to-background dark:from-green-950/20 dark:to-background">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              <Sparkles 
                className="w-4 h-4" 
                style={{ 
                  color: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'][Math.floor(Math.random() * 5)] 
                }} 
              />
            </div>
          ))}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-8 print:py-4">
        {/* Success Header */}
        <div className="text-center mb-8 print:mb-4">
          <div 
            className={`inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 mb-6 shadow-lg shadow-green-500/30 transition-all duration-700 ${
              animateCheck ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
            }`}
          >
            <CheckCircle className="w-14 h-14 text-white" />
          </div>
          <h1 
            className={`text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent mb-3 transition-all duration-500 delay-200 ${
              animateCheck ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
            data-testid="text-order-confirmed"
          >
            {t('orderConfirmation.title')}
          </h1>
          <p className="text-lg text-muted-foreground mb-2">
            {t('orderConfirmation.thankYou')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('orderConfirmation.contactSoon')}
          </p>
        </div>

        {/* Order Number Card */}
        <Card className="mb-6 overflow-hidden shadow-lg border-0 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 print:shadow-none">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-start">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2 justify-center md:justify-start">
                  <Receipt className="w-4 h-4" />
                  {t('orderConfirmation.orderNumber')}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-primary" data-testid="text-order-number">
                    {order.orderNumber}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleCopyOrderNumber}
                    className="print:hidden"
                    data-testid="button-copy-order"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(order.createdAt)}
                </div>
              </div>
              
              {/* QR Code */}
              <div className="bg-white p-3 rounded-xl shadow-inner">
                <QRCodeSVG 
                  value={order.orderNumber} 
                  size={80} 
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Status Timeline */}
        {order.status !== 'cancelled' && (
          <Card className="mb-6 shadow-lg border-0 print:shadow-none">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                {language === 'ar' ? 'حالة الطلب' : 'Order Status'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Progress Line */}
                <div className="absolute top-6 left-6 right-6 h-1 bg-muted rounded-full">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-1000"
                    style={{ width: `${(currentStep / 3) * 100}%` }}
                  />
                </div>
                
                {/* Steps */}
                <div className="relative flex justify-between">
                  {orderSteps.map((step, index) => {
                    const isCompleted = index <= currentStep;
                    const isCurrent = index === currentStep;
                    const StepIcon = step.icon;
                    
                    return (
                      <div key={step.status} className="flex flex-col items-center">
                        <div 
                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
                            isCompleted 
                              ? 'bg-gradient-to-br from-green-500 to-emerald-400 text-white shadow-lg shadow-green-500/30' 
                              : 'bg-muted text-muted-foreground'
                          } ${isCurrent ? 'ring-4 ring-green-200 dark:ring-green-800' : ''}`}
                        >
                          {isCompleted && index < currentStep ? (
                            <Check className="w-6 h-6" />
                          ) : (
                            <StepIcon className="w-5 h-5" />
                          )}
                        </div>
                        <span className={`text-xs mt-2 font-medium ${isCompleted ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Estimated Delivery */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium">
                    {language === 'ar' ? 'التوصيل المتوقع' : 'Estimated Delivery'}
                  </span>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  {getEstimatedDelivery()}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cancelled Order Alert */}
        {order.status === 'cancelled' && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 text-destructive">
                <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium">{language === 'ar' ? 'تم إلغاء الطلب' : 'Order Cancelled'}</div>
                  <div className="text-sm opacity-80">
                    {language === 'ar' ? 'تواصل معنا للمزيد من المعلومات' : 'Contact us for more information'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Shipping Info */}
          <Card className="shadow-lg border-0 print:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                {t('orderConfirmation.shippingInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="font-semibold text-lg">{order.customerName}</div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/50 p-2 rounded-lg">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{order.customerEmail}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/50 p-2 rounded-lg">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <span dir="ltr">{order.customerPhone}</span>
                </div>
              </div>
              <Separator />
              <div className="text-sm space-y-1">
                <div className="font-medium">{order.customerCity}</div>
                <div className="text-muted-foreground">{order.customerPostal}</div>
                <div className="text-muted-foreground">{order.customerAddress}</div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card className="shadow-lg border-0 print:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-primary" />
                </div>
                {t('orderConfirmation.paymentMethod')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/50 rounded-lg mb-4">
                <div className="font-semibold text-lg">{getPaymentMethodLabel(order.paymentMethod)}</div>
              </div>
              
              {/* Next Steps */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground">
                  {language === 'ar' ? 'الخطوات التالية:' : 'Next Steps:'}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span>{language === 'ar' ? 'ستصلك رسالة تأكيد عبر البريد الإلكتروني' : "You'll receive a confirmation email"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Phone className="w-3 h-3 text-blue-600" />
                    </div>
                    <span>{language === 'ar' ? 'سنتصل بك لتأكيد الطلب' : "We'll call to confirm your order"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Truck className="w-3 h-3 text-purple-600" />
                    </div>
                    <span>{language === 'ar' ? 'سيتم شحن طلبك قريباً' : 'Your order will be shipped soon'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Items - Invoice Style */}
        <Card className="mb-6 shadow-lg border-0 print:shadow-none">
          <CardHeader className="bg-muted/30 print:bg-transparent">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-primary" />
              </div>
              {t('orderConfirmation.orderItems')}
              <Badge variant="secondary" className="ms-auto">
                {order.itemsWithProducts.length} {language === 'ar' ? 'منتج' : 'items'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {order.itemsWithProducts.map((item, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors" 
                  data-testid={`order-item-${index}`}
                >
                  <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img 
                      src={`/attached_assets/generated_images/${item.product.image}`} 
                      alt={language === 'ar' ? item.product.nameAr : item.product.nameEn}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-product.png';
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {language === 'ar' ? item.product.nameAr : item.product.nameEn}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatPrice(item.price)} {t('common.currency')} × {item.quantity}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="font-semibold text-lg">
                      {formatPrice(parseFloat(item.price) * item.quantity)} {t('common.currency')}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="bg-muted/30 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('orderConfirmation.subtotal')}</span>
                <span>{formatPrice(order.subtotal)} {t('common.currency')}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span className="flex items-center gap-1">
                    {language === 'ar' ? 'الخصم' : 'Discount'}
                    {order.discountCode && (
                      <Badge variant="outline" className="text-xs ms-1">{order.discountCode}</Badge>
                    )}
                  </span>
                  <span>-{formatPrice(discountAmount)} {t('common.currency')}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('orderConfirmation.shipping')}</span>
                <span className={parseFloat(order.shipping) === 0 ? "text-green-600 font-medium" : ""}>
                  {parseFloat(order.shipping) === 0 
                    ? t('orderConfirmation.free') 
                    : `${formatPrice(order.shipping)} ${t('common.currency')}`
                  }
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-semibold">{t('orderConfirmation.total')}</span>
                <span className="text-2xl font-bold text-primary" data-testid="text-order-total">
                  {formatPrice(order.total)} {t('common.currency')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 print:hidden">
          <Button 
            onClick={() => setLocation("/")} 
            size="lg"
            className="flex-1 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            data-testid="button-continue-shopping"
          >
            <ShoppingBag className="w-4 h-4" />
            {t('orderConfirmation.continueShopping')}
            <ArrowIcon className="w-4 h-4" />
          </Button>
          
          <Button 
            variant="outline" 
            size="lg"
            onClick={handlePrint}
            className="gap-2"
            data-testid="button-print-receipt"
          >
            <Printer className="w-4 h-4" />
            {language === 'ar' ? 'طباعة' : 'Print'}
          </Button>
          
          <Button 
            variant="outline" 
            size="lg"
            onClick={handleShareWhatsApp}
            className="gap-2 hover:bg-green-50 hover:text-green-600 hover:border-green-200"
            data-testid="button-share-whatsapp"
          >
            <SiWhatsapp className="w-4 h-4" />
            {language === 'ar' ? 'مشاركة' : 'Share'}
          </Button>
        </div>

        {/* Footer Message */}
        <div className="text-center mt-8 p-4 bg-muted/30 rounded-lg print:hidden">
          <p className="text-sm text-muted-foreground">
            {language === 'ar' 
              ? 'شكراً لتسوقك معنا! إذا كان لديك أي استفسار، لا تتردد في التواصل معنا.'
              : 'Thank you for shopping with us! If you have any questions, feel free to contact us.'
            }
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 3s ease-in-out forwards;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .divide-y > * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
