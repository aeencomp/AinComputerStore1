import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Loader2, 
  Plus,
  Trash2,
  Edit,
  Ticket,
  Percent,
  Tag,
  Copy,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AdminNav } from "@/components/AdminNav";
import type { DiscountCode } from "@shared/schema";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

const discountCodeSchema = z.object({
  code: z.string().min(3, "Code must be at least 3 characters").transform(s => s.toUpperCase()),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.string().min(1, "Discount value is required"),
  minOrderAmount: z.string().optional(),
  maxUses: z.string().optional(),
  expiresAt: z.string().optional(),
  isActive: z.number().default(1),
});

type DiscountCodeFormData = z.infer<typeof discountCodeSchema>;

export default function AdminDiscountCodes() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const [deleteCodeId, setDeleteCodeId] = useState<string | null>(null);

  const form = useForm<DiscountCodeFormData>({
    resolver: zodResolver(discountCodeSchema),
    defaultValues: {
      code: "",
      discountType: "percentage",
      discountValue: "",
      minOrderAmount: "",
      maxUses: "",
      expiresAt: "",
      isActive: 1,
    },
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

  const { data: discountCodes = [], isLoading } = useQuery<DiscountCode[]>({
    queryKey: ['/api/admin/discount-codes'],
    enabled: !!currentAdmin,
  });

  const createMutation = useMutation({
    mutationFn: async (data: DiscountCodeFormData) => {
      return apiRequest('POST', '/api/admin/discount-codes', {
        code: data.code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrderAmount: data.minOrderAmount || null,
        maxUses: data.maxUses ? parseInt(data.maxUses) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
        isActive: data.isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/discount-codes'] });
      toast({
        title: language === 'ar' ? "تم الإنشاء" : "Created",
        description: language === 'ar' ? "تم إنشاء كود الخصم بنجاح" : "Discount code created successfully",
      });
      setShowCreateDialog(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل في إنشاء كود الخصم" : "Failed to create discount code",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DiscountCodeFormData> }) => {
      return apiRequest('PATCH', `/api/admin/discount-codes/${id}`, {
        code: data.code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrderAmount: data.minOrderAmount || null,
        maxUses: data.maxUses ? parseInt(data.maxUses) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
        isActive: data.isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/discount-codes'] });
      toast({
        title: language === 'ar' ? "تم التحديث" : "Updated",
        description: language === 'ar' ? "تم تحديث كود الخصم بنجاح" : "Discount code updated successfully",
      });
      setEditingCode(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل في تحديث كود الخصم" : "Failed to update discount code",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/admin/discount-codes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/discount-codes'] });
      toast({
        title: language === 'ar' ? "تم الحذف" : "Deleted",
        description: language === 'ar' ? "تم حذف كود الخصم بنجاح" : "Discount code deleted successfully",
      });
      setDeleteCodeId(null);
    },
    onError: () => {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل في حذف كود الخصم" : "Failed to delete discount code",
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: number }) => {
      return apiRequest('PATCH', `/api/admin/discount-codes/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/discount-codes'] });
    },
  });

  const handleOpenCreate = () => {
    form.reset({
      code: "",
      discountType: "percentage",
      discountValue: "",
      minOrderAmount: "",
      maxUses: "",
      expiresAt: "",
      isActive: 1,
    });
    setShowCreateDialog(true);
  };

  const handleOpenEdit = (code: DiscountCode) => {
    form.reset({
      code: code.code,
      discountType: code.discountType as "percentage" | "fixed",
      discountValue: code.discountValue,
      minOrderAmount: code.minOrderAmount || "",
      maxUses: code.maxUses?.toString() || "",
      expiresAt: code.expiresAt ? new Date(code.expiresAt).toISOString().split('T')[0] : "",
      isActive: code.isActive,
    });
    setEditingCode(code);
  };

  const onSubmit = (data: DiscountCodeFormData) => {
    if (editingCode) {
      updateMutation.mutate({ id: editingCode.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: language === 'ar' ? "تم النسخ" : "Copied",
      description: language === 'ar' ? "تم نسخ الكود" : "Code copied to clipboard",
    });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = (date: Date | string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  if (authLoading || !currentAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const activeCodes = discountCodes.filter(c => c.isActive === 1 && !isExpired(c.expiresAt));
  const inactiveCodes = discountCodes.filter(c => c.isActive !== 1 || isExpired(c.expiresAt));

  return (
    <div className={`min-h-screen bg-background ${language === 'ar' ? 'rtl' : 'ltr'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <AdminNav currentAdmin={currentAdmin} />
      
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">
              {language === 'ar' ? 'أكواد الخصم' : 'Discount Codes'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === 'ar' ? 'إنشاء وإدارة أكواد الخصم للعملاء' : 'Create and manage discount codes for customers'}
            </p>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-create-code">
            <Plus className="h-4 w-4 me-2" />
            {language === 'ar' ? 'إنشاء كود' : 'Create Code'}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === 'ar' ? 'إجمالي الأكواد' : 'Total Codes'}
              </CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{discountCodes.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === 'ar' ? 'أكواد فعالة' : 'Active Codes'}
              </CardTitle>
              <Tag className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeCodes.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === 'ar' ? 'مرات الاستخدام' : 'Total Uses'}
              </CardTitle>
              <Percent className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {discountCodes.reduce((sum, c) => sum + c.usedCount, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {language === 'ar' ? 'جميع الأكواد' : 'All Codes'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : discountCodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === 'ar' ? 'لا توجد أكواد خصم' : 'No discount codes yet'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'الكود' : 'Code'}</TableHead>
                    <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                    <TableHead>{language === 'ar' ? 'القيمة' : 'Value'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الاستخدام' : 'Usage'}</TableHead>
                    <TableHead>{language === 'ar' ? 'تاريخ الانتهاء' : 'Expires'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discountCodes.map((code) => (
                    <TableRow key={code.id} data-testid={`row-code-${code.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded font-mono text-sm">{code.code}</code>
                          <Button size="icon" variant="ghost" onClick={() => copyCode(code.code)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {code.discountType === 'percentage' 
                            ? (language === 'ar' ? 'نسبة مئوية' : 'Percentage')
                            : (language === 'ar' ? 'مبلغ ثابت' : 'Fixed')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {code.discountType === 'percentage' 
                          ? `${code.discountValue}%`
                          : `${parseFloat(code.discountValue).toLocaleString()} ${language === 'ar' ? 'د.ع' : 'IQD'}`}
                      </TableCell>
                      <TableCell>
                        {code.usedCount}{code.maxUses ? `/${code.maxUses}` : ''}
                      </TableCell>
                      <TableCell>
                        <span className={isExpired(code.expiresAt) ? 'text-destructive' : ''}>
                          {formatDate(code.expiresAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={code.isActive === 1}
                          onCheckedChange={(checked) => 
                            toggleActiveMutation.mutate({ id: code.id, isActive: checked ? 1 : 0 })
                          }
                          data-testid={`switch-active-${code.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenEdit(code)}
                            data-testid={`button-edit-${code.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteCodeId(code.id)}
                            data-testid={`button-delete-${code.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateDialog || !!editingCode} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingCode(null);
          form.reset();
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingCode 
                ? (language === 'ar' ? 'تعديل كود الخصم' : 'Edit Discount Code')
                : (language === 'ar' ? 'إنشاء كود خصم' : 'Create Discount Code')}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? 'أدخل تفاصيل كود الخصم'
                : 'Enter the discount code details'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === 'ar' ? 'الكود' : 'Code'}</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="SAVE10" 
                        className="uppercase"
                        data-testid="input-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'نوع الخصم' : 'Discount Type'}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="percentage">
                            {language === 'ar' ? 'نسبة مئوية (%)' : 'Percentage (%)'}
                          </SelectItem>
                          <SelectItem value="fixed">
                            {language === 'ar' ? 'مبلغ ثابت (د.ع)' : 'Fixed Amount (IQD)'}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="discountValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'القيمة' : 'Value'}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          placeholder="10"
                          data-testid="input-value"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minOrderAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'الحد الأدنى للطلب' : 'Min Order Amount'}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          placeholder={language === 'ar' ? 'اختياري' : 'Optional'}
                          data-testid="input-min-order"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="maxUses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'الحد الأقصى للاستخدام' : 'Max Uses'}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          placeholder={language === 'ar' ? 'غير محدود' : 'Unlimited'}
                          data-testid="input-max-uses"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="date"
                        data-testid="input-expires"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit">
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  )}
                  {editingCode 
                    ? (language === 'ar' ? 'تحديث' : 'Update')
                    : (language === 'ar' ? 'إنشاء' : 'Create')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCodeId} onOpenChange={() => setDeleteCodeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'حذف كود الخصم؟' : 'Delete Discount Code?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? 'هل أنت متأكد من حذف هذا الكود؟ لا يمكن التراجع عن هذا الإجراء.'
                : 'Are you sure you want to delete this code? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCodeId && deleteMutation.mutate(deleteCodeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
