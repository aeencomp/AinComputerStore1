import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { Shield, Phone, MessageCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchWithTimeout } from '@/lib/queryClient';

interface StoreSettings {
  phone?: string;
  whatsapp?: string;
  email?: string;
}

const BLOCK_CHECK_TIMEOUT_MS = 4_000;
const BLOCK_CACHE_KEY = 'ain-ip-block-check';
const BLOCK_CACHE_TTL_MS = 10 * 60 * 1000;

type BlockCache = { blocked: boolean; reason?: string; at: number };

function readBlockCache(): BlockCache | null {
  try {
    const raw = sessionStorage.getItem(BLOCK_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BlockCache;
    if (Date.now() - parsed.at > BLOCK_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeBlockCache(data: BlockCache) {
  try {
    sessionStorage.setItem(BLOCK_CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export function BlockedChecker({ children }: { children: React.ReactNode }) {
  const { language, isRTL } = useLanguage();
  const initialCache = readBlockCache();
  const [isBlocked, setIsBlocked] = useState(initialCache?.blocked ?? false);
  const [reason, setReason] = useState(initialCache?.reason ?? '');
  const [rayId] = useState(() => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));

  const { data: storeSettings } = useQuery<StoreSettings>({
    queryKey: ['/api/store-settings'],
    enabled: isBlocked,
  });

  useEffect(() => {
    const checkBlocked = async () => {
      try {
        const response = await fetchWithTimeout(
          '/api/check-blocked',
          { credentials: 'include' },
          BLOCK_CHECK_TIMEOUT_MS,
        );
        const data = await response.json();

        if (data.blocked) {
          setIsBlocked(true);
          setReason(data.reason || '');
          writeBlockCache({ blocked: true, reason: data.reason || '', at: Date.now() });
        } else {
          setIsBlocked(false);
          setReason('');
          writeBlockCache({ blocked: false, at: Date.now() });
        }
      } catch {
        // Fail open: allow access if the server is slow or unreachable
      }
    };

    const startCache = readBlockCache();
    if (startCache?.blocked) {
      return;
    }
    void checkBlocked();
  }, []);

  if (isBlocked) {
    const whatsappNumber = storeSettings?.whatsapp || '9647700000000';
    const phoneNumber = storeSettings?.phone || '9647700000000';
    const email = storeSettings?.email || '';

    return (
      <div 
        className="min-h-screen bg-[#1a1a2e] flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#f38020] py-3 px-4">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <Shield className="h-6 w-6 text-white" />
            <span className="text-white font-semibold text-lg">Security Check</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-xl w-full">
            <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
              <div className="bg-[#c41e3a] px-6 py-4">
                <h1 className="text-white text-xl font-bold flex items-center gap-2">
                  <Shield className="h-6 w-6" />
                  {language === 'ar' ? 'تم حظر الوصول' : 'Access Denied'}
                </h1>
                <p className="text-white/90 text-sm mt-1">
                  Error 1020
                </p>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-gray-800 font-semibold text-lg mb-2">
                    {language === 'ar' ? 'ماذا حدث؟' : 'What happened?'}
                  </h2>
                  <p className="text-gray-600">
                    {language === 'ar' 
                      ? 'تم حظر هذا الطلب بواسطة قواعد الأمان. عنوان IP الخاص بك قد تم وضعه في القائمة السوداء بسبب نشاط مشبوه.'
                      : 'This request was blocked by the security rules. Your IP address has been blacklisted due to suspicious activity.'}
                  </p>
                </div>

                <div className="bg-gray-100 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">{language === 'ar' ? 'معرف الحدث:' : 'Ray ID:'}</span>
                      <p className="font-mono text-gray-800">{rayId}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">{language === 'ar' ? 'الوقت:' : 'Time:'}</span>
                      <p className="font-mono text-gray-800">{new Date().toISOString()}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-gray-800 font-semibold mb-3">
                    {language === 'ar' 
                      ? 'هل تعتقد أن هذا خطأ؟ تواصل معنا:'
                      : 'Think this is a mistake? Contact us:'}
                  </h3>
                  
                  <div className="flex flex-col gap-2">
                    <a 
                      href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(language === 'ar' ? `مرحباً، تم حظر IP الخاص بي بالخطأ. Ray ID: ${rayId}` : `Hello, my IP was blocked by mistake. Ray ID: ${rayId}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" className="w-full gap-2 text-green-600 border-green-600 hover:bg-green-50">
                        <MessageCircle className="h-4 w-4" />
                        {language === 'ar' ? 'واتساب' : 'WhatsApp'}
                      </Button>
                    </a>
                    
                    <a href={`tel:${phoneNumber}`}>
                      <Button variant="outline" className="w-full gap-2 hover:bg-gray-50 text-gray-800 border-gray-300">
                        <Phone className="h-4 w-4 text-gray-600" />
                        <span dir="ltr" className="text-gray-800">{phoneNumber}</span>
                      </Button>
                    </a>
                    
                    {email && (
                      <a href={`mailto:${email}?subject=${encodeURIComponent(language === 'ar' ? `طلب إلغاء حظر - Ray ID: ${rayId}` : `Unblock Request - Ray ID: ${rayId}`)}`}>
                        <Button variant="outline" className="w-full gap-2 hover:bg-gray-50 text-gray-800 border-gray-300">
                          <Mail className="h-4 w-4 text-gray-600" />
                          <span className="text-gray-800">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</span>
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center mt-6">
              <p className="text-gray-400 text-sm">
                {language === 'ar' ? 'الأداء والأمان بواسطة' : 'Performance & security by'}{' '}
                <span className="text-[#f38020] font-semibold">Cloudflare</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
