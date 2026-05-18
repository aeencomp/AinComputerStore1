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
import { Trash2, Printer, AlertTriangle, LayoutList, Pencil, X, Receipt, MessageCircleOff } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { BrandSelect } from '@/components/BrandSelect';
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

interface TicketStatusHistoryRow {
  id: number;
  ticketId: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
}

export default function TicketDetailDialog({ ticketId, open, onOpenChange }: TicketDetailDialogProps) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isRTL = language === 'ar';
  const printRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [barcodeReady, setBarcodeReady] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [editingCustomerInfo, setEditingCustomerInfo] = useState(false);

  const { data: ticket, isLoading } = useQuery<RepairTicket>({
    queryKey: ['/api/repair-tickets', ticketId],
    enabled: !!ticketId && open,
  });

  const { data: statusHistory = [] } = useQuery<TicketStatusHistoryRow[]>({
    queryKey: ['/api/repair-tickets', ticketId, 'status-history'],
    queryFn: async () => {
      const res = await fetch(`/api/repair-tickets/${ticketId}/status-history`, { credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
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
    paymentStatus: z.string(),
    paymentMethod: z.string().optional(),
    technicianNotes: z.string().optional(),
    estimatedCompletion: z.string().optional(),
    costEstimate: z.string().optional(),
    finalCost: z.string().optional(),
  }), []);

  const customerSchema = useMemo(() => z.object({
    customerName: z.string().min(2, isRTL ? 'الاسم مطلوب' : 'Name required'),
    customerPhone: z.string().min(7, isRTL ? 'رقم الهاتف مطلوب' : 'Phone required'),
    customerEmail: z.string().optional(),
    deviceType: z.string().min(1, isRTL ? 'نوع الجهاز مطلوب' : 'Device type required'),
    deviceBrand: z.string().min(1, isRTL ? 'الماركة مطلوبة' : 'Brand required'),
    deviceModel: z.string().min(1, isRTL ? 'الموديل مطلوب' : 'Model required'),
    issueDescriptionAr: z.string().min(2, isRTL ? 'وصف المشكلة مطلوب' : 'Issue description required'),
    issueDescriptionEn: z.string().optional(),
  }), [isRTL]);

  const form = useForm<z.infer<typeof updateSchema>>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      status: 'pending',
      priority: 'normal',
      paymentStatus: 'unpaid',
      paymentMethod: 'cash',
      technicianNotes: '',
      estimatedCompletion: '',
      costEstimate: '',
      finalCost: '',
    },
  });

  const customerForm = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      deviceType: 'laptop',
      deviceBrand: '',
      deviceModel: '',
      issueDescriptionAr: '',
      issueDescriptionEn: '',
    },
  });

  const cleanPrice = (v: string | null | undefined) => v ? String(parseFloat(v)) : '';

  const resolveStatusField = (status: string, paymentStatus: string) => {
    if (status === 'delivered') {
      if (paymentStatus === 'deferred') return 'delivered-deferred';
      if (paymentStatus === 'paid') return 'delivered-paid';
      return 'delivered';
    }
    return status;
  };

  useEffect(() => {
    if (ticket) {
      form.reset({
        status: resolveStatusField(ticket.status, ticket.paymentStatus || 'unpaid'),
        priority: ticket.priority,
        paymentStatus: ticket.paymentStatus || 'unpaid',
        paymentMethod: (ticket as any).paymentMethod || 'cash',
        technicianNotes: ticket.technicianNotes || '',
        estimatedCompletion: ticket.estimatedCompletion ? format(new Date(ticket.estimatedCompletion), 'yyyy-MM-dd') : '',
        costEstimate: cleanPrice(ticket.costEstimate),
        finalCost: cleanPrice(ticket.finalCost),
      });
    }
  }, [ticket, form]);

  useEffect(() => {
    setBarcodeReady(false);
    setQrCodeDataUrl('');
    setEditingCustomerInfo(false);
  }, [ticketId]);

  useEffect(() => {
    if (ticket && open) {
      const trackingUrl = `${window.location.origin}/track-repair?ticket=${ticket.ticketNumber}`;
      QRCode.toDataURL(trackingUrl, { width: 200, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
        .then(url => setQrCodeDataUrl(url))
        .catch(() => setQrCodeDataUrl(''));
    }
  }, [ticket, open]);

  useEffect(() => {
    if (ticket) {
      customerForm.reset({
        customerName: ticket.customerName,
        customerPhone: ticket.customerPhone,
        customerEmail: ticket.customerEmail || '',
        deviceType: ticket.deviceType,
        deviceBrand: ticket.deviceBrand,
        deviceModel: ticket.deviceModel,
        issueDescriptionAr: ticket.issueDescriptionAr,
        issueDescriptionEn: ticket.issueDescriptionEn || '',
      });
    }
  }, [ticket, customerForm]);

  useEffect(() => {
    if (ticket && barcodeRef.current && open) {
      requestAnimationFrame(() => {
        if (barcodeRef.current) {
          try {
            JsBarcode(barcodeRef.current, ticket.ticketNumber, {
              format: 'CODE128',
              width: 2,
              height: 44,
              displayValue: false,
              margin: 0,
              background: '#ffffff',
              lineColor: '#000000',
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
      const res = await apiRequest('PATCH', `/api/admin/repair-tickets/${ticketId}`, {
        ...data,
        estimatedCompletion: data.estimatedCompletion ? new Date(data.estimatedCompletion).toISOString() : null,
      });
      return res.json();
    },
    onSuccess: (response: any) => {
      if (response && ticketId) {
        const { _whatsappStatus, ...freshTicket } = response;
        queryClient.setQueryData(['/api/repair-tickets', ticketId], freshTicket);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets', ticketId] });
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
      } else if (response?._whatsappStatus && response._whatsappStatus.startsWith('failed')) {
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

  const updateCustomerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof customerSchema>) => {
      if (!ticketId) throw new Error('No ticket ID');
      return await apiRequest('PATCH', `/api/admin/repair-tickets/${ticketId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets', ticketId] });
      setEditingCustomerInfo(false);
      toast({
        title: isRTL ? 'تم الحفظ' : 'Saved',
        description: isRTL ? 'تم تحديث بيانات العميل بنجاح' : 'Customer info updated successfully',
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: isRTL ? 'فشل تحديث بيانات العميل' : 'Failed to update customer info',
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
    let status = data.status;
    let paymentStatus = data.paymentStatus;
    if (data.status === 'delivered-paid') {
      status = 'delivered';
      paymentStatus = 'paid';
    } else if (data.status === 'delivered-deferred') {
      status = 'delivered';
      paymentStatus = 'deferred';
    }
    updateMutation.mutate({ ...data, status, paymentStatus });
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
              @page { size: 50mm 30mm; margin: 0; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { width: 50mm; min-height: 30mm; height: auto; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: Arial, Helvetica, sans-serif; background: #fff; padding: 0.8mm 1mm; }
              .store-name { font-size: 7pt; font-weight: 900; text-align: center; letter-spacing: 0.2px; line-height: 1.1; max-width: 48mm; }
              .barcode-container { text-align: center; width: 100%; margin: 0.5mm 0; }
              .barcode-container svg { width: 48mm; height: 13mm; display: block; margin: 0 auto; }
              .serial { font-size: 9pt; font-weight: 900; text-align: center; letter-spacing: 1.5px; font-family: 'Courier New', Courier, monospace; }
              .customer-info { font-size: 6pt; font-weight: 700; text-align: center; word-break: break-all; max-width: 46mm; margin-top: 0.5mm; line-height: 1.2; }
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

  const handlePrintCustomerReceipt = () => {
    if (!ticket) return;

    const priorityText: Record<string, string> = {
      urgent: isRTL ? 'عاجل' : 'Urgent',
      high: isRTL ? 'مرتفع' : 'High',
      normal: isRTL ? 'عادي' : 'Normal',
      low: isRTL ? 'منخفض' : 'Low',
    };
    const deviceTypeText: Record<string, string> = {
      laptop: isRTL ? 'لابتوب' : 'Laptop',
      desktop: isRTL ? 'كمبيوتر مكتبي' : 'Desktop',
      monitor: isRTL ? 'شاشة' : 'Monitor',
      printer: isRTL ? 'طابعة' : 'Printer',
      other: isRTL ? 'أخرى' : 'Other',
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const otherTickets = dialogActiveTickets.filter(t => t.id !== ticket.id);
    const ticketIndex = dialogActiveTickets.findIndex(t => t.id === ticket.id) + 1;
    const totalTickets = dialogActiveTickets.length;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <title>${isRTL ? 'إيصال صيانة' : 'Repair Receipt'}</title>
        <style>
          @page { size: 72.1mm auto; margin: 2mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; page-break-inside: avoid; break-inside: avoid; }
          body { font-family: Arial, sans-serif; font-size: 13px; font-weight: 600; width: 68mm; height: auto; overflow: visible; padding: 3mm; direction: ${isRTL ? 'rtl' : 'ltr'}; line-height: 1.5; color: #000; }
          .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
          .store-name { font-size: 18px; font-weight: 900; margin-bottom: 6px; letter-spacing: 0.5px; }
          .store-info { font-size: 11px; font-weight: 700; color: #000; }
          .receipt-title { text-align: center; font-size: 16px; font-weight: 900; margin: 10px 0; padding: 6px; background: #e0e0e0; border-radius: 4px; border: 1px solid #000; }
          .ticket-number { text-align: center; font-size: 22px; font-weight: 900; margin: 10px 0; padding: 8px; border: 3px dashed #000; letter-spacing: 1px; }
          .section { margin: 12px 0; padding-bottom: 10px; border-bottom: 2px dashed #333; }
          .section-title { font-weight: 900; font-size: 14px; margin-bottom: 8px; color: #000; text-decoration: underline; }
          .info-row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 12px; font-weight: 700; }
          .info-label { font-weight: 900; color: #000; }
          .info-value { text-align: ${isRTL ? 'left' : 'right'}; font-weight: 700; }
          .problem-box { background: #f0f0f0; padding: 10px; border-radius: 4px; margin-top: 8px; font-size: 12px; font-weight: 700; min-height: 50px; border: 1px solid #999; }
          .terms { margin-top: 14px; padding-top: 10px; border-top: 2px solid #000; }
          .terms-title { font-weight: 900; font-size: 12px; margin-bottom: 6px; }
          .terms-list { font-size: 10px; font-weight: 600; color: #000; padding-${isRTL ? 'right' : 'left'}: 10px; }
          .terms-list li { margin: 4px 0; }
          .footer { text-align: center; margin-top: 14px; padding-top: 10px; border-top: 3px solid #000; font-size: 12px; font-weight: 900; }
          .track-info { margin-top: 10px; padding: 8px; background: #e0e0e0; border-radius: 4px; text-align: center; font-size: 11px; font-weight: 700; border: 1px solid #666; }
          .date-time { text-align: center; font-size: 11px; font-weight: 700; color: #000; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="store-name">${isRTL ? 'العين لتجارة الحاسبات' : 'AEEN COMPUTER TRADING'}</div>
          <div class="store-info">${isRTL ? 'كربلاء - العراق' : 'Karbala - Iraq'}</div>
          <div class="store-info">07850006977</div>
        </div>

        <div class="receipt-title">${isRTL ? 'إيصال استلام جهاز للصيانة' : 'Device Repair Receipt'}</div>
        <div class="ticket-number">${ticket.ticketNumber}</div>

        ${totalTickets > 1 ? `
          <div style="text-align:center;margin:8px 0;padding:6px 10px;background:#fff3cd;border:2px solid #ffc107;border-radius:6px;font-size:15px;font-weight:900;color:#856404;">
            ${isRTL ? `الجهاز ${ticketIndex} من ${totalTickets}` : `Device ${ticketIndex} of ${totalTickets}`}
          </div>` : ''}

        ${qrCodeDataUrl ? `
          <div style="text-align:center;margin:8px 0;">
            <img src="${qrCodeDataUrl}" alt="QR" style="width:100px;height:100px;margin:0 auto;"/>
            <div style="font-size:9px;font-weight:700;margin-top:4px;">${isRTL ? 'امسح الكود لتتبع حالة الصيانة' : 'Scan to track repair status'}</div>
          </div>` : ''}

        <div class="date-time">
          ${isRTL ? 'وقت الاستلام:' : 'Received at:'}
          ${(ticket as any).receivedAt ? `${new Date((ticket as any).receivedAt).toLocaleDateString(isRTL ? 'ar-IQ' : 'en-US')} - ${new Date((ticket as any).receivedAt).toLocaleTimeString(isRTL ? 'ar-IQ' : 'en-US', { hour: '2-digit', minute: '2-digit' })}` : `${new Date(ticket.createdAt).toLocaleDateString(isRTL ? 'ar-IQ' : 'en-US')} - ${new Date(ticket.createdAt).toLocaleTimeString(isRTL ? 'ar-IQ' : 'en-US', { hour: '2-digit', minute: '2-digit' })}`}
        </div>

        <div class="section">
          <div class="section-title">${isRTL ? 'معلومات العميل' : 'Customer Information'}</div>
          ${ticketCustomer ? `
            <div class="info-row">
              <span class="info-label">${isRTL ? 'رقم العميل:' : 'Customer ID:'}</span>
              <span class="info-value" style="font-family:monospace;font-weight:900;">${ticketCustomer.customerId}</span>
            </div>` : ''}
          <div class="info-row">
            <span class="info-label">${isRTL ? 'الاسم:' : 'Name:'}</span>
            <span class="info-value">${ticket.customerName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${isRTL ? 'الهاتف:' : 'Phone:'}</span>
            <span class="info-value" dir="ltr">${ticket.customerPhone}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">${isRTL ? 'معلومات الجهاز' : 'Device Information'}</div>
          <div class="info-row">
            <span class="info-label">${isRTL ? 'النوع:' : 'Type:'}</span>
            <span class="info-value">${deviceTypeText[ticket.deviceType] || ticket.deviceType}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${isRTL ? 'الماركة:' : 'Brand:'}</span>
            <span class="info-value">${ticket.deviceBrand}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${isRTL ? 'الموديل:' : 'Model:'}</span>
            <span class="info-value">${ticket.deviceModel}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${isRTL ? 'الأولوية:' : 'Priority:'}</span>
            <span class="info-value">${priorityText[ticket.priority] || ticket.priority}</span>
          </div>
          ${ticket.costEstimate ? `
          <div class="info-row">
            <span class="info-label">${isRTL ? 'التكلفة المتوقعة:' : 'Estimated Cost:'}</span>
            <span class="info-value">${Number(ticket.costEstimate).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${isRTL ? 'د.ع' : 'IQD'}</span>
          </div>` : ''}
          ${ticket.finalCost ? `
          <div class="info-row">
            <span class="info-label">${isRTL ? 'التكلفة النهائية:' : 'Final Cost:'}</span>
            <span class="info-value">${Number(ticket.finalCost).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${isRTL ? 'د.ع' : 'IQD'}</span>
          </div>` : ''}
        </div>

        <div class="section">
          <div class="section-title">${isRTL ? 'وصف المشكلة' : 'Problem Description'}</div>
          <div class="problem-box">${ticket.issueDescriptionAr || ticket.issueDescriptionEn}</div>
        </div>

        ${otherTickets.length > 0 ? `
          <div style="margin:12px 0;padding:10px;background:#fff3cd;border:1px solid #ffc107;border-radius:4px;">
            <div style="font-weight:900;font-size:13px;margin-bottom:6px;color:#856404;">
              ${isRTL ? `طلباتك النشطة الأخرى (${otherTickets.length}):` : `Your Other Active Repairs (${otherTickets.length}):`}
            </div>
            ${otherTickets.map(t => {
              const typeMap: Record<string,string> = { laptop: isRTL ? 'لابتوب' : 'Laptop', desktop: isRTL ? 'كمبيوتر' : 'Desktop', monitor: isRTL ? 'شاشة' : 'Monitor', printer: isRTL ? 'طابعة' : 'Printer', other: isRTL ? 'أخرى' : 'Other' };
              return `<div style="display:flex;justify-content:space-between;margin:5px 0;font-size:11px;font-weight:700;">
                <span style="font-weight:900;">${t.ticketNumber}</span>
                <span>${t.deviceBrand} ${t.deviceModel} — ${typeMap[t.deviceType] || t.deviceType}</span>
              </div>`;
            }).join('')}
          </div>` : ''}

        <div class="terms">
          <div class="terms-title">${isRTL ? 'الشروط والأحكام:' : 'Terms & Conditions:'}</div>
          <ul class="terms-list">
            <li>${isRTL ? 'يرجى الاحتفاظ بهذا الإيصال لاستلام الجهاز' : 'Please keep this receipt to collect your device'}</li>
            <li>${isRTL ? 'مدة الصيانة تعتمد على نوع العطل وتوفر القطع' : 'Repair time depends on issue type and parts availability'}</li>
            <li>${isRTL ? 'سيتم التواصل معكم عند الانتهاء' : 'We will contact you when ready'}</li>
            <li>${isRTL ? 'الأجهزة غير المستلمة خلال 30 يوم لا نتحمل مسؤوليتها' : 'We are not responsible for devices not collected within 30 days'}</li>
          </ul>
        </div>

        <div class="track-info">
          ${isRTL ? 'امسح رمز QR أعلاه لتتبع حالة جهازك مباشرة' : 'Scan the QR code above to track your device status directly'}
        </div>

        <div class="footer">
          <div>${isRTL ? 'شكراً لثقتكم بنا' : 'Thank you for trusting us'}</div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
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
          <div class="store-name">${isRTL ? 'العين لتجارة الحاسبات' : 'AEEN COMPUTER TRADING'}</div>
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
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">{isRTL ? 'وقت استلام الجهاز' : 'Received At'}</div>
                <div className="text-sm font-semibold">
                  {format(new Date((ticket as any).receivedAt || ticket.createdAt), 'dd/MM/yyyy HH:mm')}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">{isRTL ? 'آخر تحديث' : 'Last Updated'}</div>
                <div className="text-sm font-semibold">
                  {format(new Date(ticket.updatedAt), 'dd/MM/yyyy HH:mm')}
                </div>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <div className="text-sm font-semibold mb-2">{isRTL ? 'سجل تغيّر الحالة' : 'Status Change Timeline'}</div>
              {statusHistory.length === 0 ? (
                <div className="text-sm text-muted-foreground">{isRTL ? 'لا يوجد سجل بعد' : 'No history yet'}</div>
              ) : (
                <div className="space-y-2">
                  {statusHistory.map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-3 p-2 rounded border bg-muted/10">
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

            {/* Customer & Device Info Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{isRTL ? 'بيانات العميل والجهاز' : 'Customer & Device Info'}</h3>
                <Button
                  type="button"
                  size="sm"
                  variant={editingCustomerInfo ? 'secondary' : 'outline'}
                  onClick={() => setEditingCustomerInfo(v => !v)}
                  data-testid="button-toggle-edit-customer"
                >
                  {editingCustomerInfo ? (
                    <><X className="h-3 w-3 ltr:mr-1 rtl:ml-1" />{isRTL ? 'إلغاء' : 'Cancel'}</>
                  ) : (
                    <><Pencil className="h-3 w-3 ltr:mr-1 rtl:ml-1" />{isRTL ? 'تعديل' : 'Edit'}</>
                  )}
                </Button>
              </div>

              {editingCustomerInfo ? (
                <Form {...customerForm}>
                  <form onSubmit={customerForm.handleSubmit(d => updateCustomerMutation.mutate(d))} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField control={customerForm.control} name="customerName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('repair.ticket.customerName')}</FormLabel>
                          <FormControl><Input {...field} data-testid="input-edit-customer-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={customerForm.control} name="customerPhone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('repair.ticket.customerPhone')}</FormLabel>
                          <FormControl><Input {...field} dir="ltr" data-testid="input-edit-customer-phone" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={customerForm.control} name="customerEmail" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('repair.ticket.customerEmail')}</FormLabel>
                          <FormControl><Input {...field} dir="ltr" type="email" placeholder="example@email.com" data-testid="input-edit-customer-email" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={customerForm.control} name="deviceType" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('repair.ticket.deviceType')}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-edit-device-type"><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="laptop">{t('repair.deviceType.laptop')}</SelectItem>
                              <SelectItem value="desktop">{t('repair.deviceType.desktop')}</SelectItem>
                              <SelectItem value="monitor">{t('repair.deviceType.monitor')}</SelectItem>
                              <SelectItem value="printer">{t('repair.deviceType.printer')}</SelectItem>
                              <SelectItem value="other">{t('repair.deviceType.other')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={customerForm.control} name="deviceBrand" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('repair.ticket.deviceBrand')}</FormLabel>
                          <FormControl>
                            <BrandSelect
                              value={field.value}
                              onValueChange={field.onChange}
                              testId="input-edit-device-brand"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={customerForm.control} name="deviceModel" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('repair.ticket.deviceModel')}</FormLabel>
                          <FormControl><Input {...field} data-testid="input-edit-device-model" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={customerForm.control} name="issueDescriptionAr" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isRTL ? 'وصف المشكلة' : 'Issue Description'}</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} lang="ar" dir="auto" spellCheck autoCorrect="on" data-testid="textarea-edit-issue-ar" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={customerForm.control} name="issueDescriptionEn" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isRTL ? 'وصف المشكلة (English)' : 'Issue Description (English)'}</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={2} dir="ltr" placeholder="Optional..." data-testid="textarea-edit-issue-en" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" size="sm" disabled={updateCustomerMutation.isPending} data-testid="button-save-customer-info">
                      {updateCustomerMutation.isPending ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ البيانات' : 'Save Info')}
                    </Button>
                  </form>
                </Form>
              ) : (
                <>
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
                  <div className="mt-3">
                    <Label className="text-muted-foreground text-xs">{t('repair.ticket.issueDescription')}</Label>
                    <p className="mt-1 text-sm">{ticket.issueDescriptionAr || ticket.issueDescriptionEn}</p>
                  </div>
                </>
              )}
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
                <h3 className="font-semibold text-sm">{isRTL ? 'خيارات الطباعة' : 'Print Options'}</h3>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={handlePrint} className="gap-2" disabled={!barcodeReady} data-testid="button-dialog-print-label">
                    <Printer className="h-4 w-4" />
                    {barcodeReady ? (isRTL ? 'بطاقة الباركود' : 'Barcode Label') : (isRTL ? 'جاري التحميل...' : 'Loading...')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handlePrintCustomerReceipt} className="gap-2" disabled={!qrCodeDataUrl} data-testid="button-dialog-print-receipt">
                    <Receipt className="h-4 w-4" />
                    {qrCodeDataUrl ? (isRTL ? 'إيصال العميل' : 'Customer Receipt') : (isRTL ? 'جاري التحميل...' : 'Loading...')}
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
                  <div className="store-name" style={{ textAlign: 'center', fontWeight: 900, fontSize: '9px', letterSpacing: '0.2px', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    العين لتجارة الحاسبات
                  </div>
                  <div className="barcode-container" style={{ textAlign: 'center', margin: '3px 0' }}>
                    <svg ref={barcodeRef} style={{ display: 'block', width: '100%' }} />
                  </div>
                  <div className="serial" style={{ textAlign: 'center', fontWeight: 900, fontSize: '12px', letterSpacing: '1.5px', fontFamily: 'Courier New, Courier, monospace' }}>
                    {ticket.ticketNumber}
                  </div>
                  {ticketCustomer && (
                    <div className="customer-info" style={{ textAlign: 'center', fontWeight: 700, fontSize: '8px', letterSpacing: '0.2px', marginTop: '1px', wordBreak: 'break-all' }}>
                      {ticketCustomer.customerId} — {ticket.customerName}
                    </div>
                  )}
                  <div className="customer-info" style={{ textAlign: 'center', fontWeight: 800, fontSize: '8px', letterSpacing: '0.3px', marginTop: '1px', direction: 'ltr' }}>
                    {ticket.customerPhone}
                  </div>
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
                          <Select
                            onValueChange={(val) => {
                              field.onChange(val);
                              if (val === 'delivered-paid') form.setValue('paymentStatus', 'paid');
                              else if (val === 'delivered-deferred') form.setValue('paymentStatus', 'deferred');
                            }}
                            value={field.value}
                          >
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
                              <SelectItem value="delivered-paid">{isRTL ? 'مُسلَّم - مدفوع' : 'Delivered - Paid'}</SelectItem>
                              <SelectItem value="delivered-deferred">{isRTL ? 'مُسلَّم - آجل' : 'Delivered - Deferred'}</SelectItem>
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

                    {!['delivered-paid', 'delivered-deferred'].includes(form.watch('status')) && (
                      <FormField
                        control={form.control}
                        name="paymentStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('repair.ticket.paymentStatus')}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="dialog-select-payment-status">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="unpaid">{t('repair.payment.unpaid')}</SelectItem>
                                <SelectItem value="paid">{t('repair.payment.paid')}</SelectItem>
                                <SelectItem value="deferred">{t('repair.payment.deferred')}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{isRTL ? 'طريقة الدفع' : 'Payment Method'}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || 'cash'}>
                            <FormControl>
                              <SelectTrigger data-testid="dialog-select-payment-method">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cash">{isRTL ? 'نقداً' : 'Cash'}</SelectItem>
                              <SelectItem value="card">{isRTL ? 'بطاقة' : 'Card'}</SelectItem>
                            </SelectContent>
                          </Select>
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
