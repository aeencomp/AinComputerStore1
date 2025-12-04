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
  CreditCard, HeadphonesIcon, Award, ArrowRight, ArrowLeft,
  Sparkles, CheckCircle2, Star
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
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  
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

  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative mt-16 md:mt-24" data-testid="footer">
      {/* Premium Newsletter Banner */}
      <div className="bg-gradient-to-r from-primary via-primary/90 to-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-10 md:py-14 relative">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-start">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-primary-foreground/80" />
                <span className="text-primary-foreground/80 text-sm font-medium">
                  {isRTL ? 'حصرياً لمشتركينا' : 'Exclusive for Subscribers'}
                </span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-2">
                {isRTL ? 'اشترك واحصل على خصم 10%' : 'Subscribe & Get 10% Off'}
              </h3>
              <p className="text-primary-foreground/70 text-sm md:text-base">
                {isRTL ? 'احصل على أحدث العروض والخصومات مباشرة في بريدك' : 'Get the latest deals and discounts directly in your inbox'}
              </p>
            </div>
            <div className="w-full md:w-auto">
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Input 
                  placeholder={t('footer.newsletterPlaceholder')} 
                  className="bg-white/10 border-white/20 text-primary-foreground placeholder:text-primary-foreground/50 h-12 w-full md:w-72 focus:bg-white/20" 
                  data-testid="input-newsletter" 
                />
                <Button 
                  variant="secondary" 
                  size="lg"
                  className="h-12 px-8 font-semibold gap-2 whitespace-nowrap" 
                  data-testid="button-newsletter-subscribe"
                >
                  {t('footer.subscribe')}
                  <ArrowIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="bg-foreground text-background">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16">
          {/* Top Section - Logo & Trust */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 pb-12 border-b border-background/10">
            {/* Logo Section */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary/50 rounded-2xl blur opacity-30"></div>
                <img 
                  src={logoUrl} 
                  alt={storeName} 
                  className="relative w-16 h-16 md:w-20 md:h-20 rounded-xl object-cover border-2 border-background/20"
                />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold" data-testid="text-footer-store-name">{storeName}</h2>
                <p className="text-background/60 text-sm">{isRTL ? 'وجهتك الأولى للإلكترونيات' : 'Your #1 Electronics Destination'}</p>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-6 md:gap-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-background/10 flex items-center justify-center">
                  <Truck className="h-6 w-6 text-primary" />
                </div>
                <div className="text-start">
                  <p className="font-semibold text-sm">{isRTL ? 'توصيل سريع' : 'Fast Shipping'}</p>
                  <p className="text-xs text-background/50">{isRTL ? 'لكل العراق' : 'All of Iraq'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-background/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-green-400" />
                </div>
                <div className="text-start">
                  <p className="font-semibold text-sm">{isRTL ? 'ضمان رسمي' : 'Official Warranty'}</p>
                  <p className="text-xs text-background/50">{isRTL ? 'منتجات أصلية' : 'Genuine Products'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-background/10 flex items-center justify-center">
                  <HeadphonesIcon className="h-6 w-6 text-blue-400" />
                </div>
                <div className="text-start">
                  <p className="font-semibold text-sm">{isRTL ? 'دعم متواصل' : '24/7 Support'}</p>
                  <p className="text-xs text-background/50">{isRTL ? 'نحن هنا لمساعدتك' : "We're here to help"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 py-12">
            {/* Contact Info */}
            <div className="lg:col-span-4 space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="w-8 h-0.5 bg-primary rounded-full"></span>
                {isRTL ? 'تواصل معنا' : 'Contact Us'}
              </h3>
              
              <p className="text-background/60 text-sm leading-relaxed">
                {aboutText || description}
              </p>

              <div className="space-y-4">
                <a 
                  href={`mailto:${email}`}
                  className="flex items-center gap-4 group"
                  data-testid="link-footer-email"
                >
                  <div className="w-11 h-11 rounded-xl bg-background/5 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-background/50 mb-0.5">{isRTL ? 'البريد الإلكتروني' : 'Email'}</p>
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">{email}</p>
                  </div>
                </a>
                
                <a 
                  href={`tel:${phone}`}
                  className="flex items-center gap-4 group"
                  data-testid="link-footer-phone"
                >
                  <div className="w-11 h-11 rounded-xl bg-background/5 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-background/50 mb-0.5">{isRTL ? 'رقم الهاتف' : 'Phone'}</p>
                    <p className="text-sm font-medium group-hover:text-primary transition-colors" dir="ltr">{phone}</p>
                  </div>
                </a>

                {settings?.whatsappNumber && (
                  <a 
                    href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 group"
                    data-testid="link-footer-whatsapp"
                  >
                    <div className="w-11 h-11 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-all duration-300">
                      <SiWhatsapp className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs text-background/50 mb-0.5">{isRTL ? 'واتساب' : 'WhatsApp'}</p>
                      <p className="text-sm font-medium text-green-400 group-hover:text-green-300 transition-colors">{isRTL ? 'تواصل الآن' : 'Chat Now'}</p>
                    </div>
                  </a>
                )}

                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-background/5 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-background/50 mb-0.5">{isRTL ? 'ساعات العمل' : 'Working Hours'}</p>
                    <p className="text-sm font-medium">{hours}</p>
                  </div>
                </div>
              </div>

              {/* Social Icons */}
              {(settings?.twitterUrl || settings?.instagramUrl || settings?.facebookUrl || settings?.whatsappNumber) && (
                <div className="pt-4">
                  <p className="text-sm text-background/50 mb-4">{t('footer.followUs')}</p>
                  <div className="flex gap-3">
                    {settings?.whatsappNumber && (
                      <a 
                        href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-11 h-11 rounded-xl bg-background/5 flex items-center justify-center text-green-400 hover:bg-green-500 hover:text-white transition-all duration-300 hover:scale-110"
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
                        className="w-11 h-11 rounded-xl bg-background/5 flex items-center justify-center text-blue-400 hover:bg-blue-600 hover:text-white transition-all duration-300 hover:scale-110"
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
                        className="w-11 h-11 rounded-xl bg-background/5 flex items-center justify-center text-pink-400 hover:bg-gradient-to-br hover:from-purple-600 hover:to-pink-500 hover:text-white transition-all duration-300 hover:scale-110"
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
                        className="w-11 h-11 rounded-xl bg-background/5 flex items-center justify-center text-sky-400 hover:bg-sky-500 hover:text-white transition-all duration-300 hover:scale-110"
                        data-testid="button-social-twitter"
                      >
                        <Twitter className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Footer Links */}
            <div className="lg:col-span-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                {(() => {
                  const footerLinks = settings?.footerLinks;
                  if (!footerLinks || !Array.isArray(footerLinks)) return null;
                  
                  return (footerLinks as FooterLinkGroup[]).map((group, groupIndex) => {
                    if (!group || !group.id || !Array.isArray(group.links)) return null;
                    
                    return (
                      <div key={group.id} className="space-y-5">
                        <h3 className="text-lg font-bold flex items-center gap-2" data-testid={`text-footer-links-${groupIndex}`}>
                          <span className="w-8 h-0.5 bg-primary rounded-full"></span>
                          {language === 'ar' ? group.titleAr : group.titleEn}
                        </h3>
                        <ul className="space-y-3">
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
                                    className="flex items-center gap-2 text-sm text-background/60 hover:text-primary transition-colors group"
                                    data-testid={`link-footer-${groupIndex}-${linkIndex}`}
                                  >
                                    <ChevronIcon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
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
                                  className="flex items-center gap-2 text-sm text-background/60 hover:text-primary transition-colors group"
                                  data-testid={`link-footer-${groupIndex}-${linkIndex}`}
                                >
                                  <ChevronIcon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
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

            {/* Map & Location */}
            <div className="lg:col-span-3 space-y-5">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="w-8 h-0.5 bg-primary rounded-full"></span>
                {t('footer.location')}
              </h3>
              
              <div className="rounded-2xl overflow-hidden border border-background/10">
                <div className="h-44">
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
                <div className="p-4 bg-background/5">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-background/70 leading-relaxed">{address}</p>
                  </div>
                </div>
              </div>

              {/* App Download Badges (placeholder) */}
              <div className="pt-2">
                <p className="text-xs text-background/40 mb-3">{isRTL ? 'قريباً على' : 'Coming Soon on'}</p>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-background/5 rounded-xl border border-background/10">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.523 2H6.477C5.109 2 4 3.109 4 4.477v15.046C4 20.891 5.109 22 6.477 22h11.046C18.891 22 20 20.891 20 19.523V4.477C20 3.109 18.891 2 17.523 2zM12 20c-.69 0-1.25-.56-1.25-1.25S11.31 17.5 12 17.5s1.25.56 1.25 1.25S12.69 20 12 20zm4-4H8V5h8v11z"/>
                    </svg>
                    <span className="text-xs font-medium">Android</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Methods Section */}
          <div className="pt-10 border-t border-background/10">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              {/* Payment Methods */}
              <div className="flex flex-col items-center lg:items-start gap-3">
                <p className="text-xs text-background/40 font-medium uppercase tracking-wider">
                  {isRTL ? 'طرق الدفع المعتمدة' : 'Accepted Payment Methods'}
                </p>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <div className="flex items-center justify-center h-10 px-4 bg-white rounded-lg">
                    <SiVisa className="h-6 w-auto text-[#1A1F71]" />
                  </div>
                  <div className="flex items-center justify-center h-10 px-4 bg-white rounded-lg">
                    <SiMastercard className="h-6 w-auto text-[#EB001B]" />
                  </div>
                  <div className="flex items-center justify-center h-10 px-5 bg-gradient-to-r from-green-500 to-green-600 rounded-lg">
                    <span className="text-white text-sm font-bold">ZainCash</span>
                  </div>
                  <div className="flex items-center justify-center h-10 px-5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg">
                    <span className="text-white text-sm font-bold">QiCard</span>
                  </div>
                  <div className="flex items-center justify-center h-10 px-5 bg-background/10 rounded-lg border border-background/20">
                    <span className="text-sm font-medium">{isRTL ? 'الدفع عند الاستلام' : 'Cash on Delivery'}</span>
                  </div>
                </div>
              </div>

              {/* Security Badges */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-background/60">
                  <Shield className="h-5 w-5 text-green-400" />
                  <span className="text-xs">{isRTL ? 'دفع آمن 100%' : '100% Secure'}</span>
                </div>
                <div className="flex items-center gap-2 text-background/60">
                  <CheckCircle2 className="h-5 w-5 text-blue-400" />
                  <span className="text-xs">{isRTL ? 'موثق ومعتمد' : 'Verified & Trusted'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright Bar */}
        <div className="border-t border-background/10">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-background/50">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                <p data-testid="text-copyright">
                  {copyrightText || `© ${currentYear} ${storeName}. ${isRTL ? 'جميع الحقوق محفوظة' : 'All rights reserved'}.`}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <Link href="/privacy" className="hover:text-primary transition-colors" data-testid="link-privacy">
                  {t('footer.privacy')}
                </Link>
                <span className="text-background/20">|</span>
                <Link href="/terms" className="hover:text-primary transition-colors" data-testid="link-terms">
                  {t('footer.terms')}
                </Link>
                <span className="text-background/20">|</span>
                <Link href="/refund" className="hover:text-primary transition-colors">
                  {isRTL ? 'سياسة الإرجاع' : 'Refund Policy'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
