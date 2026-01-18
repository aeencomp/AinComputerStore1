import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { Phone, Mail, MapPin, Clock, Facebook, Instagram, Send } from "lucide-react";
import { SiWhatsapp, SiX } from "react-icons/si";
import type { StoreSettings } from "@shared/schema";
import aeenn from "@assets/aeenn.jpg";

export function ModernFooter() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const { data: settings } = useQuery<StoreSettings>({
    queryKey: ['/api/store-settings'],
  });

  const storeName = settings 
    ? (language === 'ar' ? settings.storeNameAr : settings.storeNameEn)
    : (isRTL ? 'العين لتجارة الحاسبات' : 'Al-Ain Computers');

  const phone = settings?.phone || '+964 771 771 8800';
  const email = settings?.email || 'info@alain-computers.com';
  const address = settings 
    ? (language === 'ar' ? settings.addressAr : settings.addressEn)
    : (isRTL ? 'بغداد - العراق' : 'Baghdad - Iraq');

  const quickLinks = [
    { href: '/', labelAr: 'الرئيسية', labelEn: 'Home' },
    { href: '/?category=laptops', labelAr: 'اللابتوبات', labelEn: 'Laptops' },
    { href: '/?category=desktops', labelAr: 'أجهزة سطح المكتب', labelEn: 'Desktop PCs' },
    { href: '/?category=gaming_accessories', labelAr: 'ملحقات الألعاب', labelEn: 'Gaming' },
    { href: '/contact', labelAr: 'تواصل معنا', labelEn: 'Contact Us' },
  ];

  const customerService = [
    { href: '/orders', labelAr: 'تتبع الطلب', labelEn: 'Track Order' },
    { href: '/returns', labelAr: 'الإرجاع والاستبدال', labelEn: 'Returns & Exchange' },
    { href: '/warranty', labelAr: 'الضمان', labelEn: 'Warranty' },
    { href: '/faq', labelAr: 'الأسئلة الشائعة', labelEn: 'FAQ' },
  ];

  return (
    <footer className="bg-slate-900 text-white" dir={isRTL ? 'rtl' : 'ltr'} data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 ${isRTL ? 'text-right' : 'text-left'}`}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-600 overflow-hidden flex-shrink-0">
                <img src={aeenn} alt={storeName} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-bold text-lg">{isRTL ? 'عن العين للحاسبات' : 'About Aeen Computers'}</h3>
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              {isRTL 
                ? 'متجرك الموثوق للحواسيب وملحقاتها في العراق. نقدم أفضل المنتجات بأسعار تنافسية مع ضمان شامل.'
                : 'Your trusted store for computers and accessories in Iraq. We offer the best products at competitive prices with comprehensive warranty.'
              }
            </p>
            <div className="flex gap-2">
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover-elevate" data-testid="link-facebook">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover-elevate" data-testid="link-twitter">
                <SiX className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover-elevate" data-testid="link-instagram">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover-elevate" data-testid="link-whatsapp">
                <SiWhatsapp className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-lg mb-4">{isRTL ? 'روابط سريعة' : 'Quick Links'}</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <span className="text-slate-400 text-sm cursor-pointer hover-elevate" data-testid={`footer-link-${link.labelEn.toLowerCase().replace(/\s+/g, '-')}`}>
                      {isRTL ? link.labelAr : link.labelEn}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-lg mb-4">{isRTL ? 'خدمة العملاء' : 'Customer Service'}</h4>
            <ul className="space-y-2">
              {customerService.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <span className="text-slate-400 text-sm cursor-pointer hover-elevate" data-testid={`footer-link-${link.labelEn.toLowerCase().replace(/\s+/g, '-')}`}>
                      {isRTL ? link.labelAr : link.labelEn}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-lg mb-4">{isRTL ? 'تواصل معنا' : 'Contact Us'}</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-slate-400" dir="ltr">{phone}</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-slate-400">{email}</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-slate-400">{address}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
          <div className={`flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
            <p data-testid="text-copyright">
              © 2025 {storeName}. {isRTL ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
            </p>
            <div className="flex items-center gap-4">
              <Link href="/privacy">
                <span className="cursor-pointer hover-elevate" data-testid="link-privacy">
                  {isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'}
                </span>
              </Link>
              <Link href="/terms">
                <span className="cursor-pointer hover-elevate" data-testid="link-terms">
                  {isRTL ? 'الشروط والأحكام' : 'Terms & Conditions'}
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
