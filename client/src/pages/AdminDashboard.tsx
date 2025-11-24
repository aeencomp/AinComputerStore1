import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LogOut, Package } from "lucide-react";

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
        title: "تم التحديث بنجاح",
        description: "تم تحديث حالة الطلب",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل تحديث الطلب",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    localStorage.removeItem("adminAuth");
    toast({
      title: "تسجيل الخروج",
      description: "تم تسجيل خروجك بنجاح",
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
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-50 bg-background">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">لوحة التحكم</h1>
          <div className="flex items-center gap-2">
            <Link href="/admin/products">
              <Button variant="outline" size="sm" data-testid="link-admin-products">
                <Package className="w-4 h-4 ms-2" />
                إدارة المنتجات
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-testid="button-admin-logout"
            >
              <LogOut className="w-4 h-4 ms-2" />
              تسجيل خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">إدارة الطلبات</h2>
          <p className="text-muted-foreground">
            عدد الطلبات: {orders.length}
          </p>
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">لا توجد طلبات حالياً</p>
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
                        رقم الطلب: {order.orderNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">
                        {parseFloat(order.total).toLocaleString('ar-IQ', { minimumFractionDigits: 2 })} د.ع
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
                      <p className="text-sm text-muted-foreground">البريد الإلكتروني</p>
                      <p>{order.customerEmail}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">رقم الهاتف</p>
                      <p>{order.customerPhone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">المدينة</p>
                      <p>{order.customerCity}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">عدد العناصر</p>
                      <p>{order.items.length} عنصر</p>
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
                        <SelectItem value="pending">قيد الانتظار</SelectItem>
                        <SelectItem value="processing">قيد المعالجة</SelectItem>
                        <SelectItem value="shipped">تم الشحن</SelectItem>
                        <SelectItem value="delivered">تم التسليم</SelectItem>
                        <SelectItem value="cancelled">ملغاة</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => handleUpdateOrder(order.id)}
                      disabled={!selectedOrders[order.id] || updateMutation.isPending}
                      data-testid={`button-update-order-${order.id}`}
                    >
                      حفظ
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
