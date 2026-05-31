import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type Target = "inventory" | "pos" | "sales-login";

const TARGETS: Record<Target, string> = {
  inventory: "/sales/inventory-loc1",
  pos: "/sales/instore-pos",
  "sales-login": "/sales",
};

export function BatteryRedirectInventory() {
  return <BatterySystemRedirect target="inventory" />;
}

export function BatteryRedirectPos() {
  return <BatterySystemRedirect target="pos" />;
}

export function BatteryRedirectSalesLogin() {
  return <BatterySystemRedirect target="sales-login" />;
}

export default function BatterySystemRedirect({ target }: { target: Target }) {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();

  useEffect(() => {
    setLocation(TARGETS[target]);
  }, [target, setLocation]);

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">
        {language === "ar"
          ? "تم نقل نظام البطاريات إلى مخزون المبيعات..."
          : "Battery inventory moved to Sales — redirecting..."}
      </p>
    </div>
  );
}
