import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatPrice } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, AppWindow, Loader2 } from "lucide-react";
import { AdminNav } from "@/components/AdminNav";
import { ImageUpload } from "@/components/ImageUpload";
import type { Product, InsertProduct } from "@shared/schema";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface ProgramFormData {
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  price: string;
  oldPrice: string | null;
  image: string;
  specs: string[];
  badge: string | null;
  inStock: number;
  licenseType?: string;
  version?: string;
}

export default function AdminPrograms() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Product | null>(null);
  const [deleteProgramId, setDeleteProgramId] = useState<string | null>(null);

  const [formData, setFormData] = useState<ProgramFormData>({
    nameAr: "",
    nameEn: "",
    descriptionAr: "",
    descriptionEn: "",
    price: "0",
    oldPrice: null,
    image: "",
    specs: [],
    badge: null,
    inStock: 1,
    licenseType: "",
    version: "",
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

  const { data: allProducts = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !!currentAdmin,
  });

  const programs = allProducts.filter(p => p.category === "programs");

  const createMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      return apiRequest("POST", "/api/admin/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsAddEditOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertProduct> }) => {
      return apiRequest("PUT", `/api/admin/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsAddEditOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setDeleteProgramId(null);
    },
  });

  const resetForm = () => {
    setFormData({
      nameAr: "",
      nameEn: "",
      descriptionAr: "",
      descriptionEn: "",
      price: "0",
      oldPrice: null,
      image: "",
      specs: [],
      badge: null,
      inStock: 1,
      licenseType: "",
      version: "",
    });
    setEditingProgram(null);
  };

  const handleAdd = () => {
    resetForm();
    setIsAddEditOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProgram(product);
    const specs = product.specs || [];
    const licenseSpec = specs.find(s => s.startsWith("License:") || s.startsWith("الترخيص:"));
    const versionSpec = specs.find(s => s.startsWith("Version:") || s.startsWith("الإصدار:"));
    
    setFormData({
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      descriptionAr: product.descriptionAr,
      descriptionEn: product.descriptionEn,
      price: product.price,
      oldPrice: product.oldPrice,
      image: product.image,
      specs: specs.filter(s => 
        !s.startsWith("License:") && 
        !s.startsWith("الترخيص:") &&
        !s.startsWith("Version:") &&
        !s.startsWith("الإصدار:")
      ),
      badge: product.badge,
      inStock: product.inStock,
      licenseType: licenseSpec?.split(":")[1]?.trim() || "",
      version: versionSpec?.split(":")[1]?.trim() || "",
    });
    setIsAddEditOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const specs = [...formData.specs];
    if (formData.licenseType) {
      specs.push(language === 'ar' ? `الترخيص: ${formData.licenseType}` : `License: ${formData.licenseType}`);
    }
    if (formData.version) {
      specs.push(language === 'ar' ? `الإصدار: ${formData.version}` : `Version: ${formData.version}`);
    }

    const productData: InsertProduct = {
      nameAr: formData.nameAr,
      nameEn: formData.nameEn,
      descriptionAr: formData.descriptionAr,
      descriptionEn: formData.descriptionEn,
      price: formData.price,
      oldPrice: formData.oldPrice,
      category: "programs",
      image: formData.image,
      specs: specs,
      badge: formData.badge,
      inStock: formData.inStock,
    };

    if (editingProgram) {
      updateMutation.mutate({ id: editingProgram.id, data: productData });
    } else {
      createMutation.mutate(productData);
    }
  };

  const handleSpecsChange = (value: string) => {
    const specsArray = value.split('\n').filter(s => s.trim());
    setFormData({ ...formData, specs: specsArray });
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
      
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                <AppWindow className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{t('admin.programs.title')}</h1>
                <p className="text-muted-foreground">{t('admin.programs.subtitle')}</p>
              </div>
            </div>
            <Button onClick={handleAdd} className="bg-cyan-600 hover:bg-cyan-700" data-testid="button-add-program">
              <Plus className="w-4 h-4 me-2" />
              {t('admin.programs.addNew')}
            </Button>
          </div>

        {programs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AppWindow className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('admin.programs.noPrograms')}</h3>
              <p className="text-muted-foreground mb-4">{t('admin.programs.noProgramsDesc')}</p>
              <Button onClick={handleAdd} className="bg-cyan-600 hover:bg-cyan-700">
                <Plus className="w-4 h-4 me-2" />
                {t('admin.programs.addFirst')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.programs.image')}</TableHead>
                  <TableHead>{language === 'ar' ? t('admin.programs.nameAr') : t('admin.programs.nameEn')}</TableHead>
                  <TableHead>{t('admin.programs.price')}</TableHead>
                  <TableHead>{t('admin.programs.inStock')}</TableHead>
                  <TableHead className="text-end">{t('admin.programs.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.map((program) => (
                  <TableRow key={program.id} data-testid={`row-program-${program.id}`}>
                    <TableCell>
                      <img 
                        src={program.image} 
                        alt={language === 'ar' ? program.nameAr : program.nameEn}
                        className="w-12 h-12 object-cover rounded"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {language === 'ar' ? program.nameAr : program.nameEn}
                    </TableCell>
                    <TableCell>{formatPrice(parseFloat(program.price), language)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${program.inStock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {program.inStock > 0 ? t('admin.programs.available') : t('admin.programs.unavailable')}
                      </span>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(program)}
                          data-testid={`button-edit-${program.id}`}
                        >
                          <Pencil className="w-4 h-4 me-1" />
                          {t('admin.programs.edit')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteProgramId(program.id)}
                          data-testid={`button-delete-${program.id}`}
                        >
                          <Trash2 className="w-4 h-4 me-1" />
                          {t('admin.programs.delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
        </div>
      </div>

      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AppWindow className="w-5 h-5 text-cyan-600" />
              {editingProgram ? t('admin.programs.editProgram') : t('admin.programs.addNew')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nameAr">{t('admin.programs.nameAr')}</Label>
                <Input
                  id="nameAr"
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  placeholder={t('admin.programs.nameArPlaceholder')}
                  required
                  data-testid="input-program-nameAr"
                />
              </div>
              <div>
                <Label htmlFor="nameEn">{t('admin.programs.nameEn')}</Label>
                <Input
                  id="nameEn"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  placeholder={t('admin.programs.nameEnPlaceholder')}
                  required
                  data-testid="input-program-nameEn"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="descriptionAr">{t('admin.programs.descAr')}</Label>
                <Textarea
                  id="descriptionAr"
                  value={formData.descriptionAr}
                  onChange={(e) => setFormData({ ...formData, descriptionAr: e.target.value })}
                  placeholder={t('admin.programs.descArPlaceholder')}
                  required
                  data-testid="input-program-descriptionAr"
                />
              </div>
              <div>
                <Label htmlFor="descriptionEn">{t('admin.programs.descEn')}</Label>
                <Textarea
                  id="descriptionEn"
                  value={formData.descriptionEn}
                  onChange={(e) => setFormData({ ...formData, descriptionEn: e.target.value })}
                  placeholder={t('admin.programs.descEnPlaceholder')}
                  required
                  data-testid="input-program-descriptionEn"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="licenseType">{t('admin.programs.licenseType')}</Label>
                <Input
                  id="licenseType"
                  value={formData.licenseType}
                  onChange={(e) => setFormData({ ...formData, licenseType: e.target.value })}
                  placeholder={t('admin.programs.licenseTypePlaceholder')}
                  data-testid="input-program-licenseType"
                />
              </div>
              <div>
                <Label htmlFor="version">{t('admin.programs.version')}</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder={t('admin.programs.versionPlaceholder')}
                  data-testid="input-program-version"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="price">{t('admin.programs.price')}</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                  data-testid="input-program-price"
                />
              </div>
              <div>
                <Label htmlFor="oldPrice">{t('admin.programs.oldPrice')}</Label>
                <Input
                  id="oldPrice"
                  type="number"
                  step="0.01"
                  value={formData.oldPrice || ""}
                  onChange={(e) => setFormData({ ...formData, oldPrice: e.target.value || null })}
                  data-testid="input-program-oldPrice"
                />
              </div>
              <div>
                <Label htmlFor="inStock">{t('admin.programs.stockQuantity')}</Label>
                <Input
                  id="inStock"
                  type="number"
                  value={formData.inStock}
                  onChange={(e) => setFormData({ ...formData, inStock: parseInt(e.target.value) || 0 })}
                  required
                  data-testid="input-program-inStock"
                />
              </div>
            </div>

            <ImageUpload
              value={formData.image}
              onChange={(url) => setFormData({ ...formData, image: url })}
              label={t('admin.programs.imageUrl')}
              placeholder={t('admin.programs.imageUrlPlaceholder')}
              required
            />

            <div>
              <Label htmlFor="badge">{t('admin.programs.badge')}</Label>
              <Input
                id="badge"
                value={formData.badge || ""}
                onChange={(e) => setFormData({ ...formData, badge: e.target.value || null })}
                placeholder={t('admin.programs.badgePlaceholder')}
                data-testid="input-program-badge"
              />
            </div>

            <div>
              <Label htmlFor="specs">{t('admin.programs.features')}</Label>
              <Textarea
                id="specs"
                value={formData.specs?.join('\n') || ""}
                onChange={(e) => handleSpecsChange(e.target.value)}
                rows={4}
                placeholder={t('admin.programs.featuresPlaceholder')}
                data-testid="input-program-specs"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddEditOpen(false)}
                data-testid="button-cancel"
              >
                {t('admin.programs.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-testid="button-save-program"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? editingProgram
                    ? t('admin.programs.updating')
                    : t('admin.programs.creating')
                  : t('admin.programs.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteProgramId} onOpenChange={() => setDeleteProgramId(null)}>
        <AlertDialogContent dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.programs.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.programs.confirmDelete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              {t('admin.programs.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProgramId && deleteMutation.mutate(deleteProgramId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? t('admin.programs.deleting') : t('admin.programs.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
