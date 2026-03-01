import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { ArrowLeft, ArrowRight, Plus, Printer, Receipt, AlertTriangle, LayoutList } from 'lucide-react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import type { RepairTicket, RepairCustomer } from '@shared/schema';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';

interface Technician {
  id: string;
  username: string;
  displayName: string;
  isAdmin: number;
  isActive: number;
  permissions: string[];
}

export default function NewRepairRequest() {
  const [, navigate] = useLocation();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isRTL = language === 'ar';
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const [createdTicket, setCreatedTicket] = useState<RepairTicket | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  const { data: currentTechnician, isLoading: isAuthLoading, error: authError } = useQuery<Technician>({
    queryKey: ['/api/technician/auth/me'],
    retry: false,
  });

  useEffect(() => {
    if (authError || (!isAuthLoading && !currentTechnician)) {
      navigate('/technician/login');
    }
  }, [authError, isAuthLoading, currentTechnician, navigate]);

  const [qrReady, setQrReady] = useState(false);

  const { data: createdCustomer } = useQuery<RepairCustomer>({
    queryKey: ['/api/repair-customers', createdTicket?.repairCustomerId],
    queryFn: async () => {
      const res = await fetch(`/api/repair-customers/${createdTicket!.repairCustomerId}`);
      if (!res.ok) throw new Error('not found');
      return res.json();
    },
    enabled: !!createdTicket?.repairCustomerId,
  });

  const { data: activeTickets = [] } = useQuery<RepairTicket[]>({
    queryKey: ['/api/repair-customers', createdCustomer?.id, 'active-tickets'],
    queryFn: async () => {
      const res = await fetch(`/api/repair-customers/${createdCustomer!.id}/active-tickets`);
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    enabled: !!createdCustomer?.id,
  });

  const formSchema = z.object({
    customerName: z.string().min(2, isRTL ? 'اسم العميل مطلوب' : 'Customer name is required'),
    customerPhone: z.string().min(10, isRTL ? 'رقم الهاتف مطلوب' : 'Phone number is required'),
    customerEmail: z.string().email().optional().or(z.literal('')),
    deviceType: z.string().min(1, isRTL ? 'نوع الجهاز مطلوب' : 'Device type is required'),
    deviceBrand: z.string().min(1, isRTL ? 'الماركة مطلوبة' : 'Brand is required'),
    deviceModel: z.string().min(1, isRTL ? 'الموديل مطلوب' : 'Model is required'),
    issueDescription: z.string().min(5, isRTL ? 'وصف المشكلة مطلوب' : 'Problem description is required'),
    priority: z.string().default('normal'),
  });

  type FormData = z.infer<typeof formSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      deviceType: 'laptop',
      deviceBrand: '',
      deviceModel: '',
      issueDescription: '',
      priority: 'normal',
    },
  });

  useEffect(() => {
    if (createdTicket) {
      const trackingUrl = `${window.location.origin}/track-repair?ticket=${encodeURIComponent(createdTicket.ticketNumber)}&lang=${language}`;
      QRCode.toDataURL(trackingUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }).then((dataUrl) => {
        setQrCodeDataUrl(dataUrl);
        requestAnimationFrame(() => {
          if (barcodeRef.current) {
            try {
              JsBarcode(barcodeRef.current, createdTicket.ticketNumber, {
                format: 'CODE128',
                width: 1.5,
                height: 35,
                displayValue: false,
                margin: 1,
                background: '#ffffff',
              });
            } catch (error) {
              console.error('Barcode generation error:', error);
            }
          }
          setQrReady(true);
        });
      }).catch((error) => {
        console.error('QR code generation error:', error);
      });
    }
  }, [createdTicket, language]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        issueDescriptionAr: data.issueDescription,
        issueDescriptionEn: data.issueDescription,
      };
      const res = await apiRequest('POST', '/api/repair-tickets', payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/repair-tickets'] });
      setCreatedTicket(data);
      toast({
        title: isRTL ? 'تم إنشاء الطلب بنجاح' : 'Request Created Successfully',
        description: isRTL ? `رقم التذكرة: ${data.ticketNumber}` : `Ticket Number: ${data.ticketNumber}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('common.errorOccurred'),
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  const handlePrint = () => {
    if (printRef.current) {
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

  const handleNewRequest = () => {
    setCreatedTicket(null);
    setQrReady(false);
    setQrCodeDataUrl('');
    form.reset();
  };

  const handlePrintCustomerReceipt = () => {
    if (!createdTicket) return;
    
    const priorityText = {
      urgent: isRTL ? 'عاجل' : 'Urgent',
      high: isRTL ? 'مرتفع' : 'High',
      normal: isRTL ? 'عادي' : 'Normal',
      low: isRTL ? 'منخفض' : 'Low',
    }[createdTicket.priority] || createdTicket.priority;

    const deviceTypeText = {
      laptop: isRTL ? 'لابتوب' : 'Laptop',
      desktop: isRTL ? 'كمبيوتر مكتبي' : 'Desktop',
      monitor: isRTL ? 'شاشة' : 'Monitor',
      printer: isRTL ? 'طابعة' : 'Printer',
      other: isRTL ? 'أخرى' : 'Other',
    }[createdTicket.deviceType] || createdTicket.deviceType;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="${isRTL ? 'rtl' : 'ltr'}">
        <head>
          <title>${isRTL ? 'إيصال صيانة' : 'Repair Receipt'}</title>
          <style>
            @page { 
              size: 72.1mm auto; 
              margin: 2mm; 
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            body { 
              font-family: Arial, sans-serif; 
              font-size: 13px; 
              font-weight: 600;
              width: 68mm;
              height: auto;
              overflow: visible;
              padding: 3mm;
              direction: ${isRTL ? 'rtl' : 'ltr'};
              line-height: 1.5;
              color: #000;
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #000;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .store-name {
              font-size: 18px;
              font-weight: 900;
              margin-bottom: 6px;
              letter-spacing: 0.5px;
            }
            .store-info {
              font-size: 11px;
              font-weight: 700;
              color: #000;
            }
            .receipt-title {
              text-align: center;
              font-size: 16px;
              font-weight: 900;
              margin: 10px 0;
              padding: 6px;
              background: #e0e0e0;
              border-radius: 4px;
              border: 1px solid #000;
            }
            .ticket-number {
              text-align: center;
              font-size: 22px;
              font-weight: 900;
              margin: 10px 0;
              padding: 8px;
              border: 3px dashed #000;
              letter-spacing: 1px;
            }
            .section {
              margin: 12px 0;
              padding-bottom: 10px;
              border-bottom: 2px dashed #333;
            }
            .section-title {
              font-weight: 900;
              font-size: 14px;
              margin-bottom: 8px;
              color: #000;
              text-decoration: underline;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin: 6px 0;
              font-size: 12px;
              font-weight: 700;
            }
            .info-label {
              font-weight: 900;
              color: #000;
            }
            .info-value {
              text-align: ${isRTL ? 'left' : 'right'};
              font-weight: 700;
            }
            .problem-box {
              background: #f0f0f0;
              padding: 10px;
              border-radius: 4px;
              margin-top: 8px;
              font-size: 12px;
              font-weight: 700;
              min-height: 50px;
              border: 1px solid #999;
            }
            .terms {
              margin-top: 14px;
              padding-top: 10px;
              border-top: 2px solid #000;
            }
            .terms-title {
              font-weight: 900;
              font-size: 12px;
              margin-bottom: 6px;
            }
            .terms-list {
              font-size: 10px;
              font-weight: 600;
              color: #000;
              padding-${isRTL ? 'right' : 'left'}: 10px;
            }
            .terms-list li {
              margin: 4px 0;
            }
            .footer {
              text-align: center;
              margin-top: 14px;
              padding-top: 10px;
              border-top: 3px solid #000;
              font-size: 12px;
              font-weight: 900;
            }
            .track-info {
              margin-top: 10px;
              padding: 8px;
              background: #e0e0e0;
              border-radius: 4px;
              text-align: center;
              font-size: 11px;
              font-weight: 700;
              border: 1px solid #666;
            }
            .date-time {
              text-align: center;
              font-size: 11px;
              font-weight: 700;
              color: #000;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="store-name">${isRTL ? 'العين لتجارة الحاسبات' : 'Al-Ain Computer Trading'}</div>
            <div class="store-info">${isRTL ? 'كربلاء - العراق' : 'Karbala - Iraq'}</div>
            <div class="store-info">07850006977</div>
          </div>
          
          <div class="receipt-title">${isRTL ? 'إيصال استلام جهاز للصيانة' : 'Device Repair Receipt'}</div>
          
          <div class="ticket-number">${createdTicket.ticketNumber}</div>
          
          ${activeTickets.length > 1 ? (() => {
            const idx = activeTickets.findIndex(t => t.id === createdTicket.id) + 1;
            const total = activeTickets.length;
            return `<div style="text-align:center;margin:8px 0;padding:6px 10px;background:#fff3cd;border:2px solid #ffc107;border-radius:6px;font-size:15px;font-weight:900;color:#856404;">
              ${isRTL ? `الجهاز ${idx} من ${total}` : `Device ${idx} of ${total}`}
            </div>`;
          })() : ''}
          
          <div style="text-align: center; margin: 8px 0;">
            <img src="${qrCodeDataUrl}" alt="QR Code" style="width: 100px; height: 100px; margin: 0 auto;" />
            <div style="font-size: 9px; font-weight: 700; margin-top: 4px;">${isRTL ? 'امسح الكود لتتبع حالة الصيانة' : 'Scan to track repair status'}</div>
          </div>
          
          <div class="date-time">
            ${new Date().toLocaleDateString(isRTL ? 'ar-IQ' : 'en-US')} - ${new Date().toLocaleTimeString(isRTL ? 'ar-IQ' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          
          <div class="section">
            <div class="section-title">${isRTL ? 'معلومات العميل' : 'Customer Information'}</div>
            ${createdCustomer ? `
            <div class="info-row">
              <span class="info-label">${isRTL ? 'رقم العميل:' : 'Customer ID:'}</span>
              <span class="info-value" style="font-family: monospace; font-weight: 900;">${createdCustomer.customerId}</span>
            </div>` : ''}
            <div class="info-row">
              <span class="info-label">${isRTL ? 'الاسم:' : 'Name:'}</span>
              <span class="info-value">${createdTicket.customerName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${isRTL ? 'الهاتف:' : 'Phone:'}</span>
              <span class="info-value" dir="ltr">${createdTicket.customerPhone}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">${isRTL ? 'معلومات الجهاز' : 'Device Information'}</div>
            <div class="info-row">
              <span class="info-label">${isRTL ? 'النوع:' : 'Type:'}</span>
              <span class="info-value">${deviceTypeText}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${isRTL ? 'الماركة:' : 'Brand:'}</span>
              <span class="info-value">${createdTicket.deviceBrand}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${isRTL ? 'الموديل:' : 'Model:'}</span>
              <span class="info-value">${createdTicket.deviceModel}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${isRTL ? 'الأولوية:' : 'Priority:'}</span>
              <span class="info-value">${priorityText}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">${isRTL ? 'وصف المشكلة' : 'Problem Description'}</div>
            <div class="problem-box">
              ${createdTicket.issueDescriptionAr || createdTicket.issueDescriptionEn}
            </div>
          </div>
          
          ${createdTicket.costEstimate ? `
          <div class="section">
            <div class="info-row">
              <span class="info-label">${isRTL ? 'التكلفة المتوقعة:' : 'Estimated Cost:'}</span>
              <span class="info-value">${Number(createdTicket.costEstimate).toLocaleString()} ${isRTL ? 'د.ع' : 'IQD'}</span>
            </div>
          </div>
          ` : ''}
          
          ${activeTickets.length > 1 ? (() => {
            const others = activeTickets.filter(t => t.id !== createdTicket.id);
            const rows = others.map((t, i) => {
              const typeMap: Record<string,string> = { laptop: isRTL ? 'لابتوب' : 'Laptop', desktop: isRTL ? 'كمبيوتر' : 'Desktop', monitor: isRTL ? 'شاشة' : 'Monitor', printer: isRTL ? 'طابعة' : 'Printer', other: isRTL ? 'أخرى' : 'Other' };
              const typeTxt = typeMap[t.deviceType] || t.deviceType;
              return `<div style="display:flex;justify-content:space-between;margin:5px 0;font-size:11px;font-weight:700;">
                <span style="font-weight:900;">${t.ticketNumber}</span>
                <span>${t.deviceBrand} ${t.deviceModel} — ${typeTxt}</span>
              </div>`;
            }).join('');
            return `<div style="margin:12px 0;padding:10px;background:#fff3cd;border:1px solid #ffc107;border-radius:4px;">
              <div style="font-weight:900;font-size:13px;margin-bottom:6px;color:#856404;">
                ${isRTL ? `⚠ طلباتك النشطة الأخرى (${others.length}):` : `⚠ Your Other Active Repairs (${others.length}):`}
              </div>
              ${rows}
            </div>`;
          })() : ''}
          
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
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const handlePrintCustomerSummary = () => {
    if (!createdCustomer || activeTickets.length === 0) return;
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
    const typeMap: Record<string,string> = {
      laptop: isRTL ? 'لابتوب' : 'Laptop',
      desktop: isRTL ? 'كمبيوتر مكتبي' : 'Desktop',
      monitor: isRTL ? 'شاشة' : 'Monitor',
      printer: isRTL ? 'طابعة' : 'Printer',
      other: isRTL ? 'أخرى' : 'Other',
    };
    const deviceSections = activeTickets.map((t, i) => `
      <div class="device-section">
        <div class="device-header">${isRTL ? `الجهاز ${i + 1}` : `Device ${i + 1}`} / ${i + 1 === 1 ? (isRTL ? 'الأول' : 'First') : ''}</div>
        <div class="device-ticket">${t.ticketNumber}</div>
        <div class="device-info-row"><span class="lbl">${isRTL ? 'الجهاز:' : 'Device:'}</span><span>${t.deviceBrand} ${t.deviceModel}</span></div>
        <div class="device-info-row"><span class="lbl">${isRTL ? 'النوع:' : 'Type:'}</span><span>${typeMap[t.deviceType] || t.deviceType}</span></div>
        <div class="device-info-row"><span class="lbl">${isRTL ? 'الحالة:' : 'Status:'}</span><span style="font-weight:900;">${statusMap[t.status] || t.status}</span></div>
        ${t.costEstimate ? `<div class="device-info-row"><span class="lbl">${isRTL ? 'التكلفة:' : 'Cost:'}</span><span style="font-weight:900;">${Number(t.costEstimate).toLocaleString()} ${isRTL ? 'د.ع' : 'IQD'}</span></div>` : ''}
        ${t.issueDescriptionAr || t.issueDescriptionEn ? `<div class="device-issue"><span class="lbl">${isRTL ? 'المشكلة:' : 'Issue:'}</span> ${t.issueDescriptionAr || t.issueDescriptionEn}</div>` : ''}
      </div>
    `).join('<div class="divider"></div>');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
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
      </head>
      <body>
        <div class="header">
          <div class="store-name">${isRTL ? 'العين لتجارة الحاسبات' : 'Al-Ain Computer Trading'}</div>
          <div class="store-info">${isRTL ? 'كربلاء — العراق' : 'Karbala — Iraq'} | 07850006977</div>
        </div>
        <div class="summary-title">${isRTL ? 'ملف طلبات الصيانة' : 'Repair Summary Sheet'}</div>
        <div class="customer-block">
          <div class="customer-id">${createdCustomer.customerId}</div>
          <div class="customer-row"><span class="lbl">${isRTL ? 'الاسم:' : 'Name:'}</span><span>${createdCustomer.name}</span></div>
          <div class="customer-row"><span class="lbl">${isRTL ? 'الهاتف:' : 'Phone:'}</span><span dir="ltr">${createdCustomer.phone}</span></div>
          <div class="customer-row"><span class="lbl">${isRTL ? 'التاريخ:' : 'Date:'}</span><span>${new Date().toLocaleDateString(isRTL ? 'ar-IQ' : 'en-US')}</span></div>
        </div>
        <div class="total-badge">${isRTL ? `إجمالي الطلبات النشطة: ${activeTickets.length}` : `Total Active Repairs: ${activeTickets.length}`}</div>
        ${deviceSections}
        <div class="keep-note">${isRTL ? 'احتفظ بهذه الورقة لاستلام جميع أجهزتك' : 'Keep this sheet to collect all your devices'}</div>
        <div class="footer">${isRTL ? 'شكراً لثقتكم بنا' : 'Thank you for trusting us'}</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (!currentTechnician) {
    return null;
  }

  if (createdTicket) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <Button variant="ghost" onClick={() => navigate('/technician/dashboard')} data-testid="button-back">
              <BackIcon className="h-4 w-4 me-2" />
              {isRTL ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
            </Button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-8">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-green-600" data-testid="text-success-title">
                {isRTL ? 'تم إنشاء طلب الصيانة بنجاح!' : 'Repair Request Created Successfully!'}
              </CardTitle>
              <CardDescription>
                {isRTL ? 'يمكنك طباعة بطاقة الصيانة للعميل' : 'You can print the repair label for the customer'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Multi-device warning banner */}
              {activeTickets.length > 1 && createdCustomer && (
                <div className="flex gap-3 p-4 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700" data-testid="banner-multi-device-warning">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-2 min-w-0">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      {isRTL
                        ? `تنبيه: هذا العميل (${createdCustomer.customerId}) لديه ${activeTickets.length} طلبات نشطة في نفس الوقت`
                        : `Note: This customer (${createdCustomer.customerId}) has ${activeTickets.length} active repairs simultaneously`}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {isRTL
                        ? 'استخدم "طباعة ملخص" لطباعة ورقة موحدة تشمل جميع الأجهزة'
                        : 'Use "Print Summary" to print one consolidated sheet covering all devices'}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {activeTickets.filter(t => t.id !== createdTicket.id).map(t => (
                        <Badge key={t.id} variant="outline" className="text-xs font-mono bg-white dark:bg-transparent border-amber-400 text-amber-800 dark:text-amber-300">
                          {t.ticketNumber}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Printable Label Preview */}
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 bg-white">
                <div ref={printRef} data-testid="print-label">
                  <div className="store-name" style={{ textAlign: 'center', fontWeight: 900, fontSize: '11px', letterSpacing: '0.3px' }}>
                    العين لتجارة الحاسبات
                  </div>
                  <div className="barcode-container" style={{ textAlign: 'center', margin: '4px 0' }}>
                    <svg ref={barcodeRef} />
                  </div>
                  <div className="serial" style={{ textAlign: 'center', fontWeight: 800, fontSize: '12px', letterSpacing: '0.5px' }}>
                    {createdTicket.ticketNumber}
                  </div>
                  {createdCustomer && (
                    <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '9px', letterSpacing: '0.3px', marginTop: '1px' }}>
                      {createdCustomer.customerId} — {createdTicket.customerName}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
                <Button onClick={handlePrint} className="gap-2" disabled={!qrReady} data-testid="button-print-label">
                  <Printer className="h-4 w-4" />
                  {qrReady ? (isRTL ? 'طباعة البطاقة' : 'Print Label') : (isRTL ? 'جاري التحميل...' : 'Loading...')}
                </Button>
                <Button onClick={handlePrintCustomerReceipt} variant="secondary" className="gap-2" disabled={!qrReady} data-testid="button-print-receipt">
                  <Receipt className="h-4 w-4" />
                  {isRTL ? 'طباعة إيصال العميل' : 'Print Customer Receipt'}
                </Button>
                {activeTickets.length > 1 && (
                  <Button onClick={handlePrintCustomerSummary} variant="secondary" className="gap-2 border-amber-400 dark:border-amber-600" disabled={!createdCustomer} data-testid="button-print-summary">
                    <LayoutList className="h-4 w-4" />
                    {isRTL ? `طباعة ملخص (${activeTickets.length} أجهزة)` : `Print Summary (${activeTickets.length} devices)`}
                  </Button>
                )}
                <Button variant="outline" onClick={handleNewRequest} className="gap-2" data-testid="button-new-request">
                  <Plus className="h-4 w-4" />
                  {isRTL ? 'طلب جديد' : 'New Request'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/technician/dashboard')} data-testid="button-back">
            <BackIcon className="h-4 w-4 me-2" />
            {isRTL ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-new-request-title">
              {isRTL ? 'طلب صيانة جديد' : 'New Repair Request'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'أدخل بيانات العميل والجهاز' : 'Enter customer and device information'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Customer Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">
                    {isRTL ? 'معلومات العميل' : 'Customer Information'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{isRTL ? 'اسم العميل' : 'Customer Name'} *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={isRTL ? 'أدخل اسم العميل' : 'Enter customer name'}
                              data-testid="input-customer-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{isRTL ? 'رقم الهاتف' : 'Phone Number'} *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="tel"
                              dir="ltr"
                              placeholder="07XX XXX XXXX"
                              data-testid="input-customer-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customerEmail"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>{isRTL ? 'البريد الإلكتروني (اختياري)' : 'Email (Optional)'}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              dir="ltr"
                              placeholder="email@example.com"
                              data-testid="input-customer-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Device Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">
                    {isRTL ? 'معلومات الجهاز' : 'Device Information'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="deviceType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{isRTL ? 'نوع الجهاز' : 'Device Type'} *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-device-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="laptop">{isRTL ? 'لابتوب' : 'Laptop'}</SelectItem>
                              <SelectItem value="desktop">{isRTL ? 'كمبيوتر مكتبي' : 'Desktop'}</SelectItem>
                              <SelectItem value="mobile">{isRTL ? 'موبايل' : 'Mobile'}</SelectItem>
                              <SelectItem value="tablet">{isRTL ? 'تابلت' : 'Tablet'}</SelectItem>
                              <SelectItem value="printer">{isRTL ? 'طابعة' : 'Printer'}</SelectItem>
                              <SelectItem value="other">{isRTL ? 'أخرى' : 'Other'}</SelectItem>
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
                          <FormLabel>{isRTL ? 'الأولوية' : 'Priority'}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-priority">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">{isRTL ? 'منخفضة' : 'Low'}</SelectItem>
                              <SelectItem value="normal">{isRTL ? 'عادية' : 'Normal'}</SelectItem>
                              <SelectItem value="high">{isRTL ? 'عالية' : 'High'}</SelectItem>
                              <SelectItem value="urgent">{isRTL ? 'عاجلة' : 'Urgent'}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="deviceBrand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{isRTL ? 'الشركة المصنعة' : 'Brand'} *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={isRTL ? 'مثال: Dell, HP, Lenovo' : 'e.g., Dell, HP, Lenovo'}
                              data-testid="input-device-brand"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="deviceModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{isRTL ? 'الموديل' : 'Model'} *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={isRTL ? 'مثال: Inspiron 15' : 'e.g., Inspiron 15'}
                              data-testid="input-device-model"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Problem Description */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">
                    {isRTL ? 'وصف المشكلة' : 'Problem Description'}
                  </h3>
                  <FormField
                    control={form.control}
                    name="issueDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isRTL ? 'وصف المشكلة' : 'Issue Description'} *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder={isRTL ? 'اكتب وصف المشكلة بالتفصيل...' : 'Describe the problem in detail...'}
                            rows={4}
                            data-testid="textarea-issue-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-request">
                  <Plus className="h-4 w-4 me-2" />
                  {createMutation.isPending 
                    ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') 
                    : (isRTL ? 'إنشاء طلب الصيانة' : 'Create Repair Request')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
