import { Laptop, Monitor, Gamepad2, Keyboard } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const categories = [
  {
    id: 'laptops',
    nameAr: 'أجهزة لابتوب',
    nameEn: 'Laptops',
    icon: Laptop,
    gradient: 'from-blue-500 to-cyan-400',
    shadowColor: 'shadow-blue-500/30',
    iconBg: 'bg-blue-600',
  },
  {
    id: 'desktops',
    nameAr: 'أجهزة مكتبية',
    nameEn: 'Desktops',
    icon: Monitor,
    gradient: 'from-purple-500 to-pink-400',
    shadowColor: 'shadow-purple-500/30',
    iconBg: 'bg-purple-600',
  },
  {
    id: 'monitors',
    nameAr: 'شاشات',
    nameEn: 'Monitors',
    icon: Monitor,
    gradient: 'from-emerald-500 to-teal-400',
    shadowColor: 'shadow-emerald-500/30',
    iconBg: 'bg-emerald-600',
  },
  {
    id: 'accessories',
    nameAr: 'ملحقات الألعاب',
    nameEn: 'Gaming Accessories',
    icon: Gamepad2,
    gradient: 'from-orange-500 to-amber-400',
    shadowColor: 'shadow-orange-500/30',
    iconBg: 'bg-orange-600',
  },
];

interface CategorySectionProps {
  onCategoryClick?: (categoryId: string) => void;
}

export function CategorySection({ onCategoryClick }: CategorySectionProps) {
  const { language, t } = useLanguage();
  
  return (
    <section className="py-12 md:py-16" data-testid="section-categories">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center" data-testid="text-categories-title">
          {t('home.categories.title')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {categories.map((category) => {
            const IconComponent = category.icon;
            return (
              <div
                key={category.id}
                className={`relative overflow-hidden rounded-2xl cursor-pointer transform transition-all duration-300 hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl ${category.shadowColor}`}
                onClick={() => onCategoryClick?.(category.id)}
                data-testid={`card-category-${category.id}`}
              >
                <div className={`bg-gradient-to-br ${category.gradient} p-6 md:p-8 h-full min-h-[180px] md:min-h-[200px] flex flex-col items-center justify-center text-white`}>
                  <div className={`${category.iconBg} p-4 rounded-2xl mb-4 shadow-lg`}>
                    <IconComponent className="w-10 h-10 md:w-12 md:h-12" />
                  </div>
                  <h3 className="font-bold text-lg md:text-xl text-center drop-shadow-md" data-testid={`text-category-${category.id}`}>
                    {language === 'ar' ? category.nameAr : category.nameEn}
                  </h3>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
