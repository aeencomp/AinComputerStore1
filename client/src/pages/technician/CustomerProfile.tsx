import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import type { RepairTicket, RepairCustomer } from '@shared/schema';
import { ArrowLeft, User, Phone, Mail, Wrench, Calendar, Search } from 'lucide-react';
import { format } from 'date-fns';
import TicketDetailDialog from '@/components/TicketDetailDialog';

export default function CustomerProfile() {
  const params = useParams<{ customerId: string }>();
  const [, navigate] = useLocation();
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [jumpId, setJumpId] = useState('');

  const customerId = params.customerId?.toUpperCase();

  const { data: customer, isLoading: isCustomerLoading } = useQuery<RepairCustomer>({
    queryKey: ['/api/repair-customers/id', customerId],
    queryFn: async () => {
      const res = await fetch(`/api/repair-customers/id/${customerId}`);
      if (!res.ok) throw new Error('Customer not found');
      return res.json();
    },
    enabled: !!customerId,
    retry: false,
  });

  const { data: tickets, isLoading: isTicketsLoading } = useQuery<RepairTicket[]>({
    queryKey: ['/api/repair-customers', customer?.id, 'tickets'],
    queryFn: async () => {
      const res = await fetch(`/api/repair-customers/${customer!.id}/tickets`);
      return res.json();
    },
    enabled: !!customer?.id,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
      case 'in-progress': return 'bg-blue-500/20 text-blue-700 dark:text-blue-400';
      case 'waiting-parts': return 'bg-orange-500/20 text-orange-700 dark:text-orange-400';
      case 'completed': return 'bg-green-500/20 text-green-700 dark:text-green-400';
      case 'delivered': return 'bg-gray-500/20 text-gray-700 dark:text-gray-400';
      case 'vip': return 'bg-purple-500/20 text-purple-700 dark:text-purple-400';
      case 'rejected': return 'bg-red-500/20 text-red-700 dark:text-red-400';
      case 'unrepairable': return 'bg-red-500/20 text-red-700 dark:text-red-400';
      default: return '';
    }
  };

  const handleJump = () => {
    const id = jumpId.trim().toUpperCase();
    if (!id) return;
    const normalized = id.startsWith('C-') ? id : `C-${id}`;
    navigate(`/technician/customer/${normalized}`);
    setJumpId('');
  };

  const totalSpent = (tickets || []).reduce((sum, t) => {
    return sum + parseFloat(t.finalCost || t.costEstimate || '0');
  }, 0);
  const completedCount = (tickets || []).filter(t => ['completed', 'delivered'].includes(t.status)).length;

  if (isCustomerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <p className="text-muted-foreground text-lg">
          {isRTL ? `العميل "${customerId}" غير موجود` : `Customer "${customerId}" not found`}
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isRTL ? 'ابحث برقم C-001' : 'Search by C-001'}
              value={jumpId}
              onChange={(e) => setJumpId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJump()}
              className="ps-10 w-48"
              data-testid="input-jump-customer-id"
            />
          </div>
          <Button onClick={handleJump} data-testid="button-jump-customer">
            {isRTL ? 'بحث' : 'Search'}
          </Button>
        </div>
        <Button variant="outline" onClick={() => navigate('/technician/dashboard')} data-testid="button-back-dashboard">
          <ArrowLeft className="h-4 w-4 me-2" />
          {isRTL ? 'العودة للوحة' : 'Back to Dashboard'}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate('/technician/dashboard')} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold truncate">{customer.name}</h1>
                <Badge variant="outline" className="font-mono shrink-0" data-testid="badge-customer-id">
                  {customer.customerId}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'ملف العميل — سجل الصيانة' : 'Customer Profile — Repair History'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isRTL ? 'انتقل لعميل...' : 'Jump to customer...'}
                value={jumpId}
                onChange={(e) => setJumpId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                className="ps-10 w-44"
                data-testid="input-jump-customer"
              />
            </div>
            <Button size="icon" onClick={handleJump} data-testid="button-jump">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isRTL ? 'معلومات الاتصال' : 'Contact Info'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{customer.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span dir="ltr" data-testid="text-customer-phone">{customer.phone}</span>
              </div>
              {customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{customer.email}</span>
                </div>
              )}
              {customer.notes && (
                <p className="text-sm text-muted-foreground pt-2 border-t">{customer.notes}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isRTL ? 'إحصائيات' : 'Statistics'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{isRTL ? 'إجمالي الطلبات:' : 'Total Tickets:'}</span>
                <span className="font-bold text-lg" data-testid="text-total-tickets">{tickets?.length ?? 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{isRTL ? 'مكتمل / مسلم:' : 'Completed / Delivered:'}</span>
                <span className="font-semibold">{completedCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{isRTL ? 'إجمالي الإيرادات:' : 'Total Revenue:'}</span>
                <span className="font-semibold text-green-600 dark:text-green-400" data-testid="text-total-revenue">
                  {totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })} {isRTL ? 'د.ع' : 'IQD'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{isRTL ? 'عميل منذ:' : 'Customer Since:'}</span>
                <span className="text-sm">{format(new Date(customer.createdAt), 'dd/MM/yyyy')}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {isRTL ? 'سجل الصيانة' : 'Repair History'}
            {tickets && (
              <Badge variant="secondary">{tickets.length}</Badge>
            )}
          </h2>

          {isTicketsLoading ? (
            <p className="text-muted-foreground text-center py-8">{t('common.loading')}</p>
          ) : !tickets || tickets.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                {isRTL ? 'لا توجد طلبات صيانة لهذا العميل بعد' : 'No repair tickets for this customer yet'}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <Card
                  key={ticket.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => { setSelectedTicketId(ticket.id); setDialogOpen(true); }}
                  data-testid={`card-ticket-history-${ticket.id}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm">{ticket.ticketNumber}</span>
                          <Badge className={getStatusColor(ticket.status) + ' text-xs'}>
                            {t(`repair.status.${ticket.status}`)}
                          </Badge>
                        </div>
                        <p className="font-medium text-sm">
                          {ticket.deviceBrand} {ticket.deviceModel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t(`repair.deviceType.${ticket.deviceType}`)}
                        </p>
                        {ticket.technicianNotes && (
                          <p className="text-xs text-muted-foreground line-clamp-1 pt-1 border-t">
                            {ticket.technicianNotes}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-end space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(ticket.createdAt), 'dd/MM/yyyy')}
                        </div>
                        {(ticket.finalCost || ticket.costEstimate) && (
                          <p className="text-sm font-bold text-green-600 dark:text-green-400">
                            {parseFloat(ticket.finalCost || ticket.costEstimate || '0').toLocaleString(undefined, { maximumFractionDigits: 0 })} {isRTL ? 'د.ع' : 'IQD'}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <TicketDetailDialog
        ticketId={selectedTicketId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
