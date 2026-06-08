import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { AdminNav } from "@/components/AdminNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/formatters";
import { resolveAssetUrl } from "@/lib/assetUrl";
import type { AdminUser, Product } from "@shared/schema";
import {
  Facebook,
  Loader2,
  Send,
  RefreshCw,
  Copy,
  CheckCircle,
  XCircle,
  Settings,
  History,
  Sparkles,
  ExternalLink,
  Clock,
} from "lucide-react";

type SocialPostType = "product" | "sale" | "repair" | "announcement";

type GeneratedPost = {
  postType: SocialPostType;
  productId?: string;
  message: string;
  imageUrl: string | null;
  linkUrl: string | null;
};

type SocialConfig = {
  publicSiteUrl: string;
  facebookPageId: string;
  facebookPageAccessTokenMasked: string;
  hasFacebookToken: boolean;
  facebookAutoPostEnabled: number;
  facebookAutoPostTime: string;
  facebookAutoPostMode: string;
  facebookAutoPostLastAt?: string | null;
  facebookUrl?: string;
};

type PostLogEntry = {
  id: string;
  postType: string;
  message: string;
  facebookPostId?: string | null;
  source: string;
  success: number;
  error?: string | null;
  createdAt: string;
};

const POST_TYPES: { value: SocialPostType; labelAr: string; labelEn: string }[] = [
  { value: "product", labelAr: "منتج", labelEn: "Product" },
  { value: "sale", labelAr: "عرض / تخفيض", labelEn: "Sale" },
  { value: "repair", labelAr: "صيانة", labelEn: "Repair" },
  { value: "announcement", labelAr: "إعلان عام", labelEn: "Announcement" },
];

const AUTO_MODES = [
  { value: "rotate", labelAr: "تناوب المنتجات", labelEn: "Rotate products" },
  { value: "sale", labelAr: "منتجات مخفّضة", labelEn: "Sale items" },
  { value: "repair", labelAr: "صيانة", labelEn: "Repair promo" },
  { value: "announcement", labelAr: "إعلان المتجر", labelEn: "Store announcement" },
];

