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

  const scrollDirection = settings.announcementScrollDirection || 'rtl';

  return (
    <div 
      className="relative overflow-hidden announcement-bar-animated"
      data-testid="announcement-bar"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-black via-red-900 to-black" />
      <div className="absolute inset-0 announcement-shimmer" />
      <div className="relative py-2.5 text-sm font-semibold text-white tracking-wide">
        <div className={`flex whitespace-nowrap ${scrollDirection === 'rtl' ? 'animate-marquee-rtl' : 'animate-marquee-ltr'}`}>
          <div className="flex shrink-0">
            <span className="mx-8 drop-shadow-lg" data-testid="text-announcement">{text}</span>
            <span className="mx-8 drop-shadow-lg">{text}</span>
            <span className="mx-8 drop-shadow-lg">{text}</span>
            <span className="mx-8 drop-shadow-lg">{text}</span>
          </div>
          <div className="flex shrink-0">
            <span className="mx-8 drop-shadow-lg">{text}</span>
            <span className="mx-8 drop-shadow-lg">{text}</span>
            <span className="mx-8 drop-shadow-lg">{text}</span>
            <span className="mx-8 drop-shadow-lg">{text}</span>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[2px] animated-gradient-border" />
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/20 rounded-full transition-all z-10 bg-black/30 backdrop-blur-sm border border-white/10"
        aria-label="Dismiss announcement"
        data-testid="button-dismiss-announcement"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
