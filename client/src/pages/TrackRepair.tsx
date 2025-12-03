import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from 'wouter';
import type { RepairTicket } from '@shared/schema';
import { Search, Clock, Wrench, Package, CheckCircle, Truck, Circle } from 'lucide-react';
import JsBarcode from 'jsbarcode';

const repairSteps = [
  { id: 'pending', icon: Clock },
  { id: 'in-progress', icon: Wrench },
  { id: 'waiting-parts', icon: Package },
  { id: 'completed', icon: CheckCircle },
  { id: 'delivered', icon: Truck },
];

function RepairTimeline({ currentStatus, t, language }: { currentStatus: string; t: (key: string) => string; language: string }) {
  const currentIndex = repairSteps.findIndex(step => step.id === currentStatus);
  
  return (
    <div className="py-6" data-testid="repair-timeline">
      <h4 className="font-semibold mb-4 text-center">{language === 'ar' ? 'مراحل الصيانة' : 'Repair Progress'}</h4>
      <div className="relative">
        <div className="flex justify-between items-start">
          {repairSteps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index <= currentIndex;
            const isCurrent = index === currentIndex;
            
            return (
              <div key={step.id} className="flex flex-col items-center flex-1 relative z-10">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted 
                      ? isCurrent 
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/30 animate-pulse' 
                        : 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  data-testid={`timeline-step-${step.id}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-xs mt-2 text-center max-w-[70px] leading-tight ${
                  isCompleted ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}>
                  {t(`repair.status.${step.id}`)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted -z-0 mx-8">
          <div 
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${(currentIndex / (repairSteps.length - 1)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function TicketBarcode({ ticketNumber }: { ticketNumber: string }) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  
  useEffect(() => {
    if (barcodeRef.current && ticketNumber) {
      try {
        JsBarcode(barcodeRef.current, ticketNumber, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 14,
          margin: 10,
          background: 'transparent',
        });
      } catch (error) {
        console.error('Barcode generation error:', error);
      }
    }
  }, [ticketNumber]);
  
  return (
    <div className="flex justify-center py-4 bg-white rounded-lg" data-testid="ticket-barcode">
      <svg ref={barcodeRef} />
    </div>
  );
}

export default function TrackRepair() {
  const { t, language, setLanguage } = useLanguage();
  const [location] = useLocation();
  const barcodeRef = useRef<SVGSVGElement>(null);
  
  const formatDate = (dateValue: string | Date) => {
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    return date.toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const [phoneNumber, setPhoneNumber] = useState('');
  const [ticket, setTicket] = useState<RepairTicket | null>(null);

  // Auto-search if ticket parameter is in URL and set language from URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Set language to Arabic if lang=ar is in URL (from QR code scan)
    const langParam = params.get('lang');
    if (langParam === 'ar' || langParam === 'en') {
      setLanguage(langParam);
    }
    
    const ticketParam = params.get('ticket');
    if (ticketParam && !phoneNumber && !ticket) {
      // Search by ticket number
      searchMutation.mutate(ticketParam);
    }
  }, []);

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      // Try ticket number search first (if it starts with TKT-)
      if (query.startsWith('TKT-') || query.startsWith('REP-')) {
        const res = await fetch(`/api/repair-tickets/lookup/${encodeURIComponent(query)}`);
        if (res.ok) {
          return res.json();
        }
      }
      // Otherwise search by phone
      const res = await fetch(`/api/repair-tickets/lookup/phone/${encodeURIComponent(query)}`);
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
    if (phoneNumber.trim()) {
      searchMutation.mutate(phoneNumber.trim());
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
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder={t('repair.lookup.phonePlaceholder')}
                data-testid="input-phone-number"
              />
              <Button type="submit" disabled={searchMutation.isPending} data-testid="button-search-repair">
                {searchMutation.isPending ? t('repair.lookup.searching') : t('repair.lookup.search')}
              </Button>
            </form>

            {searchMutation.isError && (
              <div className="text-destructive text-center py-4" data-testid="text-not-found">
                {t('repair.lookup.notFound')}
              </div>
            )}

            {ticket && (
              <div className="space-y-6 border-t pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg" data-testid="text-ticket-number-result">{ticket.ticketNumber}</h3>
                    <p className="text-muted-foreground">{ticket.customerName}</p>
                  </div>
                  <Badge className={getStatusColor(ticket.status)}>
                    {t(`repair.status.${ticket.status}`)}
                  </Badge>
                </div>

                <TicketBarcode ticketNumber={ticket.ticketNumber} />

                <RepairTimeline currentStatus={ticket.status} t={t} language={language} />

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
                    <p className="font-medium">{formatDate(ticket.createdAt)}</p>
                  </div>
                  {ticket.estimatedCompletion && (
                    <div>
                      <Label className="text-muted-foreground">{t('repair.ticket.estimatedCompletion')}</Label>
                      <p className="font-medium">{formatDate(ticket.estimatedCompletion)}</p>
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
