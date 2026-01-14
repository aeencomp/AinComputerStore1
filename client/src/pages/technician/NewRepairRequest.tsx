import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { ArrowLeft, ArrowRight, Plus, Printer, Receipt } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import type { RepairTicket } from '@shared/schema';
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

  const { data: currentTechnician, isLoading: isAuthLoading, error: authError } = useQuery<Technician>({
    queryKey: ['/api/technician/auth/me'],
    retry: false,
  });

  useEffect(() => {
    if (authError || (!isAuthLoading && !currentTechnician)) {
      navigate('/technician/login');
    }
  }, [authError, isAuthLoading, currentTechnician, navigate]);

  const [barcodeReady, setBarcodeReady] = useState(false);

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
    if (createdTicket && barcodeRef.current) {
      requestAnimationFrame(() => {
        if (barcodeRef.current) {
          try {
            JsBarcode(barcodeRef.current, createdTicket.ticketNumber, {
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
  }, [createdTicket]);

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
          <html dir="${isRTL ? 'rtl' : 'ltr'}">
          <head>
            <title>${isRTL ? 'بطاقة الصيانة' : 'Repair Label'}</title>
            <style>
              @page { 
                size: 80mm 40mm; 
                margin: 1mm; 
              }
              body { 
                font-family: Arial, sans-serif; 
                font-size: 8px; 
                margin: 0; 
                padding: 2px;
                direction: ${isRTL ? 'rtl' : 'ltr'};
              }
              .label-container {
                border: 1px solid #000;
                padding: 2px;
                max-width: 78mm;
              }
              .ticket-number {
                font-size: 11px;
                font-weight: bold;
                text-align: center;
                margin-bottom: 2px;
              }
              .barcode-container {
                text-align: center;
                margin: 2px 0;
              }
              .barcode-container svg {
                max-width: 100%;
                height: 22px;
              }
              .info-row {
                display: flex;
                justify-content: space-between;
                margin: 1px 0;
                font-size: 7px;
              }
              .info-label {
                font-weight: bold;
              }
              .problem-section {
                margin-top: 2px;
                padding-top: 2px;
                border-top: 1px dashed #000;
              }
              .problem-title {
                font-weight: bold;
                font-size: 7px;
              }
              .problem-text {
                font-size: 6px;
                margin-top: 1px;
                max-height: 16px;
                overflow: hidden;
              }
              .store-name {
                text-align: center;
                font-size: 9px;
                font-weight: bold;
                margin-bottom: 1px;
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

  const handleNewRequest = () => {
    setCreatedTicket(null);
    setBarcodeReady(false);
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
              size: 72.1mm 210mm; 
              margin: 2mm; 
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body { 
              font-family: Arial, sans-serif; 
              font-size: 13px; 
              font-weight: 600;
              width: 68mm;
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
          
          <div class="date-time">
            ${new Date().toLocaleDateString(isRTL ? 'ar-IQ' : 'en-US')} - ${new Date().toLocaleTimeString(isRTL ? 'ar-IQ' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          
          <div class="section">
            <div class="section-title">${isRTL ? 'معلومات العميل' : 'Customer Information'}</div>
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
            ${isRTL ? 'لتتبع حالة جهازك، استخدم رقم التذكرة أعلاه' : 'To track your device status, use the ticket number above'}
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
              {/* Printable Label Preview */}
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 bg-white">
                <div ref={printRef} data-testid="print-label">
                  <div className="label-container" style={{ border: '1px solid #000', padding: '8px', maxWidth: '300px', margin: '0 auto' }}>
                    <div className="store-name" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                      {isRTL ? 'العين لتجارة الحاسبات' : 'Al-Ain Computer Trading'}
                    </div>
                    <div className="ticket-number" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
                      {createdTicket.ticketNumber}
                    </div>
                    <div className="barcode-container" style={{ textAlign: 'center', marginBottom: '8px' }}>
                      <svg ref={barcodeRef} />
                    </div>
                    <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 'bold' }}>{isRTL ? 'الاسم:' : 'Name:'}</span>
                        <span>{createdTicket.customerName}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 'bold' }}>{isRTL ? 'الهاتف:' : 'Phone:'}</span>
                        <span dir="ltr">{createdTicket.customerPhone}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 'bold' }}>{isRTL ? 'الجهاز:' : 'Device:'}</span>
                        <span>{createdTicket.deviceBrand} {createdTicket.deviceModel}</span>
                      </div>
                      <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #000' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{isRTL ? 'المشكلة:' : 'Problem:'}</div>
                        <div style={{ fontSize: '10px' }}>
                          {createdTicket.issueDescriptionAr || createdTicket.issueDescriptionEn}
                        </div>
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '9px', textAlign: 'center', color: '#666' }}>
                        {new Date().toLocaleDateString(isRTL ? 'ar-IQ' : 'en-US')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
                <Button onClick={handlePrint} className="gap-2" disabled={!barcodeReady} data-testid="button-print-label">
                  <Printer className="h-4 w-4" />
                  {barcodeReady ? (isRTL ? 'طباعة البطاقة' : 'Print Label') : (isRTL ? 'جاري التحميل...' : 'Loading...')}
                </Button>
                <Button onClick={handlePrintCustomerReceipt} variant="secondary" className="gap-2" data-testid="button-print-receipt">
                  <Receipt className="h-4 w-4" />
                  {isRTL ? 'طباعة إيصال العميل' : 'Print Customer Receipt'}
                </Button>
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
