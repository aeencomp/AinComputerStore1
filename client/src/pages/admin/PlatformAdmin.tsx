import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { AdminNav } from "@/components/AdminNav";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Store, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ShieldAlert,
  Loader2,
  Calendar
} from "lucide-react";
import { format } from "date-fns";

const shopSchema = z.object({
  shopName: z.string().min(2, "Shop name is required"),
  ownerName: z.string().min(2, "Owner name is required"),
  phone: z.string().min(5, "Phone is required"),
  city: z.string().min(2, "City is required"),
  username: z.string().min(3, "Username is required"),
  password: z.string().min(4, "Password must be at least 4 characters").optional(),
  subscriptionStatus: z.enum(["trial", "active", "expired", "suspended"]),
  subscriptionExpiresAt: z.string().optional().nullable(),
  isActive: z.number().default(1),
  maxTechnicians: z.number().default(3),
  notes: z.string().optional(),
});

type ShopFormValues = z.infer<typeof shopSchema>;

export default function PlatformAdmin() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<any>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/platform/stats"],
  });

  const { data: shops, isLoading: shopsLoading } = useQuery<any[]>({
    queryKey: ["/api/platform/shops"],
  });

  const { data: currentAdmin } = useQuery<any>({
    queryKey: ["/api/admin/auth/me"],
  });

  const addShopForm = useForm<ShopFormValues>({
    resolver: zodResolver(shopSchema),
    defaultValues: {
      shopName: "",
      ownerName: "",
      phone: "",
      city: "",
      username: "",
      password: "",
      subscriptionStatus: "trial",
      isActive: 1,
      maxTechnicians: 3,
      notes: "",
    },
  });

  const editShopForm = useForm<ShopFormValues>({
    resolver: zodResolver(shopSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (values: ShopFormValues) => {
      const res = await apiRequest("POST", "/api/platform/shops", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/shops"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/stats"] });
      setIsAddDialogOpen(false);
      addShopForm.reset();
      toast({
        title: language === "ar" ? "تم إنشاء المتجر" : "Shop Created",
        description: language === "ar" ? "تمت إضافة المتجر الجديد بنجاح" : "New shop added successfully",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: ShopFormValues }) => {
      const res = await apiRequest("PATCH", `/api/platform/shops/${id}`, values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/shops"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/stats"] });
      setEditingShop(null);
      toast({
        title: language === "ar" ? "تم تحديث المتجر" : "Shop Updated",
        description: language === "ar" ? "تم تحديث بيانات المتجر بنجاح" : "Shop details updated successfully",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/platform/shops/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/shops"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/stats"] });
      toast({
        title: language === "ar" ? "تم حذف المتجر" : "Shop Deleted",
        description: language === "ar" ? "تم حذف المتجر وجميع بياناته بنجاح" : "Shop and all its data deleted successfully",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "trial":
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900">{language === 'ar' ? 'تجريبي' : 'Trial'}</Badge>;
      case "active":
        return <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-200 dark:border-green-900">{language === 'ar' ? 'نشط' : 'Active'}</Badge>;
      case "expired":
        return <Badge variant="destructive">{language === 'ar' ? 'منتهي' : 'Expired'}</Badge>;
      case "suspended":
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900">{language === 'ar' ? 'معلق' : 'Suspended'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (shopsLoading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav currentAdmin={currentAdmin} />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {language === "ar" ? "إدارة المتاجر" : "Platform Management"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === "ar" ? "إدارة المتاجر الخارجية والاشتراكات" : "Manage external shops and subscriptions"}
            </p>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-shop">
                <Plus className="w-4 h-4 me-2" />
                {language === "ar" ? "إضافة متجر" : "Add Shop"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{language === "ar" ? "إضافة متجر جديد" : "Add New Shop"}</DialogTitle>
                <DialogDescription>
                  {language === "ar" ? "أدخل تفاصيل المتجر وحساب المدير" : "Enter shop details and owner account"}
                </DialogDescription>
              </DialogHeader>
              
              <Form {...addShopForm}>
                <form onSubmit={addShopForm.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={addShopForm.control}
                      name="shopName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === "ar" ? "اسم المتجر" : "Shop Name"}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-shop-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addShopForm.control}
                      name="ownerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === "ar" ? "اسم المالك" : "Owner Name"}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-owner-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addShopForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === "ar" ? "رقم الهاتف" : "Phone"}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addShopForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === "ar" ? "المدينة" : "City"}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-city" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addShopForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === "ar" ? "اسم المستخدم" : "Username"}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addShopForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === "ar" ? "كلمة المرور" : "Password"}</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} data-testid="input-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-add-shop">
                      {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                      {language === "ar" ? "إنشاء المتجر" : "Create Shop"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card data-testid="stat-total-shops">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                {language === "ar" ? "إجمالي المتاجر" : "Total Shops"}
              </CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-active-shops">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                {language === "ar" ? "المشتركون النشطون" : "Active Paid"}
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.active || 0}</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-trial-shops">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                {language === "ar" ? "في الفترة التجريبية" : "On Trial"}
              </CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.trial || 0}</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-expired-shops">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                {language === "ar" ? "الاشتراكات المنتهية" : "Expired"}
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.expired || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "قائمة المتاجر" : "Shops List"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'المتجر' : 'Shop'}</TableHead>
                  <TableHead>{language === 'ar' ? 'المدينة' : 'City'}</TableHead>
                  <TableHead>{language === 'ar' ? 'المالك' : 'Owner'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{language === 'ar' ? 'انتهاء الصلاحية' : 'Expiry'}</TableHead>
                  <TableHead className="text-right">{language === 'ar' ? 'التذاكر' : 'Tickets'}</TableHead>
                  <TableHead className="text-right">{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shops?.map((shop) => (
                  <TableRow key={shop.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{shop.shopName}</span>
                        <span className="text-xs text-muted-foreground">@{shop.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>{shop.city}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{shop.ownerName}</span>
                        <span className="text-xs text-muted-foreground">{shop.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(shop.subscriptionStatus)}</TableCell>
                    <TableCell>
                      {shop.subscriptionExpiresAt 
                        ? format(new Date(shop.subscriptionExpiresAt), "yyyy-MM-dd")
                        : shop.subscriptionStatus === 'trial'
                          ? format(new Date(shop.trialEndsAt), "yyyy-MM-dd")
                          : "-"
                      }
                    </TableCell>
                    <TableCell className="text-right">{shop.ticketCount || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setEditingShop(shop);
                            editShopForm.reset({
                              shopName: shop.shopName,
                              ownerName: shop.ownerName,
                              phone: shop.phone,
                              city: shop.city,
                              username: shop.username,
                              subscriptionStatus: shop.subscriptionStatus as any,
                              subscriptionExpiresAt: shop.subscriptionExpiresAt ? format(new Date(shop.subscriptionExpiresAt), "yyyy-MM-dd") : "",
                              isActive: shop.isActive,
                              maxTechnicians: shop.maxTechnicians,
                              notes: shop.notes || "",
                            });
                          }}
                          data-testid={`button-edit-shop-${shop.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المتجر؟ سيتم حذف جميع البيانات المرتبطة به.' : 'Are you sure you want to delete this shop? All associated data will be removed.')) {
                              deleteMutation.mutate(shop.id);
                            }
                          }}
                          data-testid={`button-delete-shop-${shop.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editingShop} onOpenChange={(open) => !open && setEditingShop(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تعديل المتجر" : "Edit Shop"}</DialogTitle>
          </DialogHeader>
          {editingShop && (
            <Form {...editShopForm}>
              <form onSubmit={editShopForm.handleSubmit((v) => updateMutation.mutate({ id: editingShop.id, values: v }))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editShopForm.control}
                    name="shopName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "ar" ? "اسم المتجر" : "Shop Name"}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="edit-shop-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editShopForm.control}
                    name="ownerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "ar" ? "اسم المالك" : "Owner Name"}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="edit-owner-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editShopForm.control}
                    name="subscriptionStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "ar" ? "حالة الاشتراك" : "Subscription Status"}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="edit-subscription-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="trial">{language === 'ar' ? 'تجريبي' : 'Trial'}</SelectItem>
                            <SelectItem value="active">{language === 'ar' ? 'نشط' : 'Active'}</SelectItem>
                            <SelectItem value="expired">{language === 'ar' ? 'منتهي' : 'Expired'}</SelectItem>
                            <SelectItem value="suspended">{language === 'ar' ? 'معلق' : 'Suspended'}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editShopForm.control}
                    name="subscriptionExpiresAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "ar" ? "تاريخ انتهاء الاشتراك" : "Expiry Date"}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} data-testid="edit-expiry-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editShopForm.control}
                    name="maxTechnicians"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === "ar" ? "أقصى عدد فنيين" : "Max Technicians"}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} data-testid="edit-max-techs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editShopForm.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-8">
                        <div className="space-y-0.5">
                          <FormLabel>{language === 'ar' ? 'نشط' : 'Active'}</FormLabel>
                        </div>
                        <FormControl>
                          <Button 
                            type="button" 
                            variant={field.value === 1 ? "default" : "outline"}
                            onClick={() => field.onChange(field.value === 1 ? 0 : 1)}
                            data-testid="edit-active-toggle"
                          >
                            {field.value === 1 ? (language === 'ar' ? 'نعم' : 'Yes') : (language === 'ar' ? 'لا' : 'No')}
                          </Button>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={editShopForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "ar" ? "ملاحظات داخلية" : "Internal Notes"}</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="min-h-[100px]" data-testid="edit-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit-shop">
                    {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                    {language === "ar" ? "حفظ التغييرات" : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
