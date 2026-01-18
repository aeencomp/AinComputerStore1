import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import razerBanner from "@assets/Screenshot_2026-01-18_060042_1768705267362.png";

interface Slide {
  id: number;
  image: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  ctaTextAr: string;
  ctaTextEn: string;
  ctaLink: string;
}

const slides: Slide[] = [
  {
    id: 1,
    image: razerBanner,
    titleAr: "منتجات شركة RAZER",
    titleEn: "RAZER Products",
    subtitleAr: "متوفرة للطلب داخل موقعنا",
    subtitleEn: "Available for order on our website",
    ctaTextAr: "اطلب الآن",
    ctaTextEn: "Order Now",
    ctaLink: "/?category=gaming",
  },
  {
    id: 2,
    image: razerBanner,
    titleAr: "أفضل المنتجات التقنية",
    titleEn: "Best Tech Products",
    subtitleAr: "تشكيلة واسعة من الحواسيب والملحقات",
    subtitleEn: "Wide selection of computers and accessories",
    ctaTextAr: "تسوق الآن",
    ctaTextEn: "Shop Now",
    ctaLink: "/",
  },
];

export function HeroSlideshow() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const { language } = useLanguage();

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, []);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, nextSlide]);

  const slide = slides[currentSlide];

  return (
    <section 
      className="relative w-full h-[300px] md:h-[400px] lg:h-[500px] overflow-hidden bg-black"
      data-testid="section-hero-slideshow"
    >
      {slides.map((s, index) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
        >
          <img
            src={s.image}
            alt={language === "ar" ? s.titleAr : s.titleEn}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-black/40 to-transparent" />
        </div>
      ))}

      <div className="absolute inset-0 z-20 flex items-center">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 w-full">
          <div className="max-w-lg space-y-4">
            <h2 
              className="text-2xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg"
              data-testid="text-slideshow-title"
            >
              {language === "ar" ? slide.titleAr : slide.titleEn}
            </h2>
            <p 
              className="text-lg md:text-xl text-white/90 drop-shadow"
              data-testid="text-slideshow-subtitle"
            >
              {language === "ar" ? slide.subtitleAr : slide.subtitleEn}
            </p>
            <Button 
              asChild
              size="lg"
              variant="outline"
              className="bg-white/10 backdrop-blur-sm border-white/30 text-white font-semibold"
              data-testid="button-slideshow-cta"
            >
              <Link href={slide.ctaLink}>
                {language === "ar" ? slide.ctaTextAr : slide.ctaTextEn}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
        aria-label="Previous slide"
        data-testid="button-prev-slide"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
        aria-label="Next slide"
        data-testid="button-next-slide"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2" data-testid="slideshow-indicators">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ${
              index === currentSlide
                ? "bg-white text-black border-white"
                : "bg-black/30 text-white border-white/50 hover:bg-white/20"
            }`}
            aria-label={`Go to slide ${index + 1}`}
            data-testid={`button-slide-indicator-${index}`}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </section>
  );
}
