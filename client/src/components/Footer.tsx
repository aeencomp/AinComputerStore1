import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StoreSettings } from "@shared/schema";
import { Twitter, Instagram, Facebook } from "lucide-react";

export function Footer() {
  const { language, t } = useLanguage();
  
  const { data: settings } = useQuery<StoreSettings>({
    queryKey: ["/api/store-settings"],
  });

  const storeName = settings 
    ? (language === 'ar' ? settings.storeNameAr : settings.storeNameEn)
    : t('footer.defaultStoreName');

  const description = settings
    ? (language === 'ar' ? settings.descriptionAr : settings.descriptionEn)
    : t('footer.defaultDescription');

  const email = settings?.email || t('footer.defaultEmail');
  const phone = settings
    ? (language === 'ar' ? settings.phoneAr : settings.phone)
    : t('footer.defaultPhone');

  const hours = settings
    ? (language === 'ar' ? settings.hoursAr : settings.hoursEn)
    : t('footer.defaultHours');

  const aboutText = settings
    ? (language === 'ar' ? settings.aboutTextAr : settings.aboutTextEn)
    : null;

  const copyrightText = settings
    ? (language === 'ar' ? settings.copyrightTextAr : settings.copyrightTextEn)
    : null;

  return (
    <footer className="bg-muted mt-12 md:mt-16" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h3 className="font-bold text-lg" data-testid="text-footer-about">
              {t('footer.about')} {storeName}
            </h3>
            <p className="text-sm text-muted-foreground">
              {aboutText || description}
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p data-testid="text-footer-email">
                {t('footer.email')} {email}
              </p>
              <p data-testid="text-footer-phone">
                {t('footer.phone')} {phone}
              </p>
              <p data-testid="text-footer-hours">
                {t('footer.hours')} {hours}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-lg" data-testid="text-footer-links">{t('footer.quickLinks')}</h3>
            <div className="flex flex-col gap-2">
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-about-us">
                {t('footer.aboutUs')}
              </Button>
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-contact">
                {t('footer.contact')}
              </Button>
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-branches">
                {t('footer.branches')}
              </Button>
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-careers">
                {t('footer.careers')}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-lg" data-testid="text-footer-support">{t('footer.customerService')}</h3>
            <div className="flex flex-col gap-2">
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-shipping">
                {t('footer.shipping')}
              </Button>
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-returns">
                {t('footer.returns')}
              </Button>
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-warranty">
                {t('footer.warranty')}
              </Button>
              <Button variant="ghost" className="justify-start p-0 h-auto text-muted-foreground" data-testid="link-footer-faq">
                {t('footer.faq')}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-lg" data-testid="text-footer-newsletter">{t('footer.newsletter')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('footer.newsletterDesc')}
            </p>
            <div className="flex gap-2">
              <Button data-testid="button-newsletter-subscribe">{t('footer.subscribe')}</Button>
              <Input placeholder={t('footer.newsletterPlaceholder')} className="flex-1" data-testid="input-newsletter" />
            </div>
            {(settings?.twitterUrl || settings?.instagramUrl || settings?.facebookUrl) && (
              <div className="pt-4">
                <p className="text-sm font-medium mb-2">{t('footer.followUs')}</p>
                <div className="flex gap-2">
                  {settings?.twitterUrl && (
                    <Button 
                      size="icon" 
                      variant="outline" 
                      data-testid="button-social-twitter"
                      asChild
                    >
                      <a href={settings.twitterUrl} target="_blank" rel="noopener noreferrer">
                        <Twitter className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {settings?.instagramUrl && (
                    <Button 
                      size="icon" 
                      variant="outline" 
                      data-testid="button-social-instagram"
                      asChild
                    >
                      <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer">
                        <Instagram className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {settings?.facebookUrl && (
                    <Button 
                      size="icon" 
                      variant="outline" 
                      data-testid="button-social-facebook"
                      asChild
                    >
                      <a href={settings.facebookUrl} target="_blank" rel="noopener noreferrer">
                        <Facebook className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p data-testid="text-copyright">{copyrightText || t('footer.copyright')}</p>
          <div className="flex gap-4">
            <Button variant="ghost" className="p-0 h-auto text-muted-foreground" data-testid="link-privacy">
              {t('footer.privacy')}
            </Button>
            <Button variant="ghost" className="p-0 h-auto text-muted-foreground" data-testid="link-terms">
              {t('footer.terms')}
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
