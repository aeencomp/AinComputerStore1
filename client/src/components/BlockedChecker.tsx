import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ShieldX } from 'lucide-react';

export function BlockedChecker({ children }: { children: React.ReactNode }) {
  const { language, isRTL } = useLanguage();
  const [isBlocked, setIsBlocked] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [checked, setChecked] = useState(false);

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
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'السبب: ' : 'Reason: '}{reason}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-6">
            {language === 'ar' 
              ? 'إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع الإدارة.'
              : 'If you believe this is an error, please contact the administrator.'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}