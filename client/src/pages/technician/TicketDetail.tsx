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
import type { RepairTicket, RepairCustomer } from '@shared/schema';
import { ArrowLeft, Trash2, Printer, Lock, Banknote, CreditCard, Split } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPosPaymentLabel } from '@/lib/posPayment';
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

interface TicketStatusHistoryRow {
  id: number;
  ticketId: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
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
  const prevStatusRef = useRef<string>('');

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

  const { data: statusHistory = [] } = useQuery<TicketStatusHistoryRow[]>({
    queryKey: ['/api/repair-tickets', params?.id, 'status-history'],
    queryFn: async () => {
      const res = await fetch(`/api/repair-tickets/${params!.id}/status-history`, { credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    enabled: !!params?.id,
  });

  const { data: ticketCustomer } = useQuery<RepairCustomer>({
    queryKey: ['/api/repair-customers', ticket?.repairCustomerId],
    queryFn: async () => {
      const res = await fetch(`/api/repair-customers/${ticket!.repairCustomerId}`);
      if (!res.ok) throw new Error('not found');
      return res.json();
    },
    enabled: !!ticket?.repairCustomerId,
  });

  const updateSchema = useMemo(() => z.object({
    status: z.string(),
    priority: z.string(),
    technicianNotes: z.string().optional(),
    estimatedCompletion: z.string().optional(),
    costEstimate: z.string().optional(),
    finalCost: z.string().optional(),
    paymentStatus: z.string().optional(),
    paymentMethod: z.string().optional(),
    cashPaidAmount: z.string().optional(),
    cardPaidAmount: z.string().optional(),
  }), []);

  const cleanPrice = (v: string | null | undefined) => v ? String(parseFloat(v)) : '';

  const form = useForm<z.infer<typeof updateSchema>>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      status: ticket?.status || 'pending',
      priority: ticket?.priority || 'normal',
      technicianNotes: ticket?.technicianNotes || '',
      estimatedCompletion: ticket?.estimatedCompletion ? format(new Date(ticket.estimatedCompletion), 'yyyy-MM-dd') : '',
      costEstimate: cleanPrice(ticket?.costEstimate),
      finalCost: cleanPrice(ticket?.finalCost),
      paymentStatus: ticket?.paymentStatus || 'unpaid',
      paymentMethod: (ticket as any)?.paymentMethod || 'cash',
      cashPaidAmount: cleanPrice((ticket as any)?.cashPaidAmount),
      cardPaidAmount: cleanPrice((ticket as any)?.cardPaidAmount),
    },
  });

  useEffect(() => {
    if (ticket) {
      prevStatusRef.current = ticket.priority;
      form.reset({
        status: ticket.status,
        priority: ticket.priority,
        technicianNotes: ticket.technicianNotes || '',
        estimatedCompletion: ticket.estimatedCompletion ? format(new Date(ticket.estimatedCompletion), 'yyyy-MM-dd') : '',
        costEstimate: cleanPrice(ticket.costEstimate),
        finalCost: cleanPrice(ticket.finalCost),
        paymentStatus: ticket.paymentStatus || 'unpaid',
        paymentMethod: (ticket as any).paymentMethod || 'cash',
        cashPaidAmount: cleanPrice((ticket as any).cashPaidAmount),
        cardPaidAmount: cleanPrice((ticket as any).cardPaidAmount),
      });
    }
  }, [ticket, form]);

  // Ticket is immutable once delivered with a final payment (paid or deferred)
  const isLocked = !!ticket &&
    ticket.status === 'delivered' &&
    (ticket.paymentStatus === 'paid' || ticket.paymentStatus === 'deferred');

  const watchedPriority = form.watch('priority');
  const watchedPaymentStatus = form.watch('paymentStatus');
  const watchedPaymentMethod = form.watch('paymentMethod');
  const watchedFinalCost = form.watch('finalCost');
  const watchedSplitCash = form.watch('cashPaidAmount');
  const watchedSplitCard = form.watch('cardPaidAmount');

