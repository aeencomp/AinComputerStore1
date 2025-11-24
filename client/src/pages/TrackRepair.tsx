import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import type { RepairTicket } from '@shared/schema';
import { Search } from 'lucide-react';
import { format } from 'date-fns';

export default function TrackRepair() {
  const { t } = useLanguage();
  const [ticketNumber, setTicketNumber] = useState('');
  const [ticket, setTicket] = useState<RepairTicket | null>(null);

  const searchMutation = useMutation({
    mutationFn: async (ticketNum: string) => {
      const res = await fetch(`/api/repair-tickets/lookup/${ticketNum}`);
      if (!res.ok) {
        throw new Error('Not found');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setTicket(data);
    },
    onError: () => {
      setTicket(null);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketNumber.trim()) {
      searchMutation.mutate(ticketNumber.trim());
    }
  };

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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Search className="h-6 w-6" />
              <CardTitle data-testid="text-track-repair-title">{t('repair.lookup.title')}</CardTitle>
            </div>
            <CardDescription>{t('repair.lookup.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                placeholder={t('repair.lookup.ticketNumberPlaceholder')}
                data-testid="input-ticket-number"
              />
              <Button type="submit" disabled={searchMutation.isPending} data-testid="button-search-ticket">
                {searchMutation.isPending ? t('repair.lookup.searching') : t('repair.lookup.search')}
              </Button>
            </form>

            {searchMutation.isError && (
              <div className="text-destructive text-center py-4" data-testid="text-not-found">
                {t('repair.lookup.notFound')}
              </div>
            )}

            {ticket && (
              <div className="space-y-4 border-t pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg" data-testid="text-ticket-number-result">{ticket.ticketNumber}</h3>
                    <p className="text-muted-foreground">{ticket.customerName}</p>
                  </div>
                  <Badge className={getStatusColor(ticket.status)}>
                    {t(`repair.status.${ticket.status}`)}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">{t('repair.ticket.deviceType')}</Label>
                    <p className="font-medium">{t(`repair.deviceType.${ticket.deviceType}`)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('repair.ticket.deviceBrand')}</Label>
                    <p className="font-medium">{ticket.deviceBrand}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('repair.ticket.deviceModel')}</Label>
                    <p className="font-medium">{ticket.deviceModel}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('repair.ticket.priority')}</Label>
                    <p className="font-medium">{t(`repair.priority.${ticket.priority}`)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('repair.ticket.createdAt')}</Label>
                    <p className="font-medium">{format(new Date(ticket.createdAt), 'MMM dd, yyyy')}</p>
                  </div>
                  {ticket.estimatedCompletion && (
                    <div>
                      <Label className="text-muted-foreground">{t('repair.ticket.estimatedCompletion')}</Label>
                      <p className="font-medium">{format(new Date(ticket.estimatedCompletion), 'MMM dd, yyyy')}</p>
                    </div>
                  )}
                  {ticket.costEstimate && (
                    <div>
                      <Label className="text-muted-foreground">{t('repair.ticket.costEstimate')}</Label>
                      <p className="font-medium">{ticket.costEstimate} {t('common.currency')}</p>
                    </div>
                  )}
                  {ticket.finalCost && (
                    <div>
                      <Label className="text-muted-foreground">{t('repair.ticket.finalCost')}</Label>
                      <p className="font-medium">{ticket.finalCost} {t('common.currency')}</p>
                    </div>
                  )}
                </div>

                {ticket.technicianNotes && (
                  <div>
                    <Label className="text-muted-foreground">{t('repair.ticket.technicianNotes')}</Label>
                    <p className="mt-2 p-3 bg-muted rounded-md">{ticket.technicianNotes}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
