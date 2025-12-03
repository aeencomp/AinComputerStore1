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

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      await fetch("/api/announcement-dismiss", { method: "POST" });
    } catch (error) {
      console.error("Failed to track dismiss:", error);
    }
  };

  if (!settings?.announcementEnabled || dismissed) {
    return null;
  }

  const text = language === 'ar' ? settings.announcementTextAr : settings.announcementTextEn;
  
  if (!text || text.trim() === '') {
    return null;
  }

  const bgColor = settings.announcementBgColor || '#3B82F6';
  const scrollDirection = settings.announcementScrollDirection || 'rtl';

  return (
    <div 
      className="relative py-2 text-sm font-medium text-white overflow-hidden"
      style={{ backgroundColor: bgColor }}
      data-testid="announcement-bar"
    >
      <div className={`flex whitespace-nowrap ${scrollDirection === 'rtl' ? 'animate-marquee-rtl' : 'animate-marquee-ltr'}`}>
        <div className="flex shrink-0">
          <span className="mx-8" data-testid="text-announcement">{text}</span>
          <span className="mx-8">{text}</span>
          <span className="mx-8">{text}</span>
          <span className="mx-8">{text}</span>
        </div>
        <div className="flex shrink-0">
          <span className="mx-8">{text}</span>
          <span className="mx-8">{text}</span>
          <span className="mx-8">{text}</span>
          <span className="mx-8">{text}</span>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded transition-colors z-10 bg-black/20"
        aria-label="Dismiss announcement"
        data-testid="button-dismiss-announcement"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