  const repairPayTotal = parseFloat(watchedFinalCost || '0') || 0;
  const splitPaidTotal =
    (parseFloat(watchedSplitCash || '0') || 0) + (parseFloat(watchedSplitCard || '0') || 0);
  const splitRemaining = repairPayTotal - splitPaidTotal;

  const selectRepairPaymentMethod = (value: string) => {
    form.setValue('paymentMethod', value);
    if (value === 'split') {
      const cash = form.getValues('cashPaidAmount');
      const card = form.getValues('cardPaidAmount');
      if (!cash && !card) {
        form.setValue('cashPaidAmount', String(Math.round(repairPayTotal)));
        form.setValue('cardPaidAmount', '0');
      }
    } else {
      form.setValue('cashPaidAmount', '');
      form.setValue('cardPaidAmount', '');
    }
  };
  useEffect(() => {
    const prev = prevStatusRef.current;
    const current = watchedPriority;
    if (!prev || prev === current) return;
    if (current === 'vip' && prev !== 'vip') {
      const cur = parseFloat(form.getValues('finalCost') || '0') || 0;
      form.setValue('finalCost', String(cur + 25000));
    } else if (prev === 'vip' && current !== 'vip') {
      const cur = parseFloat(form.getValues('finalCost') || '0') || 0;
      form.setValue('finalCost', String(Math.max(0, cur - 25000)));
    }
    prevStatusRef.current = current;
  }, [watchedPriority, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof updateSchema>) => {
      if (!params?.id) throw new Error('No ticket ID');
      const res = await apiRequest('PATCH', `/api/admin/repair-tickets/${params.id}`, {
        ...data,
        estimatedCompletion: data.estimatedCompletion ? new Date(data.estimatedCompletion).toISOString() : null,
      });
      return res.json();
    },
    onSuccess: (response: any) => {
      // Immediately push the fresh ticket into the cache so isLocked re-evaluates
      // right now instead of waiting for a background refetch to complete.
      if (response && params?.id) {
        const { _whatsappStatus, ...freshTicket } = response;
        queryClient.setQueryData(['/api/repair-tickets', params.id], freshTicket);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets'] });
      toast({
        title: t('repair.edit.successTitle'),
        description: t('repair.edit.successMessage'),
      });
      if (response?._whatsappStatus === 'sent') {
        toast({
          title: isRTL ? 'تم إرسال رسالة واتساب' : 'WhatsApp Message Sent',
          description: isRTL
            ? 'تم إشعار العميل بتحديث حالة التذكرة عبر واتساب'
            : 'Customer was notified about the ticket status update via WhatsApp',
        });
      } else if (response?._whatsappStatus?.startsWith('failed')) {
        toast({
          title: isRTL ? 'فشل إرسال واتساب' : 'WhatsApp Not Sent',
          description: isRTL
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
    if (data.paymentMethod === 'split' && data.paymentStatus === 'paid') {
      const cash = parseFloat(data.cashPaidAmount || '0') || 0;
      const card = parseFloat(data.cardPaidAmount || '0') || 0;
      const amount = parseFloat(data.finalCost || '0') || 0;
      if (cash <= 0 || card <= 0) {
        toast({
          title: isRTL ? 'مبالغ الدفع' : 'Payment amounts',
          description: isRTL ? 'أدخل مبلغ النقد ومبلغ البطاقة' : 'Enter both cash and card amounts',
          variant: 'destructive',
        });
        return;
      }
      if (amount <= 0) {
        toast({
          title: isRTL ? 'التكلفة النهائية' : 'Final cost',
          description: isRTL ? 'أدخل التكلفة النهائية أولاً' : 'Enter final cost first',
          variant: 'destructive',
        });
        return;
      }
      if (Math.abs(cash + card - amount) > 0.5) {
        toast({
          title: isRTL ? 'مجموع غير صحيح' : 'Invalid total',
          description: isRTL
            ? 'مجموع النقد والبطاقة يجب أن يساوي التكلفة النهائية'
            : 'Cash + card must equal final cost',
          variant: 'destructive',
        });
        return;
      }
    }
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
  }, [ticket]);

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
              @page { size: 50mm 30mm; margin: 0; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { width: 50mm; min-height: 30mm; height: auto; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: Arial, sans-serif; background: #fff; padding: 1.5mm 2mm; }
              .store-name { font-size: 8pt; font-weight: 900; text-align: center; letter-spacing: 0.3px; }
              .barcode-container { text-align: center; margin: 1mm 0; }
              .barcode-container svg { max-width: 44mm; height: 10mm; }
              .serial { font-size: 9pt; font-weight: 800; text-align: center; letter-spacing: 0.5px; }
              .customer-info { font-size: 7pt; font-weight: 700; text-align: center; word-break: break-all; max-width: 46mm; margin-top: 0.5mm; line-height: 1.2; }
              .phone-info { font-size: 7pt; font-weight: 800; text-align: center; direction: ltr; margin-top: 0.5mm; letter-spacing: 0.3px; }
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

  const handlePrintReceipt = () => {
    if (!ticket) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const statusMap: Record<string, string> = {
      pending: isRTL ? 'قيد الانتظار' : 'Pending',
      'in-progress': isRTL ? 'جاري العمل' : 'In Progress',
      'waiting-parts': isRTL ? 'انتظار قطع' : 'Waiting Parts',
      completed: isRTL ? 'مكتمل' : 'Completed',
      delivered: isRTL ? 'مُسلَّم' : 'Delivered',
      rejected: isRTL ? 'مرفوض' : 'Rejected',
      unrepairable: isRTL ? 'لا يمكن إصلاحه' : 'Unrepairable',
    };
    const priorityMap: Record<string, string> = {
      low: isRTL ? 'منخفضة' : 'Low',
      normal: isRTL ? 'عادية' : 'Normal',
      high: isRTL ? 'عالية' : 'High',
      urgent: isRTL ? 'عاجلة' : 'Urgent',
      vip: 'VIP',
    };
    const paymentMap: Record<string, string> = {
      unpaid: isRTL ? 'غير مدفوع' : 'Unpaid',
      paid: isRTL ? 'مدفوع' : 'Paid',
      deferred: isRTL ? 'أجل' : 'Deferred',
    };
    const ticketPaymentLabel = formatPosPaymentLabel(
      {
        paymentMethod: (ticket as any).paymentMethod,
        paymentStatus: ticket.paymentStatus,
        finalCost: ticket.finalCost,
        costEstimate: ticket.costEstimate,
        cashPaidAmount: (ticket as any).cashPaidAmount,
        cardPaidAmount: (ticket as any).cardPaidAmount,
      },
      isRTL ? 'ar' : 'en',
    );
    const intakeAt = (ticket as any).receivedAt || ticket.createdAt;
    const intakeDate = format(new Date(intakeAt), 'dd/MM/yyyy');
    const intakeTime = format(new Date(intakeAt), 'HH:mm');
    const deliveryDate = ticket.deliveredAt
      ? format(new Date(ticket.deliveredAt), 'dd/MM/yyyy')
      : (isRTL ? 'لم يُسلَّم بعد' : 'Not delivered yet');

    printWindow.document.write(`<!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}"><head>
        <title>${isRTL ? 'وصل الصيانة' : 'Repair Receipt'}</title>
        <style>
          @page { size: 72.1mm auto; margin: 2mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 12px; font-weight: 600; width: 68mm; padding: 3mm; direction: ${isRTL ? 'rtl' : 'ltr'}; color: #000; line-height: 1.5; }
          .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
          .store-name { font-size: 17px; font-weight: 900; }
          .receipt-title { text-align: center; font-size: 14px; font-weight: 900; margin: 8px 0; padding: 5px; background: #e0e0e0; border: 1px solid #000; border-radius: 3px; }
          .ticket-number { font-size: 18px; font-weight: 900; font-family: monospace; text-align: center; margin: 8px 0; letter-spacing: 1px; }
          .section { margin: 8px 0; padding: 8px; background: #f5f5f5; border: 1px solid #ccc; border-radius: 3px; }
          .row { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin: 3px 0; }
          .lbl { font-weight: 900; }
          .date-row { display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; margin: 4px 0; padding: 4px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 3px; }
          .cost-row { display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; margin: 4px 0; padding: 5px; background: #d4edda; border: 2px solid #28a745; border-radius: 3px; color: #155724; }
          .notes { font-size: 10px; font-weight: 600; margin-top: 4px; padding: 5px; background: #f0f0f0; border-radius: 3px; }
          .footer { text-align: center; margin-top: 10px; padding-top: 8px; border-top: 3px solid #000; font-size: 11px; font-weight: 900; }
          .keep-note { text-align: center; margin-top: 6px; padding: 5px; background: #d4edda; border: 1px solid #28a745; border-radius: 3px; font-size: 10px; font-weight: 700; }
        </style>
      </head><body>
        <div class="header">
          <div class="store-name">العين لتجارة الحاسبات</div>
        </div>
        <div class="receipt-title">${isRTL ? 'وصل الصيانة' : 'Repair Receipt'}</div>
        <div class="ticket-number">${ticket.ticketNumber}</div>
        <div class="section">
          <div class="row"><span class="lbl">${isRTL ? 'الاسم:' : 'Name:'}</span><span>${ticket.customerName}</span></div>
          <div class="row"><span class="lbl">${isRTL ? 'الهاتف:' : 'Phone:'}</span><span dir="ltr">${ticket.customerPhone}</span></div>
          <div class="row"><span class="lbl">${isRTL ? 'الجهاز:' : 'Device:'}</span><span>${ticket.deviceBrand} ${ticket.deviceModel}</span></div>
          <div class="row"><span class="lbl">${isRTL ? 'المشكلة:' : 'Issue:'}</span><span style="max-width:60%;text-align:end;">${ticket.issueDescriptionAr || ticket.issueDescriptionEn || ''}</span></div>
          <div class="row"><span class="lbl">${isRTL ? 'الحالة:' : 'Status:'}</span><span style="font-weight:900;">${statusMap[ticket.status] || ticket.status}</span></div>
          <div class="row"><span class="lbl">${isRTL ? 'الأولوية:' : 'Priority:'}</span><span>${priorityMap[ticket.priority] || ticket.priority}</span></div>
          <div class="row"><span class="lbl">${isRTL ? 'الدفع:' : 'Payment:'}</span><span>${paymentMap[ticket.paymentStatus || 'unpaid'] || ticket.paymentStatus}${ticket.paymentStatus === 'paid' ? ` — ${ticketPaymentLabel}` : ''}</span></div>
        </div>
        <div class="date-row"><span class="lbl">${isRTL ? 'وقت الاستلام:' : 'Intake Time:'}</span><span>${intakeDate} — ${intakeTime}</span></div>
        <div class="date-row"><span class="lbl">${isRTL ? 'تاريخ التسليم:' : 'Delivery Date:'}</span><span>${deliveryDate}</span></div>
        ${ticket.finalCost ? `<div class="cost-row"><span class="lbl">${isRTL ? 'التكلفة النهائية:' : 'Final Cost:'}</span><span>${Number(ticket.finalCost).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${isRTL ? 'د.ع' : 'IQD'}</span></div>` : ticket.costEstimate ? `<div class="cost-row"><span class="lbl">${isRTL ? 'التكلفة التقديرية:' : 'Est. Cost:'}</span><span>${Number(ticket.costEstimate).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${isRTL ? 'د.ع' : 'IQD'}</span></div>` : ''}
        ${ticket.technicianNotes ? `<div class="notes"><span style="font-weight:900;">${isRTL ? 'ملاحظات:' : 'Notes:'}</span> ${ticket.technicianNotes}</div>` : ''}
        <div class="keep-note">${isRTL ? 'احتفظ بهذا الوصل لاستلام جهازك' : 'Keep this receipt to collect your device'}</div>
        <div class="footer">${isRTL ? 'شكراً لثقتكم بنا' : 'Thank you for trusting us'}</div>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
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
                <Label className="text-muted-foreground">{isRTL ? 'تاريخ الاستلام' : 'Intake Date'}</Label>
                <p className="font-medium" data-testid="text-intake-date">
                  {format(new Date((ticket as any).receivedAt || ticket.createdAt), 'dd/MM/yyyy HH:mm')}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">{isRTL ? 'تاريخ التسليم' : 'Delivery Date'}</Label>
                <p className="font-medium" data-testid="text-delivery-date">
                  {ticket.deliveredAt
                    ? format(new Date(ticket.deliveredAt), 'dd/MM/yyyy')
                    : <span className="text-muted-foreground text-sm">{isRTL ? 'لم يُسلَّم بعد' : 'Not delivered yet'}</span>
                  }
                </p>
              </div>
              {ticket.paymentStatus === 'paid' && (
                <div>
                  <Label className="text-muted-foreground">{isRTL ? 'طريقة الدفع' : 'Payment Method'}</Label>
                  <p className="font-medium" data-testid="text-payment-method">
                    {formatPosPaymentLabel(
                      {
                        paymentMethod: (ticket as any).paymentMethod,
                        paymentStatus: ticket.paymentStatus,
                        finalCost: ticket.finalCost,
                        costEstimate: ticket.costEstimate,
                        cashPaidAmount: (ticket as any).cashPaidAmount,
                        cardPaidAmount: (ticket as any).cardPaidAmount,
                      },
                      isRTL ? 'ar' : 'en',
                    )}
                  </p>
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

            <div className="pt-2">
              <Label className="text-muted-foreground">{isRTL ? 'سجل تغيّر الحالة' : 'Status Change Timeline'}</Label>
              {statusHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">{isRTL ? 'لا يوجد سجل بعد' : 'No history yet'}</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {statusHistory.map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-3 p-2 border rounded-md">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {(h.fromStatus ? `${h.fromStatus} → ` : '') + h.toStatus}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(h.changedAt), 'dd/MM/yyyy HH:mm')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handlePrintReceipt} variant="secondary" className="gap-2" data-testid="button-print-receipt">
                <Printer className="h-4 w-4" />
                {isRTL ? 'طباعة الوصل' : 'Print Receipt'}
              </Button>
              <Button onClick={handlePrint} className="gap-2" disabled={!barcodeReady} data-testid="button-print-label">
                <Printer className="h-4 w-4" />
                {barcodeReady ? (isRTL ? 'طباعة البطاقة' : 'Print Label') : (isRTL ? 'جاري التحميل...' : 'Loading...')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 bg-white">
              <div ref={printRef} data-testid="print-label">
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
                  <div className="customer-info" style={{ textAlign: 'center', fontWeight: 700, fontSize: '8px', letterSpacing: '0.2px', marginTop: '1px', wordBreak: 'break-all' }}>
                    {ticketCustomer.customerId} — {ticket.customerName}
                  </div>
                )}
                <div className="phone-info" style={{ textAlign: 'center', fontWeight: 800, fontSize: '8px', direction: 'ltr', marginTop: '1px', letterSpacing: '0.3px' }}>
                  {ticket.customerPhone}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLocked && (
          <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-700">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <Lock className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                  {isRTL ? 'التذكرة مقفلة — تم التسليم النهائي' : 'Ticket locked — final delivery recorded'}
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-400">
                  {isRTL
                    ? 'لا يمكن تعديل هذه التذكرة بعد تعيين الحالة إلى مُسلَّم مع الدفع أو التأجيل.'
                    : 'This ticket cannot be edited after being set to Delivered + Paid or Delivered + Deferred.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t('repair.edit.title')}
              {isLocked && <Lock className="h-4 w-4 text-orange-500" />}
            </CardTitle>
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
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLocked}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status" disabled={isLocked}>
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
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLocked}>
                          <FormControl>
                            <SelectTrigger data-testid="select-priority" disabled={isLocked}>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">{t('repair.priority.low')}</SelectItem>
                            <SelectItem value="normal">{t('repair.priority.normal')}</SelectItem>
                            <SelectItem value="high">{t('repair.priority.high')}</SelectItem>
                            <SelectItem value="urgent">{t('repair.priority.urgent')}</SelectItem>
                            <SelectItem value="vip">{t('repair.priority.vip')}</SelectItem>
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
                          <Input type="date" {...field} disabled={isLocked} data-testid="input-estimated-completion" />
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
                          <Input type="number" step="0.01" placeholder="0.00" {...field} disabled={isLocked} data-testid="input-cost-estimate" />
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
                          <Input type="number" step="0.01" placeholder="0.00" {...field} disabled={isLocked} data-testid="input-final-cost" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('repair.ticket.paymentStatus') || 'حالة الدفع'}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLocked}>
                          <FormControl>
                            <SelectTrigger data-testid="select-payment-status" disabled={isLocked}>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="unpaid">{t('repair.payment.unpaid') || 'غير مدفوع'}</SelectItem>
                            <SelectItem value="paid">{t('repair.payment.paid') || 'مدفوع'}</SelectItem>
                            <SelectItem value="deferred">{t('repair.payment.deferred') || 'أجل'}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem className="md:col-span-2">
                    <FormLabel>{isRTL ? 'طريقة الدفع' : 'Payment Method'}</FormLabel>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'cash', label: isRTL ? 'نقداً' : 'Cash', icon: Banknote },
                        { value: 'card', label: isRTL ? 'بطاقة' : 'Card', icon: CreditCard },
                        { value: 'split', label: isRTL ? 'نقد+بطاقة' : 'Cash+Card', icon: Split },
                      ].map((method) => (
                        <Button
                          key={method.value}
                          type="button"
                          variant={watchedPaymentMethod === method.value ? 'default' : 'outline'}
                          size="sm"
                          className="h-auto py-2 flex-col gap-1"
                          disabled={isLocked || watchedPaymentStatus !== 'paid'}
                          onClick={() => selectRepairPaymentMethod(method.value)}
                          data-testid={`button-payment-${method.value}`}
                        >
                          <method.icon className="h-4 w-4" />
                          <span className="text-xs">{method.label}</span>
                        </Button>
                      ))}
                    </div>
                    {watchedPaymentStatus !== 'paid' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {isRTL ? 'اختر "مدفوع" لتفعيل طريقة الدفع' : 'Set status to Paid to choose payment method'}
                      </p>
                    )}
                    {watchedPaymentMethod === 'split' && watchedPaymentStatus === 'paid' && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <FormField
                          control={form.control}
                          name="cashPaidAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">{isRTL ? 'مبلغ النقد' : 'Cash amount'}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  {...field}
                                  disabled={isLocked}
                                  data-testid="input-repair-split-cash"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="cardPaidAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">{isRTL ? 'مبلغ البطاقة' : 'Card amount'}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  {...field}
                                  disabled={isLocked}
                                  data-testid="input-repair-split-card"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <p
                          className={cn(
                            'col-span-2 text-xs',
                            Math.abs(splitRemaining) <= 0.5 ? 'text-green-600' : 'text-destructive',
                          )}
                        >
                          {isRTL
                            ? `المتبقي: ${Math.max(0, splitRemaining).toLocaleString('en-US')} د.ع (التكلفة ${repairPayTotal.toLocaleString('en-US')} د.ع)`
                            : `Remaining: ${Math.max(0, splitRemaining).toLocaleString('en-US')} IQD (cost ${repairPayTotal.toLocaleString('en-US')} IQD)`}
                        </p>
                      </div>
                    )}
                  </FormItem>
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
                          disabled={isLocked}
                          data-testid="textarea-technician-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center gap-4 justify-between">
                  <Button type="submit" disabled={updateMutation.isPending || isLocked} data-testid="button-save-ticket">
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
