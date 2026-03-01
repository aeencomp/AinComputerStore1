import { useState, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import type { RepairTicket, RepairCustomer } from '@shared/schema';
import { Trash2, Printer, AlertTriangle, LayoutList } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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

interface TicketDetailDialogProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TicketDetailDialog({ ticketId, open, onOpenChange }: TicketDetailDialogProps) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isRTL = language === 'ar';
  const printRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [barcodeReady, setBarcodeReady] = useState(false);

  const { data: ticket, isLoading } = useQuery<RepairTicket>({
    queryKey: ['/api/repair-tickets', ticketId],
    enabled: !!ticketId && open,
  });

  const { data: ticketCustomer } = useQuery<RepairCustomer>({
    queryKey: ['/api/repair-customers', ticket?.repairCustomerId],
    queryFn: async () => {
      const res = await fetch(`/api/repair-customers/${ticket!.repairCustomerId}`);
      if (!res.ok) throw new Error('not found');
      return res.json();
    },
    enabled: !!ticket?.repairCustomerId && open,
  });

  const { data: dialogActiveTickets = [] } = useQuery<RepairTicket[]>({
    queryKey: ['/api/repair-customers', ticketCustomer?.id, 'active-tickets'],
    queryFn: async () => {
      const res = await fetch(`/api/repair-customers/${ticketCustomer!.id}/active-tickets`);
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    enabled: !!ticketCustomer?.id && open,
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
      status: 'pending',
      priority: 'normal',
      technicianNotes: '',
      estimatedCompletion: '',
      costEstimate: '',
      finalCost: '',
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

  useEffect(() => {
    setBarcodeReady(false);
  }, [ticketId]);

  useEffect(() => {
    if (ticket && barcodeRef.current && open) {
      requestAnimationFrame(() => {
        if (barcodeRef.current) {
          try {
            JsBarcode(barcodeRef.current, ticket.ticketNumber, {
              format: 'CODE128',
              width: 1.5,
              height: 35,
              displayValue: false,
              margin: 1,
              background: '#ffffff',
            });
            setBarcodeReady(true);
          } catch (error) {
            console.error('Barcode generation error:', error);
          }
        }
      });
    }
  }, [ticket, open]);

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof updateSchema>) => {
      if (!ticketId) throw new Error('No ticket ID');
      return await apiRequest('PATCH', `/api/admin/repair-tickets/${ticketId}`, {
        ...data,
        estimatedCompletion: data.estimatedCompletion ? new Date(data.estimatedCompletion).toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets', ticketId] });
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
      if (!ticketId) throw new Error('No ticket ID');
      return await apiRequest('DELETE', `/api/admin/repair-tickets/${ticketId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets'] });
      toast({
        title: t('repair.delete.successTitle'),
        description: t('repair.delete.successMessage'),
      });
      onOpenChange(false);
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

  const handlePrint = () => {
    if (printRef.current && ticket) {
      const printContents = printRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${isRTL ? 'بطاقة الصيانة' : 'Repair Label'}</title>
            <style>
              @page { size: 50mm 25mm; margin: 0; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { width: 50mm; height: 25mm; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: Arial, sans-serif; background: #fff; padding: 1.5mm 2mm; }
              .store-name { font-size: 8pt; font-weight: 900; text-align: center; letter-spacing: 0.3px; }
              .barcode-container { text-align: center; margin: 1mm 0; }
              .barcode-container svg { max-width: 44mm; height: 10mm; }
              .serial { font-size: 9pt; font-weight: 800; text-align: center; letter-spacing: 0.5px; }
            </style>
          </head>
          <body>${printContents}</body>
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

  const handlePrintSummary = () => {
    if (!ticketCustomer || dialogActiveTickets.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const statusMap: Record<string,string> = {
      pending: isRTL ? 'قيد الانتظار' : 'Pending',
      'in-progress': isRTL ? 'جاري العمل' : 'In Progress',
      'waiting-parts': isRTL ? 'انتظار قطع' : 'Waiting Parts',
      completed: isRTL ? 'مكتمل' : 'Completed',
      delivered: isRTL ? 'مسلم' : 'Delivered',
      rejected: isRTL ? 'مرفوض' : 'Rejected',
      unrepairable: isRTL ? 'لا يمكن إصلاحه' : 'Unrepairable',
    };
    const typeMap: Record<string,string> = { laptop: isRTL ? 'لابتوب' : 'Laptop', desktop: isRTL ? 'كمبيوتر مكتبي' : 'Desktop', monitor: isRTL ? 'شاشة' : 'Monitor', printer: isRTL ? 'طابعة' : 'Printer', other: isRTL ? 'أخرى' : 'Other' };
    const deviceSections = dialogActiveTickets.map((t, i) => `
      <div class="device-section">
        <div class="device-header">${isRTL ? `الجهاز ${i + 1}` : `Device ${i + 1}`}</div>
        <div class="device-ticket">${t.ticketNumber}</div>
        <div class="device-info-row"><span class="lbl">${isRTL ? 'الجهاز:' : 'Device:'}</span><span>${t.deviceBrand} ${t.deviceModel}</span></div>
        <div class="device-info-row"><span class="lbl">${isRTL ? 'النوع:' : 'Type:'}</span><span>${typeMap[t.deviceType] || t.deviceType}</span></div>
        <div class="device-info-row"><span class="lbl">${isRTL ? 'الحالة:' : 'Status:'}</span><span style="font-weight:900;">${statusMap[t.status] || t.status}</span></div>
        ${t.costEstimate ? `<div class="device-info-row"><span class="lbl">${isRTL ? 'التكلفة:' : 'Cost:'}</span><span style="font-weight:900;">${Number(t.costEstimate).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${isRTL ? 'د.ع' : 'IQD'}</span></div>` : ''}
        ${t.issueDescriptionAr || t.issueDescriptionEn ? `<div class="device-issue"><span class="lbl">${isRTL ? 'المشكلة:' : 'Issue:'}</span> ${t.issueDescriptionAr || t.issueDescriptionEn}</div>` : ''}
      </div>
    `).join('<div class="divider"></div>');
    printWindow.document.write(`<!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}"><head>
        <title>${isRTL ? 'ملخص طلبات العميل' : 'Customer Repairs Summary'}</title>
        <style>
          @page { size: 72.1mm auto; margin: 2mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 12px; font-weight: 600; width: 68mm; padding: 3mm; direction: ${isRTL ? 'rtl' : 'ltr'}; color: #000; line-height: 1.5; }
          .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
          .store-name { font-size: 17px; font-weight: 900; }
          .store-info { font-size: 10px; font-weight: 700; }
          .summary-title { text-align: center; font-size: 14px; font-weight: 900; margin: 8px 0; padding: 5px; background: #e0e0e0; border: 1px solid #000; border-radius: 3px; }
          .customer-block { margin: 8px 0; padding: 8px; background: #f5f5f5; border: 1px solid #ccc; border-radius: 3px; }
          .customer-id { font-size: 18px; font-weight: 900; font-family: monospace; text-align: center; margin-bottom: 4px; }
          .customer-row { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin: 3px 0; }
          .total-badge { text-align: center; font-size: 13px; font-weight: 900; margin: 6px 0; padding: 4px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 4px; color: #856404; }
          .device-section { margin: 8px 0; }
          .device-header { font-size: 13px; font-weight: 900; text-decoration: underline; margin-bottom: 4px; }
          .device-ticket { font-size: 16px; font-weight: 900; letter-spacing: 0.5px; margin: 4px 0; }
          .device-info-row { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin: 3px 0; }
          .lbl { font-weight: 900; }
          .device-issue { font-size: 10px; font-weight: 600; margin-top: 4px; padding: 4px; background: #f0f0f0; border-radius: 3px; }
          .divider { border-top: 2px dashed #666; margin: 8px 0; }
          .footer { text-align: center; margin-top: 10px; padding-top: 8px; border-top: 3px solid #000; font-size: 11px; font-weight: 900; }
          .keep-note { text-align: center; margin-top: 6px; padding: 5px; background: #d4edda; border: 1px solid #28a745; border-radius: 3px; font-size: 10px; font-weight: 700; }
        </style>
      </head><body>
        <div class="header">
          <div class="store-name">${isRTL ? 'العين لتجارة الحاسبات' : 'Al-Ain Computer Trading'}</div>
          <div class="store-info">${isRTL ? 'كربلاء — العراق' : 'Karbala — Iraq'} | 07850006977</div>
        </div>
        <div class="summary-title">${isRTL ? 'ملف طلبات الصيانة' : 'Repair Summary Sheet'}</div>
        <div class="customer-block">
          <div class="customer-id">${ticketCustomer.customerId}</div>
          <div class="customer-row"><span class="lbl">${isRTL ? 'الاسم:' : 'Name:'}</span><span>${ticketCustomer.name}</span></div>
          <div class="customer-row"><span class="lbl">${isRTL ? 'الهاتف:' : 'Phone:'}</span><span dir="ltr">${ticketCustomer.phone}</span></div>
          <div class="customer-row"><span class="lbl">${isRTL ? 'التاريخ:' : 'Date:'}</span><span>${new Date().toLocaleDateString(isRTL ? 'ar-IQ' : 'en-US')}</span></div>
        </div>
        <div class="total-badge">${isRTL ? `إجمالي الطلبات النشطة: ${dialogActiveTickets.length}` : `Total Active Repairs: ${dialogActiveTickets.length}`}</div>
        ${deviceSections}
        <div class="keep-note">${isRTL ? 'احتفظ بهذه الورقة لاستلام جميع أجهزتك' : 'Keep this sheet to collect all your devices'}</div>
        <div class="footer">${isRTL ? 'شكراً لثقتكم بنا' : 'Thank you for trusting us'}</div>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
      case 'in-progress': return 'bg-blue-500/20 text-blue-700 dark:text-blue-400';
      case 'waiting-parts': return 'bg-orange-500/20 text-orange-700 dark:text-orange-400';
      case 'completed': return 'bg-green-500/20 text-green-700 dark:text-green-400';
      case 'delivered': return 'bg-gray-500/20 text-gray-700 dark:text-gray-400';
      case 'rejected': return 'bg-red-500/20 text-red-700 dark:text-red-400';
      case 'unrepairable': return 'bg-red-500/20 text-red-700 dark:text-red-400';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-ticket-detail">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            {ticket ? (
              <>
                <span data-testid="text-dialog-ticket-number">{ticket.ticketNumber}</span>
                <Badge className={getStatusColor(ticket.status)}>
                  {t(`repair.status.${ticket.status}`)}
                </Badge>
              </>
            ) : (
              <span>{t('common.loading')}</span>
            )}
          </DialogTitle>
          <DialogDescription>{t('repair.ticket.details')}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground" data-testid="text-dialog-loading">
            {t('common.loading')}
          </div>
        ) : ticket ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground text-xs">{t('repair.ticket.customerName')}</Label>
                <p className="font-medium" data-testid="text-dialog-customer-name">{ticket.customerName}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">{t('repair.ticket.customerPhone')}</Label>
                <p className="font-medium" data-testid="text-dialog-customer-phone">{ticket.customerPhone}</p>
              </div>
              {ticket.customerEmail && (
                <div>
                  <Label className="text-muted-foreground text-xs">{t('repair.ticket.customerEmail')}</Label>
                  <p className="font-medium">{ticket.customerEmail}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground text-xs">{t('repair.ticket.deviceType')}</Label>
                <p className="font-medium">{t(`repair.deviceType.${ticket.deviceType}`)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">{t('repair.ticket.deviceBrand')}</Label>
                <p className="font-medium">{ticket.deviceBrand}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">{t('repair.ticket.deviceModel')}</Label>
                <p className="font-medium">{ticket.deviceModel}</p>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">{t('repair.ticket.issueDescription')}</Label>
              <p className="mt-1 text-sm">{ticket.issueDescriptionAr || ticket.issueDescriptionEn}</p>
            </div>

            <div className="border-t pt-4">
              {dialogActiveTickets.length > 1 && ticketCustomer && (
                <div className="flex gap-2 p-3 mb-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700" data-testid="banner-dialog-multi-device">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                      {isRTL
                        ? `${ticketCustomer.customerId} لديه ${dialogActiveTickets.length} طلبات نشطة في نفس الوقت`
                        : `${ticketCustomer.customerId} has ${dialogActiveTickets.length} active repairs simultaneously`}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {dialogActiveTickets.filter(t => t.id !== ticket.id).map(t => (
                        <Badge key={t.id} variant="outline" className="text-xs font-mono border-amber-400 text-amber-800 dark:text-amber-300">
                          {t.ticketNumber}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="font-semibold text-sm">{isRTL ? 'بطاقة الصيانة' : 'Repair Label'}</h3>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={handlePrint} className="gap-2" disabled={!barcodeReady} data-testid="button-dialog-print-label">
                    <Printer className="h-4 w-4" />
                    {barcodeReady ? (isRTL ? 'طباعة' : 'Print') : (isRTL ? 'جاري التحميل...' : 'Loading...')}
                  </Button>
                  {dialogActiveTickets.length > 1 && (
                    <Button size="sm" variant="secondary" onClick={handlePrintSummary} className="gap-2" data-testid="button-dialog-print-summary">
                      <LayoutList className="h-4 w-4" />
                      {isRTL ? `ملخص (${dialogActiveTickets.length})` : `Summary (${dialogActiveTickets.length})`}
                    </Button>
                  )}
                </div>
              </div>
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-md p-3 bg-white">
                <div ref={printRef} data-testid="dialog-print-label">
                  <div className="store-name" style={{ textAlign: 'center', fontWeight: 900, fontSize: '11px', letterSpacing: '0.3px' }}>
                    العين لتجارة الحاسبات
                  </div>
                  <div className="barcode-container" style={{ textAlign: 'center', margin: '4px 0' }}>
                    <svg ref={barcodeRef} />
                  </div>
                  <div className="serial" style={{ textAlign: 'center', fontWeight: 800, fontSize: '12px', letterSpacing: '0.5px' }}>
                    {ticket.ticketNumber}
                  </div>
                  {ticketCustomer && (
                    <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '9px', letterSpacing: '0.3px', marginTop: '1px' }}>
                      {ticketCustomer.customerId} — {ticket.customerName}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold text-sm mb-3">{t('repair.edit.title')}</h3>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('repair.ticket.status')}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="dialog-select-status">
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
                              <SelectItem value="unrepairable">{t('repair.status.unrepairable')}</SelectItem>
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
                              <SelectTrigger data-testid="dialog-select-priority">
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
                            <Input type="date" {...field} data-testid="dialog-input-estimated-completion" />
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
                            <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="dialog-input-cost-estimate" />
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
                            <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="dialog-input-final-cost" />
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
                            rows={3}
                            {...field}
                            lang="ar"
                            dir="auto"
                            spellCheck={true}
                            autoCorrect="on"
                            autoCapitalize="sentences"
                            data-testid="dialog-textarea-technician-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center gap-4 justify-between flex-wrap">
                    <Button type="submit" disabled={updateMutation.isPending} data-testid="button-dialog-save-ticket">
                      {updateMutation.isPending ? t('repair.edit.saving') : t('repair.edit.save')}
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          type="button" 
                          variant="destructive" 
                          disabled={deleteMutation.isPending}
                          data-testid="button-dialog-delete-ticket"
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
                          <AlertDialogCancel data-testid="button-dialog-cancel-delete">
                            {t('repair.delete.cancel')}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate()}
                            className="bg-destructive text-destructive-foreground"
                            data-testid="button-dialog-confirm-delete"
                          >
                            {t('repair.delete.confirm')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        ) : !isLoading ? (
          <div className="py-8 text-center text-muted-foreground" data-testid="text-dialog-not-found">
            {t('repair.lookup.notFound')}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
