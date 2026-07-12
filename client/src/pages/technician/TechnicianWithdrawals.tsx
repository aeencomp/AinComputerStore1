import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import SalesWithdrawals from "@/pages/SalesWithdrawals";

interface Technician {
  id: string;
  username: string;
  displayName: string;
  isAdmin: number;
  permissions: string[];
}

export default function TechnicianWithdrawals() {
  const [, navigate] = useLocation();
  const { language } = useLanguage();

  const { data: technician, isLoading, error } = useQuery<Technician>({
    queryKey: ["/api/technician/auth/me"],
    retry: false,
  });

  const canViewWithdrawals =
    !!technician &&
    (technician.isAdmin === 1 ||
      (technician.permissions || []).includes("view_withdrawals"));

  useEffect(() => {
    if (error) navigate("/technician/login");
    else if (!isLoading && technician && !canViewWithdrawals) {
      navigate("/technician/dashboard");
    }
  }, [error, isLoading, technician, canViewWithdrawals, navigate]);

  if (isLoading || !technician || !canViewWithdrawals) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{language === "ar" ? "جاري التحميل..." : "Loading..."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/technician/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back-technician-dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <TrendingDown className="h-5 w-5 text-orange-600" />
          <h1 className="text-lg font-semibold">
            {language === "ar" ? "سحوبات المبيعات" : "Sales Withdrawals"}
          </h1>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <SalesWithdrawals
          user={{
            name: technician.displayName,
            username: technician.username,
            permissions: { canViewWithdrawals: 1 },
          }}
        />
      </div>
    </div>
  );
}
