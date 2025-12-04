import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LogOut, Package, Settings, AppWindow, Users, Trash2, UserPlus, Edit, Key, ShieldCheck, Loader2, Bell, Check, CheckCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCity: string;
  total: string;
  status: string;
  createdAt: string;
  items: string[];
}

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [selectedOrders, setSelectedOrders] = useState<{ [key: string]: string }>({});
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("orders");
  
  // Admin user management state
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [showEditAdmin, setShowEditAdmin] = useState<AdminUser | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [deleteAdminId, setDeleteAdminId] = useState<string | null>(null);
  const [newAdminForm, setNewAdminForm] = useState({ username: '', password: '', name: '', role: 'admin' });
  const [editAdminForm, setEditAdminForm] = useState({ username: '', name: '', role: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Real-time order notifications
  const { notifications, unreadCount, markAsRead, markAllAsRead, isConnected } = useAdminNotifications();

  // Check admin session
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

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
    enabled: !!currentAdmin,
  });

  const { data: adminUsers = [], isLoading: adminUsersLoading } = useQuery<AdminUser[]>({
    queryKey: ['/api/admin/users'],
    enabled: !!currentAdmin,
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/auth/logout');
    },
    onSuccess: () => {
      localStorage.removeItem("adminAuth");
      queryClient.clear();
      toast({
        title: t('admin.dashboard.logoutSuccess'),
        description: t('admin.dashboard.logoutSuccessDesc'),
      });
      setLocation("/admin/login");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { orderId: string; status: string }) => {
      return await apiRequest('PATCH', `/api/orders/${data.orderId}`, { status: data.status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: t('admin.dashboard.updateSuccess'),
        description: t('admin.dashboard.updateSuccessDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('admin.dashboard.updateError'),
        description: t('admin.dashboard.updateErrorDesc'),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return await apiRequest('DELETE', `/api/orders/${orderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setDeleteOrderId(null);
      toast({
        title: t('admin.dashboard.deleteSuccess'),
        description: t('admin.dashboard.deleteSuccessDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('admin.dashboard.deleteError'),
        description: t('admin.dashboard.deleteErrorDesc'),
        variant: "destructive",
      });
    },
  });

  // Admin user mutations
  const createAdminMutation = useMutation({
    mutationFn: async (data: typeof newAdminForm) => {
      const response = await apiRequest('POST', '/api/admin/users', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setShowAddAdmin(false);
      setNewAdminForm({ username: '', password: '', name: '', role: 'admin' });
      toast({
        title: "تم إنشاء المستخدم",
        description: "تم إنشاء المستخدم الإداري بنجاح",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل إنشاء المستخدم",
        variant: "destructive",
      });
    },
  });

  const updateAdminMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editAdminForm }) => {
      const response = await apiRequest('PUT', `/api/admin/users/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setShowEditAdmin(null);
      toast({
        title: "تم التحديث",
        description: "تم تحديث بيانات المستخدم بنجاح",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل تحديث المستخدم",
        variant: "destructive",
      });
    },
  });

  const deleteAdminMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setDeleteAdminId(null);
      toast({
        title: "تم الحذف",
        description: "تم حذف المستخدم الإداري بنجاح",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل حذف المستخدم",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest('PUT', '/api/admin/auth/change-password', data);
      return response.json();
    },
    onSuccess: () => {
      setShowChangePassword(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({
        title: "تم تغيير كلمة المرور",
        description: "تم تغيير كلمة المرور بنجاح",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل تغيير كلمة المرور",
        variant: "destructive",
      });
    },
  });

  const handleDeleteOrder = (orderId: string) => {
    setDeleteOrderId(orderId);
  };

  const confirmDelete = () => {
    if (deleteOrderId) {
      deleteMutation.mutate(deleteOrderId);
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleStatusChange = (orderId: string, newStatus: string) => {
    setSelectedOrders(prev => ({ ...prev, [orderId]: newStatus }));
  };

  const handleUpdateOrder = (orderId: string) => {
    const status = selectedOrders[orderId];
    if (status) {
      updateMutation.mutate({ orderId, status });
    }
  };

  const handleCreateAdmin = () => {
    if (!newAdminForm.username || !newAdminForm.password || !newAdminForm.name) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }
    createAdminMutation.mutate(newAdminForm);
  };

  const handleUpdateAdmin = () => {
    if (!showEditAdmin) return;
    updateAdminMutation.mutate({ id: showEditAdmin.id, data: editAdminForm });
  };

  const handleChangePassword = () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "خطأ",
        description: "كلمات المرور غير متطابقة",
        variant: "destructive",
      });
      return;
    }
    if (passwordForm.newPassword.length < 4) {
      toast({
        title: "خطأ",
        description: "كلمة المرور يجب أن تكون 4 أحرف على الأقل",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const openEditAdmin = (admin: AdminUser) => {
    setEditAdminForm({ username: admin.username, name: admin.name, role: admin.role });
    setShowEditAdmin(admin);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-50 bg-background">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{t('admin.dashboard.title')}</h1>
            {currentAdmin && (
              <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                {currentAdmin.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/admin/products">
              <Button variant="outline" size="sm" data-testid="link-admin-products">
                <Package className="w-4 h-4 ms-2" />
                {t('admin.products.manageProducts')}
              </Button>
            </Link>
            <Link href="/admin/programs">
              <Button variant="outline" size="sm" className="border-cyan-300 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-700 dark:text-cyan-400 dark:hover:bg-cyan-900/20" data-testid="link-admin-programs">
                <AppWindow className="w-4 h-4 ms-2" />
                {t('admin.programs.managePrograms')}
              </Button>
            </Link>
            <Link href="/admin/customers">
              <Button variant="outline" size="sm" className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20" data-testid="link-admin-customers">
                <Users className="w-4 h-4 ms-2" />
                {t('admin.customers.manageCustomers')}
              </Button>
            </Link>
            <Link href="/admin/settings">
              <Button variant="outline" size="sm" data-testid="link-admin-settings">
                <Settings className="w-4 h-4 ms-2" />
                {t('admin.settings.manageSettings')}
              </Button>
            </Link>
            
            {/* Notification Bell */}
            <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative"
                  data-testid="button-notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <Badge 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground"
                      data-testid="badge-notification-count"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                  {!isConnected && (
                    <span className="absolute bottom-0 right-0 w-2 h-2 bg-yellow-500 rounded-full" title="Reconnecting..." />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0" data-testid="popover-notifications">
                <div className="flex items-center justify-between p-3 border-b">
                  <h4 className="font-semibold text-sm">{t('admin.notifications.title')}</h4>
                  {notifications.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={markAllAsRead}
                      className="h-7 text-xs"
                      data-testid="button-mark-all-read"
                    >
                      <CheckCheck className="w-3 h-3 me-1" />
                      {t('admin.notifications.markAllRead')}
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-72">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground">
                      <Bell className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm">{t('admin.notifications.empty')}</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.map((notification) => (
                        <div 
                          key={notification.timestamp}
                          className={`p-3 cursor-pointer hover-elevate transition-colors ${!notification.read ? 'bg-accent/50' : ''}`}
                          onClick={() => {
                            markAsRead(notification.timestamp);
                            queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
                            setNotificationsOpen(false);
                          }}
                          data-testid={`notification-${notification.data.orderNumber}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!notification.read ? 'bg-primary' : 'bg-muted'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">
                                {t('admin.notifications.newOrder')}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                {notification.data.orderNumber} - {notification.data.customerName}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Intl.NumberFormat('ar-IQ').format(Number(notification.data.total))} د.ع
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(notification.timestamp).toLocaleTimeString('ar-IQ', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </p>
                            </div>
                            {!notification.read && (
                              <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              data-testid="button-admin-logout"
            >
              {logoutMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin ms-2" />
              ) : (
                <LogOut className="w-4 h-4 ms-2" />
              )}
              {t('admin.dashboard.logout')}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="orders" data-testid="tab-orders">
              <Package className="w-4 h-4 me-2" />
              الطلبات
            </TabsTrigger>
            <TabsTrigger value="admins" data-testid="tab-admins">
              <ShieldCheck className="w-4 h-4 me-2" />
              المديرين
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">{t('admin.dashboard.ordersTitle')}</h2>
              <p className="text-muted-foreground">
                {t('admin.dashboard.ordersCount')}: {orders.length}
              </p>
            </div>

            {orders.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">{t('admin.dashboard.noOrders')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id} data-testid={`order-card-${order.id}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{order.customerName}</CardTitle>
                          <p className="text-sm font-semibold text-primary mt-1" data-testid={`text-order-number-${order.id}`}>
                            {t('admin.dashboard.orderNumber')}: {order.orderNumber}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {parseFloat(order.total).toLocaleString('ar-IQ', { minimumFractionDigits: 2 })} {t('common.currency')}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(order.createdAt).toLocaleDateString('ar-IQ')}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">{t('admin.dashboard.email')}</p>
                          <p>{order.customerEmail}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t('admin.dashboard.phone')}</p>
                          <p>{order.customerPhone}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t('admin.dashboard.city')}</p>
                          <p>{order.customerCity}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t('admin.dashboard.itemsCount')}</p>
                          <p>{order.items.length} {t('admin.dashboard.item')}</p>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex flex-wrap gap-2 items-center justify-between">
                        <div className="flex gap-2 items-center">
                          <Select
                            value={selectedOrders[order.id] || order.status}
                            onValueChange={(value) => handleStatusChange(order.id, value)}
                          >
                            <SelectTrigger className="w-48" data-testid={`select-order-status-${order.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">{t('admin.dashboard.pending')}</SelectItem>
                              <SelectItem value="processing">{t('admin.dashboard.processing')}</SelectItem>
                              <SelectItem value="shipped">{t('admin.dashboard.shipped')}</SelectItem>
                              <SelectItem value="delivered">{t('admin.dashboard.delivered')}</SelectItem>
                              <SelectItem value="cancelled">{t('admin.dashboard.cancelled')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => handleUpdateOrder(order.id)}
                            disabled={!selectedOrders[order.id] || updateMutation.isPending}
                            data-testid={`button-update-order-${order.id}`}
                          >
                            {updateMutation.isPending ? t('admin.dashboard.updating') : t('admin.dashboard.update')}
                          </Button>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteOrder(order.id)}
                          data-testid={`button-delete-order-${order.id}`}
                        >
                          <Trash2 className="h-4 w-4 me-1" />
                          {t('admin.dashboard.delete')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="admins">
            <div className="mb-8 flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold mb-2">إدارة المستخدمين الإداريين</h2>
                <p className="text-muted-foreground">
                  عدد المديرين: {adminUsers.length}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowChangePassword(true)}
                  data-testid="button-change-password"
                >
                  <Key className="w-4 h-4 me-2" />
                  تغيير كلمة المرور
                </Button>
                <Button
                  onClick={() => setShowAddAdmin(true)}
                  data-testid="button-add-admin"
                >
                  <UserPlus className="w-4 h-4 me-2" />
                  إضافة مدير جديد
                </Button>
              </div>
            </div>

            {adminUsersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : adminUsers.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">لا يوجد مستخدمين إداريين</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {adminUsers.map((admin) => (
                  <Card key={admin.id} data-testid={`admin-card-${admin.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                            {admin.name}
                          </CardTitle>
                          <CardDescription>@{admin.username}</CardDescription>
                        </div>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          {admin.role === 'admin' ? 'مدير' : admin.role}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground mb-4">
                        تاريخ الإنشاء: {new Date(admin.createdAt).toLocaleDateString('ar-IQ')}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditAdmin(admin)}
                          data-testid={`button-edit-admin-${admin.id}`}
                        >
                          <Edit className="w-4 h-4 me-1" />
                          تعديل
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteAdminId(admin.id)}
                          disabled={currentAdmin?.id === admin.id}
                          data-testid={`button-delete-admin-${admin.id}`}
                        >
                          <Trash2 className="w-4 h-4 me-1" />
                          حذف
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Delete Order Dialog */}
      <AlertDialog open={!!deleteOrderId} onOpenChange={(open) => !open && setDeleteOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.dashboard.deleteOrderTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.dashboard.deleteOrderConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-order">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-order"
            >
              {deleteMutation.isPending ? t('admin.dashboard.deleting') : t('admin.dashboard.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Admin Dialog */}
      <Dialog open={showAddAdmin} onOpenChange={setShowAddAdmin}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة مدير جديد</DialogTitle>
            <DialogDescription>
              أدخل بيانات المستخدم الإداري الجديد
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اسم المستخدم</Label>
              <Input
                value={newAdminForm.username}
                onChange={(e) => setNewAdminForm(prev => ({ ...prev, username: e.target.value }))}
                placeholder="username"
                data-testid="input-new-admin-username"
              />
            </div>
            <div className="space-y-2">
              <Label>الاسم الكامل</Label>
              <Input
                value={newAdminForm.name}
                onChange={(e) => setNewAdminForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="الاسم الكامل"
                data-testid="input-new-admin-name"
              />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <Input
                type="password"
                value={newAdminForm.password}
                onChange={(e) => setNewAdminForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="كلمة المرور"
                data-testid="input-new-admin-password"
              />
            </div>
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select
                value={newAdminForm.role}
                onValueChange={(value) => setNewAdminForm(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger data-testid="select-new-admin-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدير</SelectItem>
                  <SelectItem value="editor">محرر</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAdmin(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleCreateAdmin}
              disabled={createAdminMutation.isPending}
              data-testid="button-confirm-add-admin"
            >
              {createAdminMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  جاري الإنشاء...
                </>
              ) : (
                "إنشاء"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Admin Dialog */}
      <Dialog open={!!showEditAdmin} onOpenChange={(open) => !open && setShowEditAdmin(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل المستخدم</DialogTitle>
            <DialogDescription>
              تعديل بيانات المستخدم الإداري
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اسم المستخدم</Label>
              <Input
                value={editAdminForm.username}
                onChange={(e) => setEditAdminForm(prev => ({ ...prev, username: e.target.value }))}
                placeholder="username"
                data-testid="input-edit-admin-username"
              />
            </div>
            <div className="space-y-2">
              <Label>الاسم الكامل</Label>
              <Input
                value={editAdminForm.name}
                onChange={(e) => setEditAdminForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="الاسم الكامل"
                data-testid="input-edit-admin-name"
              />
            </div>
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select
                value={editAdminForm.role}
                onValueChange={(value) => setEditAdminForm(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger data-testid="select-edit-admin-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدير</SelectItem>
                  <SelectItem value="editor">محرر</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditAdmin(null)}>
              إلغاء
            </Button>
            <Button
              onClick={handleUpdateAdmin}
              disabled={updateAdminMutation.isPending}
              data-testid="button-confirm-edit-admin"
            >
              {updateAdminMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  جاري التحديث...
                </>
              ) : (
                "حفظ"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تغيير كلمة المرور</DialogTitle>
            <DialogDescription>
              أدخل كلمة المرور الحالية والجديدة
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>كلمة المرور الحالية</Label>
              <Input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="كلمة المرور الحالية"
                data-testid="input-current-password"
              />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور الجديدة</Label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                placeholder="كلمة المرور الجديدة"
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label>تأكيد كلمة المرور الجديدة</Label>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="تأكيد كلمة المرور الجديدة"
                data-testid="input-confirm-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePassword(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isPending}
              data-testid="button-confirm-change-password"
            >
              {changePasswordMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                  جاري التغيير...
                </>
              ) : (
                "تغيير"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Admin Dialog */}
      <AlertDialog open={!!deleteAdminId} onOpenChange={(open) => !open && setDeleteAdminId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المستخدم الإداري</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا المستخدم الإداري؟ هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-admin">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAdminId && deleteAdminMutation.mutate(deleteAdminId)}
              disabled={deleteAdminMutation.isPending}
              data-testid="button-confirm-delete-admin"
            >
              {deleteAdminMutation.isPending ? "جاري الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
