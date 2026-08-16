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
import { Checkbox } from "@/components/ui/checkbox";
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
import { LogOut, Package, Settings, AppWindow, Users, Trash2, UserPlus, Edit, Key, ShieldCheck, Loader2, Bell, Check, CheckCheck, TrendingUp, Warehouse, Battery, Printer, LayoutDashboard, RefreshCw, Monitor } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AdminNav } from "@/components/AdminNav";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";
import { IntercomWidget } from "@/components/IntercomWidget";
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
  canOrders?: number;
  canProducts?: number;
  canCategories?: number;
  canSettings?: number;
  canUsers?: number;
  canReports?: number;
  canPOS?: number;
  canInventory?: number;
  canCustomers?: number;
  canDiscounts?: number;
  isActive?: number;
}

interface BatterySaleItem {
  id: string;
  brand: string;
  serialNumber: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

interface BatterySale {
  id: string;
  saleNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  subtotal: string;
  discount: string;
  total: string;
  paymentMethod: string;
  createdAt: string;
  items?: BatterySaleItem[];
}

function PriceSyncCard() {
  const { toast } = useToast();
  
  const syncStatusQuery = useQuery<{
    lastSync: string | null;
    nextSync: string | null;
    updatedCount: number;
    createdCount?: number;
    totalMatched: number;
    fetchedCount?: number;
    errors: string[];
    status: string;
  }>({
    queryKey: ["/api/admin/price-sync/status"],
    refetchInterval: 30000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/price-sync/run");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/price-sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      const created = data.createdCount ?? 0;
      const updated = data.updatedCount ?? 0;
      const matched = data.totalMatched ?? 0;
      const fetched = data.fetchedCount ?? 0;
      toast({
        title: "تمت مزامنة اللابتوبات",
        description: created > 0 || updated > 0
          ? `أُضيف ${created} لابتوب جديد، وتم تحديث ${updated} سعر (${matched} موجود مسبقاً من ${fetched} على GlobalIraq)`
          : `جميع الأسعار محدّثة — ${matched} لابتوب متطابق من ${fetched} على GlobalIraq`,
      });
    },
    onError: () => {
      toast({
        title: "فشلت المزامنة",
        description: "حدث خطأ أثناء مزامنة الأسعار",
        variant: "destructive",
      });
    },
  });

