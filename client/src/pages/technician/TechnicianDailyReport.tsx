import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import DailyReport from "@/pages/DailyReport";

interface Technician {
  id: string;
  displayName: string;
  isAdmin: number;
  permissions: string[];
}

export default function TechnicianDailyReport() {
  const [, navigate] = useLocation();
  const { language } = useLanguage();

  const { data: technician, isLoading, error } = useQuery<Technician>({
    queryKey: ["/api/technician/auth/me"],
    retry: false,
  });

  const canViewDailyReport =
    !!technician &&
    (technician.isAdmin === 1 ||
      (technician.permissions || []).includes("view_daily_report"));

  useEffect(() => {
    if (error) navigate("/technician/login");
  }, [error, navigate]);

  useEffect(() => {
    if (technician && !canViewDailyReport) {
      navigate("/technician/dashboard");
    }
  }, [technician, canViewDailyReport, navigate]);

  if (isLoading || !technician || !canViewDailyReport) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/technician/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {language === "ar" ? "العودة للوحة الفني" : "Back to dashboard"}
            </Button>
          </Link>
          <span className="text-sm text-muted-foreground">{technician.displayName}</span>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <DailyReport
          user={{
            id: technician.id,
            role: technician.isAdmin === 1 ? "sales_admin" : "technician",
            permissions: { canViewReports: 1, canEditReceipt: 0 },
          }}
          salesLocationId={1}
        />
      </div>
    </div>
  );
}
