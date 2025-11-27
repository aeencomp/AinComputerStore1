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
      className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 bg-[#25D366] hover-elevate rounded-full shadow-lg text-white transition-all"
    >
      <SiWhatsapp className="w-6 h-6" />
    </a>
  );
}
