import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowRightLeft, Loader2, Search, Plus, Trash2 } from "lucide-react";

interface SearchHit {
  productSource: "instore" | "laptop" | "desktop";
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

export default function SalesTransferStock() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<TransferLine[]>([]);

  const invalidateTransferStockQueries = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = String(query.queryKey[0] || "");
        return (
          key.startsWith("/api/instore/products") ||
          key.startsWith("/api/battery/laptops") ||
          key.startsWith("/api/battery/desktops") ||
          key.startsWith("/api/sales/inventory/search-loc1") ||
          key.startsWith("/api/sales/transfers")
        );
      },
    });
  };

  const { data: results = [], isFetching } = useQuery<SearchHit[]>({
    queryKey: ["/api/sales/inventory/search-loc1", search],
    queryFn: async () => {
      if (search.trim().length < 2) return [];
      const res = await fetch(
        `/api/sales/inventory/search-loc1?q=${encodeURIComponent(search.trim())}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return (data as SearchHit[]).map((r) => ({
        ...r,
        stockQuantity: Number(r.stockQuantity) || 0,
      })).filter((r) => r.stockQuantity > 0);
    },
    enabled: search.trim().length >= 2,
  });

  const transferMutation = useMutation({
    mutationFn: async (payload: {
      lines: TransferLine[];
      notes: string;
    }) => {
      for (const line of payload.lines) {
        const qty = parseQty(line.quantity, line.hit.stockQuantity);
        await apiRequest("POST", "/api/sales/transfers", {
          productSource: line.hit.productSource,
          productId: line.hit.productId,
          quantity: qty,
          notes: payload.notes.trim() || null,
          fromLocationId: 1,
          toLocationId: 2,
        });
      }
    },
    onSuccess: (_data, variables) => {
      toast({
        title: language === "ar" ? "تم النقل بنجاح" : "Transfer completed",
        description:
          language === "ar"
            ? `تم نقل ${variables.lines.length} صنف`
            : `${variables.lines.length} item(s) transferred`,
      });
      setSelected(null);
      setSearch("");
      setQuantity("1");
      setNotes("");
      setLines([]);
      invalidateTransferStockQueries();
    },
    onError: (e: Error) => {
      toast({ title: e.message, variant: "destructive" });
    },
  });

  const selectedAvailable = selected ? Number(selected.stockQuantity) || 0 : 0;

  const addLineToList = () => {
    if (!selected || selectedAvailable < 1) return;
    const qty = parseQty(quantity, selectedAvailable);
    const key = lineKey(selected);
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        const merged = Math.min(
          parseQty(String(parseInt(existing.quantity, 10) + qty), selectedAvailable),
          selectedAvailable,
        );
        return prev.map((l) =>
          l.key === key ? { ...l, quantity: String(merged) } : l,
        );
      }
      return [...prev, { key, hit: selected, quantity: String(qty) }];
    });
    setSelected(null);
    setSearch("");
    setQuantity("1");
    toast({
      title: language === "ar" ? "تمت الإضافة للقائمة" : "Added to list",
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

  const transferSingle = () => {
    if (!selected) return;
    const qty = parseQty(quantity, selectedAvailable);
    transferMutation.mutate({
      lines: [{ key: lineKey(selected), hit: selected, quantity: String(qty) }],
      notes,
    });
  };

  const transferAllLines = () => {
    if (lines.length === 0) return;
    transferMutation.mutate({ lines, notes });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            {language === "ar" ? "نقل مخزون إلى الموقع 2" : "Transfer stock to Location 2"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {language === "ar"
              ? "ابحث في مخزون الموقع 1، حدد الكمية لكل صنف، ثم انقل"
              : "Search Location 1 stock, set quantity per item, then transfer"}
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
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelected(null);
                }}
                placeholder={language === "ar" ? "ابحث..." : "Search..."}
                data-testid="input-transfer-search"
              />
            </div>
            {isFetching && (
              <p className="text-xs text-muted-foreground mt-1">
                <Loader2 className="inline h-3 w-3 animate-spin" />
              </p>
            )}
            {results.length > 0 && !selected && (
              <ul className="mt-2 border rounded-md divide-y max-h-48 overflow-y-auto">
                {results.map((r) => (
                  <li key={lineKey(r)}>
                    <button
                      type="button"
                      className="w-full text-start px-3 py-2 hover:bg-muted text-sm"
                      onClick={() => {
                        setSelected(r);
                        setQuantity("1");
                      }}
                    >
                      <span className="font-medium">{r.label}</span>
                      <span className="text-muted-foreground ms-2">
                        ({language === "ar" ? "متوفر" : "avail"}: {r.stockQuantity})
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected && (
            <div className="space-y-4 p-3 border rounded-md bg-muted/30">
              <div className="text-sm">
                <strong>{selected.label}</strong>
                <span className="text-muted-foreground block">
                  {selected.productSource} ·{" "}
                  {language === "ar" ? "متوفر في الموقع 1" : "Available at Location 1"}:{" "}
                  <span className="font-bold text-foreground">{selectedAvailable}</span>
                </span>
              </div>
              <div>
                <Label>
                  {language === "ar" ? "الكمية المراد نقلها" : "Quantity to transfer"}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={selectedAvailable}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-testid="input-transfer-quantity"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {language === "ar"
                    ? `أقصى كمية: ${selectedAvailable}`
                    : `Maximum: ${selectedAvailable}`}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={addLineToList}
                  disabled={selectedAvailable < 1}
                  data-testid="button-add-transfer-line"
                >
                  <Plus className="h-4 w-4" />
                  {language === "ar" ? "إضافة للقائمة" : "Add to list"}
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={transferSingle}
                  disabled={transferMutation.isPending || selectedAvailable < 1}
                  data-testid="button-confirm-transfer"
                >
                  {transferMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : language === "ar" ? (
                    "نقل الآن"
                  ) : (
                    "Transfer now"
                  )}
                </Button>
              </div>
            </div>
          )}

          {lines.length > 0 && (
            <div className="space-y-3">
              <Label>
                {language === "ar" ? "قائمة النقل" : "Transfer list"} ({lines.length})
              </Label>
              <ul className="border rounded-md divide-y">
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
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeLine(line.key)}
                        aria-label={language === "ar" ? "حذف" : "Remove"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div>
            <Label>{language === "ar" ? "ملاحظات (اختياري)" : "Notes (optional)"}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
          </div>

          {lines.length > 0 && (
            <Button
              className="w-full"
              onClick={transferAllLines}
              disabled={transferMutation.isPending}
              data-testid="button-transfer-all-lines"
            >
              {transferMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : language === "ar" ? (
                `نقل ${lines.length} صنف إلى الموقع 2`
              ) : (
                `Transfer ${lines.length} item(s) to Location 2`
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
