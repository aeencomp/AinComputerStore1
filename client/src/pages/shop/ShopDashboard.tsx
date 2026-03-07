import { useState, useEffect, useMemo } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { SaasRepairTicket } from '@shared/schema';
import ShopTicketDialog from '@/components/ShopTicketDialog';
import { LogOut, Wrench, Search, Plus, DollarSign, CheckCircle, Clock, Banknote, Truck, Archive, AlertTriangle, UserSearch } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface SaasShop {
  id: number;
  shopName: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  trialEndsAt: string;
}

export default function ShopDashboard() {
  const [, navigate] = useLocation();
  const { t, language, isRTL } = useLanguage();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customerLookup, setCustomerLookup] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const { data: authData, isLoading: isAuthLoading, error: authError } = useQuery<{ shop: SaasShop, isActive: boolean, isOwner: boolean }>({
    queryKey: ['/api/saas/auth/me'],
    retry: false,
  });

  const { data: tickets, isLoading: isTicketsLoading } = useQuery<SaasRepairTicket[]>({
    queryKey: ['/api/saas/tickets'],
    enabled: !!authData,
  });

  const { data: stats } = useQuery<{
    pending: number;
    inProgress: number;
    completedToday: number;
    revenue: number;
  }>({
    queryKey: ['/api/saas/stats'],
    enabled: !!authData,
  });

  useEffect(() => {
    if (authError || (!isAuthLoading && !authData)) {
      navigate('/shop/login');
    }
  }, [authError, isAuthLoading, authData, navigate]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/saas/auth/logout');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saas/auth/me'] });
      toast({
        title: language === 'ar' ? 'تم تسجيل الخروج' : 'Logged out',
        description: language === 'ar' ? 'تم تسجيل خروجك بنجاح' : 'You have been logged out successfully',
      });
      navigate('/shop/login');
    },
  });

  const archiveTicketMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/saas/tickets/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saas/tickets'] });
      toast({
        title: language === 'ar' ? 'تمت الأرشفة' : 'Archived',
        description: language === 'ar' ? 'تم أرشفة التذكرة بنجاح' : 'Ticket archived successfully',
      });
    },
  });

  const handleCustomerLookup = () => {
    const raw = customerLookup.trim().toUpperCase();
    if (!raw) return;
    const id = raw.startsWith('C-') ? raw : `C-${raw}`;
    navigate(`/shop/customer/${id}`);
    setCustomerLookup('');
  };

  const filteredTickets = useMemo(() => {
    return tickets?.filter((ticket) => {
      if (filterStatus !== 'all' && ticket.status !== filterStatus) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        const phoneMatch = ticket.customerPhone.includes(query);
        const nameMatch = ticket.customerName.toLowerCase().includes(query);
        const ticketNumberMatch = ticket.ticketNumber.toLowerCase().includes(query);
        if (!nameMatch && !phoneMatch && !ticketNumberMatch) return false;
      }
      return true;
    });
  }, [tickets, filterStatus, searchQuery]);

  const expiryDays = useMemo(() => {
    if (!authData?.shop.subscriptionExpiresAt) return null;
    return differenceInDays(new Date(authData.shop.subscriptionExpiresAt), new Date());
  }, [authData]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Wrench className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authData) return null;

  const { shop, isOwner } = authData;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'in-progress': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'completed': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'delivered': return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      case 'vip': return 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
      default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold truncate max-w-[200px] md:max-w-none">{shop.shopName}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] py-0 h-4">
                  {shop.subscriptionStatus === 'trial' ? (language === 'ar' ? 'تجريبي' : 'Trial') : (language === 'ar' ? 'نشط' : 'Active')}
                </Badge>
                {expiryDays !== null && (
                  <span className="text-[10px] text-muted-foreground">
                    {language === 'ar' ? `ينتهي خلال ${expiryDays} يوم` : `Expires in ${expiryDays} days`}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/shop/new-request">
              <Button size="sm" data-testid="button-new-repair">
                <Plus className="h-4 w-4 me-2" />
                {language === 'ar' ? 'صيانة جديدة' : 'New Repair'}
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
              <LogOut className="h-4 w-4 md:me-2" />
              <span className="hidden md:inline">{language === 'ar' ? 'خروج' : 'Logout'}</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {expiryDays !== null && expiryDays <= 7 && (
          <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{language === 'ar' ? 'تنبيه الاشتراك' : 'Subscription Warning'}</AlertTitle>
            <AlertDescription>
              {language === 'ar' 
                ? `بقي ${expiryDays} أيام فقط على انتهاء اشتراكك. يرجى التجديد لتجنب توقف الخدمة.` 
                : `Your subscription expires in ${expiryDays} days. Please renew to avoid service interruption.`}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'ar' ? 'بانتظار الصيانة' : 'Pending'}</p>
                  <p className="text-lg font-bold">{stats?.pending || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Wrench className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'ar' ? 'جاري العمل' : 'In-Progress'}</p>
                  <p className="text-lg font-bold">{stats?.inProgress || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'ar' ? 'اكتمل اليوم' : 'Completed Today'}</p>
                  <p className="text-lg font-bold">{stats?.completedToday || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Banknote className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'ar' ? 'الإيرادات المتوقعة' : 'Revenue'}</p>
                  <p className="text-lg font-bold">
                    {(stats?.revenue ?? 0).toLocaleString(language === 'ar' ? 'ar-IQ' : 'en-US')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'ar' ? 'بحث برقم التذكرة أو الهاتف...' : 'Search ticket or phone...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-10"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <UserSearch className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'ar' ? 'رقم العميل C-001' : 'Customer ID C-001'}
                value={customerLookup}
                onChange={(e) => setCustomerLookup(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomerLookup()}
                className="ps-10 w-48"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={language === 'ar' ? 'الحالة' : 'Status'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
                <SelectItem value="pending">{language === 'ar' ? 'انتظار' : 'Pending'}</SelectItem>
                <SelectItem value="in-progress">{language === 'ar' ? 'جاري' : 'In-Progress'}</SelectItem>
                <SelectItem value="completed">{language === 'ar' ? 'مكتمل' : 'Completed'}</SelectItem>
                <SelectItem value="delivered">{language === 'ar' ? 'تم التسليم' : 'Delivered'}</SelectItem>
                <SelectItem value="vip">{language === 'ar' ? 'VIP - عميل مميز' : 'VIP'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isTicketsLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />)
          ) : filteredTickets && filteredTickets.length > 0 ? (
            filteredTickets.map((ticket) => (
              <Card key={ticket.id} className="hover-elevate cursor-pointer group" onClick={() => setSelectedTicketId(ticket.id)}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base">{ticket.ticketNumber}</CardTitle>
                    <Badge className={getStatusColor(ticket.status)}>
                      {language === 'ar' ? t(`repair.status.${ticket.status}`) : ticket.status}
                    </Badge>
                  </div>
                  <CardDescription>{ticket.customerName}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 pb-3">
                  <p className="text-xs"><span className="text-muted-foreground">{language === 'ar' ? 'الجهاز:' : 'Device:'}</span> {ticket.deviceBrand} {ticket.deviceModel}</p>
                  <p className="text-xs"><span className="text-muted-foreground">{language === 'ar' ? 'التاريخ:' : 'Date:'}</span> {format(new Date(ticket.createdAt!), 'yyyy/MM/dd HH:mm')}</p>
                </CardContent>
                <div className="px-6 pb-4 flex justify-between items-center mt-auto">
                  <Link href={`/shop/customer/${ticket.repairCustomerId}`}>
                    <Button variant="link" size="sm" className="p-0 h-auto text-xs">
                      {language === 'ar' ? 'ملف العميل' : 'Customer Profile'}
                    </Button>
                  </Link>
                  {isOwner && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(language === 'ar' ? 'هل أنت متأكد من أرشفة هذه التذكرة؟' : 'Are you sure you want to archive this ticket?')) {
                          archiveTicketMutation.mutate(Number(ticket.id));
                        }
                      }}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-20 text-center border-2 border-dashed rounded-lg">
              <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
              <p className="text-muted-foreground">{language === 'ar' ? 'لا توجد تذاكر صيانة حالياً' : 'No repair tickets found'}</p>
            </div>
          )}
        </div>
      </div>

      <ShopTicketDialog
        ticketId={selectedTicketId}
        open={!!selectedTicketId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTicketId(null);
            queryClient.invalidateQueries({ queryKey: ['/api/saas/tickets'] });
          }
        }}
      />
    </div>
  );
}
