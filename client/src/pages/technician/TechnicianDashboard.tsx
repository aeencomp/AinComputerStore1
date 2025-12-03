import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { RepairTicket } from '@shared/schema';
import { LogOut, Wrench, Search, Users, Settings } from 'lucide-react';
import { format } from 'date-fns';

interface Technician {
  id: string;
  username: string;
  displayName: string;
  isAdmin: number;
  isActive: number;
  permissions: string[];
}

export default function TechnicianDashboard() {
  const [, navigate] = useLocation();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: currentTechnician, isLoading: isAuthLoading, error: authError } = useQuery<Technician>({
    queryKey: ['/api/technician/auth/me'],
    retry: false,
  });

  const { data: tickets, isLoading: isTicketsLoading } = useQuery<RepairTicket[]>({
    queryKey: ['/api/repair-tickets'],
    enabled: !!currentTechnician,
  });

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

  if (authError || !currentTechnician) {
    navigate('/technician/login');
    return null;
  }

  const isAdmin = currentTechnician.isAdmin === 1;

  const filteredTickets = tickets?.filter((ticket) => {
    if (filterStatus !== 'all' && ticket.status !== filterStatus) return false;
    if (filterPriority !== 'all' && ticket.priority !== filterPriority) return false;
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
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'in-progress': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'waiting-parts': return 'bg-orange-500/10 text-orange-700 dark:text-orange-400';
      case 'completed': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'delivered': return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'high': return 'bg-orange-500/10 text-orange-700 dark:text-orange-400';
      case 'normal': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'low': return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
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
          
          <div className="flex items-center gap-2">
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
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1 md:max-w-[300px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('repair.technician.dashboard.searchAll')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-10"
              data-testid="input-search-query"
            />
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
            </SelectContent>
          </Select>
        </div>

        {isTicketsLoading ? (
          <div className="text-center py-12" data-testid="text-loading">
            {t('common.loading')}
          </div>
        ) : filteredTickets && filteredTickets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTickets.map((ticket) => (
              <Link key={ticket.id} href={`/technician/tickets/${ticket.id}`}>
                <Card className="hover-elevate cursor-pointer" data-testid={`card-ticket-${ticket.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <CardTitle className="text-lg">{ticket.ticketNumber}</CardTitle>
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {t(`repair.priority.${ticket.priority}`)}
                      </Badge>
                    </div>
                    <CardDescription>{ticket.customerName}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('repair.ticket.deviceType')}:</span>
                      <span className="text-sm font-medium">{t(`repair.deviceType.${ticket.deviceType}`)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('repair.ticket.status')}:</span>
                      <Badge className={getStatusColor(ticket.status)}>
                        {t(`repair.status.${ticket.status}`)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground pt-2">
                      {format(new Date(ticket.createdAt), 'MMM dd, yyyy')}
                    </div>
                  </CardContent>
                </Card>
              </Link>
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
    </div>
  );
}
