import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StoreSettings } from "@shared/schema";

export function Footer() {
  const { language } = useLanguage();
  
  const { data: settings } = useQuery<StoreSettings>({
    queryKey: ["/api/store-settings"],
  });

  const storeName = settings 
    ? (language === 'ar' ? settings.storeNameAr : settings.storeNameEn)
    : (language === 'ar' ? "العين لتجارة الحاسبات" : "Al-Ain Computer Trading");

  const description = settings
    ? (language === 'ar' ? settings.descriptionAr : settings.descriptionEn)
    : (language === 'ar' 
      ? "متجرك الموثوق لأحدث الحواسيب والملحقات بأفضل الأسعار وأعلى جودة."
      : "Your trusted store for the latest computers and accessories at the best prices and highest quality.");

  const email = settings?.email || "info@alain-computers.com";
  const phone = settings
    ? (language === 'ar' ? settings.phoneAr : settings.phone)
    : (language === 'ar' ? "٩٢٠٠٠١٢٣٤" : "920001234");

  const hours = settings
    ? (language === 'ar' ? settings.hoursAr : settings.hoursEn)
    : (language === 'ar' 
      ? "السبت - الخميس ٩ص - ٩م"
      : "Saturday - Thursday 9am - 9pm");

  return (
    <footer className="bg-muted mt-12 md:mt-16" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h3 className="font-bold text-lg" data-testid="text-footer-about">
              {language === 'ar' ? 'عن ' : 'About '}
              {storeName}
            </h3>
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p data-testid="text-footer-email">
                {language === 'ar' ? 'البريد الإلكتروني: ' : 'Email: '}
                {email}
              </p>
              <p data-testid="text-footer-phone">
                {language === 'ar' ? 'الهاتف: ' : 'Phone: '}
                {phone}
              </p>
              <p data-testid="text-footer-hours">
                {language === 'ar' ? 'ساعات العمل: ' : 'Working Hours: '}
                {hours}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-lg" data-testid="text-footer-links">روابط سريعة</h3>
            <div className="flex flex-col gap-2">
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-about-us">
                من نحن
              </Button>
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-contact">
                اتصل بنا
              </Button>
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-branches">
                فروعنا
              </Button>
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-careers">
                الوظائف
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-lg" data-testid="text-footer-support">خدمة العملاء</h3>
            <div className="flex flex-col gap-2">
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-shipping">
                سياسة الشحن
              </Button>
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-returns">
                الاستبدال والاسترجاع
              </Button>
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-warranty">
                الضمان
              </Button>
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-faq">
                الأسئلة الشائعة
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-lg" data-testid="text-footer-newsletter">اشترك في النشرة الإخبارية</h3>
            <p className="text-sm text-muted-foreground">
              احصل على آخر العروض والأخبار
            </p>
            <div className="flex gap-2">
              <Button data-testid="button-newsletter-subscribe">اشترك</Button>
              <Input placeholder="بريدك الإلكتروني" className="flex-1" data-testid="input-newsletter" />
            </div>
            <div className="pt-4">
              <p className="text-sm font-medium mb-2">تابعنا</p>
              <div className="flex gap-2">
                <Button size="icon" variant="outline" data-testid="button-social-twitter">X</Button>
                <Button size="icon" variant="outline" data-testid="button-social-instagram">IG</Button>
                <Button size="icon" variant="outline" data-testid="button-social-facebook">FB</Button>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p data-testid="text-copyright">© ٢٠٢٥ العين لتجارة الحاسبات. جميع الحقوق محفوظة.</p>
          <div className="flex gap-4">
            <Button variant="ghost" className="p-0 h-auto text-muted-foreground" data-testid="link-privacy">
              سياسة الخصوصية
            </Button>
            <Button variant="ghost" className="p-0 h-auto text-muted-foreground" data-testid="link-terms">
              الشروط والأحكام
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
