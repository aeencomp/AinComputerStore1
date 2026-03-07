import { useState } from "react";
import { useLocation } from "wouter";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  Phone,
  User,
  Users,
  RefreshCw,
  Info,
} from "lucide-react";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface WaTemplate {
  id: string;
  name: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED";
  language: string;
  components: Array<{
    type: string;
    format?: string;
    text?: string;
    parameters?: any[];
    example?: any;
  }>;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: 'account' | 'repair' | 'order';
}

const TEMPLATE_DEFINITIONS: Record<string, { labelAr: string; labelEn: string; params: { nameAr: string; nameEn: string; placeholder: string }[] }> = {
  hello_world: {
    labelAr: "مرحبا بالعالم (افتراضي)",
    labelEn: "Hello World (default)",
    params: [],
  },
  customer_greeting: {
    labelAr: "تحية العميل",
    labelEn: "Customer Greeting",
    params: [
      { nameAr: "اسم العميل", nameEn: "Customer Name", placeholder: "e.g. أحمد" },
    ],
  },
  product_offer: {
    labelAr: "عرض منتج",
    labelEn: "Product Offer",
    params: [
      { nameAr: "اسم العميل", nameEn: "Customer Name", placeholder: "e.g. أحمد" },
      { nameAr: "اسم المنتج", nameEn: "Product Name", placeholder: "e.g. لابتوب HP ProBook 450" },
      { nameAr: "السعر", nameEn: "Price", placeholder: "e.g. 750,000" },
    ],
  },
  general_notification: {
    labelAr: "إشعار عام",
    labelEn: "General Notification",
    params: [
      { nameAr: "اسم العميل", nameEn: "Customer Name", placeholder: "e.g. أحمد" },
      { nameAr: "نص الرسالة", nameEn: "Message Body", placeholder: "e.g. طلبكم جاهز للاستلام" },
    ],
  },
};

