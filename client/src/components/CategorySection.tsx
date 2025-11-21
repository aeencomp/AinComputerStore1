import { Card, CardContent } from "@/components/ui/card";
import laptopImage from "@assets/generated_images/gaming_laptop_product_photo.png";
import desktopImage from "@assets/generated_images/desktop_pc_tower_photo.png";
import monitorImage from "@assets/generated_images/gaming_monitor_product_photo.png";
import accessoriesImage from "@assets/generated_images/gaming_keyboard_product_photo.png";

const categories = [
  {
    id: 'laptops',
    nameAr: 'أجهزة كمبيوتر محمولة',
    image: laptopImage,
  },
  {
    id: 'desktops',
    nameAr: 'أجهزة مكتبية',
    image: desktopImage,
  },
  {
    id: 'monitors',
    nameAr: 'شاشات',
    image: monitorImage,
  },
  {
    id: 'accessories',
    nameAr: 'ملحقات الألعاب',
    image: accessoriesImage,
  },
];

export function CategorySection() {
  return (
    <section className="py-12 md:py-16" data-testid="section-categories">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center" data-testid="text-categories-title">
          تصفح حسب الفئة
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {categories.map((category) => (
            <Card
              key={category.id}
              className="overflow-hidden group cursor-pointer hover-elevate active-elevate-2"
              data-testid={`card-category-${category.id}`}
            >
              <CardContent className="p-0 relative">
                <div className="aspect-square overflow-hidden bg-muted">
                  <img
                    src={category.image}
                    alt={category.nameAr}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
                  <h3 className="text-white font-bold text-lg md:text-xl p-4 w-full text-center" data-testid={`text-category-${category.id}`}>
                    {category.nameAr}
                  </h3>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
