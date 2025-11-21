import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Footer() {
  return (
    <footer className="bg-muted mt-12 md:mt-16" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h3 className="font-bold text-lg" data-testid="text-footer-about">عن العين لتجارة الحاسبات</h3>
            <p className="text-sm text-muted-foreground">
              متجرك الموثوق لأحدث الحواسيب والملحقات بأفضل الأسعار وأعلى جودة.
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>البريد الإلكتروني: info@alain-computers.com</p>
              <p>الهاتف: ٩٢٠٠٠١٢٣٤</p>
              <p>ساعات العمل: السبت - الخميس ٩ص - ٩م</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-lg" data-testid="text-footer-links">روابط سريعة</h3>
            <div className="flex flex-col gap-2">
              <Button variant="link" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-about-us">
                من نحن
              </Button>
              <Button variant="link" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-contact">
                اتصل بنا
              </Button>
              <Button variant="link" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-branches">
                فروعنا
              </Button>
              <Button variant="link" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-careers">
                الوظائف
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-lg" data-testid="text-footer-support">خدمة العملاء</h3>
            <div className="flex flex-col gap-2">
              <Button variant="link" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-shipping">
                سياسة الشحن
              </Button>
              <Button variant="link" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-returns">
                الاستبدال والاسترجاع
              </Button>
              <Button variant="link" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-warranty">
                الضمان
              </Button>
              <Button variant="link" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-faq">
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
            <Button variant="link" className="p-0 h-auto text-muted-foreground" data-testid="link-privacy">
              سياسة الخصوصية
            </Button>
            <Button variant="link" className="p-0 h-auto text-muted-foreground" data-testid="link-terms">
              الشروط والأحكام
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
