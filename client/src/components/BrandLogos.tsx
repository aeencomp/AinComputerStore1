import { useLanguage } from "@/contexts/LanguageContext";
import { SiMsi, SiAsus, SiLenovo, SiIntel, SiAmd, SiNvidia } from "react-icons/si";

const brands = [
  { icon: SiMsi, name: 'MSI' },
  { icon: SiAsus, name: 'ASUS' },
  { icon: SiLenovo, name: 'Lenovo' },
  { icon: SiIntel, name: 'Intel' },
  { icon: SiAmd, name: 'AMD' },
  { icon: SiNvidia, name: 'NVIDIA' },
];

export function BrandLogos() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  return (
    <section className="py-8 border-y border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {brands.map((brand, index) => (
            <div 
              key={index}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title={brand.name}
              data-testid={`brand-logo-${brand.name.toLowerCase()}`}
            >
              <brand.icon className="w-16 h-8 md:w-20 md:h-10" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
