import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { AdminNav } from "@/components/AdminNav";
import { GlobalIraqSyncPanel } from "@/components/GlobalIraqSyncPanel";
import { useLanguage } from "@/contexts/LanguageContext";
import { adminAuthMeQueryFn } from "@/lib/queryClient";

export default function AdminSync() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();

  const { data: currentAdmin, isLoading } = useQuery({
    queryKey: ["/api/admin/auth/me"],
    queryFn: adminAuthMeQueryFn,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!currentAdmin) {
    setLocation("/admin/login");
    return null;
  }

  const canSync =
    currentAdmin.role === "admin" || currentAdmin.canProducts === 1;

  if (!canSync) {
    setLocation("/admin/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-background" dir={language === "ar" ? "rtl" : "ltr"}>
      <AdminNav currentAdmin={currentAdmin} />
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <h1 className="text-2xl font-bold mb-2">
          {language === "ar" ? "مزامنة المتجر مع Global Iraq" : "Global Iraq store sync"}
        </h1>
        <p className="text-muted-foreground mb-6">
          {language === "ar"
            ? "اضغط «مزامنة الآن» — قد تستغرق 1–3 دقائق. لا حاجة لـ SSH."
            : "Click Sync now — takes 1–3 minutes. No SSH needed."}
        </p>
        <GlobalIraqSyncPanel />
      </div>
    </div>
  );
}