  const status = syncStatusQuery.data;
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("ar-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="mt-4" data-testid="card-price-sync">
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            مزامنة الأسعار - GlobalIraq
          </CardTitle>
          <CardDescription>
            استيراد لابتوبات GlobalIraq وتحديث الأسعار تلقائياً كل 6 ساعات
          </CardDescription>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || status?.status === "running"}
          data-testid="button-sync-prices"
        >
          {syncMutation.isPending || status?.status === "running" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري المزامنة...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              مزامنة الآن
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">الحالة</p>
            <p className="font-medium">
              <Badge variant={
                status?.status === "success" ? "default" :
                status?.status === "running" ? "secondary" :
                status?.status === "error" ? "destructive" : "outline"
              }>
                {status?.status === "success" ? "ناجح" :
                 status?.status === "running" ? "قيد التشغيل" :
                 status?.status === "error" ? "خطأ" : "في الانتظار"}
              </Badge>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">آخر مزامنة</p>
            <p className="font-medium">{formatDate(status?.lastSync ?? null)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">المزامنة القادمة</p>
            <p className="font-medium">{formatDate(status?.nextSync ?? null)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">لابتوبات GlobalIraq</p>
            <p className="font-medium">{status?.fetchedCount ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">مضاف / محدّث</p>
            <p className="font-medium">{status?.createdCount ?? 0} / {status?.updatedCount ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">موجود مسبقاً</p>
            <p className="font-medium">{status?.totalMatched ?? 0}</p>
          </div>
        </div>
        {status?.errors && status.errors.length > 0 && (
          <div className="mt-3 p-2 bg-destructive/10 rounded text-sm text-destructive">
            {status.errors.map((err, i) => (
              <p key={i}>{err}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DesktopSyncCard() {
  const { toast } = useToast();

  const syncStatusQuery = useQuery<{
    lastSync: string | null;
    nextSync: string | null;
    updatedCount: number;
    createdCount?: number;
    totalMatched: number;
    fetchedCount?: number;
    errors: string[];
    status: string;
  }>({
    queryKey: ["/api/admin/desktop-sync/status"],
    refetchInterval: 30000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/desktop-sync/run");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/desktop-sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      const created = data.createdCount ?? 0;
      const updated = data.updatedCount ?? 0;
      const matched = data.totalMatched ?? 0;
      const fetched = data.fetchedCount ?? 0;
      toast({
        title: "تمت مزامنة الأجهزة المكتبية",
        description: created > 0 || updated > 0
          ? `أُضيف ${created} جهاز جديد، وتم تحديث ${updated} سعر (${matched} موجود مسبقاً من ${fetched} على GlobalIraq)`
          : `جميع الأسعار محدّثة — ${matched} جهاز متطابق من ${fetched} على GlobalIraq`,
      });
    },
    onError: () => {
      toast({
        title: "فشلت المزامنة",
        description: "حدث خطأ أثناء مزامنة أسعار الأجهزة المكتبية",
        variant: "destructive",
      });
    },
  });

  const status = syncStatusQuery.data;
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("ar-IQ", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <Card className="mt-4" data-testid="card-desktop-sync">
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            مزامنة أسعار الأجهزة المكتبية والكل في واحد
          </CardTitle>
          <CardDescription>
            استيراد أجهزة GlobalIraq المكتبية والكل في واحد وتحديث الأسعار كل 6 ساعات
          </CardDescription>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || status?.status === "running"}
          data-testid="button-sync-desktop-prices"
        >
          {syncMutation.isPending || status?.status === "running" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري المزامنة...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              مزامنة الآن
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">الحالة</p>
            <p className="font-medium">
              <Badge variant={
                status?.status === "success" ? "default" :
                status?.status === "running" ? "secondary" :
                status?.status === "error" ? "destructive" : "outline"
              }>
                {status?.status === "success" ? "ناجح" :
                 status?.status === "running" ? "قيد التشغيل" :
                 status?.status === "error" ? "خطأ" : "في الانتظار"}
              </Badge>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">آخر مزامنة</p>
            <p className="font-medium">{formatDate(status?.lastSync ?? null)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">المزامنة القادمة</p>
            <p className="font-medium">{formatDate(status?.nextSync ?? null)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">أجهزة GlobalIraq</p>
            <p className="font-medium">{status?.fetchedCount ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">مضاف / محدّث</p>
            <p className="font-medium">{status?.createdCount ?? 0} / {status?.updatedCount ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">موجود مسبقاً</p>
            <p className="font-medium">{status?.totalMatched ?? 0}</p>
          </div>
        </div>
        {status?.errors && status.errors.length > 0 && (
          <div className="mt-3 p-2 bg-destructive/10 rounded text-sm text-destructive">
            {status.errors.map((err, i) => <p key={i}>{err}</p>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [selectedOrders, setSelectedOrders] = useState<{ [key: string]: string }>({});
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("welcome");
  
  // Admin user management state
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [showEditAdmin, setShowEditAdmin] = useState<AdminUser | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [deleteAdminId, setDeleteAdminId] = useState<string | null>(null);
  const [newAdminForm, setNewAdminForm] = useState({ 
    username: '', password: '', name: '', role: 'admin',
    canOrders: 1, canProducts: 1, canCategories: 1, canSettings: 0,
    canUsers: 0, canReports: 0, canPOS: 1, canInventory: 0,
    canCustomers: 0, canDiscounts: 0
  });
  const [editAdminForm, setEditAdminForm] = useState({ 
    username: '', name: '', role: '', password: '',
    canOrders: 1, canProducts: 1, canCategories: 1, canSettings: 0,
    canUsers: 0, canReports: 0, canPOS: 1, canInventory: 0,
    canCustomers: 0, canDiscounts: 0
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedNotificationOrderId, setSelectedNotificationOrderId] = useState<string | null>(null);

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

  const { data: products = [] } = useQuery<{ id: string; nameAr: string; nameEn: string }[]>({
    queryKey: ['/api/products'],
    enabled: !!currentAdmin,
  });

  const productMap = new Map(products.map(p => [p.id, p]));
  const getFulfillmentLines = (item: any) => {
    const prefix = language === 'ar' ? 'تم الأخذ من:' : 'Taken from:';
    if (Array.isArray(item.fulfillmentAllocations) && item.fulfillmentAllocations.length > 0) {
      return item.fulfillmentAllocations.map((allocation: any) =>
        `${prefix} ${allocation.locationName} (${allocation.quantity})`
      );
    }
    return item.fulfillmentLocationName ? [`${prefix} ${item.fulfillmentLocationName}`] : [];
  };

  const { data: adminUsers = [], isLoading: adminUsersLoading } = useQuery<AdminUser[]>({
    queryKey: ['/api/admin/users'],
    enabled: !!currentAdmin,
  });

  const { data: batterySales = [], isLoading: batterySalesLoading } = useQuery<BatterySale[]>({
    queryKey: ['/api/admin/battery-sales'],
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
      setNewAdminForm({ 
        username: '', password: '', name: '', role: 'admin',
        canOrders: 1, canProducts: 1, canCategories: 1, canSettings: 0,
        canUsers: 0, canReports: 0, canPOS: 1, canInventory: 0,
        canCustomers: 0, canDiscounts: 0
      });
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

  const selectedNotificationOrder = selectedNotificationOrderId
    ? orders.find((o) => o.id === selectedNotificationOrderId) || null
    : null;

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
    setEditAdminForm({ 
      username: admin.username, 
      name: admin.name, 
      role: admin.role,
      password: '',
      canOrders: admin.canOrders ?? 1,
      canProducts: admin.canProducts ?? 1,
      canCategories: admin.canCategories ?? 1,
      canSettings: admin.canSettings ?? 0,
      canUsers: admin.canUsers ?? 0,
      canReports: admin.canReports ?? 0,
      canPOS: admin.canPOS ?? 1,
      canInventory: admin.canInventory ?? 0,
      canCustomers: admin.canCustomers ?? 0,
      canDiscounts: admin.canDiscounts ?? 0
    });
    setShowEditAdmin(admin);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav currentAdmin={currentAdmin ?? null} />
      
      {/* Sub-header with page title and notifications */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold">{t('admin.dashboard.title')}</h1>
          <div className="flex items-center gap-2">
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
                            setSelectedNotificationOrderId(notification.data.orderId);
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

          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            {/* Welcome tab for all users */}
            <TabsTrigger value="welcome" data-testid="tab-welcome">
              <LayoutDashboard className="w-4 h-4 me-2" />
              الرئيسية
            </TabsTrigger>
            {/* Hide Orders tab for editor users */}
            {currentAdmin?.role !== 'editor' && (
              <TabsTrigger value="orders" data-testid="tab-orders">
                <Package className="w-4 h-4 me-2" />
                الطلبات
              </TabsTrigger>
            )}
            {/* Hide Battery Sales tab for editor users */}
            {currentAdmin?.role !== 'editor' && (
              <TabsTrigger value="battery-sales" data-testid="tab-battery-sales">
                <Battery className="w-4 h-4 me-2" />
                مبيعات البطاريات
              </TabsTrigger>
            )}
            {/* Hide Admins tab for editor users */}
            {currentAdmin?.role !== 'editor' && (
              <TabsTrigger value="admins" data-testid="tab-admins">
                <ShieldCheck className="w-4 h-4 me-2" />
                المديرين
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="welcome">
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">مرحباً {currentAdmin?.name}</h2>
              <p className="text-muted-foreground">
                لوحة التحكم الإدارية - العين لتجارة الحاسبات
              </p>
            </div>
            
            {/* Hide summary cards for editor users */}
            {currentAdmin?.role !== 'editor' && (
              <>
                <div className="grid md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        إجمالي الطلبات
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{orders.length}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Battery className="w-5 h-5" />
                        مبيعات البطاريات
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{batterySales.length}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        المديرين
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{adminUsers.length}</p>
                    </CardContent>
                  </Card>
                </div>

                <PriceSyncCard />
                <DesktopSyncCard />
              </>
            )}
          </TabsContent>

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

                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground mb-2">{language === 'ar' ? 'المنتجات المطلوبة:' : 'Ordered Products:'}</p>
                        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                          {order.items.map((itemStr: string, idx: number) => {
                            try {
                              const item = JSON.parse(itemStr);
                              const product = productMap.get(item.productId);
                              const displayName = language === 'ar' 
                                ? (item.nameAr || product?.nameAr || item.productId) 
                                : (item.nameEn || product?.nameEn || item.productId);
                              return (
                                <div key={idx} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                  <div>
                                    <span className="font-medium">
                                      {displayName}
                                    </span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {getFulfillmentLines(item).map((line: string, lineIndex: number) => (
                                        <Badge key={lineIndex} variant="outline" className="text-xs">
                                          {line}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex gap-4 text-muted-foreground">
                                    <span>{language === 'ar' ? 'الكمية:' : 'Qty:'} {item.quantity}</span>
                                    <span>{parseFloat(item.price).toLocaleString('ar-IQ')} {t('common.currency')}</span>
                                  </div>
                                </div>
                              );
                            } catch {
                              return <div key={idx} className="text-sm text-muted-foreground">{itemStr}</div>;
                            }
                          })}
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

          <TabsContent value="battery-sales">
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">مبيعات البطاريات</h2>
              <p className="text-muted-foreground">
                عدد المبيعات: {batterySales.length}
              </p>
            </div>

            {batterySalesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : batterySales.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">لا توجد مبيعات بطاريات حالياً</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Battery className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                          <p className="text-2xl font-bold">{batterySales.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                          <p className="text-xl font-bold text-green-600">
                            {batterySales.reduce((sum, sale) => sum + parseFloat(sale.total || '0'), 0).toLocaleString('ar-IQ')} د.ع
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <Package className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">إجمالي البطاريات المباعة</p>
                          <p className="text-2xl font-bold">
                            {batterySales.reduce((sum, sale) => sum + (sale.items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sales List */}
                {batterySales.map((sale) => (
                  <Card key={sale.id} data-testid={`battery-sale-card-${sale.id}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                            {sale.customerName || 'زبون متجر'}
                          </CardTitle>
                          <p className="text-sm font-semibold text-primary mt-1">
                            رقم الفاتورة: {sale.saleNumber}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-green-600">
                            {parseFloat(sale.total).toLocaleString('ar-IQ')} د.ع
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(sale.createdAt).toLocaleDateString('ar-IQ')}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-3 gap-4">
                        {sale.customerPhone && (
                          <div>
                            <p className="text-sm text-muted-foreground">رقم الهاتف</p>
                            <p dir="ltr" className="text-start">{sale.customerPhone}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-muted-foreground">طريقة الدفع</p>
                          <p>
                            {sale.paymentMethod === 'cash' ? 'نقدي' : 
                             sale.paymentMethod === 'card' ? 'بطاقة' : 'زين كاش'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">عدد العناصر</p>
                          <p>{sale.items?.length || 0} بطارية</p>
                        </div>
                      </div>

                      {sale.items && sale.items.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-sm font-semibold mb-2">البطاريات المباعة:</p>
                            <div className="space-y-2">
                              {sale.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-muted/50 p-2 rounded">
                                  <div>
                                    <span className="font-medium">{item.brand}</span>
                                    <span className="text-sm text-muted-foreground mx-2">|</span>
                                    <span className="text-sm font-mono">{item.serialNumber}</span>
                                  </div>
                                  <div className="text-end">
                                    <span className="text-sm">الكمية: {item.quantity}</span>
                                    <span className="text-sm text-muted-foreground mx-2">|</span>
                                    <span className="font-medium">{parseFloat(item.lineTotal).toLocaleString('ar-IQ')} د.ع</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {parseFloat(sale.discount) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">الخصم:</span>
                          <span className="text-red-600">-{parseFloat(sale.discount).toLocaleString('ar-IQ')} د.ع</span>
                        </div>
                      )}
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

      <Dialog
        open={!!selectedNotificationOrderId}
        onOpenChange={(open) => !open && setSelectedNotificationOrderId(null)}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'تفاصيل الطلب' : 'Order Details'}
              {selectedNotificationOrder?.orderNumber ? ` #${selectedNotificationOrder.orderNumber}` : ''}
            </DialogTitle>
          </DialogHeader>
          {!selectedNotificationOrder ? (
            <p className="text-sm text-muted-foreground">
              {language === 'ar'
                ? 'تعذر تحميل تفاصيل الطلب. افتح تبويب الطلبات للمراجعة.'
                : 'Could not load order details. Open Orders tab to review it.'}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">{language === 'ar' ? 'العميل:' : 'Customer:'}</span> {selectedNotificationOrder.customerName || '-'}</div>
                <div><span className="text-muted-foreground">{language === 'ar' ? 'الهاتف:' : 'Phone:'}</span> {selectedNotificationOrder.customerPhone || '-'}</div>
                <div><span className="text-muted-foreground">{language === 'ar' ? 'البريد:' : 'Email:'}</span> {selectedNotificationOrder.customerEmail || '-'}</div>
                <div><span className="text-muted-foreground">{language === 'ar' ? 'المدينة:' : 'City:'}</span> {selectedNotificationOrder.customerCity || '-'}</div>
                <div className="md:col-span-2"><span className="text-muted-foreground">{language === 'ar' ? 'العنوان:' : 'Address:'}</span> {selectedNotificationOrder.customerAddress || '-'}</div>
                <div><span className="text-muted-foreground">{language === 'ar' ? 'الرمز البريدي:' : 'Postal:'}</span> {selectedNotificationOrder.customerPostal || '-'}</div>
                <div><span className="text-muted-foreground">{language === 'ar' ? 'الحالة:' : 'Status:'}</span> {selectedNotificationOrder.status || '-'}</div>
                <div><span className="text-muted-foreground">{language === 'ar' ? 'وقت الطلب:' : 'Created:'}</span> {new Date(selectedNotificationOrder.createdAt).toLocaleString(language === 'ar' ? 'ar-IQ' : 'en-US')}</div>
              </div>

              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-semibold">{language === 'ar' ? 'المنتجات المطلوبة' : 'Ordered Items'}</p>
                {selectedNotificationOrder.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{language === 'ar' ? 'لا توجد عناصر' : 'No items'}</p>
                ) : (
                  selectedNotificationOrder.items.map((itemStr: string, idx: number) => {
                    try {
                      const item = JSON.parse(itemStr);
                      const product = productMap.get(item.productId);
                      const displayName = language === 'ar'
                        ? (item.nameAr || product?.nameAr || item.productId)
                        : (item.nameEn || product?.nameEn || item.productId);
                      return (
                        <div key={`${selectedNotificationOrder.id}-item-${idx}`} className="flex justify-between items-start text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{displayName}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {getFulfillmentLines(item).map((line: string, lineIndex: number) => (
                                <Badge key={lineIndex} variant="outline" className="text-[10px]">
                                  {line}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="text-end shrink-0 ms-2">
                            <p>{language === 'ar' ? 'الكمية' : 'Qty'}: {item.quantity ?? 1}</p>
                            <p className="font-semibold">{new Intl.NumberFormat('ar-IQ').format(Number(item.price || 0))} {t('common.currency')}</p>
                          </div>
                        </div>
                      );
                    } catch {
                      return (
                        <p key={`${selectedNotificationOrder.id}-raw-${idx}`} className="text-xs text-muted-foreground truncate">
                          {itemStr}
                        </p>
                      );
                    }
                  })
                )}
              </div>

              <div className="rounded-md border p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div><span className="text-muted-foreground">{language === 'ar' ? 'المجموع الفرعي:' : 'Subtotal:'}</span> {new Intl.NumberFormat('ar-IQ').format(Number((selectedNotificationOrder as any).subtotal || 0))} {t('common.currency')}</div>
                <div><span className="text-muted-foreground">{language === 'ar' ? 'الشحن:' : 'Shipping:'}</span> {new Intl.NumberFormat('ar-IQ').format(Number((selectedNotificationOrder as any).shipping || 0))} {t('common.currency')}</div>
                <div><span className="text-muted-foreground">{language === 'ar' ? 'الإجمالي:' : 'Total:'}</span> {new Intl.NumberFormat('ar-IQ').format(Number(selectedNotificationOrder.total || 0))} {t('common.currency')}</div>
                <div><span className="text-muted-foreground">{language === 'ar' ? 'عدد العناصر:' : 'Items:'}</span> {selectedNotificationOrder.items.length}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                onValueChange={(value) => {
                  if (value === 'admin') {
                    setNewAdminForm(prev => ({ 
                      ...prev, role: value,
                      canOrders: 1, canProducts: 1, canCategories: 1, canSettings: 1,
                      canUsers: 1, canReports: 1, canPOS: 1, canInventory: 1,
                      canCustomers: 1, canDiscounts: 1
                    }));
                  } else {
                    setNewAdminForm(prev => ({ ...prev, role: value }));
                  }
                }}
              >
                <SelectTrigger data-testid="select-new-admin-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدير (صلاحيات كاملة)</SelectItem>
                  <SelectItem value="manager">مشرف</SelectItem>
                  <SelectItem value="editor">محرر</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newAdminForm.role !== 'admin' && (
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-base font-semibold">الصلاحيات</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="new-canOrders"
                      checked={newAdminForm.canOrders === 1}
                      onCheckedChange={(checked) => setNewAdminForm(prev => ({ ...prev, canOrders: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="new-canOrders" className="text-sm cursor-pointer">الطلبات</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="new-canProducts"
                      checked={newAdminForm.canProducts === 1}
                      onCheckedChange={(checked) => setNewAdminForm(prev => ({ ...prev, canProducts: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="new-canProducts" className="text-sm cursor-pointer">المنتجات</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="new-canCategories"
                      checked={newAdminForm.canCategories === 1}
                      onCheckedChange={(checked) => setNewAdminForm(prev => ({ ...prev, canCategories: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="new-canCategories" className="text-sm cursor-pointer">الفئات</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="new-canPOS"
                      checked={newAdminForm.canPOS === 1}
                      onCheckedChange={(checked) => setNewAdminForm(prev => ({ ...prev, canPOS: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="new-canPOS" className="text-sm cursor-pointer">نقطة البيع</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="new-canInventory"
                      checked={newAdminForm.canInventory === 1}
                      onCheckedChange={(checked) => setNewAdminForm(prev => ({ ...prev, canInventory: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="new-canInventory" className="text-sm cursor-pointer">المخزون</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="new-canReports"
                      checked={newAdminForm.canReports === 1}
                      onCheckedChange={(checked) => setNewAdminForm(prev => ({ ...prev, canReports: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="new-canReports" className="text-sm cursor-pointer">التقارير</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="new-canCustomers"
                      checked={newAdminForm.canCustomers === 1}
                      onCheckedChange={(checked) => setNewAdminForm(prev => ({ ...prev, canCustomers: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="new-canCustomers" className="text-sm cursor-pointer">العملاء</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="new-canDiscounts"
                      checked={newAdminForm.canDiscounts === 1}
                      onCheckedChange={(checked) => setNewAdminForm(prev => ({ ...prev, canDiscounts: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="new-canDiscounts" className="text-sm cursor-pointer">الخصومات</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="new-canSettings"
                      checked={newAdminForm.canSettings === 1}
                      onCheckedChange={(checked) => setNewAdminForm(prev => ({ ...prev, canSettings: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="new-canSettings" className="text-sm cursor-pointer">الإعدادات</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="new-canUsers"
                      checked={newAdminForm.canUsers === 1}
                      onCheckedChange={(checked) => setNewAdminForm(prev => ({ ...prev, canUsers: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="new-canUsers" className="text-sm cursor-pointer">المستخدمين</Label>
                  </div>
                </div>
              </div>
            )}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              <Label>كلمة المرور الجديدة (اتركه فارغاً للإبقاء)</Label>
              <Input
                type="password"
                value={editAdminForm.password}
                onChange={(e) => setEditAdminForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="كلمة المرور الجديدة"
                data-testid="input-edit-admin-password"
              />
            </div>
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select
                value={editAdminForm.role}
                onValueChange={(value) => {
                  if (value === 'admin') {
                    setEditAdminForm(prev => ({ 
                      ...prev, role: value,
                      canOrders: 1, canProducts: 1, canCategories: 1, canSettings: 1,
                      canUsers: 1, canReports: 1, canPOS: 1, canInventory: 1,
                      canCustomers: 1, canDiscounts: 1
                    }));
                  } else {
                    setEditAdminForm(prev => ({ ...prev, role: value }));
                  }
                }}
              >
                <SelectTrigger data-testid="select-edit-admin-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدير (صلاحيات كاملة)</SelectItem>
                  <SelectItem value="manager">مشرف</SelectItem>
                  <SelectItem value="editor">محرر</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editAdminForm.role !== 'admin' && (
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-base font-semibold">الصلاحيات</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="edit-canOrders"
                      checked={editAdminForm.canOrders === 1}
                      onCheckedChange={(checked) => setEditAdminForm(prev => ({ ...prev, canOrders: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="edit-canOrders" className="text-sm cursor-pointer">الطلبات</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="edit-canProducts"
                      checked={editAdminForm.canProducts === 1}
                      onCheckedChange={(checked) => setEditAdminForm(prev => ({ ...prev, canProducts: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="edit-canProducts" className="text-sm cursor-pointer">المنتجات</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="edit-canCategories"
                      checked={editAdminForm.canCategories === 1}
                      onCheckedChange={(checked) => setEditAdminForm(prev => ({ ...prev, canCategories: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="edit-canCategories" className="text-sm cursor-pointer">الفئات</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="edit-canPOS"
                      checked={editAdminForm.canPOS === 1}
                      onCheckedChange={(checked) => setEditAdminForm(prev => ({ ...prev, canPOS: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="edit-canPOS" className="text-sm cursor-pointer">نقطة البيع</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="edit-canInventory"
                      checked={editAdminForm.canInventory === 1}
                      onCheckedChange={(checked) => setEditAdminForm(prev => ({ ...prev, canInventory: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="edit-canInventory" className="text-sm cursor-pointer">المخزون</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="edit-canReports"
                      checked={editAdminForm.canReports === 1}
                      onCheckedChange={(checked) => setEditAdminForm(prev => ({ ...prev, canReports: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="edit-canReports" className="text-sm cursor-pointer">التقارير</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="edit-canCustomers"
                      checked={editAdminForm.canCustomers === 1}
                      onCheckedChange={(checked) => setEditAdminForm(prev => ({ ...prev, canCustomers: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="edit-canCustomers" className="text-sm cursor-pointer">العملاء</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="edit-canDiscounts"
                      checked={editAdminForm.canDiscounts === 1}
                      onCheckedChange={(checked) => setEditAdminForm(prev => ({ ...prev, canDiscounts: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="edit-canDiscounts" className="text-sm cursor-pointer">الخصومات</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="edit-canSettings"
                      checked={editAdminForm.canSettings === 1}
                      onCheckedChange={(checked) => setEditAdminForm(prev => ({ ...prev, canSettings: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="edit-canSettings" className="text-sm cursor-pointer">الإعدادات</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="edit-canUsers"
                      checked={editAdminForm.canUsers === 1}
                      onCheckedChange={(checked) => setEditAdminForm(prev => ({ ...prev, canUsers: checked ? 1 : 0 }))}
                    />
                    <Label htmlFor="edit-canUsers" className="text-sm cursor-pointer">المستخدمين</Label>
                  </div>
                </div>
              </div>
            )}
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
      <IntercomWidget portal="admin" />
    </div>
  );
}
