import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StoreSettings } from "@shared/schema";
import heroImage from "@assets/generated_images/gaming_setup_hero_banner.png";

interface HeroSectionProps {
  settings?: StoreSettings;
}

export function HeroSection({ settings }: HeroSectionProps) {
  const { language, t } = useLanguage();

  const heroTitle = settings 
    ? (language === 'ar' ? settings.heroTitleAr : settings.heroTitleEn) 
    : t('home.hero.title');
  
  const heroSubtitle = settings 
    ? (language === 'ar' ? settings.heroSubtitleAr : settings.heroSubtitleEn) 
    : t('home.hero.subtitle');

  const backgroundImage = settings?.heroImageUrl || heroImage;

  return (
    <section className="relative h-[60vh] min-h-[400px] w-full overflow-hidden" data-testid="section-hero">
      <img
        src={backgroundImage}
        alt={t('home.hero.imageAlt')}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/50 to-black/30" />
      <div className="relative max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-full flex items-center">
        <div className="max-w-2xl text-white space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight" data-testid="text-hero-title">
            {heroTitle || t('home.hero.title')}
          </h1>
          <p className="text-xl md:text-2xl text-white/90" data-testid="text-hero-subtitle">
            {heroSubtitle || t('home.hero.subtitle')}
          </p>
          <Button 
            size="lg" 
            className="bg-primary/90 backdrop-blur-sm hover:bg-primary text-lg px-8 py-6"
            data-testid="button-shop-now"
          >
            {t('home.hero.cta')}
          </Button>
        </div>
      </div>
    </section>
  );
}
