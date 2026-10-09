import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
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

async function pollAdminPriceSyncStatus(
  statusUrl: string,
): Promise<AdminPriceSyncStatus> {
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const res = await fetchWithTimeout(statusUrl, { credentials: "include" }, 30_000);
    if (!res.ok) continue;
    const data = (await res.json()) as AdminPriceSyncStatus;
    if (data.status !== "running") {
      if (data.status === "error" && data.errors?.length) {
        throw new Error(data.errors[data.errors.length - 1] ?? "فشلت المزامنة");
      }
      return data;
    }
  }
  throw new Error("انتهت مهلة انتظار المزامنة — تحقق من الخادم أو حاول لاحقاً");
}

async function requestCatalogSyncStart(runUrl: string): Promise<AdminPriceSyncStatus> {
  const res = await fetchWithTimeout(
    runUrl,
    { method: "POST", credentials: "include" },
    60_000,
  );
  const body = (await res.json()) as AdminPriceSyncStatus & { error?: string };
  if (res.status === 409) {
    throw new Error(body.error ?? "المزامنة قيد التشغيل بالفعل");
  }
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (body.status === "running") {
    return pollAdminPriceSyncStatus("/api/admin/price-sync/status");
  }
  return body;
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

  const syncStatusQuery = useQuery<AdminPriceSyncStatus>({
    queryKey: ["/api/admin/price-sync/status"],
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 3000 : 30000,
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/price-sync/reset"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/price-sync/status"] });
      toast({
        title: language === "ar" ? "تم إعادة التعيين" : "Sync state reset",
        description:
          language === "ar"
            ? "يمكنك الضغط على «مزامنة الآن» مرة أخرى."
            : "You can press Sync now again.",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => requestCatalogSyncStart("/api/admin/price-sync/run"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/price-sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      const created = data.createdCount ?? 0;
      const updated = data.updatedCount ?? 0;
      const matched = data.totalMatched ?? 0;
      const fetched = data.fetchedCount ?? 0;
      toast({
        title: language === "ar" ? "تمت مزامنة Global Iraq" : "Global Iraq sync complete",
        description:
          language === "ar"
            ? created > 0 || updated > 0
              ? `أُضيف ${created}، وتم تحديث ${updated} (${matched} من ${fetched})`
              : `محدّث — ${matched} منتج من ${fetched} على GlobalIraq`
            : `${created} added, ${updated} updated (${matched}/${fetched} matched)`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: language === "ar" ? "فشلت المزامنة" : "Sync failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const status = syncStatusQuery.data;
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
              ? "أسعار ومنتجات (لابتوبات، برامج، إكسسوارات…) — تلقائياً كل 24 ساعة وبعد كل نشر من GitHub"
              : "Prices & catalog incl. software — auto every 24h and after GitHub deploy"}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {(status?.status === "running" || syncMutation.isPending) && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={resetMutation.isPending}
              onClick={() => resetMutation.mutate()}
              data-testid="button-reset-price-sync"
            >
              {language === "ar" ? "إعادة تعيين" : "Reset stuck sync"}
            </Button>
          )}
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={
              syncMutation.isPending ||
              resetMutation.isPending ||
              status?.status === "running"
            }
            data-testid="button-sync-prices"
            size="lg"
          >
            {syncMutation.isPending || status?.status === "running" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {language === "ar" ? "جاري المزامنة…" : "Syncing…"}
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
        {status?.status === "running" && status.progress ? (
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
            <p className="text-muted-foreground">{language === "ar" ? "من Global Iraq" : "Fetched"}</p>
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
            {status.status === "error" &&
            status.errors.some((e) => e.includes("429") || e.includes("Rate limit")) ? (
              <p className="mt-2 text-xs opacity-90">
                {language === "ar"
                  ? "Global Iraq يحدّ الطلبات. انتظر 10–15 دقيقة ثم «مزامنة الآن» — أو «إعادة تعيين» إن بقيت عالقة."
                  : "Global Iraq is rate-limiting. Wait 10–15 minutes, then Sync now."}
              </p>
            ) : null}
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
