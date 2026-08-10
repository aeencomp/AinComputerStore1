import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Users, Loader2, Search, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminNav } from "@/components/AdminNav";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  createdAt: string;
  source: "repair" | "account" | "order";
  customerId?: string;
  editable?: boolean;
}

type SourceFilter = "all" | "repair" | "order";

export default function AdminCustomers() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [exportSource, setExportSource] = useState<"repair" | "order">("repair");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const { data: currentAdmin, isLoading: authLoading, isError: authError } = useQuery<AdminUser>({
    queryKey: ['/api/admin/auth/me'],
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && (authError || !currentAdmin)) {
      localStorage.removeItem("adminAuth");
      setLocation("/admin/login");
    }
  }, [authLoading, authError, currentAdmin, setLocation]);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/admin/customers"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/admin/customers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      setEditingCustomer(null);
      resetForm();
      toast({
        title: t('admin.customers.updateSuccess'),
      });
    },
    onError: () => {
      toast({
        title: t('admin.customers.updateError'),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      setDeleteCustomerId(null);
      toast({
        title: t('admin.customers.deleteSuccess'),
      });
    },
    onError: () => {
      toast({
        title: t('admin.customers.deleteError'),
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
    });
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone,
      password: "",
    });
  };

  const sourceLabel = (source: Customer["source"]) => {
    if (source === "repair") return t("admin.customers.sourceRepair");
    if (source === "account") return t("admin.customers.sourceAccount");
    return t("admin.customers.sourceOrder");
  };

  const filteredCustomers = customers.filter((customer) => {
    if (sourceFilter !== "all" && customer.source !== sourceFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      customer.name.toLowerCase().includes(q) ||
      customer.phone.includes(q) ||
      (customer.email?.toLowerCase().includes(q) ?? false) ||
      (customer.customerId?.toLowerCase().includes(q) ?? false)
    );
  });

  const getCustomersForExport = (source: "repair" | "order") => {
    return customers.filter((customer) => {
      if (customer.source !== source) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        customer.name.toLowerCase().includes(q) ||
        customer.phone.includes(q) ||
        (customer.email?.toLowerCase().includes(q) ?? false) ||
        (customer.customerId?.toLowerCase().includes(q) ?? false)
      );
    });
  };

  const handleExportExcel = async () => {
    const toExport = getCustomersForExport(exportSource);
    if (toExport.length === 0) {
      toast({
        title: t("admin.customers.exportEmpty"),
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      const params = new URLSearchParams({
        source: exportSource,
        lang: language === "ar" ? "ar" : "en",
      });
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const response = await fetch(`/api/admin/customers/export?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const dateStamp = new Date().toISOString().slice(0, 10);
      const filename = exportSource === "repair"
        ? `repair-customers-${dateStamp}.xlsx`
        : `order-customers-${dateStamp}.xlsx`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setExportDialogOpen(false);
      toast({ title: t("admin.customers.exportSuccess") });
    } catch {
      toast({
        title: t("admin.customers.exportError"),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleSubmit = () => {
    if (!editingCustomer) return;

    const updateData: any = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
    };

    if (formData.password.trim()) {
      updateData.password = formData.password;
    }

    updateMutation.mutate({
      id: editingCustomer.id,
      data: updateData,
    });
  };

  const handleDelete = (id: string) => {
    setDeleteCustomerId(id);
  };

  const confirmDelete = () => {
    if (deleteCustomerId) {
      deleteMutation.mutate(deleteCustomerId);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(
      language === 'ar' ? 'ar-IQ' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric' }
    );
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!currentAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <AdminNav currentAdmin={currentAdmin} />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t("admin.customers.title")}</h1>
            <p className="text-muted-foreground">{t("admin.customers.subtitle")}</p>
          </div>
          <Badge variant="secondary" className="w-fit text-sm px-3 py-1">
            {t("admin.customers.customersCount")}: {customers.length}
          </Badge>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("admin.customers.searchPlaceholder")}
              className="ps-9"
              data-testid="input-customer-search"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
              <SelectTrigger className="w-[180px]" data-testid="select-source-filter">
                <SelectValue placeholder={t("admin.customers.filterSource")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.customers.filterAll")}</SelectItem>
                <SelectItem value="repair">{t("admin.customers.sourceRepair")}</SelectItem>
                <SelectItem value="order">{t("admin.customers.sourceOrder")}</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(true)}
              data-testid="button-export-customers"
            >
              <Download className="h-4 w-4 me-2" />
              {t("admin.customers.exportExcel")}
            </Button>
          </div>
        </div>

        {customers.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('admin.customers.noCustomers')}</h3>
              <p className="text-muted-foreground">{t('admin.customers.noCustomersDesc')}</p>
            </CardContent>
          </Card>
        ) : filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('admin.customers.noSearchResults')}</h3>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.customers.name')}</TableHead>
                    <TableHead>{t('admin.customers.phone')}</TableHead>
                    <TableHead>{t('admin.customers.registeredAt')}</TableHead>
                    <TableHead>{t('admin.customers.source')}</TableHead>
                    <TableHead className="text-end">{t('admin.customers.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={`${customer.source}-${customer.id}`} data-testid={`row-customer-${customer.id}`}>
                      <TableCell className="font-medium" data-testid={`text-customer-name-${customer.id}`}>
                        <div>{customer.name}</div>
                        {customer.customerId && (
                          <div className="text-xs text-muted-foreground">{customer.customerId}</div>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-customer-phone-${customer.id}`}>
                        {customer.phone}
                      </TableCell>
                      <TableCell>
                        {formatDate(customer.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sourceLabel(customer.source)}</Badge>
                      </TableCell>
                      <TableCell className="text-end">
                        {customer.editable ? (
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(customer)}
                              data-testid={`button-edit-customer-${customer.id}`}
                            >
                              <Pencil className="h-4 w-4 me-1" />
                              {t('admin.customers.edit')}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(customer.id)}
                              data-testid={`button-delete-customer-${customer.id}`}
                            >
                              <Trash2 className="h-4 w-4 me-1" />
                              {t('admin.customers.delete')}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.customers.exportTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("admin.customers.exportPickSource")}</Label>
              <Select value={exportSource} onValueChange={(v) => setExportSource(v as "repair" | "order")}>
                <SelectTrigger data-testid="select-export-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="repair">{t("admin.customers.sourceRepair")}</SelectItem>
                  <SelectItem value="order">{t("admin.customers.sourceOrder")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("admin.customers.exportCount")}: {getCustomersForExport(exportSource).length}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              {t("admin.customers.cancel")}
            </Button>
            <Button onClick={handleExportExcel} disabled={exporting} data-testid="button-confirm-export">
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  {t("admin.customers.exporting")}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 me-2" />
                  {t("admin.customers.exportExcel")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.customers.editCustomer')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('admin.customers.name')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-customer-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('admin.customers.email')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="input-customer-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t('admin.customers.phone')}</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                data-testid="input-customer-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('admin.customers.password')}</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={t('admin.customers.passwordHint')}
                data-testid="input-customer-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingCustomer(null)}
              data-testid="button-cancel-edit"
            >
              {t('admin.customers.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
              data-testid="button-save-customer"
            >
              {updateMutation.isPending ? t('admin.customers.updating') : t('admin.customers.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCustomerId} onOpenChange={(open) => !open && setDeleteCustomerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.customers.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.customers.confirmDelete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              {t('admin.customers.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? t('admin.customers.deleting') : t('admin.customers.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