export default function AdminSocialPosts() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const dir = language === "ar" ? "rtl" : "ltr";
  const ar = language === "ar";

  const [postType, setPostType] = useState<SocialPostType>("product");
  const [productId, setProductId] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [customIntro, setCustomIntro] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [generatedProductId, setGeneratedProductId] = useState<string | undefined>();

  const [configForm, setConfigForm] = useState({
    publicSiteUrl: "https://aeen-iq.com",
    facebookPageId: "",
    facebookPageAccessToken: "",
    facebookAutoPostEnabled: false,
    facebookAutoPostTime: "18:00",
    facebookAutoPostMode: "rotate",
  });

  const { data: currentAdmin } = useQuery<AdminUser>({
    queryKey: ["/api/admin/auth/me"],
    retry: false,
  });

  const { data: config, refetch: refetchConfig } = useQuery<SocialConfig>({
    queryKey: ["/api/admin/social/config"],
    enabled: !!currentAdmin,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !!currentAdmin,
  });

  const { data: diagnostics, refetch: refetchDiagnostics } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/admin/social/diagnostics"],
    enabled: !!currentAdmin,
  });

  const { data: history = [], refetch: refetchHistory } = useQuery<PostLogEntry[]>({
    queryKey: ["/api/admin/social/history"],
    enabled: !!currentAdmin,
  });

  useEffect(() => {
    if (!config) return;
    setConfigForm({
      publicSiteUrl: config.publicSiteUrl || "https://aeen-iq.com",
      facebookPageId: config.facebookPageId || "",
      facebookPageAccessToken: "",
      facebookAutoPostEnabled: config.facebookAutoPostEnabled === 1,
      facebookAutoPostTime: config.facebookAutoPostTime || "18:00",
      facebookAutoPostMode: config.facebookAutoPostMode || "rotate",
    });
  }, [config]);

  const inStockProducts = useMemo(
    () => products.filter((p) => p.inStock === 1),
    [products],
  );

  const saleProducts = useMemo(
    () =>
      inStockProducts.filter((p) => {
        if (!p.oldPrice) return false;
        return parseFloat(String(p.oldPrice)) > parseFloat(String(p.price));
      }),
    [inStockProducts],
  );

  const productOptions = postType === "sale" && saleProducts.length > 0 ? saleProducts : inStockProducts;

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/social/generate", {
        postType,
        productId: postType === "product" || postType === "sale" ? productId : undefined,
        discountCode: discountCode || undefined,
        customIntro: customIntro || undefined,
      });
      return res.json() as Promise<GeneratedPost>;
    },
    onSuccess: (post) => {
      setMessage(post.message);
      setImageUrl(post.imageUrl);
      setLinkUrl(post.linkUrl);
      setGeneratedProductId(post.productId);
      toast({ title: ar ? "تم إنشاء المنشور" : "Post generated" });
    },
    onError: (err: Error) => {
      toast({ title: ar ? "فشل الإنشاء" : "Generate failed", description: err.message, variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/social/publish", {
        message,
        imageUrl,
        linkUrl,
        postType,
        productId: generatedProductId,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: ar ? "تم النشر على فيسبوك!" : "Published to Facebook!" });
      refetchHistory();
      refetchDiagnostics();
    },
    onError: (err: Error) => {
      toast({ title: ar ? "فشل النشر" : "Publish failed", description: err.message, variant: "destructive" });
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        publicSiteUrl: configForm.publicSiteUrl,
        facebookPageId: configForm.facebookPageId,
        facebookAutoPostEnabled: configForm.facebookAutoPostEnabled,
        facebookAutoPostTime: configForm.facebookAutoPostTime,
        facebookAutoPostMode: configForm.facebookAutoPostMode,
      };
      if (configForm.facebookPageAccessToken.trim()) {
        payload.facebookPageAccessToken = configForm.facebookPageAccessToken.trim();
      }
      const res = await apiRequest("PUT", "/api/admin/social/config", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: ar ? "تم حفظ الإعدادات" : "Settings saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/config"] });
      refetchDiagnostics();
    },
    onError: (err: Error) => {
      toast({ title: ar ? "فشل الحفظ" : "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const testPublishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/social/test-publish", {
        facebookPageId: configForm.facebookPageId,
        facebookPageAccessToken: configForm.facebookPageAccessToken.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: ar ? "نجح اختبار النشر!" : "Publish test OK!",
        description: ar
          ? "ظهر منشور اختبار على صفحتك. احفظ التوكن ثم انشر المنشورات."
          : "Test post on your Page. Save token then publish posts.",
      });
    },
    onError: (err: Error) => {
      toast({ title: ar ? "فشل اختبار النشر" : "Publish test failed", description: err.message, variant: "destructive" });
    },
  });

  const autoPostMutation = useMutation({
    mutationFn: async (force?: boolean) => {
      const res = await apiRequest("POST", "/api/admin/social/auto-post-now", { force: !!force });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: ar ? "تم النشر التلقائي" : "Auto post published" });
      refetchHistory();
      refetchConfig();
    },
    onError: (err: Error) => {
      const msg = err.message || "";
      const reason =
        msg.includes("Auto-post disabled")
          ? (ar ? "فعّل «نشر تلقائي يومي» أو استخدم تبويب إنشاء منشور → نشر على فيسبوك" : "Enable daily auto-post or use Create Post tab")
          : msg;
      toast({ title: ar ? "لم يتم النشر" : "Post failed", description: reason, variant: "destructive" });
    },
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast({ title: ar ? "تم النسخ" : "Copied" });
    } catch {
      toast({ title: ar ? "فشل النسخ" : "Copy failed", variant: "destructive" });
    }
  };

  const previewImage = imageUrl ? resolveAssetUrl(imageUrl) : null;
  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <AdminNav currentAdmin={currentAdmin ?? null} />
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Facebook className="h-6 w-6 text-blue-600" />
            {ar ? "تسويق فيسبوك" : "Facebook Marketing"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {ar
              ? "أنشئ منشورات عربية تلقائياً وانشرها على صفحة متجرك في فيسبوك"
              : "Auto-generate Arabic posts and publish to your store Facebook Page"}
          </p>
        </div>

        <Tabs defaultValue="create" dir={dir}>
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="create">{ar ? "إنشاء منشور" : "Create Post"}</TabsTrigger>
            <TabsTrigger value="settings">{ar ? "إعدادات فيسبوك" : "Facebook Settings"}</TabsTrigger>
            <TabsTrigger value="history">{ar ? "السجل" : "History"}</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    {ar ? "مولّد المنشور" : "Post Generator"}
                  </CardTitle>
                  <CardDescription>
                    {ar ? "اختر نوع المنشور ثم اضغط إنشاء" : "Choose post type then generate"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{ar ? "نوع المنشور" : "Post type"}</Label>
                    <Select value={postType} onValueChange={(v) => setPostType(v as SocialPostType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POST_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {ar ? t.labelAr : t.labelEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(postType === "product" || postType === "sale") && (
                    <>
                      <div className="space-y-2">
                        <Label>{ar ? "المنتج" : "Product"}</Label>
                        <Select value={productId} onValueChange={setProductId}>
                          <SelectTrigger>
                            <SelectValue placeholder={ar ? "اختر منتجاً" : "Select product"} />
                          </SelectTrigger>
                          <SelectContent>
                            {productOptions.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nameAr} — {formatPrice(p.price, language)} {ar ? "د.ع" : "IQD"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {postType === "sale" && saleProducts.length === 0 && (
                          <p className="text-xs text-amber-700">
                            {ar ? "لا توجد منتجات بسعر قديم — سيتم استخدام كل المنتجات" : "No sale items — all products shown"}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>{ar ? "كود خصم (اختياري)" : "Discount code (optional)"}</Label>
                        <Input
                          value={discountCode}
                          onChange={(e) => setDiscountCode(e.target.value)}
                          placeholder="ONLINE5"
                          dir="ltr"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{ar ? "مقدمة مخصصة (اختياري)" : "Custom intro (optional)"}</Label>
                        <Input
                          value={customIntro}
                          onChange={(e) => setCustomIntro(e.target.value)}
                          placeholder={ar ? "🔥 عرض محدود اليوم فقط!" : "🔥 Limited offer today!"}
                        />
                      </div>
                    </>
                  )}

                  <Button
                    className="w-full gap-2"
                    onClick={() => generateMutation.mutate()}
                    disabled={
                      generateMutation.isPending ||
                      ((postType === "product" || postType === "sale") && !productId)
                    }
                  >
                    {generateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {ar ? "إنشاء المنشور" : "Generate Post"}
                  </Button>

                  {selectedProduct && (postType === "product" || postType === "sale") && (
                    <div className="rounded-md border p-3 text-sm space-y-1">
                      <p className="font-medium">{selectedProduct.nameAr}</p>
                      <p className="text-muted-foreground">
                        {formatPrice(selectedProduct.price, language)} {ar ? "د.ع" : "IQD"}
                        {selectedProduct.oldPrice && (
                          <span className="line-through ms-2 opacity-60">
                            {formatPrice(selectedProduct.oldPrice, language)}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{ar ? "معاينة ونشر" : "Preview & Publish"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {previewImage && (
                    <img
                      src={previewImage}
                      alt=""
                      className="w-full max-h-48 object-contain rounded-md border bg-muted/30"
                    />
                  )}
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={12}
                    placeholder={ar ? "اضغط إنشاء المنشور..." : "Click Generate Post..."}
                    className="font-sans text-sm"
                  />
                  {linkUrl && (
                    <a
                      href={linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {linkUrl}
                    </a>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={handleCopy}
                      disabled={!message}
                    >
                      <Copy className="h-4 w-4" />
                      {ar ? "نسخ" : "Copy"}
                    </Button>
                    <Button
                      className="gap-2 bg-blue-600 hover:bg-blue-700"
                      onClick={() => publishMutation.mutate()}
                      disabled={!message || publishMutation.isPending || !config?.hasFacebookToken}
                    >
                      {publishMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {ar ? "نشر على فيسبوك" : "Publish to Facebook"}
                    </Button>
                  </div>
                  {!config?.hasFacebookToken && (
                    <p className="text-xs text-amber-700">
                      {ar
                        ? "أضف Page ID و Access Token في تبويب الإعدادات أولاً"
                        : "Add Page ID and Access Token in Settings tab first"}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  {ar ? "ربط صفحة فيسبوك" : "Connect Facebook Page"}
                </CardTitle>
                <CardDescription>
                  {ar
                    ? "من Meta Business Suite: Page ID + Page Access Token مع صلاحية pages_manage_posts"
                    : "From Meta Business Suite: Page ID + Page Access Token with pages_manage_posts"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{ar ? "رابط الموقع العام" : "Public site URL"}</Label>
                  <Input
                    value={configForm.publicSiteUrl}
                    onChange={(e) => setConfigForm((f) => ({ ...f, publicSiteUrl: e.target.value }))}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Facebook Page ID</Label>
                  <Input
                    value={configForm.facebookPageId}
                    onChange={(e) => setConfigForm((f) => ({ ...f, facebookPageId: e.target.value }))}
                    dir="ltr"
                    placeholder="123456789012345"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Page Access Token</Label>
                  <Input
                    type="password"
                    value={configForm.facebookPageAccessToken}
                    onChange={(e) => setConfigForm((f) => ({ ...f, facebookPageAccessToken: e.target.value }))}
                    dir="ltr"
                    placeholder={
                      config?.hasFacebookToken
                        ? config.facebookPageAccessTokenMasked
                        : "EAAxxxx..."
                    }
                  />
                  {config?.hasFacebookToken && !configForm.facebookPageAccessToken && (
                    <p className="text-xs text-muted-foreground">
                      {ar ? "التوكن محفوظ — اتركه فارغاً للإبقاء عليه" : "Token saved — leave blank to keep it"}
                    </p>
                  )}
                </div>

                <SeparatorBlock />

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>{ar ? "نشر تلقائي يومي" : "Daily auto-post"}</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ar
                        ? "للجدولة اليومية فقط — زر «نشر تلقائي الآن» يعمل بدون تفعيل هذا الخيار"
                        : "For daily schedule only — «Run auto-post now» works without this toggle"}
                    </p>
                  </div>
                  <Switch
                    checked={configForm.facebookAutoPostEnabled}
                    onCheckedChange={(v) => setConfigForm((f) => ({ ...f, facebookAutoPostEnabled: v }))}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{ar ? "وقت النشر (بغداد)" : "Post time (Baghdad)"}</Label>
                    <Input
                      value={configForm.facebookAutoPostTime}
                      onChange={(e) => setConfigForm((f) => ({ ...f, facebookAutoPostTime: e.target.value }))}
                      dir="ltr"
                      placeholder="18:00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{ar ? "نوع المنشور التلقائي" : "Auto post type"}</Label>
                    <Select
                      value={configForm.facebookAutoPostMode}
                      onValueChange={(v) => setConfigForm((f) => ({ ...f, facebookAutoPostMode: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AUTO_MODES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {ar ? m.labelAr : m.labelEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => saveConfigMutation.mutate()}
                    disabled={saveConfigMutation.isPending}
                  >
                    {saveConfigMutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                    {ar ? "حفظ الإعدادات" : "Save Settings"}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => refetchDiagnostics()}
                  >
                    <RefreshCw className="h-4 w-4" />
                    {ar ? "اختبار الاتصال" : "Test Connection"}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 border-blue-300 text-blue-800"
                    onClick={() => testPublishMutation.mutate()}
                    disabled={testPublishMutation.isPending || !configForm.facebookPageId}
                  >
                    {testPublishMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {ar ? "اختبار النشر" : "Test publish"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="gap-2"
                    onClick={() => autoPostMutation.mutate(true)}
                    disabled={autoPostMutation.isPending}
                  >
                    {autoPostMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                    {ar ? "نشر تلقائي الآن (اختبار)" : "Run auto-post now (test)"}
                  </Button>
                </div>

                {config?.facebookAutoPostLastAt && (
                  <p className="text-xs text-muted-foreground">
                    {ar ? "آخر نشر تلقائي:" : "Last auto-post:"}{" "}
                    {new Date(config.facebookAutoPostLastAt).toLocaleString(ar ? "ar-IQ" : "en-IQ")}
                  </p>
                )}

                {diagnostics && (
                  <div className="rounded-md border p-3 text-sm space-y-2">
                    {"error" in diagnostics && diagnostics.error ? (
                      <>
                        <p className="text-red-700 flex items-center gap-2">
                          <XCircle className="h-4 w-4 shrink-0" />
                          {String(diagnostics.error)}
                        </p>
                        {"hint" in diagnostics && diagnostics.hint && (
                          <p className="text-xs text-muted-foreground">{String(diagnostics.hint)}</p>
                        )}
                      </>
                    ) : diagnostics.configured ? (
                      <>
                        <p
                          className={`flex items-center gap-2 ${
                            diagnostics.canPublish === false ? "text-amber-700" : "text-green-700"
                          }`}
                        >
                          {diagnostics.canPublish === false ? (
                            <XCircle className="h-4 w-4 shrink-0" />
                          ) : (
                            <CheckCircle className="h-4 w-4 shrink-0" />
                          )}
                          {ar ? "متصل:" : "Connected:"}{" "}
                          {String(diagnostics.pageName || diagnostics.pageId)}
                        </p>
                        {"note" in diagnostics && diagnostics.note && (
                          <p className="text-xs text-muted-foreground">{String(diagnostics.note)}</p>
                        )}
                        {"warning" in diagnostics && diagnostics.warning && (
                          <p className="text-xs text-amber-800 font-medium">{String(diagnostics.warning)}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-amber-700">{ar ? "غير مُعدّ بعد" : "Not configured yet"}</p>
                    )}
                  </div>
                )}

                <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-xs space-y-2 text-blue-900">
                  <p className="font-medium">{ar ? "كيف تحصل على التوكن الصحيح:" : "How to get the correct token:"}</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      {ar
                        ? "Explorer → Permissions: pages_manage_posts + pages_read_engagement + pages_show_list"
                        : "Explorer → Permissions: pages_manage_posts + pages_read_engagement + pages_show_list"}
                    </li>
                    <li>
                      {ar
                        ? "User or Page → اختر «العين لتجارة الحاسبات» (ليس User Token) → Generate Access Token"
                        : "User or Page → select your Page (not User Token) → Generate Access Token"}
                    </li>
                    <li>
                      {ar
                        ? "انسخ التوكن من Explorer والصقه في الحقل أعلاه → اضغط «اختبار النشر»"
                        : "Paste Explorer token above → click «Test publish»"}
                    </li>
                    <li dir="ltr" className="font-mono text-[10px]">
                      Explorer POST /159035964278475/feed message=test (not GET)
                    </li>
                  </ol>
                  <p className="text-amber-800 font-medium">
                    {ar
                      ? "⚠️ إذا كان التوكن محفوظاً قديماً: الصق توكناً جديداً كاملاً بعد إضافة الصلاحيات"
                      : "⚠️ If token was saved before: paste a full new token after adding permissions"}
                  </p>
                </div>

                <div className="rounded-md bg-muted/50 p-3 text-xs space-y-2 font-mono" dir="ltr">
                  <p className="font-sans font-medium text-foreground">
                    {ar ? "أمر cron على السيرفر (يومياً الساعة 6 مساءً):" : "VPS cron (daily 6 PM Baghdad):"}
                  </p>
                  <code className="block whitespace-pre-wrap break-all">
                    {`0 15 * * * curl -sS -X POST -H "x-cron-secret: YOUR_SECRET" https://aeen-iq.com/api/cron/facebook/auto-post`}
                  </code>
                  <p className="font-sans text-muted-foreground">
                    {ar
                      ? "استخدم FACEBOOK_CRON_SECRET أو DAILY_REVENUE_CRON_SECRET من ملف .env"
                      : "Use FACEBOOK_CRON_SECRET or DAILY_REVENUE_CRON_SECRET from .env"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    {ar ? "سجل المنشورات" : "Post History"}
                  </CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchHistory()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    {ar ? "لا توجد منشورات بعد" : "No posts yet"}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {history.map((entry) => (
                      <div key={entry.id} className="rounded-md border p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{entry.postType}</Badge>
                          <Badge variant="outline">{entry.source}</Badge>
                          {entry.success ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              <CheckCircle className="h-3 w-3 me-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 me-1" />
                              {ar ? "فشل" : "Failed"}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground ms-auto">
                            {new Date(entry.createdAt).toLocaleString(ar ? "ar-IQ" : "en-IQ")}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-line line-clamp-4">{entry.message}</p>
                        {entry.facebookPostId && (
                          <p className="text-xs text-muted-foreground font-mono">ID: {entry.facebookPostId}</p>
                        )}
                        {entry.error && <p className="text-xs text-red-600">{entry.error}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SeparatorBlock() {
  return <div className="border-t my-2" />;
}
