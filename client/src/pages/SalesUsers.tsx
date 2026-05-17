import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Users,
  Loader2,
  Shield,
  ShoppingCart,
  Package,
  BarChart3,
  Percent,
  Receipt
} from "lucide-react";

interface SalesUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: string;
  canPos: number;
  canInventory: number;
  canInventoryLocation2: number;
  canManageUsers: number;
  canViewReports: number;
  canApplyDiscount: number;
  canEditReceipt: number;
  isActive: number;
  createdAt: string;
  locationIds?: number[];
}

interface CurrentUser {
  id: string;
  permissions: {
    canManageUsers: number;
  };
}

interface SalesUsersProps {
  user: CurrentUser;
}

export default function SalesUsers({ user }: SalesUsersProps) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SalesUser | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    role: "sales",
    canPos: 1,
    canInventory: 0,
    canInventoryLocation2: 0,
    canManageUsers: 0,
    canViewReports: 0,
    canApplyDiscount: 0,
    canEditReceipt: 0,
    isActive: 1,
    locationIds: [1] as number[],
  });

  const { data: users = [], isLoading } = useQuery<SalesUser[]>({
    queryKey: ['/api/sales/users'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('POST', '/api/sales/users', data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === 'ar' ? 'تم إنشاء المستخدم' : 'User created' });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/users'] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const res = await apiRequest('PUT', `/api/sales/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === 'ar' ? 'تم تحديث المستخدم' : 'User updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/users'] });
      setDialogOpen(false);
      setEditingUser(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/sales/users/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === 'ar' ? 'تم حذف المستخدم' : 'User deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/users'] });
    },
    onError: (error: any) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      name: "",
      email: "",
      role: "sales",
      canPos: 1,
      canInventory: 0,
      canInventoryLocation2: 0,
      canManageUsers: 0,
      canViewReports: 0,
      canApplyDiscount: 0,
      canEditReceipt: 0,
      isActive: 1,
      locationIds: [1],
    });
  };

  const openEditDialog = (u: SalesUser) => {
    setEditingUser(u);
    setFormData({
      username: u.username,
      password: "",
      name: u.name,
      email: u.email || "",
      role: u.role,
      canPos: u.canPos,
      canInventory: u.canInventory,
      canInventoryLocation2: u.canInventoryLocation2,
      canManageUsers: u.canManageUsers,
      canViewReports: u.canViewReports,
      canApplyDiscount: u.canApplyDiscount,
      canEditReceipt: u.canEditReceipt,
      isActive: u.isActive,
      locationIds: u.locationIds?.length ? u.locationIds : [1],
    });
    setDialogOpen(true);
  };

  const toggleLocation = (locId: number) => {
    setFormData((prev) => {
      const set = new Set(prev.locationIds);
      if (set.has(locId)) set.delete(locId);
      else set.add(locId);
      const next = Array.from(set);
      return { ...prev, locationIds: next.length ? next : [1] };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const updateData = { ...formData };
      if (!updateData.password) delete (updateData as any).password;
      updateMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!user.permissions.canManageUsers) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">
          {language === 'ar' ? 'ليس لديك صلاحية إدارة المستخدمين' : 'You do not have access to manage users'}
        </p>
      </div>
    );
  }

  const permissionIcons = {
    canPos: ShoppingCart,
    canInventory: Package,
    canManageUsers: Users,
    canViewReports: BarChart3,
    canApplyDiscount: Percent,
    canEditReceipt: Receipt,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          {language === 'ar' ? 'إدارة المستخدمين' : 'User Management'}
        </h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingUser(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-user">
              <Plus className="h-4 w-4 me-2" />
              {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingUser 
                  ? (language === 'ar' ? 'تعديل مستخدم' : 'Edit User')
                  : (language === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User')
                }
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'اسم المستخدم' : 'Username'}</Label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    required
                    data-testid="input-new-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {language === 'ar' ? 'كلمة المرور' : 'Password'}
                    {editingUser && <span className="text-muted-foreground text-xs"> ({language === 'ar' ? 'اتركها فارغة للإبقاء' : 'leave empty to keep'})</span>}
                  </Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required={!editingUser}
                    data-testid="input-new-password"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'البريد الإلكتروني (للتحقق بكلمة مرور OTP)' : 'Email (for OTP verification)'}</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder={language === 'ar' ? 'اختياري' : 'Optional'}
                  data-testid="input-new-email"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'الاسم الكامل' : 'Full Name'}</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    data-testid="input-new-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'الدور' : 'Role'}</Label>
                  <Select 
                    value={formData.role} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, role: v }))}
                  >
                    <SelectTrigger data-testid="select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">{language === 'ar' ? 'موظف مبيعات' : 'Sales Staff'}</SelectItem>
                      <SelectItem value="sales_admin">{language === 'ar' ? 'مدير مبيعات' : 'Sales Admin'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>{language === 'ar' ? 'الصلاحيات' : 'Permissions'}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span className="text-sm">{language === 'ar' ? 'الموقع 1' : 'Location 1'}</span>
                    </div>
                    <Switch
                      checked={formData.locationIds.includes(1)}
                      onCheckedChange={() => toggleLocation(1)}
                      data-testid="switch-location-1"
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span className="text-sm">{language === 'ar' ? 'الموقع 2' : 'Location 2'}</span>
                    </div>
                    <Switch
                      checked={formData.locationIds.includes(2)}
                      onCheckedChange={() => toggleLocation(2)}
                      data-testid="switch-location-2"
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      <span className="text-sm">{language === 'ar' ? 'نقطة البيع' : 'POS'}</span>
                    </div>
                    <Switch
                      checked={formData.canPos === 1}
                      onCheckedChange={(v) => setFormData(prev => ({ ...prev, canPos: v ? 1 : 0 }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span className="text-sm">{language === 'ar' ? 'المخزون' : 'Inventory'}</span>
                    </div>
                    <Switch
                      checked={formData.canInventory === 1}
                      onCheckedChange={(v) => setFormData(prev => ({ ...prev, canInventory: v ? 1 : 0 }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span className="text-sm">{language === 'ar' ? 'إضافة مخزون الموقع 2' : 'Add Inventory Loc 2'}</span>
                    </div>
                    <Switch
                      checked={formData.canInventoryLocation2 === 1}
                      onCheckedChange={(v) => setFormData(prev => ({
                        ...prev,
                        canInventoryLocation2: v ? 1 : 0,
                        locationIds: v && !prev.locationIds.includes(2)
                          ? [...prev.locationIds, 2]
                          : prev.locationIds,
                      }))}
                      data-testid="switch-can-inventory-location2"
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">{language === 'ar' ? 'المستخدمين' : 'Users'}</span>
                    </div>
                    <Switch
                      checked={formData.canManageUsers === 1}
                      onCheckedChange={(v) => setFormData(prev => ({ ...prev, canManageUsers: v ? 1 : 0 }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      <span className="text-sm">{language === 'ar' ? 'التقارير' : 'Reports'}</span>
                    </div>
                    <Switch
                      checked={formData.canViewReports === 1}
                      onCheckedChange={(v) => setFormData(prev => ({ ...prev, canViewReports: v ? 1 : 0 }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded col-span-2">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4" />
                      <span className="text-sm">{language === 'ar' ? 'تطبيق الخصومات' : 'Apply Discounts'}</span>
                    </div>
                    <Switch
                      checked={formData.canApplyDiscount === 1}
                      onCheckedChange={(v) => setFormData(prev => ({ ...prev, canApplyDiscount: v ? 1 : 0 }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded col-span-2">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      <span className="text-sm">{language === 'ar' ? 'تعديل الوصل بعد البيع' : 'Edit Receipt After Sale'}</span>
                    </div>
                    <Switch
                      checked={formData.canEditReceipt === 1}
                      onCheckedChange={(v) => setFormData(prev => ({ ...prev, canEditReceipt: v ? 1 : 0 }))}
                      data-testid="switch-can-edit-receipt"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded bg-muted/50">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>{language === 'ar' ? 'الحساب نشط' : 'Account Active'}</span>
                </div>
                <Switch
                  checked={formData.isActive === 1}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, isActive: v ? 1 : 0 }))}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-user"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    language === 'ar' ? 'حفظ' : 'Save'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-start p-3">{language === 'ar' ? 'المستخدم' : 'User'}</th>
                    <th className="text-start p-3">{language === 'ar' ? 'الدور' : 'Role'}</th>
                    <th className="text-start p-3">{language === 'ar' ? 'الصلاحيات' : 'Permissions'}</th>
                    <th className="text-center p-3">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                    <th className="text-end p-3">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-muted-foreground text-xs">@{u.username}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant={u.role === 'sales_admin' ? 'default' : 'secondary'}>
                          {u.role === 'sales_admin' 
                            ? (language === 'ar' ? 'مدير مبيعات' : 'Sales Admin')
                            : (language === 'ar' ? 'موظف مبيعات' : 'Sales Staff')
                          }
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {u.canPos === 1 && (
                            <Badge variant="outline" className="text-xs">
                              <ShoppingCart className="h-3 w-3 me-1" />
                              POS
                            </Badge>
                          )}
                          {u.canInventory === 1 && (
                            <Badge variant="outline" className="text-xs">
                              <Package className="h-3 w-3 me-1" />
                              {language === 'ar' ? 'مخزون' : 'Inv'}
                            </Badge>
                          )}
                          {u.canManageUsers === 1 && (
                            <Badge variant="outline" className="text-xs">
                              <Users className="h-3 w-3 me-1" />
                              {language === 'ar' ? 'مستخدمين' : 'Users'}
                            </Badge>
                          )}
                          {u.canViewReports === 1 && (
                            <Badge variant="outline" className="text-xs">
                              <BarChart3 className="h-3 w-3 me-1" />
                              {language === 'ar' ? 'تقارير' : 'Reports'}
                            </Badge>
                          )}
                          {u.canApplyDiscount === 1 && (
                            <Badge variant="outline" className="text-xs">
                              <Percent className="h-3 w-3 me-1" />
                              {language === 'ar' ? 'خصم' : 'Disc'}
                            </Badge>
                          )}
                          {u.canEditReceipt === 1 && (
                            <Badge variant="outline" className="text-xs">
                              <Receipt className="h-3 w-3 me-1" />
                              {language === 'ar' ? 'تعديل وصل' : 'Receipt'}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {u.isActive === 1 ? (
                          <Badge variant="outline" className="border-green-500 text-green-600">
                            {language === 'ar' ? 'نشط' : 'Active'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-red-500 text-red-600">
                            {language === 'ar' ? 'معطل' : 'Inactive'}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditDialog(u)}
                            data-testid={`button-edit-user-${u.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {u.id !== user.id && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => {
                                if (confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المستخدم؟' : 'Are you sure you want to delete this user?')) {
                                  deleteMutation.mutate(u.id);
                                }
                              }}
                              data-testid={`button-delete-user-${u.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