export default function AdminWhatsApp() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const { toast } = useToast();
  const dir = language === "ar" ? "rtl" : "ltr";

  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [params, setParams] = useState<string[]>([]);
  const [bulkResults, setBulkResults] = useState<{ phone: string; name: string; success: boolean; error?: string }[]>([]);

  const { data: currentAdmin } = useQuery<AdminUser>({
    queryKey: ["/api/admin/auth/me"],
    retry: false,
  });

  const { data: templatesData, isLoading: templatesLoading, refetch: refetchTemplates } = useQuery<{ data: WaTemplate[] }>({
    queryKey: ["/api/admin/whatsapp/templates"],
    enabled: !!currentAdmin,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/admin/whatsapp/customers"],
    enabled: !!currentAdmin,
  });

  const templates = templatesData?.data || [];
  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");

  const sendMutation = useMutation({
    mutationFn: async (payload: { to: string; templateName: string; language: string; params: string[] }) => {
      const res = await apiRequest("POST", "/api/admin/whatsapp/send", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "تم الإرسال بنجاح!" : "Sent successfully!" });
      setPhone("");
      setParams([]);
    },
    onError: (err: any) => {
      toast({ title: language === "ar" ? "فشل الإرسال" : "Send failed", description: err.message, variant: "destructive" });
    },
  });

  const handleTemplateChange = (name: string) => {
    setSelectedTemplate(name);
    const def = TEMPLATE_DEFINITIONS[name];
    setParams(def ? def.params.map(() => "") : []);
  };

  const handleSend = () => {
    if (!selectedTemplate || !phone) return;
    sendMutation.mutate({ to: phone, templateName: selectedTemplate, language: "ar", params });
  };

  const handleBulkSend = async () => {
    if (!selectedTemplate || customers.length === 0) return;
    const results: typeof bulkResults = [];
    for (const customer of customers) {
      try {
        const res = await apiRequest("POST", "/api/admin/whatsapp/send", {
          to: customer.phone,
          templateName: selectedTemplate,
          language: "ar",
          params: params.map((p, i) => i === 0 ? customer.name : p),
        });
        const data = await res.json();
        results.push({ phone: customer.phone, name: customer.name, success: !!data.success });
      } catch (e: any) {
        results.push({ phone: customer.phone, name: customer.name, success: false, error: e.message });
      }
    }
    setBulkResults(results);
    const ok = results.filter((r) => r.success).length;
    toast({ title: language === "ar" ? `تم الإرسال لـ ${ok} من ${results.length}` : `Sent to ${ok} of ${results.length}` });
  };

  const getTemplateBody = (template: WaTemplate) => {
    const body = template.components?.find((c) => c.type === "BODY");
    return body?.text || "";
  };

  const getTemplateHeader = (template: WaTemplate) => {
    const header = template.components?.find((c) => c.type === "HEADER");
    return header?.text || "";
  };

  const getTemplateFooter = (template: WaTemplate) => {
    const footer = template.components?.find((c) => c.type === "FOOTER");
    return footer?.text || "";
  };

  const statusBadge = (status: WaTemplate["status"]) => {
    if (status === "APPROVED") return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 gap-1">
        <CheckCircle className="h-3 w-3" />{language === "ar" ? "مُعتمد" : "Approved"}
      </Badge>
    );
    if (status === "PENDING") return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 gap-1">
        <Clock className="h-3 w-3" />{language === "ar" ? "قيد المراجعة" : "Pending"}
      </Badge>
    );
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 gap-1">
        <XCircle className="h-3 w-3" />{language === "ar" ? "مرفوض" : "Rejected"}
      </Badge>
    );
  };

  const selectedDef = selectedTemplate ? TEMPLATE_DEFINITIONS[selectedTemplate] : null;

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <AdminNav currentAdmin={currentAdmin ?? null} />
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-green-600" />
            {language === "ar" ? "تسويق واتساب" : "WhatsApp Marketing"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {language === "ar"
              ? "أرسل رسائل نموذجية للعملاء عبر واتساب بيزنس"
              : "Send template messages to customers via WhatsApp Business"}
          </p>
        </div>

        <Tabs defaultValue="templates" dir={dir}>
          <TabsList className="mb-4">
            <TabsTrigger value="templates">
              {language === "ar" ? "القوالب" : "Templates"}
            </TabsTrigger>
            <TabsTrigger value="send">
              {language === "ar" ? "إرسال فردي" : "Send Message"}
            </TabsTrigger>
            <TabsTrigger value="bulk">
              {language === "ar" ? "إرسال جماعي" : "Bulk Send"}
            </TabsTrigger>
          </TabsList>

          {/* TEMPLATES TAB */}
          <TabsContent value="templates">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {language === "ar"
                  ? "القوالب المعتمدة من Meta فقط يمكن استخدامها للرسائل الأولى"
                  : "Only Meta-approved templates can be used for first-contact messages"}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchTemplates()} className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" />
                {language === "ar" ? "تحديث" : "Refresh"}
              </Button>
            </div>

            {templatesLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                {language === "ar" ? "لا توجد قوالب" : "No templates found"}
              </div>
            ) : (
              <div className="grid gap-4">
                {templates.map((t) => (
                  <Card key={t.id}>
                    <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                      <div>
                        <CardTitle className="text-base font-mono">{t.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {TEMPLATE_DEFINITIONS[t.name]?.[language === "ar" ? "labelAr" : "labelEn"] || t.name}
                          {" · "}
                          {t.language === "ar" ? "عربي" : t.language}
                        </CardDescription>
                      </div>
                      {statusBadge(t.status)}
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md bg-muted/50 p-3 space-y-1 text-sm">
                        {getTemplateHeader(t) && (
                          <p className="font-semibold text-foreground">{getTemplateHeader(t)}</p>
                        )}
                        <p className="whitespace-pre-line text-muted-foreground">{getTemplateBody(t)}</p>
                        {getTemplateFooter(t) && (
                          <p className="text-xs text-muted-foreground border-t pt-1 mt-1">{getTemplateFooter(t)}</p>
                        )}
                      </div>
                      {t.status === "APPROVED" && (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => {
                              handleTemplateChange(t.name);
                              document.querySelector('[data-value="send"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                            }}
                          >
                            <Send className="h-3.5 w-3.5" />
                            {language === "ar" ? "إرسال بهذا القالب" : "Send with this template"}
                          </Button>
                        </div>
                      )}
                      {t.status === "PENDING" && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-yellow-700">
                          <Info className="h-3.5 w-3.5 shrink-0" />
                          {language === "ar"
                            ? "هذا القالب قيد المراجعة من Meta. عادةً يستغرق 24-48 ساعة."
                            : "This template is under Meta review. Usually takes 24-48 hours."}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* SEND MESSAGE TAB */}
          <TabsContent value="send">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{language === "ar" ? "إرسال رسالة لعميل" : "Send to a Customer"}</CardTitle>
                <CardDescription>
                  {language === "ar"
                    ? "اختر قالباً معتمداً وأدخل رقم الهاتف"
                    : "Choose an approved template and enter a phone number"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {approvedTemplates.length === 0 ? (
                  <div className="flex items-center gap-2 p-4 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
                    <Clock className="h-4 w-4 shrink-0" />
                    {language === "ar"
                      ? "لا توجد قوالب معتمدة بعد. القوالب الجديدة قيد المراجعة من Meta (24-48 ساعة)."
                      : "No approved templates yet. New templates are under Meta review (24-48 hours)."}
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "القالب" : "Template"}</Label>
                      <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                        <SelectTrigger data-testid="select-template">
                          <SelectValue placeholder={language === "ar" ? "اختر قالباً" : "Select a template"} />
                        </SelectTrigger>
                        <SelectContent>
                          {approvedTemplates.map((t) => (
                            <SelectItem key={t.id} value={t.name}>
                              {TEMPLATE_DEFINITIONS[t.name]?.[language === "ar" ? "labelAr" : "labelEn"] || t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone-input">
                        <Phone className="inline h-3.5 w-3.5 me-1" />
                        {language === "ar" ? "رقم الهاتف" : "Phone Number"}
                      </Label>
                      <Input
                        id="phone-input"
                        data-testid="input-phone"
                        placeholder="07xxxxxxxxx or +9647xxxxxxxxx"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        dir="ltr"
                      />
                    </div>

                    {selectedDef && selectedDef.params.length > 0 && (
                      <div className="space-y-3">
                        <Label>{language === "ar" ? "معاملات الرسالة" : "Message Parameters"}</Label>
                        {selectedDef.params.map((p, i) => (
                          <div key={i} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {`{{${i + 1}}}`} — {language === "ar" ? p.nameAr : p.nameEn}
                            </Label>
                            <Input
                              data-testid={`input-param-${i}`}
                              placeholder={p.placeholder}
                              value={params[i] || ""}
                              onChange={(e) => {
                                const next = [...params];
                                next[i] = e.target.value;
                                setParams(next);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedTemplate && (
                      <div className="rounded-md bg-green-50 border border-green-200 p-3 space-y-1 text-sm">
                        <p className="text-xs font-medium text-green-700 mb-2">{language === "ar" ? "معاينة الرسالة" : "Message Preview"}</p>
                        {(() => {
                          const t = templates.find((x) => x.name === selectedTemplate);
                          if (!t) return null;
                          let body = getTemplateBody(t);
                          params.forEach((p, i) => {
                            if (p) body = body.replace(`{{${i + 1}}}`, p);
                          });
                          return (
                            <>
                              {getTemplateHeader(t) && <p className="font-semibold text-green-900">{getTemplateHeader(t)}</p>}
                              <p className="whitespace-pre-line text-green-800">{body}</p>
                              {getTemplateFooter(t) && <p className="text-xs text-green-600 border-t border-green-200 pt-1">{getTemplateFooter(t)}</p>}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    <Button
                      data-testid="button-send"
                      className="w-full gap-2"
                      disabled={!selectedTemplate || !phone || sendMutation.isPending}
                      onClick={handleSend}
                    >
                      {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {language === "ar" ? "إرسال الرسالة" : "Send Message"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BULK SEND TAB */}
          <TabsContent value="bulk">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{language === "ar" ? "إرسال جماعي للعملاء" : "Bulk Send to Customers"}</CardTitle>
                <CardDescription>
                  {language === "ar"
                    ? `سيتم الإرسال لـ ${customers.length} عميل (صيانة + حسابات + طلبات) — بدون تكرار`
                    : `Will send to ${customers.length} unique customers (repair + accounts + orders)`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {approvedTemplates.length === 0 ? (
                  <div className="flex items-center gap-2 p-4 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
                    <Clock className="h-4 w-4 shrink-0" />
                    {language === "ar"
                      ? "لا توجد قوالب معتمدة بعد. القوالب الجديدة قيد المراجعة من Meta."
                      : "No approved templates yet. New templates are under Meta review."}
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "القالب" : "Template"}</Label>
                      <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                        <SelectTrigger data-testid="select-bulk-template">
                          <SelectValue placeholder={language === "ar" ? "اختر قالباً" : "Select a template"} />
                        </SelectTrigger>
                        <SelectContent>
                          {approvedTemplates.map((t) => (
                            <SelectItem key={t.id} value={t.name}>
                              {TEMPLATE_DEFINITIONS[t.name]?.[language === "ar" ? "labelAr" : "labelEn"] || t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedDef && selectedDef.params.length > 1 && (
                      <div className="space-y-3">
                        <Label>{language === "ar" ? "المعاملات الثابتة ({{1}} = اسم العميل تلقائياً)" : "Fixed Parameters ({{1}} = customer name auto)"}</Label>
                        {selectedDef.params.slice(1).map((p, i) => (
                          <div key={i} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {`{{${i + 2}}}`} — {language === "ar" ? p.nameAr : p.nameEn}
                            </Label>
                            <Input
                              data-testid={`input-bulk-param-${i}`}
                              placeholder={p.placeholder}
                              value={params[i + 1] || ""}
                              onChange={(e) => {
                                const next = [...params];
                                next[i + 1] = e.target.value;
                                setParams(next);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium mb-1 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {language === "ar" ? "العملاء المستهدفون" : "Target Customers"} ({customers.length})
                      </p>
                      <div className="flex gap-3 text-xs text-muted-foreground mb-2">
                        <span>{language === "ar" ? "إصلاح:" : "Repair:"} {customers.filter(c => c.source === 'repair').length}</span>
                        <span>{language === "ar" ? "حسابات:" : "Accounts:"} {customers.filter(c => c.source === 'account').length}</span>
                        <span>{language === "ar" ? "طلبات:" : "Orders:"} {customers.filter(c => c.source === 'order').length}</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {customers.slice(0, 20).map((c) => (
                          <div key={c.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3 w-3 shrink-0" />
                            <span className="truncate flex-1">{c.name}</span>
                            <span className="font-mono text-xs shrink-0" dir="ltr">{c.phone}</span>
                            <span className={`text-xs px-1 rounded shrink-0 ${
                              c.source === 'repair' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              c.source === 'account' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            }`}>
                              {c.source === 'repair' ? (language === "ar" ? "إصلاح" : "repair") :
                               c.source === 'account' ? (language === "ar" ? "حساب" : "account") :
                               (language === "ar" ? "طلب" : "order")}
                            </span>
                          </div>
                        ))}
                        {customers.length > 20 && (
                          <p className="text-xs text-muted-foreground pt-1">+{customers.length - 20} {language === "ar" ? "آخرون" : "more"}</p>
                        )}
                      </div>
                    </div>

                    <Button
                      data-testid="button-bulk-send"
                      className="w-full gap-2"
                      variant="default"
                      disabled={!selectedTemplate || customers.length === 0}
                      onClick={handleBulkSend}
                    >
                      <Send className="h-4 w-4" />
                      {language === "ar"
                        ? `إرسال لـ ${customers.length} عميل`
                        : `Send to ${customers.length} customers`}
                    </Button>

                    {bulkResults.length > 0 && (
                      <div className="rounded-md border p-3 space-y-2">
                        <p className="text-sm font-medium">{language === "ar" ? "نتائج الإرسال" : "Send Results"}</p>
                        <div className="flex gap-3 text-sm">
                          <span className="text-green-700">
                            <CheckCircle className="inline h-3.5 w-3.5 me-1" />
                            {bulkResults.filter((r) => r.success).length} {language === "ar" ? "نجح" : "succeeded"}
                          </span>
                          <span className="text-red-700">
                            <XCircle className="inline h-3.5 w-3.5 me-1" />
                            {bulkResults.filter((r) => !r.success).length} {language === "ar" ? "فشل" : "failed"}
                          </span>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {bulkResults.map((r, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              {r.success
                                ? <CheckCircle className="h-3 w-3 text-green-600 shrink-0" />
                                : <XCircle className="h-3 w-3 text-red-600 shrink-0" />}
                              <span>{r.name} — {r.phone}</span>
                              {r.error && <span className="text-red-500">{r.error}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
