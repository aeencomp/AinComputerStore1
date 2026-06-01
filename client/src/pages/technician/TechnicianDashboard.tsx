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
import { formatPosPaymentLabel } from '@/lib/posPayment';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { RepairTicket, RepairCustomer } from '@shared/schema';
import { LogOut, Wrench, Search, Users, Settings, Plus, DollarSign, CheckCircle, Clock, Banknote, Truck, Archive, ArchiveRestore, UserSearch, CreditCard, MessageCircle, BellRing } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { format } from 'date-fns';
import TicketDetailDialog from '@/components/TicketDetailDialog';
import { IntercomWidget } from '@/components/IntercomWidget';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Technician {
  id: string;
  username: string;
  displayName: string;
  isAdmin: number;
  isActive: number;
  permissions: string[];
}

interface RepairReminderResponse {
  pendingDueCount: number;
  completedNotPickedDueCount: number;
  pendingDueIds: string[];
  completedNotPickedDueIds: string[];
}

export default function TechnicianDashboard() {
  const [, navigate] = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [customerLookup, setCustomerLookup] = useState('');

  const { data: currentTechnician, isLoading: isAuthLoading, error: authError } = useQuery<Technician>({
    queryKey: ['/api/technician/auth/me'],
    retry: false,
  });

  const { data: tickets, isLoading: isTicketsLoading } = useQuery<RepairTicket[]>({
    queryKey: ['/api/repair-tickets'],
    enabled: !!currentTechnician,
  });

  const { data: reminders } = useQuery<RepairReminderResponse>({
    queryKey: ['/api/admin/repair-tickets/reminders'],
    queryFn: async () => {
      const res = await fetch('/api/admin/repair-tickets/reminders', { credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    enabled: !!currentTechnician,
    refetchInterval: 5 * 60 * 1000,
  });

  const ackRemindersMutation = useMutation({
    mutationFn: async (payload: { pendingIds?: string[]; completedNotPickedIds?: string[] }) => {
      const res = await apiRequest('POST', '/api/admin/repair-tickets/reminders/ack', payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/repair-tickets/reminders'] });
    },
  });

  const { data: customers } = useQuery<(RepairCustomer & { ticketCount: number })[]>({
    queryKey: ['/api/repair-customers'],
    enabled: !!currentTechnician,
  });

  const customerIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    (customers || []).forEach(c => { map[c.id] = c.customerId; });
    return map;
  }, [customers]);

  const handleCustomerLookup = () => {
    const raw = customerLookup.trim().toUpperCase();
    if (!raw) return;
    const id = raw.startsWith('C-') ? raw : `C-${raw}`;
    navigate(`/technician/customer/${id}`);
    setCustomerLookup('');
  };

  useEffect(() => {
    if (authError || (!isAuthLoading && !currentTechnician)) {
      navigate('/technician/login');
    }
  }, [authError, isAuthLoading, currentTechnician, navigate]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/technician/auth/logout');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/technician/auth/me'] });
      toast({
        title: t('technician.dashboard.logout'),
        description: t('technician.login.success.description'),
      });
      navigate('/technician/login');
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('common.errorOccurred'),
        variant: 'destructive',
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, status, paymentStatus }: { id: string; status: string; paymentStatus?: string }) => {
      const body: Record<string, string> = { status };
      if (paymentStatus !== undefined) body.paymentStatus = paymentStatus;
      const res = await apiRequest('PATCH', `/api/admin/repair-tickets/${id}`, body);
      return res.json();
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets'] });
      toast({
        title: t('repair.edit.successTitle'),
        description: t('repair.edit.successMessage'),
      });
      if (response?._whatsappStatus?.startsWith('accepted:') || response?._whatsappStatus === 'sent' || response?._whatsappStatus === 'queued') {
        toast({
          title: language === 'ar' ? 'تم إرسال رسالة واتساب' : 'WhatsApp Message Sent',
          description: language === 'ar'
            ? 'تم إشعار العميل بتحديث حالة التذكرة عبر واتساب'
            : 'Customer was notified about the ticket status update via WhatsApp',
        });
      } else if (response?._whatsappStatus?.startsWith('failed')) {
        toast({
          title: language === 'ar' ? 'فشل إرسال واتساب' : 'WhatsApp Not Sent',
          description: language === 'ar'
            ? 'لم يتم إرسال إشعار واتساب للعميل'
            : 'Could not send WhatsApp notification to customer',
          variant: 'destructive',
        });
      }
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('repair.edit.errorMessage'),
        variant: 'destructive',
      });
    },
  });

  const paymentStatusMutation = useMutation({
    mutationFn: async ({ id, paymentStatus }: { id: string; paymentStatus: string }) => {
      const res = await apiRequest('PATCH', `/api/admin/repair-tickets/${id}`, { paymentStatus });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets'] });
      toast({
        title: language === 'ar' ? 'تم التحديث' : 'Updated',
        description: language === 'ar' ? 'تم تحديث حالة الدفع' : 'Payment status updated',
      });
    },
    onError: () => {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل تحديث حالة الدفع' : 'Failed to update payment status',
        variant: 'destructive',
      });
    },
  });

  const archiveTicketMutation = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      return await apiRequest('PATCH', `/api/admin/repair-tickets/${id}/archive`, { archived });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets'] });
      toast({
        title: language === 'ar' ? 'تم التحديث' : 'Updated',
        description: language === 'ar' ? 'تم تحديث حالة الأرشفة' : 'Archive status updated',
      });
    },
  });

  const archiveAllDeliveredMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/repair-tickets/archive-delivered');
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets'] });
      toast({
        title: language === 'ar' ? 'تمت الأرشفة' : 'Archived',
        description: language === 'ar' ? `تم أرشفة ${data.count} تذكرة مسلمة` : `${data.count} delivered tickets archived`,
      });
    },
  });

  const bulkSendCompletionWhatsAppMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/repair-tickets/bulk-send-completion-whatsapp', {});
      return res.json();
    },
    onSuccess: (data: { sent: number; total: number }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets'] });
      toast({
        title: language === 'ar' ? 'انتهى إرسال واتساب' : 'WhatsApp batch finished',
        description: t('repair.whatsapp.bulkResult', { sent: String(data.sent), total: String(data.total) }),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: language === 'ar' ? 'فشل الإرسال الجماعي' : 'Bulk WhatsApp send failed',
        variant: 'destructive',
      });
    },
  });

  const stats = useMemo(() => {
    if (!tickets) return { totalRevenue: 0, dailyRevenue: 0, completedCount: 0, completedRevenue: 0, pendingCount: 0, deliveredCount: 0, deferredCount: 0 };
    let totalRevenue = 0;
    let dailyRevenue = 0;
    let completedCount = 0;
    let completedRevenue = 0;
    let pendingCount = 0;
    let deliveredCount = 0;
    let deferredCount = 0;
    const baghdadToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Baghdad' });
    for (const ticket of tickets) {
      const cost = parseFloat(ticket.finalCost || ticket.costEstimate || '0');
      if (ticket.status === 'completed') {
        totalRevenue += cost;
        const completedDate = (ticket as any).completedAt || ticket.updatedAt;
        const dayKey = new Date(completedDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Baghdad' });
        if (dayKey === baghdadToday) dailyRevenue += cost;
        if (ticket.isArchived !== 1) {
          completedCount++;
          completedRevenue += cost;
        }
      } else if (ticket.status === 'delivered') {
        totalRevenue += cost;
        const deliveredDate = ticket.deliveredAt || ticket.updatedAt;
        const dayKey = new Date(deliveredDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Baghdad' });
        if (dayKey === baghdadToday) dailyRevenue += cost;
        if (ticket.isArchived !== 1) {
          deliveredCount++;
        }
      }
      if (ticket.isArchived !== 1) {
        if (ticket.paymentStatus === 'deferred') deferredCount++;
        if (ticket.status === 'pending') pendingCount++;
      }
    }
    return { totalRevenue, dailyRevenue, completedCount, completedRevenue, pendingCount, deliveredCount, deferredCount };
  }, [tickets]);

  const archivedCount = useMemo(() => {
    return tickets?.filter(t => t.isArchived === 1).length || 0;
  }, [tickets]);

  const deliveredUnarchived = useMemo(() => {
    return tickets?.filter(t => t.status === 'delivered' && t.isArchived !== 1).length || 0;
  }, [tickets]);

  const completedUnarchivedTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter(t => t.status === 'completed' && t.isArchived !== 1);
  }, [tickets]);

  const pendingReminderTickets = useMemo(() => {
    if (!tickets) return [];
    const baghdadNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Baghdad' }));
    return tickets.filter(t => {
      if (t.isArchived === 1) return false;
      if (t.status !== 'pending') return false;
      const intakeAt = (t as any).receivedAt || t.createdAt;
      const ageDays = Math.floor((baghdadNow.getTime() - new Date(intakeAt).getTime()) / (24 * 60 * 60 * 1000));
      // Start reminding once it passes 2 days
      return ageDays >= 2;
    });
  }, [tickets]);

  const completedNotPickedReminderTickets = useMemo(() => {
    if (!tickets) return [];
    const baghdadNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Baghdad' }));
    return tickets.filter(t => {
      if (t.isArchived === 1) return false;
      // Completed but not delivered yet
      if (t.status !== 'completed') return false;
      const completedAt = (t as any).completedAt;
      if (!completedAt) return false;
      const ageDays = Math.floor((baghdadNow.getTime() - new Date(completedAt).getTime()) / (24 * 60 * 60 * 1000));
      // Start reminding once it passes 30 days
      return ageDays >= 30;
    });
  }, [tickets]);

  const formatPrice = (price: string | null | undefined) => {
    if (!price || price === '0' || price === '0.00') return null;
    const num = parseFloat(price);
    return language === 'ar'
      ? `${num.toLocaleString('ar-IQ', { maximumFractionDigits: 0 })} د.ع`
      : `${num.toLocaleString('en-US', { maximumFractionDigits: 0 })} IQD`;
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Wrench className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!currentTechnician) {
    return null;
  }

  const isAdmin = currentTechnician.isAdmin === 1;
  const canViewRevenue = isAdmin || (currentTechnician.permissions || []).includes('view_revenue');

  const filteredTickets = tickets?.filter((ticket) => {
    if (!showArchived && ticket.isArchived === 1) return false;
    if (showArchived && ticket.isArchived !== 1) return false;
    if (filterStatus !== 'all' && ticket.status !== filterStatus) return false;
    if (filterPriority !== 'all' && ticket.priority !== filterPriority) return false;
    if (filterPayment !== 'all' && (ticket.paymentStatus || 'unpaid') !== filterPayment) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      const normalizedQuery = query.replace(/[\s\-\+]/g, '');
      const normalizedPhone = ticket.customerPhone.replace(/[\s\-\+]/g, '');
      const nameMatch = ticket.customerName.toLowerCase().includes(query);
      const phoneMatch = normalizedPhone.includes(normalizedQuery);
      const ticketNumberMatch = ticket.ticketNumber.toLowerCase().includes(query);
      if (!nameMatch && !phoneMatch && !ticketNumberMatch) return false;
    }
    return true;
  })?.sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'in-progress': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'waiting-parts': return 'bg-orange-500/10 text-orange-700 dark:text-orange-400';
      case 'completed': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'delivered': return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      case 'rejected': return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'unrepairable': return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'high': return 'bg-orange-500/10 text-orange-700 dark:text-orange-400';
      case 'normal': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'low': return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      case 'vip': return 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
      default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-technician-dashboard-title">
                {t('repair.technician.dashboard.title')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('technician.dashboard.welcome', { name: currentTechnician.displayName })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              data-testid="button-language-toggle"
            >
              {language === 'ar' ? 'EN' : 'AR'}
            </Button>
            <Link href="/technician/new-request">
              <Button data-testid="button-new-repair-request">
                <Plus className="h-4 w-4 me-2" />
                {language === 'ar' ? 'طلب صيانة جديد' : 'New Request'}
              </Button>
            </Link>
            {!showArchived && stats.completedCount > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 min-h-7 gap-1 px-2 py-0 text-[11px] leading-none bg-blue-600 hover:bg-blue-600/90 text-white"
                    disabled={bulkSendCompletionWhatsAppMutation.isPending || isTicketsLoading}
                    data-testid="button-send-whatsapp-all-completed"
                  >
                    <MessageCircle className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate max-w-[9.5rem] sm:max-w-none">{t('repair.whatsapp.dashboardButton')}</span>
                    <span className="opacity-90 tabular-nums">({stats.completedCount})</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('repair.whatsapp.confirmTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('repair.whatsapp.confirmDescription', { count: String(stats.completedCount) })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-whatsapp-confirm-cancel">
                      {t('repair.whatsapp.confirmCancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-blue-600 text-white hover:bg-blue-600/90"
                      disabled={bulkSendCompletionWhatsAppMutation.isPending}
                      onClick={() => bulkSendCompletionWhatsAppMutation.mutate()}
                      data-testid="button-whatsapp-confirm-send"
                    >
                      {bulkSendCompletionWhatsAppMutation.isPending
                        ? (language === 'ar' ? 'جاري الإرسال…' : 'Sending…')
                        : t('repair.whatsapp.confirmSend')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {isAdmin && (
              <Link href="/technician/manage">
                <Button variant="outline" data-testid="button-manage-technicians">
                  <Users className="h-4 w-4 me-2" />
                  {t('technician.management.title')}
                </Button>
              </Link>
            )}
            <Button variant="outline" onClick={handleLogout} disabled={logoutMutation.isPending} data-testid="button-technician-logout">
              <LogOut className="h-4 w-4 me-2" />
              {t('technician.dashboard.logout')}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className={`grid gap-4 mb-6 ${canViewRevenue ? 'grid-cols-2 lg:grid-cols-6' : 'grid-cols-2'}`}>
          {canViewRevenue && (
            <Card
              className={`cursor-pointer hover-elevate ${filterStatus === 'all' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setFilterStatus('all')}
              data-testid="card-total-revenue"
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}</p>
                    <p className="text-lg font-bold" data-testid="text-total-revenue">
                      {language === 'ar'
                        ? `${stats.totalRevenue.toLocaleString('ar-IQ', { maximumFractionDigits: 0 })} د.ع`
                        : `${stats.totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })} IQD`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {canViewRevenue && (
            <Card
              className={`cursor-pointer hover-elevate ${filterStatus === 'all' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setFilterStatus('all')}
              data-testid="card-daily-revenue"
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{language === 'ar' ? 'إيراد اليوم' : 'Daily Revenue'}</p>
                    <p className="text-lg font-bold" data-testid="text-daily-revenue">
                      {language === 'ar'
                        ? `${stats.dailyRevenue.toLocaleString('ar-IQ', { maximumFractionDigits: 0 })} د.ع`
                        : `${stats.dailyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })} IQD`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card
            className={`cursor-pointer hover-elevate ${filterStatus === 'completed' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFilterStatus(filterStatus === 'completed' ? 'all' : 'completed')}
            data-testid="card-completed-count"
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{language === 'ar' ? 'مكتملة' : 'Completed'}</p>
                  <p className="text-lg font-bold" data-testid="text-completed-count">
                    {canViewRevenue
                      ? (language === 'ar'
                        ? `${stats.completedRevenue.toLocaleString('ar-IQ', { maximumFractionDigits: 0 })} د.ع`
                        : `${stats.completedRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })} IQD`)
                      : stats.completedCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer hover-elevate ${filterStatus === 'pending' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}
            data-testid="card-pending-count"
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{language === 'ar' ? 'قيد الانتظار' : 'Pending'}</p>
                  <p className="text-lg font-bold" data-testid="text-pending-count">{stats.pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer hover-elevate ${filterStatus === 'delivered' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFilterStatus(filterStatus === 'delivered' ? 'all' : 'delivered')}
            data-testid="card-delivered-count"
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <Truck className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{language === 'ar' ? 'تم التسليم' : 'Delivered'}</p>
                  <p className="text-lg font-bold" data-testid="text-delivered-count">{stats.deliveredCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer hover-elevate ${filterPayment === 'deferred' ? 'ring-2 ring-orange-500' : ''}`}
            onClick={() => setFilterPayment(filterPayment === 'deferred' ? 'all' : 'deferred')}
            data-testid="card-deferred-count"
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{language === 'ar' ? 'آجل (غير محصّل)' : 'Deferred'}</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400" data-testid="text-deferred-count">{stats.deferredCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {!showArchived && ((reminders?.completedNotPickedDueCount || 0) > 0 || (reminders?.pendingDueCount || 0) > 0) && (
          <div className="space-y-3 mb-6">
            {(reminders?.completedNotPickedDueCount || 0) > 0 && (
              <Alert className="border-blue-200 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-900/10">
                <BellRing className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <div>
                  <AlertTitle className="flex items-center justify-between gap-2">
                    <span>{language === 'ar' ? 'تذكير: تذاكر مكتملة لم تُستلم' : 'Reminder: Completed (not picked up)'}</span>
                    <Badge className="bg-blue-600 text-white">{reminders?.completedNotPickedDueCount || 0}</Badge>
                  </AlertTitle>
                  <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-sm">
                      {language === 'ar'
                        ? 'تذاكر مكتملة منذ أكثر من شهر ولم يستلمها الزبون.'
                        : 'Tickets completed for more than 1 month and not picked up.'}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-300 text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/30"
                      onClick={() => {
                        ackRemindersMutation.mutate({ completedNotPickedIds: reminders?.completedNotPickedDueIds || [] });
                        setFilterStatus('completed');
                      }}
                      data-testid="button-alert-show-completed"
                    >
                      {language === 'ar' ? 'عرض' : 'Show'}
                    </Button>
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {(reminders?.pendingDueCount || 0) > 0 && (
              <Alert className="border-yellow-200 bg-yellow-50/40 dark:border-yellow-900/40 dark:bg-yellow-900/10">
                <Clock className="h-4 w-4 text-yellow-700 dark:text-yellow-400" />
                <div>
                  <AlertTitle className="flex items-center justify-between gap-2">
                    <span>{language === 'ar' ? 'تذكير: تذاكر قيد الانتظار' : 'Reminder: Pending Tickets'}</span>
                    <Badge className="bg-yellow-600 text-white">{reminders?.pendingDueCount || 0}</Badge>
                  </AlertTitle>
                  <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-sm">
                      {language === 'ar'
                        ? 'تذاكر قيد الانتظار منذ أكثر من يومين من وقت الاستلام.'
                        : 'Pending tickets older than 2 days from intake.'}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-yellow-300 text-yellow-900 hover:bg-yellow-100 dark:border-yellow-800 dark:text-yellow-300 dark:hover:bg-yellow-900/30"
                      onClick={() => {
                        ackRemindersMutation.mutate({ pendingIds: reminders?.pendingDueIds || [] });
                        setFilterStatus('pending');
                      }}
                      data-testid="button-alert-show-overdue-pending"
                    >
                      {language === 'ar' ? 'عرض' : 'Show'}
                    </Button>
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </div>
        )}

        <div className="space-y-3 mb-6">
          {/* Search bar — full width, prominent */}
          <div className="relative">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('repair.technician.dashboard.searchAll')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-12 py-6 text-lg"
              data-testid="input-search-query"
            />
          </div>

          {/* Filters row */}
          <div className="flex flex-col md:flex-row gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="relative">
              <UserSearch className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={language === 'ar' ? 'رقم العميل C-001' : 'Customer ID C-001'}
                value={customerLookup}
                onChange={(e) => setCustomerLookup(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomerLookup()}
                className="ps-10 w-48"
                data-testid="input-customer-lookup"
              />
            </div>
            <Button size="icon" variant="outline" onClick={handleCustomerLookup} data-testid="button-customer-lookup">
              <UserSearch className="h-4 w-4" />
            </Button>
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full md:w-[200px]" data-testid="select-filter-status">
              <SelectValue placeholder={t('repair.technician.dashboard.filterStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('repair.technician.dashboard.allTickets')}</SelectItem>
              <SelectItem value="pending">{t('repair.status.pending')}</SelectItem>
              <SelectItem value="in-progress">{t('repair.status.in-progress')}</SelectItem>
              <SelectItem value="waiting-parts">{t('repair.status.waiting-parts')}</SelectItem>
              <SelectItem value="completed">{t('repair.status.completed')}</SelectItem>
              <SelectItem value="delivered">{t('repair.status.delivered')}</SelectItem>
              <SelectItem value="rejected">{t('repair.status.rejected')}</SelectItem>
              <SelectItem value="unrepairable">{t('repair.status.unrepairable')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-full md:w-[200px]" data-testid="select-filter-priority">
              <SelectValue placeholder={t('repair.technician.dashboard.filterPriority')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('repair.technician.dashboard.allTickets')}</SelectItem>
              <SelectItem value="urgent">{t('repair.priority.urgent')}</SelectItem>
              <SelectItem value="high">{t('repair.priority.high')}</SelectItem>
              <SelectItem value="normal">{t('repair.priority.normal')}</SelectItem>
              <SelectItem value="low">{t('repair.priority.low')}</SelectItem>
              <SelectItem value="vip">{t('repair.priority.vip')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterPayment} onValueChange={setFilterPayment}>
            <SelectTrigger className="w-full md:w-[200px]" data-testid="select-filter-payment">
              <SelectValue placeholder={language === 'ar' ? 'حالة الدفع' : 'Payment Status'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'ar' ? 'كل الفواتير' : 'All Payments'}</SelectItem>
              <SelectItem value="unpaid">{t('repair.payment.unpaid')}</SelectItem>
              <SelectItem value="paid">{t('repair.payment.paid')}</SelectItem>
              <SelectItem value="deferred">{t('repair.payment.deferred')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-full md:w-[200px]" data-testid="select-sort-order">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{language === 'ar' ? 'الأحدث أولاً' : 'Newest First'}</SelectItem>
              <SelectItem value="oldest">{language === 'ar' ? 'الأقدم أولاً' : 'Oldest First'}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={showArchived ? 'default' : 'outline'}
            onClick={() => setShowArchived(!showArchived)}
            className="toggle-elevate"
            data-testid="button-toggle-archived"
          >
            <Archive className="h-4 w-4 me-2" />
            {language === 'ar' ? `الأرشيف (${archivedCount})` : `Archive (${archivedCount})`}
          </Button>

          {!showArchived && deliveredUnarchived > 0 && (
            <Button
              variant="outline"
              onClick={() => archiveAllDeliveredMutation.mutate()}
              disabled={archiveAllDeliveredMutation.isPending}
              data-testid="button-archive-all-delivered"
            >
              <Archive className="h-4 w-4 me-2" />
              {language === 'ar' ? `أرشفة المسلمة (${deliveredUnarchived})` : `Archive Delivered (${deliveredUnarchived})`}
            </Button>
          )}

          </div>
        </div>

        {isTicketsLoading ? (
          <div className="text-center py-12" data-testid="text-loading">
            {t('common.loading')}
          </div>
        ) : filteredTickets && filteredTickets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTickets.map((ticket) => (
              <Card
                key={ticket.id}
                className="hover-elevate cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => { setSelectedTicketId(ticket.id); setDialogOpen(true); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTicketId(ticket.id); setDialogOpen(true); } }}
                data-testid={`card-ticket-${ticket.id}`}
              >
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <CardTitle className="text-lg">{ticket.ticketNumber}</CardTitle>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {ticket.repairCustomerId && customerIdMap[ticket.repairCustomerId] && (
                        <Badge
                          variant="outline"
                          className="font-mono text-xs cursor-pointer hover-elevate"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/technician/customer/${customerIdMap[ticket.repairCustomerId!]}`);
                          }}
                          data-testid={`badge-customer-id-${ticket.id}`}
                        >
                          {customerIdMap[ticket.repairCustomerId]}
                        </Badge>
                      )}
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {t(`repair.priority.${ticket.priority}`)}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>{ticket.customerName}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t('repair.ticket.deviceType')}:</span>
                    <span className="text-sm font-medium">{t(`repair.deviceType.${ticket.deviceType}`)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{language === 'ar' ? 'الموديل:' : 'Model:'}</span>
                    <span className="text-sm font-medium" data-testid={`text-model-${ticket.id}`}>{ticket.deviceBrand} {ticket.deviceModel}</span>
                  </div>

                  {canViewRevenue && formatPrice(ticket.finalCost) && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('repair.ticket.finalCost')}:</span>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400" data-testid={`text-final-price-${ticket.id}`}>
                        {formatPrice(ticket.finalCost)}
                      </span>
                    </div>
                  )}
                  {canViewRevenue && formatPrice(ticket.costEstimate) && !formatPrice(ticket.finalCost) && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('repair.ticket.costEstimate')}:</span>
                      <span className="text-sm font-semibold" data-testid={`text-price-${ticket.id}`}>
                        {formatPrice(ticket.costEstimate)}
                      </span>
                    </div>
                  )}

                  <div
                    className="pt-2"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Select
                      value={ticket.status}
                      onValueChange={(val) => {
                        statusUpdateMutation.mutate({ id: ticket.id, status: val });
                      }}
                      disabled={
                        ticket.status === 'delivered' &&
                        (ticket.paymentStatus === 'paid' || ticket.paymentStatus === 'deferred')
                      }
                    >
                      <SelectTrigger
                        className="w-full"
                        data-testid={`select-card-status-${ticket.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(ticket.status) + ' text-xs'}>
                            {t(`repair.status.${ticket.status}`)}
                          </Badge>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">{t('repair.status.pending')}</SelectItem>
                        <SelectItem value="in-progress">{t('repair.status.in-progress')}</SelectItem>
                        <SelectItem value="waiting-parts">{t('repair.status.waiting-parts')}</SelectItem>
                        <SelectItem value="completed">{t('repair.status.completed')}</SelectItem>
                        <SelectItem value="delivered">{t('repair.status.delivered')}</SelectItem>
                        <SelectItem value="rejected">{t('repair.status.rejected')}</SelectItem>
                        <SelectItem value="unrepairable">{t('repair.status.unrepairable')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{language === 'ar' ? 'تاريخ الاستلام:' : 'Intake Date:'}</span>
                    <span className="text-sm font-medium" data-testid={`text-intake-date-${ticket.id}`}>
                      {format(new Date(ticket.createdAt), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  {ticket.completedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{language === 'ar' ? 'تاريخ الإكمال:' : 'Completed:'}</span>
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400" data-testid={`text-completed-date-${ticket.id}`}>
                        {format(new Date(ticket.completedAt), 'dd/MM/yyyy')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{language === 'ar' ? 'تاريخ التسليم:' : 'Delivery Date:'}</span>
                    <span className={`text-sm font-medium ${ticket.deliveredAt ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} data-testid={`text-delivery-date-${ticket.id}`}>
                      {ticket.deliveredAt ? format(new Date(ticket.deliveredAt), 'dd/MM/yyyy') : (language === 'ar' ? 'لم يُسلَّم' : 'Not yet')}
                    </span>
                  </div>

                  <div className="pt-1 flex items-center gap-2" data-testid={`text-payment-status-${ticket.id}`}>
                    {ticket.paymentStatus === 'paid' ? (
                      <>
                        <Badge className="bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700 text-xs">
                          {t('repair.payment.paid')}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {formatPosPaymentLabel(
                            {
                              paymentMethod: (ticket as any).paymentMethod,
                              paymentStatus: ticket.paymentStatus,
                              finalCost: ticket.finalCost,
                              costEstimate: ticket.costEstimate,
                              cashPaidAmount: (ticket as any).cashPaidAmount,
                              cardPaidAmount: (ticket as any).cardPaidAmount,
                            },
                            language === 'ar' ? 'ar' : 'en',
                          )}
                        </Badge>
                      </>
                    ) : ticket.paymentStatus === 'deferred' ? (
                      <Badge className="bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700 text-xs">
                        {t('repair.payment.deferred')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-xs">
                        {t('repair.payment.unpaid')}
                      </Badge>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    {showArchived ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); archiveTicketMutation.mutate({ id: ticket.id, archived: false }); }}
                        disabled={archiveTicketMutation.isPending}
                        data-testid={`button-unarchive-${ticket.id}`}
                      >
                        <ArchiveRestore className="h-3 w-3 me-1" />
                        {language === 'ar' ? 'إلغاء الأرشفة' : 'Unarchive'}
                      </Button>
                    ) : ticket.status === 'delivered' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); archiveTicketMutation.mutate({ id: ticket.id, archived: true }); }}
                        disabled={archiveTicketMutation.isPending}
                        data-testid={`button-archive-${ticket.id}`}
                      >
                        <Archive className="h-3 w-3 me-1" />
                        {language === 'ar' ? 'أرشفة' : 'Archive'}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground" data-testid="text-no-tickets">
                {t('repair.technician.dashboard.noTickets')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <TicketDetailDialog
        ticketId={selectedTicketId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
      <IntercomWidget portal="technician" />
    </div>
  );
}
