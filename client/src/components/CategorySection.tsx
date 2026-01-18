import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import laptopImage from "@assets/generated_images/gaming_laptop_product_photo.png";
import desktopImage from "@assets/generated_images/gaming_desktop_pc_photo.png";
import monitorImage from "@assets/generated_images/gaming_monitor_product_photo.png";
import accessoriesImage from "@assets/generated_images/gaming_accessories_collection_photo.png";

const categories = [
  {
    id: 'laptops',
    nameAr: 'أجهزة لابتوب',
    nameEn: 'Laptops',
    image: laptopImage,
  },
  {
    id: 'desktops',
    nameAr: 'أجهزة مكتبية',
    nameEn: 'Desktops',
    image: desktopImage,
  },
  {
    id: 'monitors',
    nameAr: 'شاشات',
    nameEn: 'Monitors',
    image: monitorImage,
  },
  {
    id: 'accessories',
    nameAr: 'ملحقات الألعاب',
    nameEn: 'Gaming Accessories',
    image: accessoriesImage,
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
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-6xl font-black mb-4 tracking-tight" data-testid="text-categories-title">
            <span className="bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent text-[48px]">
              {t('home.categories.title')}
            </span>
          </h2>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-6">
            {language === 'ar' 
              ? 'اختر من بين مجموعة واسعة من المنتجات عالية الجودة'
              : 'Choose from a wide range of high-quality products'}
          </p>
          <div className="flex items-center justify-center gap-2">
            <div className="w-12 h-1 bg-gradient-to-r from-transparent to-primary rounded-full" />
            <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            <div className="w-12 h-1 bg-gradient-to-l from-transparent to-primary rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {categories.map((category) => (
              <div
                key={category.id}
                className="animated-border-wrapper group cursor-pointer"
                onClick={() => onCategoryClick?.(category.id)}
                data-testid={`card-category-${category.id}`}
              >
                <Card className="overflow-hidden border-0 shadow-md h-full">
                  <CardContent className="p-0">
                    <div className="aspect-square overflow-hidden bg-muted shimmer-effect">
                      <img
                        src={category.image}
                        alt={language === 'ar' ? category.nameAr : category.nameEn}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-4 text-center bg-card">
                      <h3 className="font-bold text-lg md:text-xl group-hover:text-primary transition-colors duration-300" data-testid={`text-category-${category.id}`}>
                        {language === 'ar' ? category.nameAr : category.nameEn}
                      </h3>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
