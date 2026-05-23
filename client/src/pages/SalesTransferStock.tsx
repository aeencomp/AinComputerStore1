import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowRightLeft, Loader2, Search, Plus, Trash2, ShoppingCart } from "lucide-react";

interface SearchHit {
  productSource: "instore" | "laptop" | "desktop" | "adapter";
  productId: string;
  label: string;
  stockQuantity: number;
  barcode?: string | null;
}

interface TransferLine {
  key: string;
  hit: SearchHit;
  quantity: string;
}

function lineKey(hit: SearchHit) {
  return `${hit.productSource}-${hit.productId}`;
}

function parseQty(value: string, max: number): number {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, max);
}

export type StockTransferDirection = "1-to-2" | "2-to-1";

const TRANSFER_CONFIG = {
  "1-to-2": {
    fromLocationId: 1,
    toLocationId: 2,
    searchPath: "/api/sales/inventory/search-loc1",
    titleAr: "نقل مخزون إلى الموقع 2",
    titleEn: "Transfer stock to Location 2",
    subtitleAr: "ابحث في مخزون الموقع 1، أضف الأصناف، ثم انقلها دفعة واحدة إلى الموقع 2",
    subtitleEn: "Search Location 1 stock, add items, then transfer all to Location 2",
    sourceAr: "الموقع 1",
    sourceEn: "Location 1",
    destAr: "الموقع 2",
    destEn: "Location 2",
    transferAllAr: (n: number) => `نقل الكل (${n} صنف) إلى الموقع 2`,
    transferAllEn: (n: number) => `Transfer all (${n} items) to Location 2`,
  },
  "2-to-1": {
    fromLocationId: 2,
    toLocationId: 1,
    searchPath: "/api/sales/inventory/search-loc2",
    titleAr: "نقل مخزون إلى الموقع 1",
    titleEn: "Transfer stock to Location 1",
    subtitleAr: "ابحث في مخزون الموقع 2، أضف الأصناف، ثم انقلها دفعة واحدة إلى الموقع 1",
    subtitleEn: "Search Location 2 stock, add items, then transfer all to Location 1",
    sourceAr: "الموقع 2",
    sourceEn: "Location 2",
    destAr: "الموقع 1",
    destEn: "Location 1",
    transferAllAr: (n: number) => `نقل الكل (${n} صنف) إلى الموقع 1`,
    transferAllEn: (n: number) => `Transfer all (${n} items) to Location 1`,
  },
} as const;

interface SalesTransferStockProps {
  direction: StockTransferDirection;
  user: {
    role: string;
    permissions: {
      canInventory: number;
      canTransferToLoc1: number;
    };
  };
}

