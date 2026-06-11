import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { trackMetaEvent } from "@/lib/metaPixel";
import type { StoreSettings } from "@shared/schema";
import { Wrench, ShoppingBag, MessageCircle, MapPin, Clock, Shield, Laptop } from "lucide-react";
import heroImage from "@assets/generated_images/gaming_setup_hero_banner.png";

function formatIraqiPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("964")) return digits;
  if (digits.startsWith("0")) return `964${digits.slice(1)}`;
  return `964${digits}`;
}

export default function PromoLanding() {
  const { language } = useLanguage();
  const ar = language === "ar";

  const { data: settings } = useQuery<StoreSettings>({
    queryKey: ["/api/store-settings"],
  });

  const storeName = ar
    ? settings?.storeNameAr || "العين لتجارة الحاسبات"
    : settings?.storeNameEn || "Al-Ain Computer Store";
  const address = ar
    ? settings?.addressAr || "كربلاء، العراق"
    : settings?.addressEn || "Karbala, Iraq";
  const hours = ar ? settings?.hoursAr : settings?.hoursEn;
  const whatsapp = settings?.whatsappNumber?.trim();
  const heroBg = settings?.heroImageUrl || heroImage;

  useEffect(() => {
    trackMetaEvent("ViewContent", {
      content_name: "promo_landing",
      content_category: "ad_campaign",
    });
  }, []);

  const whatsappUrl = whatsapp
    ? `https://wa.me/${formatIraqiPhone(whatsapp)}?text=${encodeURIComponent(
        ar
          ? "السلام عليكم، شفت إعلانكم — أريد استفسار عن صيانة أو شراء جهاز"
          : "Hi, I saw your ad — I want to ask about repair or buying a device",
      )}`
    : null;

  const onRepairClick = () => {
    trackMetaEvent("Lead", { content_name: "repair_request", content_category: "promo" });
  };

  const onShopClick = () => {
    trackMetaEvent("ViewContent", { content_name: "products", content_category: "promo" });
  };

  const onWhatsAppClick = () => {
    trackMetaEvent("Contact", { content_name: "whatsapp", content_category: "promo" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={ar ? "rtl" : "ltr"}>
      <Header />
      <main className="flex-1">
        <section className="relative min-h-[55vh] flex items-center overflow-hidden">
          <img
            src={heroBg}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
          <div className="relative container mx-auto px-4 py-16 max-w-4xl text-center space-y-6">
            <p className="text-sm font-medium text-primary uppercase tracking-wide">
              {ar ? "كربلاء · العراق" : "Karbala, Iraq"}
            </p>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">{storeName}</h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              {ar
                ? "صيانة لابتوب وكمبيوتر · بيع أجهزة أصلية · أسعار مناسبة"
                : "Laptop & PC repair · Genuine devices · Fair prices"}
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button size="lg" className="gap-2 text-base px-8" asChild>
                <Link href="/repair-request" onClick={onRepairClick}>
                  <Wrench className="h-5 w-5" />
                  {ar ? "اطلب صيانة" : "Request repair"}
                </Link>
              </Button>
              <Button size="lg" variant="secondary" className="gap-2 text-base px-8" asChild>
                <Link href="/products" onClick={onShopClick}>
                  <ShoppingBag className="h-5 w-5" />
                  {ar ? "تسوق الآن" : "Shop now"}
                </Link>
              </Button>
              {whatsappUrl && (
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 text-base px-8 border-[#25D366] text-[#128C7E] hover:bg-[#25D366]/10"
                  asChild
                >
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={onWhatsAppClick}>
                    <MessageCircle className="h-5 w-5" />
                    {ar ? "واتساب" : "WhatsApp"}
                  </a>
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6 text-center space-y-2">
                <Wrench className="h-8 w-8 mx-auto text-primary" />
                <p className="font-semibold">{ar ? "صيانة سريعة" : "Fast repair"}</p>
                <p className="text-sm text-muted-foreground">
                  {ar ? "لابتوب وكمبيوتر مكتبي" : "Laptops & desktops"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center space-y-2">
                <Laptop className="h-8 w-8 mx-auto text-primary" />
                <p className="font-semibold">{ar ? "أجهزة أصلية" : "Genuine devices"}</p>
                <p className="text-sm text-muted-foreground">
                  {ar ? "لابتوبات وكمبيوتر" : "Laptops & PCs"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center space-y-2">
                <Shield className="h-8 w-8 mx-auto text-primary" />
                <p className="font-semibold">{ar ? "ضمان وخدمة" : "Warranty & service"}</p>
                <p className="text-sm text-muted-foreground">
                  {ar ? "ثقة بعد البيع" : "After-sales support"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-10 rounded-lg border bg-muted/30 p-6 space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{address}</span>
            </div>
            {hours && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                <span>{hours}</span>
              </div>
            )}
            {whatsapp && (
              <p className="font-mono text-lg font-semibold" dir="ltr">
                {whatsapp}
              </p>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
