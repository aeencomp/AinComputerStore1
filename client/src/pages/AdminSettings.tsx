import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowRight, Save, Store, Palette, Search, Home, CreditCard, FileText, Plus, Trash2, GripVertical, ExternalLink, Link as LinkIcon } from "lucide-react";
import { Link } from "wouter";
import type { StoreSettings, FooterLinkGroup, FooterLink } from "@shared/schema";
import { useMemo, useState, useEffect } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";

export default function AdminSettings() {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("store");
  const [footerLinks, setFooterLinks] = useState<FooterLinkGroup[]>([]);

  const storeSettingsFormSchema = useMemo(() => z.object({
    storeNameAr: z.string().min(1, t("admin.settings.validation.storeNameArRequired")),
    storeNameEn: z.string().min(1, t("admin.settings.validation.storeNameEnRequired")),
    descriptionAr: z.string().min(1, t("admin.settings.validation.descriptionArRequired")),
    descriptionEn: z.string().min(1, t("admin.settings.validation.descriptionEnRequired")),
    email: z.string().email(t("admin.settings.validation.emailInvalid")),
    phone: z.string().min(1, t("admin.settings.validation.phoneRequired")),
    phoneAr: z.string().min(1, t("admin.settings.validation.phoneArRequired")),
    addressAr: z.string().min(1, t("admin.settings.validation.addressArRequired")),
    addressEn: z.string().min(1, t("admin.settings.validation.addressEnRequired")),
    hoursAr: z.string().min(1, t("admin.settings.validation.hoursArRequired")),
    hoursEn: z.string().min(1, t("admin.settings.validation.hoursEnRequired")),
    facebookUrl: z.string().optional(),
    twitterUrl: z.string().optional(),
    instagramUrl: z.string().optional(),
    whatsappNumber: z.string().optional(),
    logoUrl: z.string().optional(),
    faviconUrl: z.string().optional(),
    primaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    metaTitleAr: z.string().optional(),
    metaTitleEn: z.string().optional(),
    metaDescriptionAr: z.string().optional(),
    metaDescriptionEn: z.string().optional(),
    metaKeywordsAr: z.string().optional(),
    metaKeywordsEn: z.string().optional(),
    heroTitleAr: z.string().optional(),
    heroTitleEn: z.string().optional(),
    heroSubtitleAr: z.string().optional(),
    heroSubtitleEn: z.string().optional(),
    heroImageUrl: z.string().optional(),
    showHeroBanner: z.number().optional(),
    showFeaturedProducts: z.number().optional(),
    showCategories: z.number().optional(),
    featuredProductsCount: z.number().optional(),
    copyrightTextAr: z.string().optional(),
    copyrightTextEn: z.string().optional(),
    aboutTextAr: z.string().optional(),
    aboutTextEn: z.string().optional(),
    shippingCost: z.string().optional(),
    freeShippingThreshold: z.string().optional(),
    enableFreeShipping: z.number().optional(),
    enableCashOnDelivery: z.number().optional(),
    enableElectronicPayment: z.number().optional(),
    currencySymbolAr: z.string().optional(),
    currencySymbolEn: z.string().optional(),
  }), [t]);

  type StoreSettingsForm = z.infer<typeof storeSettingsFormSchema>;

  const { data: settings, isLoading } = useQuery<StoreSettings>({
    queryKey: ["/api/store-settings"],
  });

  const form = useForm<StoreSettingsForm>({
    resolver: zodResolver(storeSettingsFormSchema),
    values: settings ? {
      storeNameAr: settings.storeNameAr,
      storeNameEn: settings.storeNameEn,
      descriptionAr: settings.descriptionAr,
      descriptionEn: settings.descriptionEn,
      email: settings.email,
      phone: settings.phone,
      phoneAr: settings.phoneAr,
      addressAr: settings.addressAr,
      addressEn: settings.addressEn,
      hoursAr: settings.hoursAr,
      hoursEn: settings.hoursEn,
      facebookUrl: settings.facebookUrl || "",
      twitterUrl: settings.twitterUrl || "",
      instagramUrl: settings.instagramUrl || "",
      whatsappNumber: settings.whatsappNumber || "",
      logoUrl: settings.logoUrl || "",
      faviconUrl: settings.faviconUrl || "",
      primaryColor: settings.primaryColor || "#3B82F6",
      accentColor: settings.accentColor || "#10B981",
      metaTitleAr: settings.metaTitleAr || "",
      metaTitleEn: settings.metaTitleEn || "",
      metaDescriptionAr: settings.metaDescriptionAr || "",
      metaDescriptionEn: settings.metaDescriptionEn || "",
      metaKeywordsAr: settings.metaKeywordsAr || "",
      metaKeywordsEn: settings.metaKeywordsEn || "",
      heroTitleAr: settings.heroTitleAr || "",
      heroTitleEn: settings.heroTitleEn || "",
      heroSubtitleAr: settings.heroSubtitleAr || "",
      heroSubtitleEn: settings.heroSubtitleEn || "",
      heroImageUrl: settings.heroImageUrl || "",
      showHeroBanner: settings.showHeroBanner ?? 1,
      showFeaturedProducts: settings.showFeaturedProducts ?? 1,
      showCategories: settings.showCategories ?? 1,
      featuredProductsCount: settings.featuredProductsCount ?? 8,
      copyrightTextAr: settings.copyrightTextAr || "",
      copyrightTextEn: settings.copyrightTextEn || "",
      aboutTextAr: settings.aboutTextAr || "",
      aboutTextEn: settings.aboutTextEn || "",
      shippingCost: settings.shippingCost || "5000",
      freeShippingThreshold: settings.freeShippingThreshold || "100000",
      enableFreeShipping: settings.enableFreeShipping ?? 1,
      enableCashOnDelivery: settings.enableCashOnDelivery ?? 1,
      enableElectronicPayment: settings.enableElectronicPayment ?? 0,
      currencySymbolAr: settings.currencySymbolAr || "د.ع",
      currencySymbolEn: settings.currencySymbolEn || "IQD",
    } : undefined,
  });

  // Sync footer links from settings
  useEffect(() => {
    if (settings?.footerLinks) {
      setFooterLinks(settings.footerLinks as FooterLinkGroup[]);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: StoreSettingsForm) => {
      // Include footer links in the update
      const dataWithFooterLinks = { ...data, footerLinks };
      return apiRequest("PUT", "/api/admin/store-settings", dataWithFooterLinks);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store-settings"] });
      toast({
        title: t("admin.settings.successTitle"),
        description: t("admin.settings.successMessage"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("admin.settings.errorMessage"),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: StoreSettingsForm) => {
    updateMutation.mutate(data);
  };

  // Footer links management functions
  const addLinkGroup = () => {
    const newGroup: FooterLinkGroup = {
      id: `group-${Date.now()}`,
      titleAr: "",
      titleEn: "",
      links: []
    };
    setFooterLinks([...footerLinks, newGroup]);
  };

  const removeLinkGroup = (groupId: string) => {
    setFooterLinks(footerLinks.filter(g => g.id !== groupId));
  };

  const updateLinkGroup = (groupId: string, field: keyof FooterLinkGroup, value: string) => {
    setFooterLinks(footerLinks.map(g => 
      g.id === groupId ? { ...g, [field]: value } : g
    ));
  };

  const addLink = (groupId: string) => {
    const newLink: FooterLink = {
      id: `link-${Date.now()}`,
      labelAr: "",
      labelEn: "",
      url: "",
      isExternal: false
    };
    setFooterLinks(footerLinks.map(g => 
      g.id === groupId ? { ...g, links: [...g.links, newLink] } : g
    ));
  };

  const removeLink = (groupId: string, linkId: string) => {
    setFooterLinks(footerLinks.map(g => 
      g.id === groupId ? { ...g, links: g.links.filter(l => l.id !== linkId) } : g
    ));
  };

  const updateLink = (groupId: string, linkId: string, field: keyof FooterLink, value: string | boolean) => {
    setFooterLinks(footerLinks.map(g => 
      g.id === groupId 
        ? { ...g, links: g.links.map(l => l.id === linkId ? { ...l, [field]: value } : l) }
        : g
    ));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            {t("admin.settings.title")}
          </h1>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 mb-6">
              <TabsTrigger value="store" className="flex items-center gap-2" data-testid="tab-store">
                <Store className="h-4 w-4" />
                <span className="hidden sm:inline">{t("admin.settings.tabs.store")}</span>
              </TabsTrigger>
              <TabsTrigger value="theme" className="flex items-center gap-2" data-testid="tab-theme">
                <Palette className="h-4 w-4" />
                <span className="hidden sm:inline">{t("admin.settings.tabs.theme")}</span>
              </TabsTrigger>
              <TabsTrigger value="seo" className="flex items-center gap-2" data-testid="tab-seo">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">{t("admin.settings.tabs.seo")}</span>
              </TabsTrigger>
              <TabsTrigger value="homepage" className="flex items-center gap-2" data-testid="tab-homepage">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">{t("admin.settings.tabs.homepage")}</span>
              </TabsTrigger>
              <TabsTrigger value="footer" className="flex items-center gap-2" data-testid="tab-footer">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">{t("admin.settings.tabs.footer")}</span>
              </TabsTrigger>
              <TabsTrigger value="shipping" className="flex items-center gap-2" data-testid="tab-shipping">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">{t("admin.settings.tabs.shipping")}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="store" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.settings.storeInfo")}</CardTitle>
                  <CardDescription>{t("admin.settings.storeInfoDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="storeNameAr">{t("admin.settings.storeNameAr")}</Label>
                      <Input
                        id="storeNameAr"
                        {...form.register("storeNameAr")}
                        data-testid="input-store-name-ar"
                      />
                      {form.formState.errors.storeNameAr && (
                        <p className="text-sm text-destructive">{form.formState.errors.storeNameAr.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="storeNameEn">{t("admin.settings.storeNameEn")}</Label>
                      <Input
                        id="storeNameEn"
                        {...form.register("storeNameEn")}
                        data-testid="input-store-name-en"
                      />
                      {form.formState.errors.storeNameEn && (
                        <p className="text-sm text-destructive">{form.formState.errors.storeNameEn.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="descriptionAr">{t("admin.settings.descriptionAr")}</Label>
                      <Textarea
                        id="descriptionAr"
                        {...form.register("descriptionAr")}
                        data-testid="input-description-ar"
                      />
                      {form.formState.errors.descriptionAr && (
                        <p className="text-sm text-destructive">{form.formState.errors.descriptionAr.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="descriptionEn">{t("admin.settings.descriptionEn")}</Label>
                      <Textarea
                        id="descriptionEn"
                        {...form.register("descriptionEn")}
                        data-testid="input-description-en"
                      />
                      {form.formState.errors.descriptionEn && (
                        <p className="text-sm text-destructive">{form.formState.errors.descriptionEn.message}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.settings.contactInfo")}</CardTitle>
                  <CardDescription>{t("admin.settings.contactInfoDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("admin.settings.email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      {...form.register("email")}
                      data-testid="input-email"
                    />
                    {form.formState.errors.email && (
                      <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t("admin.settings.phone")}</Label>
                      <Input
                        id="phone"
                        {...form.register("phone")}
                        data-testid="input-phone"
                      />
                      {form.formState.errors.phone && (
                        <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phoneAr">{t("admin.settings.phoneAr")}</Label>
                      <Input
                        id="phoneAr"
                        {...form.register("phoneAr")}
                        data-testid="input-phone-ar"
                      />
                      {form.formState.errors.phoneAr && (
                        <p className="text-sm text-destructive">{form.formState.errors.phoneAr.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="addressAr">{t("admin.settings.addressAr")}</Label>
                      <Input
                        id="addressAr"
                        {...form.register("addressAr")}
                        data-testid="input-address-ar"
                      />
                      {form.formState.errors.addressAr && (
                        <p className="text-sm text-destructive">{form.formState.errors.addressAr.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addressEn">{t("admin.settings.addressEn")}</Label>
                      <Input
                        id="addressEn"
                        {...form.register("addressEn")}
                        data-testid="input-address-en"
                      />
                      {form.formState.errors.addressEn && (
                        <p className="text-sm text-destructive">{form.formState.errors.addressEn.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hoursAr">{t("admin.settings.hoursAr")}</Label>
                      <Input
                        id="hoursAr"
                        {...form.register("hoursAr")}
                        data-testid="input-hours-ar"
                      />
                      {form.formState.errors.hoursAr && (
                        <p className="text-sm text-destructive">{form.formState.errors.hoursAr.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hoursEn">{t("admin.settings.hoursEn")}</Label>
                      <Input
                        id="hoursEn"
                        {...form.register("hoursEn")}
                        data-testid="input-hours-en"
                      />
                      {form.formState.errors.hoursEn && (
                        <p className="text-sm text-destructive">{form.formState.errors.hoursEn.message}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.settings.socialMedia")}</CardTitle>
                  <CardDescription>{t("admin.settings.socialMediaDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="facebookUrl">{t("admin.settings.facebookUrl")}</Label>
                    <Input
                      id="facebookUrl"
                      {...form.register("facebookUrl")}
                      placeholder="https://facebook.com/..."
                      data-testid="input-facebook"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitterUrl">{t("admin.settings.twitterUrl")}</Label>
                    <Input
                      id="twitterUrl"
                      {...form.register("twitterUrl")}
                      placeholder="https://twitter.com/..."
                      data-testid="input-twitter"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instagramUrl">{t("admin.settings.instagramUrl")}</Label>
                    <Input
                      id="instagramUrl"
                      {...form.register("instagramUrl")}
                      placeholder="https://instagram.com/..."
                      data-testid="input-instagram"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsappNumber">{t("admin.settings.whatsappNumber")}</Label>
                    <Input
                      id="whatsappNumber"
                      {...form.register("whatsappNumber")}
                      placeholder="07XXXXXXXXX"
                      data-testid="input-whatsapp"
                    />
                    <p className="text-sm text-muted-foreground">{t("admin.settings.whatsappNumberHint")}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="theme" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.settings.theme.branding")}</CardTitle>
                  <CardDescription>{t("admin.settings.theme.brandingDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="logoUrl">{t("admin.settings.theme.logoUrl")}</Label>
                      <Input
                        id="logoUrl"
                        {...form.register("logoUrl")}
                        placeholder="https://example.com/logo.png"
                        data-testid="input-logo-url"
                      />
                      <p className="text-sm text-muted-foreground">{t("admin.settings.theme.logoUrlHint")}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="faviconUrl">{t("admin.settings.theme.faviconUrl")}</Label>
                      <Input
                        id="faviconUrl"
                        {...form.register("faviconUrl")}
                        placeholder="https://example.com/favicon.ico"
                        data-testid="input-favicon-url"
                      />
                      <p className="text-sm text-muted-foreground">{t("admin.settings.theme.faviconUrlHint")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.settings.theme.colors")}</CardTitle>
                  <CardDescription>{t("admin.settings.theme.colorsDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primaryColor">{t("admin.settings.theme.primaryColor")}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primaryColor"
                          type="color"
                          className="w-16 h-10 p-1"
                          {...form.register("primaryColor")}
                          data-testid="input-primary-color"
                        />
                        <Input
                          {...form.register("primaryColor")}
                          placeholder="#3B82F6"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accentColor">{t("admin.settings.theme.accentColor")}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="accentColor"
                          type="color"
                          className="w-16 h-10 p-1"
                          {...form.register("accentColor")}
                          data-testid="input-accent-color"
                        />
                        <Input
                          {...form.register("accentColor")}
                          placeholder="#10B981"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.settings.theme.currency")}</CardTitle>
                  <CardDescription>{t("admin.settings.theme.currencyDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currencySymbolAr">{t("admin.settings.theme.currencySymbolAr")}</Label>
                      <Input
                        id="currencySymbolAr"
                        {...form.register("currencySymbolAr")}
                        placeholder="د.ع"
                        data-testid="input-currency-ar"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currencySymbolEn">{t("admin.settings.theme.currencySymbolEn")}</Label>
                      <Input
                        id="currencySymbolEn"
                        {...form.register("currencySymbolEn")}
                        placeholder="IQD"
                        data-testid="input-currency-en"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="seo" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.settings.seo.metaTitle")}</CardTitle>
                  <CardDescription>{t("admin.settings.seo.metaTitleDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="metaTitleAr">{t("admin.settings.seo.metaTitleAr")}</Label>
                      <Input
                        id="metaTitleAr"
                        {...form.register("metaTitleAr")}
                        data-testid="input-meta-title-ar"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="metaTitleEn">{t("admin.settings.seo.metaTitleEn")}</Label>
                      <Input
                        id="metaTitleEn"
                        {...form.register("metaTitleEn")}
                        data-testid="input-meta-title-en"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.settings.seo.metaDescription")}</CardTitle>
                  <CardDescription>{t("admin.settings.seo.metaDescriptionDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="metaDescriptionAr">{t("admin.settings.seo.metaDescriptionAr")}</Label>
                      <Textarea
                        id="metaDescriptionAr"
                        {...form.register("metaDescriptionAr")}
                        data-testid="input-meta-desc-ar"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="metaDescriptionEn">{t("admin.settings.seo.metaDescriptionEn")}</Label>
                      <Textarea
                        id="metaDescriptionEn"
                        {...form.register("metaDescriptionEn")}
                        data-testid="input-meta-desc-en"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.settings.seo.keywords")}</CardTitle>
                  <CardDescription>{t("admin.settings.seo.keywordsDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="metaKeywordsAr">{t("admin.settings.seo.keywordsAr")}</Label>
                      <Input
                        id="metaKeywordsAr"
                        {...form.register("metaKeywordsAr")}
                        placeholder={t("admin.settings.seo.keywordsPlaceholder")}
                        data-testid="input-keywords-ar"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="metaKeywordsEn">{t("admin.settings.seo.keywordsEn")}</Label>
                      <Input
                        id="metaKeywordsEn"
                        {...form.register("metaKeywordsEn")}
                        placeholder={t("admin.settings.seo.keywordsPlaceholder")}
                        data-testid="input-keywords-en"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="homepage" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.settings.homepage.hero")}</CardTitle>
                  <CardDescription>{t("admin.settings.homepage.heroDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="showHeroBanner">{t("admin.settings.homepage.showHeroBanner")}</Label>
                    <Switch
                      id="showHeroBanner"
                      checked={form.watch("showHeroBanner") === 1}
                      onCheckedChange={(checked) => form.setValue("showHeroBanner", checked ? 1 : 0)}
                      data-testid="switch-show-hero"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="heroTitleAr">{t("admin.settings.homepage.heroTitleAr")}</Label>
                      <Input
                        id="heroTitleAr"
                        {...form.register("heroTitleAr")}
                        data-testid="input-hero-title-ar"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="heroTitleEn">{t("admin.settings.homepage.heroTitleEn")}</Label>
                      <Input
                        id="heroTitleEn"
                        {...form.register("heroTitleEn")}
                        data-testid="input-hero-title-en"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="heroSubtitleAr">{t("admin.settings.homepage.heroSubtitleAr")}</Label>
                      <Input
                        id="heroSubtitleAr"
                        {...form.register("heroSubtitleAr")}
                        data-testid="input-hero-subtitle-ar"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="heroSubtitleEn">{t("admin.settings.homepage.heroSubtitleEn")}</Label>
                      <Input
                        id="heroSubtitleEn"
                        {...form.register("heroSubtitleEn")}
                        data-testid="input-hero-subtitle-en"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="heroImageUrl">{t("admin.settings.homepage.heroImageUrl")}</Label>
                    <Input
                      id="heroImageUrl"
                      {...form.register("heroImageUrl")}
                      placeholder="https://example.com/hero.jpg"
                      data-testid="input-hero-image"
                    />
                    <p className="text-sm text-muted-foreground">{t("admin.settings.homepage.heroImageHint")}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.settings.homepage.sections")}</CardTitle>
                  <CardDescription>{t("admin.settings.homepage.sectionsDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="showCategories">{t("admin.settings.homepage.showCategories")}</Label>
                    <Switch
                      id="showCategories"
                      checked={form.watch("showCategories") === 1}
                      onCheckedChange={(checked) => form.setValue("showCategories", checked ? 1 : 0)}
                      data-testid="switch-show-categories"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="showFeaturedProducts">{t("admin.settings.homepage.showFeaturedProducts")}</Label>
                    <Switch
                      id="showFeaturedProducts"
                      checked={form.watch("showFeaturedProducts") === 1}
                      onCheckedChange={(checked) => form.setValue("showFeaturedProducts", checked ? 1 : 0)}
                      data-testid="switch-show-featured"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="featuredProductsCount">{t("admin.settings.homepage.featuredProductsCount")}</Label>
                    <Input
                      id="featuredProductsCount"
                      type="number"
                      min="1"
                      max="24"
                      {...form.register("featuredProductsCount", { valueAsNumber: true })}
                      data-testid="input-featured-count"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="footer" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.settings.footer.about")}</CardTitle>
                  <CardDescription>{t("admin.settings.footer.aboutDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="aboutTextAr">{t("admin.settings.footer.aboutTextAr")}</Label>
                      <Textarea
                        id="aboutTextAr"
                        {...form.register("aboutTextAr")}
                        data-testid="input-about-ar"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="aboutTextEn">{t("admin.settings.footer.aboutTextEn")}</Label>
                      <Textarea
                        id="aboutTextEn"
                        {...form.register("aboutTextEn")}
                        data-testid="input-about-en"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.settings.footer.copyright")}</CardTitle>
                  <CardDescription>{t("admin.settings.footer.copyrightDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="copyrightTextAr">{t("admin.settings.footer.copyrightTextAr")}</Label>
                      <Input
                        id="copyrightTextAr"
                        {...form.register("copyrightTextAr")}
                        data-testid="input-copyright-ar"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="copyrightTextEn">{t("admin.settings.footer.copyrightTextEn")}</Label>
                      <Input
                        id="copyrightTextEn"
                        {...form.register("copyrightTextEn")}
                        data-testid="input-copyright-en"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="h-5 w-5" />
                    {t("admin.settings.footer.linksTitle")}
                  </CardTitle>
                  <CardDescription>{t("admin.settings.footer.linksDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {footerLinks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <LinkIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>{t("admin.settings.footer.noGroups")}</p>
                    </div>
                  ) : (
                    <Accordion type="multiple" className="space-y-4">
                      {footerLinks.map((group, groupIndex) => (
                        <AccordionItem key={group.id} value={group.id} className="border rounded-lg px-4">
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3 flex-1">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {language === 'ar' ? (group.titleAr || t("admin.settings.footer.untitledGroup")) : (group.titleEn || t("admin.settings.footer.untitledGroup"))}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                ({group.links.length} {t("admin.settings.footer.links")})
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-4 space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>{t("admin.settings.footer.groupTitleAr")}</Label>
                                <Input
                                  value={group.titleAr}
                                  onChange={(e) => updateLinkGroup(group.id, 'titleAr', e.target.value)}
                                  placeholder={t("admin.settings.footer.groupTitlePlaceholder")}
                                  data-testid={`input-group-title-ar-${groupIndex}`}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>{t("admin.settings.footer.groupTitleEn")}</Label>
                                <Input
                                  value={group.titleEn}
                                  onChange={(e) => updateLinkGroup(group.id, 'titleEn', e.target.value)}
                                  placeholder={t("admin.settings.footer.groupTitlePlaceholder")}
                                  data-testid={`input-group-title-en-${groupIndex}`}
                                />
                              </div>
                            </div>

                            <div className="space-y-3">
                              <Label className="text-sm font-medium">{t("admin.settings.footer.linksInGroup")}</Label>
                              {group.links.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">{t("admin.settings.footer.noLinks")}</p>
                              ) : (
                                <div className="space-y-3">
                                  {group.links.map((link, linkIndex) => (
                                    <div key={link.id} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div className="space-y-1">
                                          <Label className="text-xs">{t("admin.settings.footer.labelAr")}</Label>
                                          <Input
                                            value={link.labelAr}
                                            onChange={(e) => updateLink(group.id, link.id, 'labelAr', e.target.value)}
                                            placeholder={t("admin.settings.footer.labelPlaceholder")}
                                            data-testid={`input-link-label-ar-${groupIndex}-${linkIndex}`}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">{t("admin.settings.footer.labelEn")}</Label>
                                          <Input
                                            value={link.labelEn}
                                            onChange={(e) => updateLink(group.id, link.id, 'labelEn', e.target.value)}
                                            placeholder={t("admin.settings.footer.labelPlaceholder")}
                                            data-testid={`input-link-label-en-${groupIndex}-${linkIndex}`}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">{t("admin.settings.footer.url")}</Label>
                                          <Input
                                            value={link.url}
                                            onChange={(e) => updateLink(group.id, link.id, 'url', e.target.value)}
                                            placeholder="/page or https://..."
                                            data-testid={`input-link-url-${groupIndex}-${linkIndex}`}
                                          />
                                        </div>
                                        <div className="space-y-1 flex items-end gap-2">
                                          <div className="flex items-center gap-2 flex-1">
                                            <Checkbox
                                              id={`external-${link.id}`}
                                              checked={link.isExternal || false}
                                              onCheckedChange={(checked) => updateLink(group.id, link.id, 'isExternal', !!checked)}
                                              data-testid={`checkbox-external-${groupIndex}-${linkIndex}`}
                                            />
                                            <Label htmlFor={`external-${link.id}`} className="text-xs flex items-center gap-1">
                                              <ExternalLink className="h-3 w-3" />
                                              {t("admin.settings.footer.external")}
                                            </Label>
                                          </div>
                                        </div>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeLink(group.id, link.id)}
                                        className="text-destructive hover:text-destructive"
                                        data-testid={`button-remove-link-${groupIndex}-${linkIndex}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addLink(group.id)}
                                className="mt-2"
                                data-testid={`button-add-link-${groupIndex}`}
                              >
                                <Plus className="h-4 w-4 ml-1" />
                                {t("admin.settings.footer.addLink")}
                              </Button>
                            </div>

                            <div className="flex justify-end pt-2 border-t">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => removeLinkGroup(group.id)}
                                data-testid={`button-remove-group-${groupIndex}`}
                              >
                                <Trash2 className="h-4 w-4 ml-1" />
                                {t("admin.settings.footer.removeGroup")}
                              </Button>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addLinkGroup}
                    className="w-full"
                    data-testid="button-add-group"
                  >
                    <Plus className="h-4 w-4 ml-1" />
                    {t("admin.settings.footer.addGroup")}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="shipping" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.settings.shipping.title")}</CardTitle>
                  <CardDescription>{t("admin.settings.shipping.description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shippingCost">{t("admin.settings.shipping.cost")}</Label>
                      <Input
                        id="shippingCost"
                        type="number"
                        {...form.register("shippingCost")}
                        data-testid="input-shipping-cost"
                      />
                      <p className="text-sm text-muted-foreground">{t("admin.settings.shipping.costHint")}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="freeShippingThreshold">{t("admin.settings.shipping.freeThreshold")}</Label>
                      <Input
                        id="freeShippingThreshold"
                        type="number"
                        {...form.register("freeShippingThreshold")}
                        data-testid="input-free-threshold"
                      />
                      <p className="text-sm text-muted-foreground">{t("admin.settings.shipping.freeThresholdHint")}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="enableFreeShipping">{t("admin.settings.shipping.enableFreeShipping")}</Label>
                    <Switch
                      id="enableFreeShipping"
                      checked={form.watch("enableFreeShipping") === 1}
                      onCheckedChange={(checked) => form.setValue("enableFreeShipping", checked ? 1 : 0)}
                      data-testid="switch-free-shipping"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.settings.payment.title")}</CardTitle>
                  <CardDescription>{t("admin.settings.payment.description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enableCashOnDelivery">{t("admin.settings.payment.cashOnDelivery")}</Label>
                    <Switch
                      id="enableCashOnDelivery"
                      checked={form.watch("enableCashOnDelivery") === 1}
                      onCheckedChange={(checked) => form.setValue("enableCashOnDelivery", checked ? 1 : 0)}
                      data-testid="switch-cash-on-delivery"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="enableElectronicPayment">{t("admin.settings.payment.electronicPayment")}</Label>
                    <Switch
                      id="enableElectronicPayment"
                      checked={form.watch("enableElectronicPayment") === 1}
                      onCheckedChange={(checked) => form.setValue("enableElectronicPayment", checked ? 1 : 0)}
                      data-testid="switch-electronic-payment"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end sticky bottom-4">
            <Button
              type="submit"
              size="lg"
              disabled={updateMutation.isPending}
              data-testid="button-save-settings"
            >
              <Save className="h-4 w-4 ml-2" />
              {updateMutation.isPending ? t("common.saving") : t("admin.settings.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
