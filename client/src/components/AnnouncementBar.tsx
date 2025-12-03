import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StoreSettings } from "@shared/schema";
import { X } from "lucide-react";
import { useState } from "react";

export function AnnouncementBar() {
  const { language } = useLanguage();
  const [dismissed, setDismissed] = useState(false);
  
  const { data: settings } = useQuery<StoreSettings>({
    queryKey: ["/api/store-settings"],
  });

  if (!settings?.announcementEnabled || dismissed) {
    return null;
  }

  const text = language === 'ar' ? settings.announcementTextAr : settings.announcementTextEn;
  
  if (!text || text.trim() === '') {
    return null;
  }

  const bgColor = settings.announcementBgColor || '#3B82F6';

  return (
    <div 
      className="relative py-2 px-4 text-center text-sm font-medium text-white"
      style={{ backgroundColor: bgColor }}
      data-testid="announcement-bar"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
        <span data-testid="text-announcement">{text}</span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded transition-colors"
        aria-label="Dismiss announcement"
        data-testid="button-dismiss-announcement"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
