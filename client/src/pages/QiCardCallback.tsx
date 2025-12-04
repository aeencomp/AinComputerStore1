import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, AlertCircle, Home, Package, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type PaymentStatus = 'success' | 'completed' | 'failed' | 'pending' | 'error';

interface PaymentStatusResponse {
  orderNumber: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
}

export default function QiCardCallback() {
  const [, setLocation] = useLocation();
  const { language, t } = useLanguage();
  const [status, setStatus] = useState<PaymentStatus>('pending');
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get('status') as PaymentStatus || 'pending';
    const orderParam = params.get('order') || '';
    const msgParam = params.get('msg') || '';
    
    setStatus(statusParam);
    setOrderNumber(orderParam);
    setErrorMessage(msgParam);
    setIsLoading(false);
  }, []);

  const { data: paymentData } = useQuery<PaymentStatusResponse>({
    queryKey: ['/api/qicard/status', orderNumber],
    enabled: !!orderNumber && status !== 'error',
    refetchInterval: status === 'pending' ? 5000 : false,
  });

  const effectiveStatus = paymentData?.paymentStatus 
    ? (paymentData.paymentStatus as PaymentStatus) 
    : status;

  const getStatusConfig = () => {
    switch (effectiveStatus) {
      case 'success':
      case 'completed':
        return {
          icon: CheckCircle,
          iconColor: 'text-green-500',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          title: language === 'ar' ? 'تم الدفع بنجاح!' : 'Payment Successful!',
          description: language === 'ar'
            ? 'شكراً لك! تم استلام دفعتك بنجاح وسيتم معالجة طلبك قريباً.'
            : 'Thank you! Your payment has been received and your order will be processed soon.',
        };
      case 'failed':
        return {
          icon: XCircle,
          iconColor: 'text-red-500',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          title: language === 'ar' ? 'فشل الدفع' : 'Payment Failed',
          description: language === 'ar'
            ? 'لم يتم إتمام عملية الدفع. يمكنك المحاولة مرة أخرى أو اختيار طريقة دفع أخرى.'
            : 'Your payment could not be completed. You can try again or choose another payment method.',
        };
      case 'error':
        return {
          icon: AlertCircle,
          iconColor: 'text-orange-500',
          bgColor: 'bg-orange-50 dark:bg-orange-900/20',
          title: language === 'ar' ? 'حدث خطأ' : 'An Error Occurred',
          description: language === 'ar'
            ? `حدث خطأ أثناء معالجة الدفع: ${getErrorTranslation(errorMessage)}`
            : `An error occurred while processing your payment: ${getErrorTranslation(errorMessage)}`,
        };
      default:
        return {
          icon: Clock,
          iconColor: 'text-yellow-500',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          title: language === 'ar' ? 'الدفع قيد المعالجة' : 'Payment Pending',
          description: language === 'ar'
            ? 'جاري معالجة الدفع. يرجى الانتظار أو التحقق من حالة الطلب لاحقاً.'
            : 'Your payment is being processed. Please wait or check your order status later.',
        };
    }
  };

  const getErrorTranslation = (error: string): string => {
    const translations: Record<string, { ar: string; en: string }> = {
      'missing_params': { ar: 'بيانات غير مكتملة', en: 'Missing parameters' },
      'verification_failed': { ar: 'فشل التحقق من الدفع', en: 'Payment verification failed' },
      'order_not_found': { ar: 'لم يتم العثور على الطلب', en: 'Order not found' },
      'internal_error': { ar: 'خطأ داخلي في النظام', en: 'Internal system error' },
    };
    return translations[error]?.[language] || error;
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-4" />
            <p className="text-muted-foreground">
              {language === 'ar' ? 'جاري التحقق من حالة الدفع...' : 'Checking payment status...'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className={`mx-auto w-20 h-20 rounded-full ${config.bgColor} flex items-center justify-center mb-4`}>
            <StatusIcon className={`w-10 h-10 ${config.iconColor}`} />
          </div>
          <CardTitle className="text-2xl">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">{config.description}</p>
          
          {orderNumber && (
            <div className={`p-4 rounded-lg ${config.bgColor}`}>
              <p className="text-sm text-muted-foreground mb-1">
                {language === 'ar' ? 'رقم الطلب' : 'Order Number'}
              </p>
              <p className="text-xl font-bold font-mono" data-testid="text-order-number">{orderNumber}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {orderNumber && (
              <Link href={`/track-order`}>
                <Button variant="default" className="w-full" data-testid="button-track-order">
                  <Package className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                  {language === 'ar' ? 'تتبع الطلب' : 'Track Order'}
                </Button>
              </Link>
            )}
            
            <Link href="/">
              <Button variant="outline" className="w-full" data-testid="button-go-home">
                <Home className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                {language === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
              </Button>
            </Link>

            {(effectiveStatus === 'failed' || effectiveStatus === 'error') && (
              <Link href="/cart">
                <Button variant="secondary" className="w-full" data-testid="button-retry-payment">
                  {language === 'ar' ? 'المحاولة مرة أخرى' : 'Try Again'}
                </Button>
              </Link>
            )}
          </div>

          {(effectiveStatus === 'success' || effectiveStatus === 'completed') && (
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'ستتلقى رسالة تأكيد على بريدك الإلكتروني قريباً.'
                : 'You will receive a confirmation email shortly.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
