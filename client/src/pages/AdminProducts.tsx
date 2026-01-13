import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatPrice } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { AdminNav } from "@/components/AdminNav";
import { ImageUpload } from "@/components/ImageUpload";
import type { Product, InsertProduct } from "@shared/schema";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

export default function AdminProducts() {
  const { t, language } = useLanguage();
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);

  const [formData, setFormData] = useState<InsertProduct>({
    nameAr: "",
    nameEn: "",
    descriptionAr: "",
    descriptionEn: "",
    price: "0",
    oldPrice: null,
    category: "laptops",
    image: "",
    specs: [],
    badge: null,
    inStock: 1,
  });

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

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
      setDeleteProductId(null);
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
      category: "laptops",
      image: "",
      specs: [],
      badge: null,
      inStock: 1,
    });
    setEditingProduct(null);
  };

  const handleAdd = () => {
    resetForm();
    setIsAddEditOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      descriptionAr: product.descriptionAr,
      descriptionEn: product.descriptionEn,
      price: product.price,
      oldPrice: product.oldPrice,
      category: product.category,
      image: product.image,
      specs: product.specs || [],
      badge: product.badge,
      inStock: product.inStock,
    });
    setIsAddEditOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleSpecsChange = (value: string) => {
    const specsArray = value.split('\n').filter(s => s.trim());
    setFormData({ ...formData, specs: specsArray });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">{t('admin.products.title')}</h1>
          <Button onClick={handleAdd} data-testid="button-add-product">
            <Plus className="w-4 h-4 me-2" />
            {t('admin.products.addNew')}
          </Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? t('admin.products.nameAr') : t('admin.products.nameEn')}</TableHead>
                <TableHead>{t('admin.products.category')}</TableHead>
                <TableHead>{t('admin.products.price')}</TableHead>
                <TableHead>{t('admin.products.inStock')}</TableHead>
                <TableHead className="text-end">{t('admin.products.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                  <TableCell className="font-medium">
                    {language === 'ar' ? product.nameAr : product.nameEn}
                  </TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>{formatPrice(parseFloat(product.price), language)}</TableCell>
                  <TableCell>{product.inStock}</TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(product)}
                        data-testid={`button-edit-${product.id}`}
                      >
                        <Pencil className="w-4 h-4 me-1" />
                        {t('admin.products.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteProductId(product.id)}
                        data-testid={`button-delete-${product.id}`}
                      >
                        <Trash2 className="w-4 h-4 me-1" />
                        {t('admin.products.delete')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent 
          className="max-w-2xl max-h-[90vh] overflow-y-auto" 
          dir={language === 'ar' ? 'rtl' : 'ltr'}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? t('admin.products.edit') : t('admin.products.addNew')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nameAr">{t('admin.products.nameAr')}</Label>
                <Input
                  id="nameAr"
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  required
                  data-testid="input-nameAr"
                />
              </div>
              <div>
                <Label htmlFor="nameEn">{t('admin.products.nameEn')}</Label>
                <Input
                  id="nameEn"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  required
                  data-testid="input-nameEn"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="descriptionAr">{t('admin.products.descAr')}</Label>
                <Textarea
                  id="descriptionAr"
                  value={formData.descriptionAr}
                  onChange={(e) => setFormData({ ...formData, descriptionAr: e.target.value })}
                  required
                  data-testid="input-descriptionAr"
                />
              </div>
              <div>
                <Label htmlFor="descriptionEn">{t('admin.products.descEn')}</Label>
                <Textarea
                  id="descriptionEn"
                  value={formData.descriptionEn}
                  onChange={(e) => setFormData({ ...formData, descriptionEn: e.target.value })}
                  required
                  data-testid="input-descriptionEn"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="price">{t('admin.products.price')}</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                  data-testid="input-price"
                />
              </div>
              <div>
                <Label htmlFor="oldPrice">{t('admin.products.oldPrice')}</Label>
                <Input
                  id="oldPrice"
                  type="number"
                  step="0.01"
                  value={formData.oldPrice || ""}
                  onChange={(e) => setFormData({ ...formData, oldPrice: e.target.value || null })}
                  data-testid="input-oldPrice"
                />
              </div>
              <div>
                <Label htmlFor="inStock">{t('admin.products.inStock')}</Label>
                <Input
                  id="inStock"
                  type="number"
                  value={formData.inStock}
                  onChange={(e) => setFormData({ ...formData, inStock: parseInt(e.target.value) || 0 })}
                  required
                  data-testid="input-inStock"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">{t('admin.products.category')}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <SelectItem value="laptops" className="font-semibold">{t('categories.laptops')}</SelectItem>
                    <SelectItem value="gaming-laptops">{language === 'ar' ? '↳ لابتوب ألعاب' : '↳ Gaming Laptops'}</SelectItem>
                    <SelectItem value="business-laptops">{language === 'ar' ? '↳ لابتوب أعمال' : '↳ Business Laptops'}</SelectItem>
                    <SelectItem value="student-laptops">{language === 'ar' ? '↳ لابتوب طلاب' : '↳ Student Laptops'}</SelectItem>
                    <SelectItem value="ultrabooks">{language === 'ar' ? '↳ ألترابوك' : '↳ Ultrabooks'}</SelectItem>
                    <SelectItem value="workstation-laptops">{language === 'ar' ? '↳ محطات عمل محمولة' : '↳ Workstation Laptops'}</SelectItem>
                    
                    <SelectItem value="desktops" className="font-semibold">{t('categories.desktops')}</SelectItem>
                    <SelectItem value="gaming-pcs">{language === 'ar' ? '↳ أجهزة ألعاب' : '↳ Gaming PCs'}</SelectItem>
                    <SelectItem value="office-pcs">{language === 'ar' ? '↳ أجهزة مكتبية' : '↳ Office PCs'}</SelectItem>
                    <SelectItem value="workstations">{language === 'ar' ? '↳ محطات عمل' : '↳ Workstations'}</SelectItem>
                    <SelectItem value="all-in-one">{language === 'ar' ? '↳ الكل في واحد' : '↳ All-in-One PCs'}</SelectItem>
                    <SelectItem value="mini-pcs">{language === 'ar' ? '↳ أجهزة صغيرة' : '↳ Mini PCs'}</SelectItem>
                    
                    <SelectItem value="monitors" className="font-semibold">{t('categories.monitors')}</SelectItem>
                    <SelectItem value="gaming-monitors">{language === 'ar' ? '↳ شاشات ألعاب' : '↳ Gaming Monitors'}</SelectItem>
                    <SelectItem value="office-monitors">{language === 'ar' ? '↳ شاشات مكتبية' : '↳ Office Monitors'}</SelectItem>
                    <SelectItem value="curved-monitors">{language === 'ar' ? '↳ شاشات منحنية' : '↳ Curved Monitors'}</SelectItem>
                    <SelectItem value="4k-monitors">{language === 'ar' ? '↳ شاشات 4K' : '↳ 4K/UHD Monitors'}</SelectItem>
                    <SelectItem value="ultrawide-monitors">{language === 'ar' ? '↳ شاشات عريضة' : '↳ Ultrawide Monitors'}</SelectItem>
                    
                    <SelectItem value="accessories" className="font-semibold">{t('categories.accessories')}</SelectItem>
                    <SelectItem value="keyboards">{language === 'ar' ? '↳ لوحات المفاتيح' : '↳ Keyboards'}</SelectItem>
                    <SelectItem value="mice">{language === 'ar' ? '↳ الماوسات' : '↳ Mice'}</SelectItem>
                    <SelectItem value="headphones">{language === 'ar' ? '↳ سماعات' : '↳ Headphones'}</SelectItem>
                    <SelectItem value="webcams">{language === 'ar' ? '↳ كاميرات ويب' : '↳ Webcams'}</SelectItem>
                    <SelectItem value="cables">{language === 'ar' ? '↳ كابلات وموزعات' : '↳ Cables & Hubs'}</SelectItem>
                    <SelectItem value="bags">{language === 'ar' ? '↳ حقائب لابتوب' : '↳ Laptop Bags'}</SelectItem>
                    <SelectItem value="chargers">{language === 'ar' ? '↳ شواحن ومحولات' : '↳ Chargers & Adapters'}</SelectItem>
                    
                    <SelectItem value="pc-components" className="font-semibold">{language === 'ar' ? 'قطع الكمبيوتر' : 'PC Components'}</SelectItem>
                    <SelectItem value="ram">{language === 'ar' ? '↳ ذاكرة RAM' : '↳ RAM Memory'}</SelectItem>
                    <SelectItem value="ssd">{language === 'ar' ? '↳ أقراص SSD' : '↳ SSD Drives'}</SelectItem>
                    <SelectItem value="hdd">{language === 'ar' ? '↳ أقراص HDD' : '↳ HDD Drives'}</SelectItem>
                    <SelectItem value="processors">{language === 'ar' ? '↳ المعالجات' : '↳ Processors'}</SelectItem>
                    <SelectItem value="motherboards">{language === 'ar' ? '↳ اللوحات الأم' : '↳ Motherboards'}</SelectItem>
                    <SelectItem value="gpu">{language === 'ar' ? '↳ كروت الشاشة' : '↳ Graphics Cards'}</SelectItem>
                    <SelectItem value="psu">{language === 'ar' ? '↳ مزودات الطاقة' : '↳ Power Supplies'}</SelectItem>
                    <SelectItem value="cases">{language === 'ar' ? '↳ صناديق الكمبيوتر' : '↳ PC Cases'}</SelectItem>
                    <SelectItem value="cooling">{language === 'ar' ? '↳ أنظمة التبريد' : '↳ Cooling Systems'}</SelectItem>
                    
                    <SelectItem value="programs" className="font-semibold">{language === 'ar' ? 'البرامج' : 'Software'}</SelectItem>
                    <SelectItem value="operating-systems">{language === 'ar' ? '↳ أنظمة التشغيل' : '↳ Operating Systems'}</SelectItem>
                    <SelectItem value="office-software">{language === 'ar' ? '↳ برامج المكتب' : '↳ Office Software'}</SelectItem>
                    <SelectItem value="antivirus">{language === 'ar' ? '↳ مضادات الفيروسات' : '↳ Antivirus'}</SelectItem>
                    <SelectItem value="design-software">{language === 'ar' ? '↳ برامج التصميم' : '↳ Design Software'}</SelectItem>
                    <SelectItem value="gaming-software">{language === 'ar' ? '↳ برامج الألعاب' : '↳ Gaming Software'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="badge">{t('admin.products.badge')}</Label>
                <Input
                  id="badge"
                  value={formData.badge || ""}
                  onChange={(e) => setFormData({ ...formData, badge: e.target.value || null })}
                  data-testid="input-badge"
                />
              </div>
            </div>

            <ImageUpload
              value={formData.image}
              onChange={(url) => setFormData({ ...formData, image: url })}
              label={t('admin.products.image')}
              placeholder={t('admin.products.imagePlaceholder')}
              required
            />

            <div>
              <Label htmlFor="specs">{t('admin.products.specs')}</Label>
              <Textarea
                id="specs"
                value={formData.specs?.join('\n') || ""}
                onChange={(e) => handleSpecsChange(e.target.value)}
                rows={4}
                data-testid="input-specs"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddEditOpen(false)}
                data-testid="button-cancel"
              >
                {t('admin.products.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? editingProduct
                    ? t('admin.products.updating')
                    : t('admin.products.creating')
                  : t('admin.products.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteProductId} onOpenChange={() => setDeleteProductId(null)}>
        <AlertDialogContent dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.products.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.products.confirmDelete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              {t('admin.products.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProductId && deleteMutation.mutate(deleteProductId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? t('admin.products.deleting') : t('admin.products.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
