import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import type { RepairTicket } from '@shared/schema';
import { ArrowLeft, Trash2, Printer } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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

export default function TicketDetail() {
  const [, params] = useRoute('/technician/tickets/:id');
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isRTL = language === 'ar';
  const printRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [barcodeReady, setBarcodeReady] = useState(false);

  const { data: currentTechnician, isLoading: isAuthLoading, error: authError } = useQuery<Technician>({
    queryKey: ['/api/technician/auth/me'],
    retry: false,
  });

  useEffect(() => {
    if (authError || (!isAuthLoading && !currentTechnician)) {
      setLocation('/technician/login');
    }
  }, [authError, isAuthLoading, currentTechnician, setLocation]);

  const { data: ticket, isLoading } = useQuery<RepairTicket>({
    queryKey: ['/api/repair-tickets', params?.id],
    enabled: !!params?.id,
  });

  const updateSchema = useMemo(() => z.object({
    status: z.string(),
    priority: z.string(),
    technicianNotes: z.string().optional(),
    estimatedCompletion: z.string().optional(),
    costEstimate: z.string().optional(),
    finalCost: z.string().optional(),
  }), []);

  const form = useForm<z.infer<typeof updateSchema>>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      status: ticket?.status || 'pending',
      priority: ticket?.priority || 'normal',
      technicianNotes: ticket?.technicianNotes || '',
      estimatedCompletion: ticket?.estimatedCompletion ? format(new Date(ticket.estimatedCompletion), 'yyyy-MM-dd') : '',
      costEstimate: ticket?.costEstimate || '',
      finalCost: ticket?.finalCost || '',
    },
  });

  useEffect(() => {
    if (ticket) {
      form.reset({
        status: ticket.status,
        priority: ticket.priority,
        technicianNotes: ticket.technicianNotes || '',
        estimatedCompletion: ticket.estimatedCompletion ? format(new Date(ticket.estimatedCompletion), 'yyyy-MM-dd') : '',
        costEstimate: ticket.costEstimate || '',
        finalCost: ticket.finalCost || '',
      });
    }
  }, [ticket, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof updateSchema>) => {
      if (!params?.id) throw new Error('No ticket ID');
      return await apiRequest('PATCH', `/api/admin/repair-tickets/${params.id}`, {
        ...data,
        estimatedCompletion: data.estimatedCompletion ? new Date(data.estimatedCompletion).toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets', params?.id] });
      toast({
        title: t('repair.edit.successTitle'),
        description: t('repair.edit.successMessage'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('repair.edit.errorMessage'),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!params?.id) throw new Error('No ticket ID');
      return await apiRequest('DELETE', `/api/admin/repair-tickets/${params.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets'] });
      toast({
        title: t('repair.delete.successTitle'),
        description: t('repair.delete.successMessage'),
      });
      setLocation('/technician/dashboard');
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('repair.delete.errorMessage'),
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: z.infer<typeof updateSchema>) => {
    updateMutation.mutate(data);
  };

  useEffect(() => {
    if (ticket && barcodeRef.current) {
      requestAnimationFrame(() => {
        if (barcodeRef.current) {
          try {
            JsBarcode(barcodeRef.current, ticket.ticketNumber, {
              format: 'CODE128',
              width: 1.5,
              height: 40,
              displayValue: true,
              fontSize: 12,
              margin: 5,
              background: '#ffffff',
            });
            setBarcodeReady(true);
          } catch (error) {
            console.error('Barcode generation error:', error);
          }
        }
      });
    }
  }, [ticket]);

  const handlePrint = () => {
    if (printRef.current && ticket) {
      const printContents = printRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html dir="${isRTL ? 'rtl' : 'ltr'}">
          <head>
            <title>${isRTL ? 'بطاقة الصيانة' : 'Repair Label'}</title>
            <style>
              @page { 
                size: 80mm 60mm; 
                margin: 2mm; 
              }
              body { 
                font-family: Arial, sans-serif; 
                font-size: 10px; 
                margin: 0; 
                padding: 4px;
                direction: ${isRTL ? 'rtl' : 'ltr'};
              }
              .label-container {
                border: 1px solid #000;
                padding: 4px;
                max-width: 76mm;
              }
              .ticket-number {
                font-size: 14px;
                font-weight: bold;
                text-align: center;
                margin-bottom: 4px;
              }
              .barcode-container {
                text-align: center;
                margin: 4px 0;
              }
              .barcode-container svg {
                max-width: 100%;
                height: 35px;
              }
              .info-row {
                display: flex;
                justify-content: space-between;
                margin: 2px 0;
                font-size: 9px;
              }
              .info-label {
                font-weight: bold;
              }
              .problem-section {
                margin-top: 4px;
                padding-top: 4px;
                border-top: 1px dashed #000;
              }
              .problem-title {
                font-weight: bold;
                font-size: 9px;
              }
              .problem-text {
                font-size: 8px;
                margin-top: 2px;
                max-height: 30px;
                overflow: hidden;
              }
              .store-name {
                text-align: center;
                font-size: 11px;
                font-weight: bold;
                margin-bottom: 2px;
              }
            </style>
          </head>
          <body>
            ${printContents}
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (!currentTechnician) {
    return null;
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t('repair.lookup.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => setLocation('/technician/dashboard')} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            {t('common.back') || 'Back'}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-ticket-number">{ticket.ticketNumber}</CardTitle>
            <CardDescription>{t('repair.ticket.details')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">{t('repair.ticket.customerName')}</Label>
                <p className="font-medium" data-testid="text-customer-name">{ticket.customerName}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">{t('repair.ticket.customerPhone')}</Label>
                <p className="font-medium" data-testid="text-customer-phone">{ticket.customerPhone}</p>
              </div>
              {ticket.customerEmail && (
                <div>
                  <Label className="text-muted-foreground">{t('repair.ticket.customerEmail')}</Label>
                  <p className="font-medium" data-testid="text-customer-email">{ticket.customerEmail}</p>
                </div>
              )}
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
            </div>
            <div>
              <Label className="text-muted-foreground">{t('repair.ticket.issueDescription')}</Label>
              <p className="mt-2">{ticket.issueDescriptionAr || ticket.issueDescriptionEn}</p>
            </div>
          </CardContent>
        </Card>

        {/* Printable Label Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{isRTL ? 'بطاقة الصيانة' : 'Repair Label'}</CardTitle>
              <CardDescription>{isRTL ? 'اطبع البطاقة لتعليقها على الجهاز' : 'Print label to attach to device'}</CardDescription>
            </div>
            <Button onClick={handlePrint} className="gap-2" disabled={!barcodeReady} data-testid="button-print-label">
              <Printer className="h-4 w-4" />
              {barcodeReady ? (isRTL ? 'طباعة' : 'Print') : (isRTL ? 'جاري التحميل...' : 'Loading...')}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 bg-white">
              <div ref={printRef} data-testid="print-label">
                <div style={{ border: '1px solid #000', padding: '8px', maxWidth: '300px', margin: '0 auto' }}>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                    {isRTL ? 'العين لتجارة الحاسبات' : 'Al-Ain Computer Trading'}
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
                    {ticket.ticketNumber}
                  </div>
                  <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                    <svg ref={barcodeRef} />
                  </div>
                  <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 'bold' }}>{isRTL ? 'الاسم:' : 'Name:'}</span>
                      <span>{ticket.customerName}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 'bold' }}>{isRTL ? 'الهاتف:' : 'Phone:'}</span>
                      <span dir="ltr">{ticket.customerPhone}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 'bold' }}>{isRTL ? 'الجهاز:' : 'Device:'}</span>
                      <span>{ticket.deviceBrand} {ticket.deviceModel}</span>
                    </div>
                    <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #000' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{isRTL ? 'المشكلة:' : 'Problem:'}</div>
                      <div style={{ fontSize: '10px' }}>
                        {ticket.issueDescriptionAr || ticket.issueDescriptionEn}
                      </div>
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '9px', textAlign: 'center', color: '#666' }}>
                      {new Date(ticket.createdAt).toLocaleDateString(isRTL ? 'ar-IQ' : 'en-US')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('repair.edit.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('repair.ticket.status')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">{t('repair.status.pending')}</SelectItem>
                            <SelectItem value="in-progress">{t('repair.status.in-progress')}</SelectItem>
                            <SelectItem value="waiting-parts">{t('repair.status.waiting-parts')}</SelectItem>
                            <SelectItem value="completed">{t('repair.status.completed')}</SelectItem>
                            <SelectItem value="delivered">{t('repair.status.delivered')}</SelectItem>
                            <SelectItem value="rejected">{t('repair.status.rejected')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('repair.ticket.priority')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-priority">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">{t('repair.priority.low')}</SelectItem>
                            <SelectItem value="normal">{t('repair.priority.normal')}</SelectItem>
                            <SelectItem value="high">{t('repair.priority.high')}</SelectItem>
                            <SelectItem value="urgent">{t('repair.priority.urgent')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="estimatedCompletion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('repair.ticket.estimatedCompletion')}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-estimated-completion" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="costEstimate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('repair.ticket.costEstimate')}</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-cost-estimate" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="finalCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('repair.ticket.finalCost')}</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-final-cost" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="technicianNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('repair.ticket.technicianNotes')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('repair.edit.addNotes') || 'Add notes...'}
                          rows={4}
                          {...field}
                          data-testid="textarea-technician-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center gap-4 justify-between">
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-ticket">
                    {updateMutation.isPending ? t('repair.edit.saving') : t('repair.edit.save')}
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        type="button" 
                        variant="destructive" 
                        disabled={deleteMutation.isPending}
                        data-testid="button-delete-ticket"
                      >
                        <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                        {deleteMutation.isPending ? t('repair.delete.deleting') : t('repair.delete.button')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('repair.delete.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('repair.delete.description')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-delete">
                          {t('repair.delete.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          data-testid="button-confirm-delete"
                        >
                          {t('repair.delete.confirm')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
