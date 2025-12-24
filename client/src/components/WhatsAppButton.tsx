import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StoreSettings } from "@shared/schema";
import { SiWhatsapp } from "react-icons/si";

export function WhatsAppButton() {
  const { language, t } = useLanguage();
  
  const { data: settings } = useQuery<StoreSettings>({
    queryKey: ["/api/store-settings"],
  });

  if (!settings?.whatsappNumber) {
    return null;
  }

  // Format Iraqi phone number: remove leading 0, add 964 country code
  const formatIraqiPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('964')) return digits;
    if (digits.startsWith('0')) return '964' + digits.slice(1);
    return '964' + digits;
  };
  
  const whatsappNumber = formatIraqiPhone(settings.whatsappNumber);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    language === 'ar' 
      ? 'السلام عليكم ورحمة الله وبركاته، أود الاستفسار عن...'
      : 'Hi, I would like to inquire about...'
  )}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="button-whatsapp-chat"
      title={t('footer.whatsapp')}
      className="fixed bottom-6 left-6 z-50 flex items-center justify-center w-14 h-14 bg-[#25D366] hover:bg-[#20BD5C] rounded-full shadow-xl text-white transition-all duration-300 hover:scale-110 animate-pulse hover:animate-none"
      style={{
        boxShadow: '0 4px 20px rgba(37, 211, 102, 0.4)',
      }}
    >
      <SiWhatsapp className="w-7 h-7" />
    </a>
  );
}
