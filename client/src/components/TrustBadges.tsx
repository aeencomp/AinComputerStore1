import { Shield, Truck, CreditCard, Headphones } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const badges = [
  {
    icon: Shield,
    titleAr: 'ضمان أصلي',
    titleEn: 'Genuine Warranty',
    descAr: 'ضمان شامل لمدة سنتين',
    descEn: '2 Year Full Warranty'
  },
  {
    icon: Truck,
    titleAr: 'شحن سريع',
    titleEn: 'Fast Shipping',
    descAr: 'توصيل سريع لجميع المحافظات',
    descEn: 'Fast delivery to all provinces'
  },
  {
    icon: CreditCard,
    titleAr: 'الدفع عند الاستلام',
    titleEn: 'Cash On Delivery',
    descAr: 'ادفع عند استلام طلبك',
    descEn: 'Pay when you receive your order'
  },
  {
    icon: Headphones,
    titleAr: 'دعم مخصص',
    titleEn: 'Dedicated Support',
    descAr: 'فريق دعم متخصص 24/7',
    descEn: 'Expert support team 24/7'
  }
];

export function TrustBadges() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  return (
    <section className="py-12 bg-gradient-to-r from-blue-50 via-white to-blue-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800" dir={isRTL ? 'rtl' : 'ltr'} data-testid="section-trust-badges">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-10">
          {isRTL ? 'لماذا تتسوق معنا؟' : 'Why Shop With Us?'}
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {badges.map((badge, index) => (
            <div 
              key={index}
              className="flex flex-col items-center text-center p-4"
              data-testid={`trust-badge-${index}`}
            >
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <badge.icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">
                {isRTL ? badge.titleAr : badge.titleEn}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isRTL ? badge.descAr : badge.descEn}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
