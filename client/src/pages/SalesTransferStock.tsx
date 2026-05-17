import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowRightLeft, Loader2, Search } from "lucide-react";

interface SearchHit {
  productSource: "instore" | "laptop" | "desktop";
  productId: string;
  label: string;
  stockQuantity: number;
  barcode?: string | null;
}

export default function SalesTransferStock() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");

  const { data: results = [], isFetching } = useQuery<SearchHit[]>({
    queryKey: ["/api/sales/inventory/search-loc1", search],
    queryFn: async () => {
      if (search.trim().length < 2) return [];
      const res = await fetch(
        `/api/sales/inventory/search-loc1?q=${encodeURIComponent(search.trim())}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: search.trim().length >= 2,
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("No product");
      const res = await apiRequest("POST", "/api/sales/transfers", {
        productSource: selected.productSource,
        productId: selected.productId,
        quantity: parseInt(quantity, 10) || 1,
        notes: notes.trim() || null,
        fromLocationId: 1,
        toLocationId: 2,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: language === "ar" ? "تم النقل بنجاح" : "Transfer completed",
      });
      setSelected(null);
      setSearch("");
      setQuantity("1");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/instore/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/battery/laptops"] });
      queryClient.invalidateQueries({ queryKey: ["/api/battery/desktops"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/transfers"] });
    },
    onError: (e: Error) => {
      toast({ title: e.message, variant: "destructive" });
    },
  });

  const isSerial = selected?.productSource === "laptop" || selected?.productSource === "desktop";

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
              ? "ابحث في مخزون الموقع 1 ثم انقل الكمية إلى الموقع 2"
              : "Search Location 1 inventory, then move quantity to Location 2"}
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
            {isFetching && <p className="text-xs text-muted-foreground mt-1"><Loader2 className="inline h-3 w-3 animate-spin" /></p>}
            {results.length > 0 && !selected && (
              <ul className="mt-2 border rounded-md divide-y max-h-48 overflow-y-auto">
                {results.map((r) => (
                  <li key={`${r.productSource}-${r.productId}`}>
                    <button
                      type="button"
                      className="w-full text-start px-3 py-2 hover:bg-muted text-sm"
                      onClick={() => {
                        setSelected(r);
                        setQuantity(r.productSource === "instore" ? "1" : "1");
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
            <>
              <div className="p-3 bg-muted rounded-md text-sm">
                <strong>{selected.label}</strong>
                <span className="text-muted-foreground block">
                  {selected.productSource} · {language === "ar" ? "متوفر" : "Available"}: {selected.stockQuantity}
                </span>
              </div>
              {!isSerial && (
                <div>
                  <Label>{language === "ar" ? "الكمية" : "Quantity"}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={selected.stockQuantity}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
              )}
              <div>
                <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button
                className="w-full"
                onClick={() => transferMutation.mutate()}
                disabled={transferMutation.isPending}
                data-testid="button-confirm-transfer"
              >
                {transferMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  language === "ar" ? "نقل إلى الموقع 2" : "Transfer to Location 2"
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
