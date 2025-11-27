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

  const whatsappNumber = settings.whatsappNumber.replace(/\D/g, '');
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
      className="flex items-center justify-center w-14 h-14 bg-[#25D366] hover:bg-[#20BD5C] rounded-full shadow-xl text-white transition-all duration-300 hover:scale-110 animate-pulse hover:animate-none"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        boxShadow: '0 4px 20px rgba(37, 211, 102, 0.4)',
      }}
    >
      <SiWhatsapp className="w-7 h-7" />
    </a>
  );
}
