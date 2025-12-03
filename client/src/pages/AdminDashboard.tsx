import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LogOut, Package, Settings, AppWindow } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

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

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [selectedOrders, setSelectedOrders] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const isAdmin = localStorage.getItem("adminAuth");
    if (!isAdmin) {
      setLocation("/admin/login");
    }
  }, [setLocation]);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
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

  const handleLogout = () => {
    localStorage.removeItem("adminAuth");
    toast({
      title: t('admin.dashboard.logoutSuccess'),
      description: t('admin.dashboard.logoutSuccessDesc'),
    });
    setLocation("/admin/login");
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-50 bg-background">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">{t('admin.dashboard.title')}</h1>
          <div className="flex items-center gap-2">
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
            <Link href="/admin/settings">
              <Button variant="outline" size="sm" data-testid="link-admin-settings">
                <Settings className="w-4 h-4 ms-2" />
                {t('admin.settings.manageSettings')}
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-testid="button-admin-logout"
            >
              <LogOut className="w-4 h-4 ms-2" />
              {t('admin.dashboard.logout')}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
