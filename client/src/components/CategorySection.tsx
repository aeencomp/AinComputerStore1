import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { Laptop, Monitor, Keyboard, Cpu } from "lucide-react";
import laptopImage from "@assets/generated_images/gaming_laptop_product_photo.png";
import desktopImage from "@assets/generated_images/desktop_pc_tower_photo.png";
import monitorImage from "@assets/generated_images/gaming_monitor_product_photo.png";
import accessoriesImage from "@assets/generated_images/gaming_keyboard_product_photo.png";

const categories = [
  {
    id: 'laptops',
    nameAr: 'أجهزة لابتوب',
    nameEn: 'Laptops',
    image: laptopImage,
    icon: Laptop,
    gradient: 'from-purple-600/90 via-purple-500/70 to-transparent',
    accentColor: 'bg-purple-500',
  },
  {
    id: 'desktops',
    nameAr: 'أجهزة مكتبية',
    nameEn: 'Desktops',
    image: desktopImage,
    icon: Cpu,
    gradient: 'from-blue-600/90 via-blue-500/70 to-transparent',
    accentColor: 'bg-blue-500',
  },
  {
    id: 'monitors',
    nameAr: 'شاشات',
    nameEn: 'Monitors',
    image: monitorImage,
    icon: Monitor,
    gradient: 'from-teal-600/90 via-teal-500/70 to-transparent',
    accentColor: 'bg-teal-500',
  },
  {
    id: 'accessories',
    nameAr: 'ملحقات الألعاب',
    nameEn: 'Gaming Accessories',
    image: accessoriesImage,
    icon: Keyboard,
    gradient: 'from-rose-600/90 via-rose-500/70 to-transparent',
    accentColor: 'bg-rose-500',
  },
];

interface CategorySectionProps {
  onCategoryClick?: (categoryId: string) => void;
}

export function CategorySection({ onCategoryClick }: CategorySectionProps) {
  const { t, language } = useLanguage();
  
  return (
    <section className="py-16 md:py-20 bg-gradient-to-b from-background via-muted/20 to-background" data-testid="section-categories">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="text-center pt-8 mb-20">
          <h2 className="text-5xl md:text-7xl font-black mb-6 tracking-tight" data-testid="text-categories-title">
            <span className="bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
              {t('home.categories.title')}
            </span>
          </h2>
          <p className="text-muted-foreground text-xl md:text-2xl max-w-2xl mx-auto mb-8">
            {language === 'ar' 
              ? 'اختر من بين مجموعة واسعة من المنتجات عالية الجودة'
              : 'Choose from a wide range of high-quality products'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="w-16 h-1.5 bg-gradient-to-r from-transparent to-primary rounded-full" />
            <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
            <div className="w-16 h-1.5 bg-gradient-to-l from-transparent to-primary rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-8">
          {categories.map((category) => {
            const IconComponent = category.icon;
            return (
              <Card
                key={category.id}
                className="overflow-hidden group cursor-pointer border-0 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2"
                onClick={() => onCategoryClick?.(category.id)}
                data-testid={`card-category-${category.id}`}
              >
                <CardContent className="p-0 relative">
                  <div className="aspect-[4/5] overflow-hidden bg-muted">
                    <img
                      src={category.image}
                      alt={language === 'ar' ? category.nameAr : category.nameEn}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  </div>
                  <div className={`absolute inset-0 bg-gradient-to-t ${category.gradient} flex flex-col items-center justify-end pb-6`}>
                    <div className={`${category.accentColor} w-14 h-14 rounded-full flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <IconComponent className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-white font-bold text-lg md:text-xl text-center drop-shadow-lg" data-testid={`text-category-${category.id}`}>
                      {language === 'ar' ? category.nameAr : category.nameEn}
                    </h3>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
