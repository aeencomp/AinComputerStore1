import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface LocationOption {
  id: number;
  code: string;
  nameAr: string;
  nameEn?: string | null;
}

interface MeResponse {
  allowedLocations: LocationOption[];
}

export default function SalesLocationPick() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: me, isLoading } = useQuery<MeResponse>({
    queryKey: ["/api/sales/auth/me"],
    retry: false,
  });

  const selectMutation = useMutation({
    mutationFn: async (locationId: number) => {
      const res = await apiRequest("POST", "/api/sales/locations/select", { locationId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/auth/me"] });
      setLocation("/sales");
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const locations = me?.allowedLocations ?? [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4" dir={language === "ar" ? "rtl" : "ltr"}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Store className="h-7 w-7 text-primary" />
          </div>
          <CardTitle>{language === "ar" ? "اختر موقع العمل" : "Select work location"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {language === "ar" ? "حدد الموقع الذي ستعمل منه اليوم" : "Choose which shop you are working at today"}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {locations.map((loc) => (
            <Button
              key={loc.id}
              variant="outline"
              className="w-full h-auto py-4 justify-start text-start"
              disabled={selectMutation.isPending}
              onClick={() => selectMutation.mutate(loc.id)}
              data-testid={`button-pick-location-${loc.id}`}
            >
              <Store className="h-5 w-5 me-3 shrink-0" />
              <span className="font-semibold">
                {language === "ar" ? loc.nameAr : (loc.nameEn || loc.nameAr)}
              </span>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

