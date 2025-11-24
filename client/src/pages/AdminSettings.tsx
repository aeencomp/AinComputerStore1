import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowRight, Save } from "lucide-react";
import { Link } from "wouter";
import type { StoreSettings } from "@shared/schema";

const storeSettingsFormSchema = z.object({
  storeNameAr: z.string().min(1, "اسم المتجر بالعربية مطلوب"),
  storeNameEn: z.string().min(1, "Store name in English is required"),
  descriptionAr: z.string().min(1, "الوصف بالعربية مطلوب"),
  descriptionEn: z.string().min(1, "Description in English is required"),
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  phone: z.string().min(1, "رقم الهاتف مطلوب"),
  phoneAr: z.string().min(1, "رقم الهاتف بالعربية مطلوب"),
  addressAr: z.string().min(1, "العنوان بالعربية مطلوب"),
  addressEn: z.string().min(1, "Address in English is required"),
  hoursAr: z.string().min(1, "ساعات العمل بالعربية مطلوبة"),
  hoursEn: z.string().min(1, "Working hours in English are required"),
  facebookUrl: z.string().optional(),
  twitterUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
});

type StoreSettingsForm = z.infer<typeof storeSettingsFormSchema>;

export default function AdminSettings() {
  const { language, t } = useLanguage();
  const { toast } = useToast();

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
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: StoreSettingsForm) => {
      return apiRequest("PUT", "/api/admin/store-settings", data);
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
        title: t("admin.toast.error"),
        description: t("admin.settings.errorMessage"),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: StoreSettingsForm) => {
    updateMutation.mutate(data);
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
      <div className="max-w-4xl mx-auto">
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
                  <Input
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
                  <Input
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
            </CardContent>
          </Card>

          <div className="flex justify-end">
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
