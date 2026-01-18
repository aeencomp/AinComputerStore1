import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowRight, ChevronLeft, Sparkles } from "lucide-react";
import { Link } from "wouter";

const gamingPcImage = "https://images.unsplash.com/photo-1587831990711-23ca6441447b?w=600&q=80";

export function ModernHero() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-900" dir={isRTL ? 'rtl' : 'ltr'} data-testid="section-hero">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-2xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className={`space-y-6 ${isRTL ? 'lg:order-2 text-right' : 'lg:order-1'}`}>
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              {isRTL ? 'أفضل العروض لهذا الشهر' : 'Best Deals This Month'}
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white leading-tight">
              {isRTL ? (
                <>
                  <span className="block">أفضل الحواسيب</span>
                  <span className="block">واللابتوبات</span>
                  <span className="block text-blue-600 dark:text-blue-400">في العراق</span>
                </>
              ) : (
                <>
                  <span className="block">Top Computers</span>
                  <span className="block">and Laptops</span>
                  <span className="block text-blue-600 dark:text-blue-400">in Iraq</span>
                </>
              )}
            </h1>

            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-lg">
              {isRTL 
                ? 'ضمان أصلي • أسعار تنافسية • شحن سريع'
                : 'Genuine Warranty • Competitive Prices • Fast Shipping'
              }
            </p>

            <div className={`flex flex-wrap gap-4 ${isRTL ? 'justify-end' : 'justify-start'}`}>
              <Link href="/?category=laptops">
                <Button 
                  size="lg" 
                  className="bg-blue-600 text-white px-8 py-6 text-lg rounded-full gap-2"
                  data-testid="button-shop-now"
                >
                  {isRTL ? 'تسوق الآن' : 'Shop Now'}
                  {isRTL ? <ChevronLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                </Button>
              </Link>
              <Link href="/?category=offers">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="px-8 py-6 text-lg rounded-full border-2 gap-2"
                  data-testid="button-daily-deals"
                >
                  {isRTL ? 'العروض اليومية' : 'Daily Deals'}
                  {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </Button>
              </Link>
            </div>
          </div>

          <div className={`relative ${isRTL ? 'lg:order-1' : 'lg:order-2'}`}>
            <div className="relative z-10">
              <img
                src={gamingPcImage}
                alt={isRTL ? 'كمبيوتر ألعاب' : 'Gaming PC'}
                className="w-full max-w-lg mx-auto drop-shadow-2xl"
                data-testid="img-hero-product"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-cyan-500/10 to-transparent rounded-full blur-3xl scale-150" />
          </div>
        </div>
      </div>
    </section>
  );
}
