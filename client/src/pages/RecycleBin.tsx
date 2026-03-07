import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminNav from "@/components/AdminNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, RotateCcw, Search, PackageX, ShoppingCart, Wrench, Package, AlertTriangle } from "lucide-react";

type RecycleBinItem = {
  id: number;
  itemType: string;
  itemId: string;
  itemLabel: string;
  section: string;
  data: any;
  deletedAt: string;
  deletedBy: string;
};

const SECTION_CONFIG: Record<string, { labelAr: string; labelEn: string; color: string; icon: any }> = {
  online: { labelAr: "طلب إلكتروني", labelEn: "Online Order", color: "bg-blue-100 text-blue-700", icon: ShoppingCart },
  "walk-in": { labelAr: "طلب حضوري", labelEn: "Walk-in Order", color: "bg-purple-100 text-purple-700", icon: ShoppingCart },
  repair: { labelAr: "تذكرة إصلاح", labelEn: "Repair Ticket", color: "bg-orange-100 text-orange-700", icon: Wrench },
  product: { labelAr: "منتج", labelEn: "Product", color: "bg-green-100 text-green-700", icon: Package },
};

function formatDate(dateStr: string) {
  try {
    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export default function RecycleBin() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [deleteDialogId, setDeleteDialogId] = useState<number | null>(null);

  const { data: items = [], isLoading } = useQuery<RecycleBinItem[]>({
    queryKey: ["/api/admin/recycle-bin"],
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/recycle-bin/${id}/restore`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recycle-bin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/repair-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "تم الاستعادة", description: "تم استعادة العنصر بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل استعادة العنصر", variant: "destructive" });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/recycle-bin/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recycle-bin"] });
      setDeleteDialogId(null);
      toast({ title: "تم الحذف", description: "تم حذف العنصر نهائياً" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حذف العنصر", variant: "destructive" });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/admin/recycle-bin/all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recycle-bin"] });
      setClearDialogOpen(false);
      toast({ title: "تم التفريغ", description: "تم تفريغ سلة المحذوفات بالكامل" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل تفريغ سلة المحذوفات", variant: "destructive" });
    },
  });

  const filtered = items.filter((item) => {
    const matchesSearch =
      !search ||
      item.itemLabel.toLowerCase().includes(search.toLowerCase()) ||
      item.itemId.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === "all" || item.section === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const counts: Record<string, number> = { all: items.length };
  for (const item of items) {
    counts[item.section] = (counts[item.section] || 0) + 1;
  }

  const filters = [
    { key: "all", labelAr: "الكل", labelEn: "All" },
    { key: "online", labelAr: "الطلبات الإلكترونية", labelEn: "Online Orders" },
    { key: "walk-in", labelAr: "الطلبات الحضورية", labelEn: "Walk-in Orders" },
    { key: "repair", labelAr: "تذاكر الإصلاح", labelEn: "Repair Tickets" },
    { key: "product", labelAr: "المنتجات", labelEn: "Products" },
  ];

  function getItemDetails(item: RecycleBinItem) {
    const d = item.data;
    if (item.itemType === "order") {
      return [
        d.customerName && `العميل: ${d.customerName}`,
        d.total && `الإجمالي: ${Number(d.total).toLocaleString()} د.ع`,
        d.status && `الحالة: ${d.status}`,
      ].filter(Boolean).join(" · ");
    }
    if (item.itemType === "repair_ticket") {
      return [
        d.customerName && `العميل: ${d.customerName}`,
        d.deviceBrand && d.deviceModel && `الجهاز: ${d.deviceBrand} ${d.deviceModel}`,
        d.status && `الحالة: ${d.status}`,
      ].filter(Boolean).join(" · ");
    }
    if (item.itemType === "product") {
      return [
        d.nameAr || d.nameEn,
        d.price && `السعر: ${Number(d.price).toLocaleString()} د.ع`,
      ].filter(Boolean).join(" · ");
    }
    return "";
  }

  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      <AdminNav />
      <main className="flex-1 p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-muted-foreground" />
              سلة المحذوفات
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              استعادة أو حذف نهائي للعناصر المحذوفة من جميع الأقسام
            </p>
          </div>
          {items.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setClearDialogOpen(true)}
              data-testid="button-clear-recycle-bin"
            >
              <Trash2 className="w-4 h-4 me-1" />
              تفريغ سلة المحذوفات
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Button
              key={f.key}
              variant={activeFilter === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter(f.key)}
              data-testid={`filter-${f.key}`}
            >
              {f.labelAr}
              {counts[f.key] !== undefined && (
                <Badge variant="secondary" className="ms-1 no-default-active-elevate">
                  {counts[f.key]}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم العنصر أو المعرف..."
            className="pe-9"
            data-testid="input-recycle-search"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-20 flex flex-col items-center gap-3 text-center">
              <PackageX className="w-12 h-12 text-muted-foreground/40" />
              <p className="text-lg font-medium text-muted-foreground">
                {items.length === 0 ? "سلة المحذوفات فارغة" : "لا توجد نتائج مطابقة"}
              </p>
              <p className="text-sm text-muted-foreground/70">
                {items.length === 0
                  ? "ستظهر هنا العناصر المحذوفة من الطلبات والإصلاح والمنتجات"
                  : "جرب تغيير كلمة البحث أو الفلتر"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => {
              const cfg = SECTION_CONFIG[item.section] || SECTION_CONFIG["product"];
              const Icon = cfg.icon;
              return (
                <Card key={item.id} data-testid={`recycle-item-${item.id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-0.5 p-2 rounded-md bg-muted shrink-0">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{item.itemLabel}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                              {cfg.labelAr}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {getItemDetails(item)}
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-1">
                            حُذف في: {formatDate(item.deletedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => restoreMutation.mutate(item.id)}
                          disabled={restoreMutation.isPending}
                          data-testid={`button-restore-${item.id}`}
                        >
                          <RotateCcw className="w-3.5 h-3.5 me-1" />
                          استعادة
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteDialogId(item.id)}
                          data-testid={`button-perm-delete-${item.id}`}
                          className="text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <AlertDialog open={deleteDialogId !== null} onOpenChange={(o) => !o && setDeleteDialogId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              حذف نهائي
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا العنصر نهائياً؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={() => deleteDialogId !== null && permanentDeleteMutation.mutate(deleteDialogId)}
              className="bg-destructive text-destructive-foreground"
            >
              حذف نهائي
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              تفريغ سلة المحذوفات
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف جميع {items.length} عناصر نهائياً بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={() => clearAllMutation.mutate()}
              className="bg-destructive text-destructive-foreground"
            >
              تفريغ الكل
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