export default function SalesTransferStock({ direction, user }: SalesTransferStockProps) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const cfg = TRANSFER_CONFIG[direction];
  const isAr = language === "ar";

  const canAccess =
    user.role === "sales_admin" ||
    (direction === "1-to-2" && user.permissions.canInventory === 1) ||
    (direction === "2-to-1" && user.permissions.canTransferToLoc1 === 1);

  const [search, setSearch] = useState("");
  const [draftQty, setDraftQty] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<TransferLine[]>([]);

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">
          {isAr ? "ليس لديك صلاحية هذا النقل" : "You do not have permission for this transfer"}
        </p>
      </div>
    );
  }

  const invalidateTransferStockQueries = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = String(query.queryKey[0] || "");
        return (
          key.startsWith("/api/instore/products") ||
          key.startsWith("/api/battery/laptops") ||
          key.startsWith("/api/battery/desktops") ||
          key.startsWith("/api/battery/adapters") ||
          key.startsWith("/api/sales/inventory/search-loc1") ||
          key.startsWith("/api/sales/inventory/search-loc2") ||
          key.startsWith("/api/sales/transfers")
        );
      },
    });
  };

  const { data: results = [], isFetching } = useQuery<SearchHit[]>({
    queryKey: [cfg.searchPath, search],
    queryFn: async () => {
      if (search.trim().length < 2) return [];
      const res = await fetch(
        `${cfg.searchPath}?q=${encodeURIComponent(search.trim())}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return (data as SearchHit[])
        .map((r) => ({
          ...r,
          stockQuantity: Number(r.stockQuantity) || 0,
        }))
        .filter((r) => r.stockQuantity > 0);
    },
    enabled: search.trim().length >= 2,
  });

  const transferBatchMutation = useMutation({
    mutationFn: async (payload: { lines: TransferLine[]; notes: string }) => {
      const res = await apiRequest("POST", "/api/sales/transfers/batch", {
        fromLocationId: cfg.fromLocationId,
        toLocationId: cfg.toLocationId,
        notes: payload.notes.trim() || null,
        items: payload.lines.map((line) => ({
          productSource: line.hit.productSource,
          productId: line.hit.productId,
          quantity: parseQty(line.quantity, line.hit.stockQuantity),
        })),
      });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({
        title: language === "ar" ? "تم النقل بنجاح" : "Transfer completed",
        description:
          language === "ar"
            ? `تم نقل ${variables.lines.length} صنف دفعة واحدة`
            : `${variables.lines.length} item(s) transferred in one go`,
      });
      setLines([]);
      setDraftQty({});
      invalidateTransferStockQueries();
    },
    onError: (e: Error) => {
      const msg = e.message?.replace(/^\d+:\s*/, "") || e.message;
      toast({ title: msg, variant: "destructive" });
    },
  });

  const getDraftQty = (hit: SearchHit) => draftQty[lineKey(hit)] ?? "1";

  const setHitDraftQty = (hit: SearchHit, value: string) => {
    const key = lineKey(hit);
    const max = hit.stockQuantity;
    if (value === "") {
      setDraftQty((prev) => ({ ...prev, [key]: "" }));
      return;
    }
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return;
    setDraftQty((prev) => ({
      ...prev,
      [key]: String(Math.max(1, Math.min(n, max))),
    }));
  };

  const addHitToCart = (hit: SearchHit) => {
    const qty = parseQty(getDraftQty(hit), hit.stockQuantity);
    const key = lineKey(hit);
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        const merged = Math.min(
          parseQty(String(parseInt(existing.quantity, 10) + qty), hit.stockQuantity),
          hit.stockQuantity,
        );
        return prev.map((l) =>
          l.key === key ? { ...l, quantity: String(merged) } : l,
        );
      }
      return [...prev, { key, hit, quantity: String(qty) }];
    });
    toast({
      title: language === "ar" ? "تمت الإضافة" : "Added",
      description: hit.label,
    });
  };

  const updateLineQty = (key: string, value: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const max = Number(l.hit.stockQuantity) || 0;
        if (value === "") return { ...l, quantity: "" };
        const n = parseInt(value, 10);
        if (!Number.isFinite(n)) return l;
        return { ...l, quantity: String(Math.max(1, Math.min(n, max))) };
      }),
    );
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const clearCart = () => {
    setLines([]);
    toast({ title: language === "ar" ? "تم تفريغ القائمة" : "Cart cleared" });
  };

  const totalUnits = lines.reduce(
    (sum, l) => sum + parseQty(l.quantity, l.hit.stockQuantity),
    0,
  );

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-28">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowRightLeft className="h-5 w-5" />
            {isAr ? cfg.titleAr : cfg.titleEn}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isAr ? cfg.subtitleAr : cfg.subtitleEn}
          </p>
          <p className="text-xs font-medium text-primary">
            {isAr
              ? `${cfg.sourceAr} → ${cfg.destAr}`
              : `${cfg.sourceEn} → ${cfg.destEn}`}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{language === "ar" ? "بحث (باركود / سيريال / اسم)" : "Search (barcode / serial / name)"}</Label>
            <div className="relative mt-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="ps-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={language === "ar" ? "ابحث وأضف أصنافاً..." : "Search and add items..."}
                data-testid="input-transfer-search"
              />
            </div>
            {isFetching && (
              <p className="text-xs text-muted-foreground mt-1">
                <Loader2 className="inline h-3 w-3 animate-spin" />
              </p>
            )}
            {search.trim().length >= 2 && !isFetching && results.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {language === "ar" ? "لا توجد نتائج" : "No results"}
              </p>
            )}
            {results.length > 0 && (
              <ul className="mt-2 border rounded-md divide-y max-h-64 overflow-y-auto">
                {results.map((r) => {
                  const inCart = lines.some((l) => l.key === lineKey(r));
                  return (
                    <li
                      key={lineKey(r)}
                      className="px-3 py-2 flex flex-wrap items-center gap-2 text-sm bg-background"
                    >
                      <div className="flex-1 min-w-[160px]">
                        <span className="font-medium block">{r.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {language === "ar" ? "متوفر" : "Avail"}: {r.stockQuantity}
                          {inCart && (
                            <span className="text-primary ms-2">
                              · {language === "ar" ? "في القائمة" : "In cart"}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          max={r.stockQuantity}
                          className="w-16 h-8 text-center"
                          value={getDraftQty(r)}
                          onChange={(e) => setHitDraftQty(r, e.target.value)}
                          data-testid={`input-draft-qty-${lineKey(r)}`}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant={inCart ? "secondary" : "default"}
                          className="h-8 gap-1"
                          onClick={() => addHitToCart(r)}
                          data-testid={`button-add-cart-${lineKey(r)}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {language === "ar" ? "إضافة" : "Add"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <Label>{language === "ar" ? "ملاحظات (اختياري)" : "Notes (optional)"}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Transfer cart — always visible */}
      <Card className="border-primary/30 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-5 w-5 text-primary" />
              {language === "ar" ? "قائمة النقل" : "Transfer cart"}
              <span className="text-sm font-normal text-muted-foreground">
                ({lines.length} {language === "ar" ? "صنف" : "items"})
              </span>
            </CardTitle>
            {lines.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={clearCart}>
                {language === "ar" ? "تفريغ" : "Clear"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {language === "ar"
                ? "ابحث عن المنتجات واضغط «إضافة» لكل صنف. عند الانتهاء اضغط نقل الكل."
                : "Search products and tap Add for each item. When done, press Transfer all."}
            </p>
          ) : (
            <ul className="border rounded-md divide-y max-h-56 overflow-y-auto">
              {lines.map((line) => {
                const max = Number(line.hit.stockQuantity) || 0;
                return (
                  <li
                    key={line.key}
                    className="px-3 py-2 flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="flex-1 min-w-[140px] font-medium">{line.hit.label}</span>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">
                        {language === "ar" ? "الكمية" : "Qty"}
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={max}
                        className="w-20 h-8"
                        value={line.quantity}
                        onChange={(e) => updateLineQty(line.key, e.target.value)}
                        data-testid={`input-transfer-line-qty-${line.key}`}
                      />
                      <span className="text-xs text-muted-foreground">/ {max}</span>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => removeLine(line.key)}
                      aria-label={language === "ar" ? "حذف" : "Remove"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          {lines.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {language === "ar"
                ? `إجمالي الوحدات المراد نقلها: ${totalUnits}`
                : `Total units to transfer: ${totalUnits}`}
            </p>
          )}

          <Button
            className="w-full h-12 text-base font-bold"
            size="lg"
            onClick={() => transferBatchMutation.mutate({ lines, notes })}
            disabled={lines.length === 0 || transferBatchMutation.isPending}
            data-testid="button-transfer-all-lines"
          >
            {transferBatchMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin me-2" />
                {language === "ar" ? "جاري النقل..." : "Transferring..."}
              </>
            ) : lines.length === 0 ? (
              isAr ? "أضف أصنافاً للقائمة أولاً" : "Add items to cart first"
            ) : isAr ? (
              cfg.transferAllAr(lines.length)
            ) : (
              cfg.transferAllEn(lines.length)
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
