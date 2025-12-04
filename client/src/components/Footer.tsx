import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import type { StoreSettings, FooterLinkGroup } from "@shared/schema";
import { 
  Twitter, Instagram, Facebook, Phone, MapPin, Mail, Clock, 
  ExternalLink, ChevronLeft, ChevronRight, Shield, Truck, 
  CreditCard, HeadphonesIcon, Award, Send
} from "lucide-react";
import { SiWhatsapp, SiVisa, SiMastercard } from "react-icons/si";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import logoUrl from "@assets/aeenn.jpg";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export function Footer() {
  const { language, t } = useLanguage();
  const isRTL = language === 'ar';
  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;
  
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

  const address = settings
    ? (language === 'ar' ? settings.addressAr : settings.addressEn)
    : t('footer.location');

  return (
    <footer className="bg-gradient-to-b from-muted/50 to-muted mt-12 md:mt-16" data-testid="footer">
      {/* Trust Badges Section */}
      <div className="bg-primary/5 border-y border-primary/10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{isRTL ? 'توصيل سريع' : 'Fast Delivery'}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'لجميع المحافظات' : 'All Provinces'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{isRTL ? 'ضمان شامل' : 'Full Warranty'}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'على جميع المنتجات' : 'On All Products'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{isRTL ? 'دفع آمن' : 'Secure Payment'}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'طرق دفع متعددة' : 'Multiple Methods'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <HeadphonesIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{isRTL ? 'دعم فني' : 'Tech Support'}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'متوفر دائماً' : 'Always Available'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Store Info & Contact - Larger Column */}
          <div className="lg:col-span-4 space-y-6">
            {/* Logo and Store Name */}
            <div className="flex items-center gap-3">
              <img 
                src={logoUrl} 
                alt={storeName} 
                className="w-14 h-14 rounded-xl object-cover border-2 border-primary/20"
              />
              <div>
                <h3 className="font-bold text-xl" data-testid="text-footer-store-name">{storeName}</h3>
                <p className="text-xs text-muted-foreground">{isRTL ? 'متجر الإلكترونيات الموثوق' : 'Trusted Electronics Store'}</p>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              {aboutText || description}
            </p>

            {/* Contact Info with Icons */}
            <div className="space-y-3">
              <a 
                href={`mailto:${email}`}
                className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                data-testid="link-footer-email"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Mail className="h-4 w-4" />
                </div>
                <span>{email}</span>
              </a>
              
              <a 
                href={`tel:${phone}`}
                className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                data-testid="link-footer-phone"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Phone className="h-4 w-4" />
                </div>
                <span dir="ltr">{phone}</span>
              </a>

              {settings?.whatsappNumber && (
                <a 
                  href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-muted-foreground hover:text-green-600 transition-colors group"
                  data-testid="link-footer-whatsapp"
                >
                  <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                    <SiWhatsapp className="h-4 w-4 text-green-600" />
                  </div>
                  <span>{t('footer.whatsapp')}</span>
                </a>
              )}

              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
                <span>{hours}</span>
              </div>
            </div>

            {/* Social Media Icons */}
            {(settings?.twitterUrl || settings?.instagramUrl || settings?.facebookUrl || settings?.whatsappNumber) && (
              <div className="pt-2">
                <p className="text-sm font-medium mb-3">{t('footer.followUs')}</p>
                <div className="flex gap-2">
                  {settings?.whatsappNumber && (
                    <a 
                      href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 hover:bg-green-500 hover:text-white transition-all duration-300"
                      data-testid="button-social-whatsapp"
                    >
                      <SiWhatsapp className="h-5 w-5" />
                    </a>
                  )}
                  {settings?.facebookUrl && (
                    <a 
                      href={settings.facebookUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all duration-300"
                      data-testid="button-social-facebook"
                    >
                      <Facebook className="h-5 w-5" />
                    </a>
                  )}
                  {settings?.instagramUrl && (
                    <a 
                      href={settings.instagramUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-600 hover:bg-gradient-to-br hover:from-purple-600 hover:to-pink-500 hover:text-white transition-all duration-300"
                      data-testid="button-social-instagram"
                    >
                      <Instagram className="h-5 w-5" />
                    </a>
                  )}
                  {settings?.twitterUrl && (
                    <a 
                      href={settings.twitterUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-500 hover:bg-sky-500 hover:text-white transition-all duration-300"
                      data-testid="button-social-twitter"
                    >
                      <Twitter className="h-5 w-5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Footer Link Groups */}
          <div className="lg:col-span-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              {(() => {
                const footerLinks = settings?.footerLinks;
                if (!footerLinks || !Array.isArray(footerLinks)) return null;
                
                return (footerLinks as FooterLinkGroup[]).map((group, groupIndex) => {
                  if (!group || !group.id || !Array.isArray(group.links)) return null;
                  
                  return (
                    <div key={group.id} className="space-y-4">
                      <h3 className="font-bold text-base relative inline-block" data-testid={`text-footer-links-${groupIndex}`}>
                        {language === 'ar' ? group.titleAr : group.titleEn}
                        <span className="absolute -bottom-1 start-0 w-8 h-0.5 bg-primary rounded-full"></span>
                      </h3>
                      <ul className="space-y-2.5">
                        {group.links.map((link, linkIndex) => {
                          if (!link || !link.id) return null;
                          const label = language === 'ar' ? link.labelAr : link.labelEn;
                          
                          if (link.isExternal) {
                            return (
                              <li key={link.id}>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                                  data-testid={`link-footer-${groupIndex}-${linkIndex}`}
                                >
                                  <ChevronIcon className="h-3 w-3 opacity-50" />
                                  {label}
                                  <ExternalLink className="h-3 w-3 opacity-50" />
                                </a>
                              </li>
                            );
                          }
                          
                          return (
                            <li key={link.id}>
                              <Link 
                                href={link.url}
                                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                                data-testid={`link-footer-${groupIndex}-${linkIndex}`}
                              >
                                <ChevronIcon className="h-3 w-3 opacity-50" />
                                {label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Newsletter & Map Column */}
          <div className="lg:col-span-3 space-y-6">
            {/* Newsletter */}
            <div className="bg-card rounded-xl p-5 border border-border/50">
              <h3 className="font-bold text-base mb-2" data-testid="text-footer-newsletter">
                {t('footer.newsletter')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('footer.newsletterDesc')}
              </p>
              <div className="space-y-2">
                <Input 
                  placeholder={t('footer.newsletterPlaceholder')} 
                  className="bg-background" 
                  data-testid="input-newsletter" 
                />
                <Button className="w-full gap-2" data-testid="button-newsletter-subscribe">
                  <Send className="h-4 w-4" />
                  {t('footer.subscribe')}
                </Button>
              </div>
            </div>

            {/* Mini Map */}
            <div className="rounded-xl overflow-hidden border border-border/50">
              <div className="flex items-center gap-2 p-3 bg-card border-b border-border/50">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{t('footer.location')}</span>
              </div>
              <div className="h-36">
                <MapContainer 
                  center={[32.60524733098948, 44.02350055860585] as [number, number]} 
                  zoom={15} 
                  style={{ height: '100%', width: '100%' }} 
                  data-testid="map-store-location"
                  zoomControl={false}
                  attributionControl={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[32.60524733098948, 44.02350055860585] as [number, number]}>
                    <Popup>
                      <div className="text-center p-1">
                        <p className="font-bold text-sm">{storeName}</p>
                        <p className="text-xs text-muted-foreground">{address}</p>
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
              <div className="p-2 bg-card">
                <p className="text-xs text-muted-foreground text-center">{address}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods & Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            {/* Payment Methods */}
            <div className="flex flex-col items-center md:items-start gap-2">
              <p className="text-xs text-muted-foreground font-medium">{isRTL ? 'طرق الدفع المتاحة' : 'Payment Methods'}</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 px-3 py-1.5 bg-card rounded-lg border border-border/50">
                  <SiVisa className="h-6 w-10 text-blue-600" />
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 bg-card rounded-lg border border-border/50">
                  <SiMastercard className="h-6 w-10 text-orange-500" />
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 bg-card rounded-lg border border-border/50">
                  <span className="text-xs font-bold text-green-600">ZainCash</span>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 bg-card rounded-lg border border-border/50">
                  <span className="text-xs font-bold text-blue-500">QiCard</span>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 bg-card rounded-lg border border-border/50">
                  <span className="text-xs font-bold">{isRTL ? 'نقداً' : 'Cash'}</span>
                </div>
              </div>
            </div>

            {/* Security Badge */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-5 w-5 text-green-600" />
              <span className="text-xs">{isRTL ? 'تسوق آمن ومضمون 100%' : '100% Secure Shopping'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright Bar */}
      <div className="bg-foreground/5 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 text-sm text-muted-foreground">
            <p data-testid="text-copyright" className="flex items-center gap-1.5">
              <Award className="h-4 w-4 text-primary" />
              {copyrightText || t('footer.copyright')}
            </p>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-foreground transition-colors" data-testid="link-privacy">
                {t('footer.privacy')}
              </Link>
              <Link href="/terms" className="hover:text-foreground transition-colors" data-testid="link-terms">
                {t('footer.terms')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
