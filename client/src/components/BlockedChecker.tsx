import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { ShieldX, Phone, MessageCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StoreSettings {
  phone?: string;
  whatsapp?: string;
  email?: string;
}

export function BlockedChecker({ children }: { children: React.ReactNode }) {
  const { language, isRTL } = useLanguage();
  const [isBlocked, setIsBlocked] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [checked, setChecked] = useState(false);

  const { data: storeSettings } = useQuery<StoreSettings>({
    queryKey: ['/api/store-settings'],
    enabled: isBlocked,
  });

  useEffect(() => {
    const checkBlocked = async () => {
      try {
        const response = await fetch('/api/check-blocked');
        const data = await response.json();
        
        if (data.blocked) {
          setIsBlocked(true);
          setReason(data.reason || '');
        }
      } catch (error) {
        // If check fails, allow access
      }
      setChecked(true);
    };

    checkBlocked();
  }, []);

  if (!checked) {
    return null;
  }

  if (isBlocked) {
    const whatsappNumber = storeSettings?.whatsapp || '9647700000000';
    const phoneNumber = storeSettings?.phone || '9647700000000';
    const email = storeSettings?.email || '';

    return (
      <div 
        className="min-h-screen bg-background flex items-center justify-center p-4"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center">
              <ShieldX className="h-10 w-10 text-red-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-red-500 mb-4">
            {language === 'ar' ? 'تم حظر الوصول' : 'Access Blocked'}
          </h1>
          <p className="text-muted-foreground mb-4">
            {language === 'ar' 
              ? 'عذراً، تم حظر الوصول من عنوان IP الخاص بك إلى هذا الموقع.'
              : 'Sorry, your IP address has been blocked from accessing this site.'}
          </p>
          {reason && reason !== 'Access denied' && (
            <p className="text-sm text-muted-foreground mb-4">
              {language === 'ar' ? 'السبب: ' : 'Reason: '}{reason}
            </p>
          )}
          
          <div className="border-t pt-6 mt-6">
            <p className="text-sm text-muted-foreground mb-4">
              {language === 'ar' 
                ? 'إذا كنت تعتقد أن هذا خطأ، يرجى التواصل معنا:'
                : 'If you believe this is an error, please contact us:'}
            </p>
            
            <div className="flex flex-col gap-3">
              <a 
                href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(language === 'ar' ? 'مرحباً، أعتقد أن حظر IP الخاص بي كان خطأ. الرجاء المساعدة.' : 'Hello, I believe my IP was blocked by mistake. Please help.')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full gap-2 text-green-600 border-green-600">
                  <MessageCircle className="h-4 w-4" />
                  {language === 'ar' ? 'تواصل عبر واتساب' : 'Contact via WhatsApp'}
                </Button>
              </a>
              
              <a href={`tel:${phoneNumber}`}>
                <Button variant="outline" className="w-full gap-2">
                  <Phone className="h-4 w-4" />
                  {language === 'ar' ? 'اتصل بنا' : 'Call Us'}
                  <span className="font-mono text-sm" dir="ltr">{phoneNumber}</span>
                </Button>
              </a>
              
              {email && (
                <a href={`mailto:${email}?subject=${encodeURIComponent(language === 'ar' ? 'طلب إلغاء حظر IP' : 'IP Unblock Request')}`}>
                  <Button variant="outline" className="w-full gap-2">
                    <Mail className="h-4 w-4" />
                    {language === 'ar' ? 'راسلنا عبر البريد' : 'Email Us'}
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}