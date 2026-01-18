import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChevronRight, ChevronLeft, Gamepad2, Monitor, Computer, Laptop } from "lucide-react";
import { Link } from "wouter";

interface CategoryCard {
  id: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  icon: React.ReactNode;
  image: string;
  category: string;
}

const categories: CategoryCard[] = [
  {
    id: 'gaming',
    nameAr: 'ملحقات الألعاب',
    nameEn: 'Gaming Accessories',
    descAr: 'لوحات مفاتيح • ماوس • سماعات',
    descEn: 'Keyboards • Mice • Headsets',
    icon: <Gamepad2 className="w-6 h-6" />,
    image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400&q=80',
    category: 'gaming_accessories'
  },
  {
    id: 'monitors',
    nameAr: 'الشاشات',
    nameEn: 'Monitors',
    descAr: 'ألعاب • عمل • فائقة العرض',
    descEn: 'Gaming • Work • UltraWide',
    icon: <Monitor className="w-6 h-6" />,
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&q=80',
    category: 'monitors'
  },
  {
    id: 'desktops',
    nameAr: 'أجهزة سطح المكتب',
    nameEn: 'Desktop PCs',
    descAr: 'حواسيب مخصصة قوية',
    descEn: 'Powerful Custom PCs',
    icon: <Computer className="w-6 h-6" />,
    image: 'https://images.unsplash.com/photo-1587831990711-23ca6441447b?w=400&q=80',
    category: 'desktops'
  },
  {
    id: 'laptops',
    nameAr: 'اللابتوبات',
    nameEn: 'Laptops',
    descAr: 'ألعاب • عمل • دراسة',
    descEn: 'Gaming • Work • Study',
    icon: <Laptop className="w-6 h-6" />,
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80',
    category: 'laptops'
  }
];

export function ModernCategorySection() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <section className="py-16 bg-white dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3">
            {isRTL ? 'تصفح حسب الفئة' : 'Browse by Category'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
            {isRTL 
              ? 'اختر من مجموعتنا الواسعة من المنتجات عالية الجودة'
              : 'Find exactly what you need from our wide selection of quality products'
            }
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {categories.map((cat) => (
            <Link key={cat.id} href={`/?category=${cat.category}`}>
              <Card 
                className="group relative overflow-hidden rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer h-64"
                data-testid={`card-category-${cat.id}`}
              >
                <div className="absolute inset-0">
                  <img 
                    src={cat.image} 
                    alt={isRTL ? cat.nameAr : cat.nameEn}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent" />
                </div>
                
                <div className="relative h-full flex flex-col justify-end p-4 text-white">
                  <h3 className="text-lg font-bold mb-1">
                    {isRTL ? cat.nameAr : cat.nameEn}
                  </h3>
                  <p className="text-sm text-white/70 mb-3">
                    {isRTL ? cat.descAr : cat.descEn}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-fit bg-white/10 border-white/30 text-white hover:bg-white hover:text-slate-900 backdrop-blur-sm gap-1"
                  >
                    {isRTL ? 'عرض المنتجات' : 'View Products'}
                    <ChevronIcon className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
