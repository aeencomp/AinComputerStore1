import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatPrice } from "@/lib/formatters";
import { getCategoryName } from "@/lib/categoryNames";
import { apiRequest, fetchWithTimeout, queryClient } from "@/lib/queryClient";

export interface SyncProductEntry {
  id: string;
  nameEn: string;
  sku: string | null;
  category: string;
  price: string;
  previousPrice?: string | null;
}

export interface AdminPriceSyncStatus {
  lastSync: string | null;
  nextSync: string | null;
  updatedCount: number;
  createdCount?: number;
  totalMatched: number;
  fetchedCount?: number;
  createdProducts?: SyncProductEntry[];
  updatedProducts?: SyncProductEntry[];
  errors: string[];
  status: string;
  progress?: string;
  startedAt?: string;
  processedCount?: number;
}

function SyncProductResults({
  createdProducts,
  updatedProducts,
}: {
  createdProducts?: SyncProductEntry[];
  updatedProducts?: SyncProductEntry[];
}) {
  const { language } = useLanguage();
  const created = createdProducts ?? [];
  const updated = updatedProducts ?? [];

  if (created.length === 0 && updated.length === 0) {
    return null;
  }

  const renderList = (items: SyncProductEntry[], showPrevious = false) => (
    <ScrollArea className="h-52 rounded-md border">
      <div className="p-2 space-y-1">
        {items.map((product) => (
          <div
            key={product.id}
            className="flex items-start justify-between gap-3 py-2 border-b last:border-0 text-sm"
          >
            <div className="min-w-0 flex-1">
              <Link href={`/product/${product.id}`} className="text-primary hover:underline line-clamp-2">
                {product.nameEn}
              </Link>
              <p className="text-xs text-muted-foreground mt-0.5">
                {getCategoryName(product.category, language)}
                {product.sku ? ` · SKU ${product.sku}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-left">
              {showPrevious && product.previousPrice ? (
                <p className="text-xs text-muted-foreground line-through">
                  {formatPrice(parseFloat(product.previousPrice) * 1000, language)}
                </p>
              ) : null}
              <p className="font-medium whitespace-nowrap">
                {formatPrice(parseFloat(product.price) * 1000, language)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );

  return (
    <div className="mt-4 space-y-4">
      {created.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">
            {language === "ar" ? "منتجات مضافة" : "Added"} ({created.length})
          </p>
          {renderList(created)}
        </div>
      )}
      {updated.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">
            {language === "ar" ? "أسعار محدّثة" : "Updated prices"} ({updated.length})
          </p>
          {renderList(updated, true)}
        </div>
      )}
    </div>
  );
}

export function GlobalIraqSyncPanel({ className }: { className?: string }) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const prevStatusRef = useRef<string | undefined>(undefined);

  const syncStatusQuery = useQuery<AdminPriceSyncStatus>({
    queryKey: ["/api/admin/price-sync/status"],
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 2000 : 30000,
  });

  const status = syncStatusQuery.data;
  const isRunning = status?.status === "running";

  useEffect(() => {
    const prev = prevStatusRef.current;
    const cur = status?.status;
    if (prev === "running" && cur === "success") {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      const created = status?.createdCount ?? 0;
      const updated = status?.updatedCount ?? 0;
      const matched = status?.totalMatched ?? 0;
      const fetched = status?.fetchedCount ?? 0;
      toast({
        title: language === "ar" ? "تمت مزامنة Global Iraq" : "Global Iraq sync complete",
        description:
          language === "ar"
            ? `${created} مضاف، ${updated} محدّث (${matched}/${fetched})`
            : `${created} added, ${updated} updated (${matched}/${fetched})`,
      });
    }
    if (prev === "running" && cur === "error" && status?.errors?.length) {
      toast({
        title: language === "ar" ? "فشلت المزامنة" : "Sync failed",
        description: status.errors[status.errors.length - 1],
        variant: "destructive",
      });
    }
    if (prev === "running" && cur === "idle") {
      toast({
        title: language === "ar" ? "توقفت المزامنة" : "Sync stopped",
        description:
          language === "ar"
            ? "تم إعادة التعيين — اضغط مزامنة الآن."
            : "State was reset — press Sync now.",
      });
    }
    prevStatusRef.current = cur;
  }, [status?.status, status, language, toast]);

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/price-sync/reset"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/price-sync/status"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithTimeout(
        "/api/admin/price-sync/run",
        { method: "POST", credentials: "include" },
        30_000,
      );
      const body = (await res.json()) as AdminPriceSyncStatus & { error?: string };
      if (res.status === 409) {
        throw new Error(body.error ?? "المزامنة قيد التشغيل بالفعل");
      }
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/price-sync/status"] });
      toast({
        title: language === "ar" ? "بدأت المزامنة" : "Sync started",
        description:
          language === "ar"
            ? "يتم التحديث في الخلفية — راقب «الحالة» أدناه."
            : "Running in background — watch Status below.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: language === "ar" ? "لم تبدأ المزامنة" : "Could not start sync",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString(language === "ar" ? "ar-IQ" : "en-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className={className} data-testid="card-price-sync">
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            {language === "ar" ? "مزامنة Global Iraq" : "Global Iraq sync"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "تحديث تلقائي كل 24 ساعة (أسعار + توفر) — GitHub يحمّل كatalog Global Iraq يومياً، والخادم يطبّقه على المتجر"
              : "Auto sync every 24h (price + stock) — GitHub refreshes the catalog daily, server applies to your store"}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {isRunning && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={resetMutation.isPending}
              onClick={() => resetMutation.mutate()}
              data-testid="button-reset-price-sync"
            >
              {language === "ar" ? "إيقاف / إعادة تعيين" : "Stop / reset"}
            </Button>
          )}
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || resetMutation.isPending || isRunning}
            data-testid="button-sync-prices"
            size="lg"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {language === "ar" ? "جاري التطبيق…" : "Applying…"}
              </>
            ) : syncMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {language === "ar" ? "جاري البدء…" : "Starting…"}
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {language === "ar" ? "مزامنة الآن" : "Sync now"}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isRunning && status?.progress ? (
          <p className="text-sm text-muted-foreground mb-4">{status.progress}</p>
        ) : null}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{language === "ar" ? "الحالة" : "Status"}</p>
            <Badge
              variant={
                status?.status === "success"
                  ? "default"
                  : status?.status === "running"
                    ? "secondary"
                    : status?.status === "error"
                      ? "destructive"
                      : "outline"
              }
            >
              {status?.status === "success"
                ? language === "ar"
                  ? "ناجح"
                  : "OK"
                : status?.status === "running"
                  ? language === "ar"
                    ? "قيد التشغيل"
                    : "Running"
                  : status?.status === "error"
                    ? language === "ar"
                      ? "خطأ"
                      : "Error"
                    : language === "ar"
                      ? "في الانتظار"
                      : "Idle"}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground">{language === "ar" ? "آخر مزامنة" : "Last sync"}</p>
            <p className="font-medium">{formatDate(status?.lastSync ?? null)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{language === "ar" ? "التالية" : "Next"}</p>
            <p className="font-medium">{formatDate(status?.nextSync ?? null)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{language === "ar" ? "من الكatalog" : "In catalog"}</p>
            <p className="font-medium">{status?.fetchedCount ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{language === "ar" ? "مضاف / محدّث" : "Added / updated"}</p>
            <p className="font-medium">
              {status?.createdCount ?? 0} / {status?.updatedCount ?? 0}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{language === "ar" ? "متطابق" : "Matched"}</p>
            <p className="font-medium">{status?.totalMatched ?? 0}</p>
          </div>
        </div>
        {status?.errors && status.errors.length > 0 && (
          <div
            className={`mt-3 p-2 rounded text-sm ${
              status.status === "success"
                ? "bg-amber-500/10 text-amber-900 dark:text-amber-200"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {status.errors.map((err, i) => (
              <p key={i}>{err}</p>
            ))}
          </div>
        )}
        <SyncProductResults
          createdProducts={status?.createdProducts}
          updatedProducts={status?.updatedProducts}
        />
      </CardContent>
    </Card>
  );
}
