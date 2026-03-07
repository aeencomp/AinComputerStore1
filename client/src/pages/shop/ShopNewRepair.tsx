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
import { ArrowLeft, ArrowRight, Plus, Printer, Receipt, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import type { SaasRepairTicket, SaasRepairCustomer, SaasShop } from '@shared/schema';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export default function ShopNewRepair() {
  const [, navigate] = useLocation();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isRTL = language === 'ar';
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const [createdTicket, setCreatedTicket] = useState<SaasRepairTicket | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [qrReady, setQrReady] = useState(false);

  const { data: shopMe, isLoading: isAuthLoading } = useQuery<SaasShop>({
    queryKey: ['/api/saas/auth/me'],
    retry: false,
  });

  useEffect(() => {
    if (!isAuthLoading && !shopMe) {
      navigate('/shop/login');
    }
  }, [isAuthLoading, shopMe, navigate]);

  const { data: createdCustomer } = useQuery<SaasRepairCustomer>({
    queryKey: ['/api/saas/customers', createdTicket?.repairCustomerId],
    enabled: !!createdTicket?.repairCustomerId,
  });

  const { data: activeTickets = [] } = useQuery<SaasRepairTicket[]>({
    queryKey: ['/api/saas/customers', createdCustomer?.id, 'active-tickets'],
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
                width: 2,
                height: 44,
                displayValue: false,
                margin: 0,
                background: '#ffffff',
                lineColor: '#000000',
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
      const res = await apiRequest('POST', '/api/saas/tickets', payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/saas/tickets'] });
      setCreatedTicket(data.ticket);
      toast({
        title: isRTL ? 'تم إنشاء الطلب بنجاح' : 'Request Created Successfully',
        description: isRTL ? `رقم التذكرة: ${data.ticket?.ticketNumber}` : `Ticket Number: ${data.ticket?.ticketNumber}`,
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

  const handlePrintLabel = () => {
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
              body { width: 50mm; height: 25mm; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: Arial, Helvetica, sans-serif; background: #fff; padding: 0.8mm 1mm; }
              .store-name { font-size: 7pt; font-weight: 900; text-align: center; letter-spacing: 0.2px; line-height: 1.1; white-space: nowrap; overflow: hidden; max-width: 48mm; }
              .barcode-container { text-align: center; width: 100%; margin: 0.5mm 0; }
              .barcode-container svg { width: 48mm; height: 13mm; display: block; margin: 0 auto; }
              .serial { font-size: 9pt; font-weight: 900; text-align: center; letter-spacing: 1.5px; font-family: 'Courier New', Courier, monospace; }
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
    if (!createdTicket) return;
    
    const priorityText = {
      urgent: isRTL ? 'عاجل' : 'Urgent',
      high: isRTL ? 'مرتفع' : 'High',
      normal: isRTL ? 'عادي' : 'Normal',
      low: isRTL ? 'منخفض' : 'Low',
      vip: isRTL ? 'VIP - عميل مميز' : 'VIP',
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
            @page { size: 72.1mm auto; margin: 2mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 13px; font-weight: 600; width: 68mm; padding: 3mm; direction: ${isRTL ? 'rtl' : 'ltr'}; line-height: 1.5; color: #000; }
            .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
            .store-name { font-size: 18px; font-weight: 900; margin-bottom: 6px; }
            .receipt-title { text-align: center; font-size: 16px; font-weight: 900; margin: 10px 0; padding: 6px; background: #e0e0e0; border-radius: 4px; border: 1px solid #000; }
            .ticket-number { text-align: center; font-size: 22px; font-weight: 900; margin: 10px 0; padding: 8px; border: 3px dashed #000; }
            .section { margin: 12px 0; padding-bottom: 10px; border-bottom: 2px dashed #333; }
            .section-title { font-weight: 900; font-size: 14px; margin-bottom: 8px; text-decoration: underline; }
            .info-row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 12px; font-weight: 700; }
            .info-label { font-weight: 900; }
            .problem-box { background: #f0f0f0; padding: 10px; border-radius: 4px; margin-top: 8px; font-size: 12px; border: 1px solid #999; }
            .terms { margin-top: 14px; padding-top: 10px; border-top: 2px solid #000; }
            .footer { text-align: center; margin-top: 14px; padding-top: 10px; border-top: 3px solid #000; font-size: 12px; font-weight: 900; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="store-name">${shopMe?.shopName}</div>
            <div class="store-info">${shopMe?.city}</div>
            <div class="store-info">${shopMe?.phone}</div>
          </div>
          <div class="receipt-title">${isRTL ? 'إيصال استلام جهاز للصيانة' : 'Device Repair Receipt'}</div>
          <div class="ticket-number">${createdTicket.ticketNumber}</div>
          <div style="text-align: center; margin: 8px 0;">
            <img src="${qrCodeDataUrl}" alt="QR Code" style="width: 100px; height: 100px; margin: 0 auto;" />
          </div>
          <div class="section">
            <div class="section-title">${isRTL ? 'معلومات العميل' : 'Customer Information'}</div>
            ${createdCustomer ? `<div class="info-row"><span class="info-label">${isRTL ? 'رقم العميل:' : 'Customer ID:'}</span><span>${createdCustomer.customerId}</span></div>` : ''}
            <div class="info-row"><span class="info-label">${isRTL ? 'الاسم:' : 'Name:'}</span><span>${createdTicket.customerName}</span></div>
            <div class="info-row"><span class="info-label">${isRTL ? 'الهاتف:' : 'Phone:'}</span><span dir="ltr">${createdTicket.customerPhone}</span></div>
          </div>
          <div class="section">
            <div class="section-title">${isRTL ? 'معلومات الجهاز' : 'Device Information'}</div>
            <div class="info-row"><span class="info-label">${isRTL ? 'النوع:' : 'Type:'}</span><span>${deviceTypeText}</span></div>
            <div class="info-row"><span class="info-label">${isRTL ? 'الماركة:' : 'Brand:'}</span><span>${createdTicket.deviceBrand}</span></div>
            <div class="info-row"><span class="info-label">${isRTL ? 'الموديل:' : 'Model:'}</span><span>${createdTicket.deviceModel}</span></div>
          </div>
          <div class="section">
            <div class="section-title">${isRTL ? 'وصف المشكلة' : 'Problem Description'}</div>
            <div class="problem-box">${createdTicket.issueDescriptionAr}</div>
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

  const handleNewRequest = () => {
    setCreatedTicket(null);
    setQrReady(false);
    setQrCodeDataUrl('');
    form.reset();
  };

  if (createdTicket) {
    return (
      <div className="container mx-auto p-4 flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">{isRTL ? 'تم إنشاء الطلب' : 'Request Created'}</CardTitle>
            <CardDescription className="text-center">
              {isRTL ? 'يمكنك الآن طباعة الملصق والإيصال' : 'You can now print the label and receipt'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">{isRTL ? 'رقم التذكرة' : 'Ticket Number'}</div>
              <div className="text-3xl font-bold tracking-tighter">{createdTicket.ticketNumber}</div>
            </div>

            {createdCustomer && (
              <div className="text-center space-y-1 p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">{isRTL ? 'رقم العميل' : 'Customer ID'}</div>
                <div className="font-mono font-bold text-lg">{createdCustomer.customerId}</div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <Button onClick={handlePrintLabel} className="w-full" variant="outline">
                <Printer className="ml-2 h-4 w-4" />
                {isRTL ? 'طباعة الملصق (50x25)' : 'Print Label (50x25)'}
              </Button>
              <Button onClick={handlePrintCustomerReceipt} className="w-full" variant="outline">
                <Receipt className="ml-2 h-4 w-4" />
                {isRTL ? 'طباعة إيصال العميل' : 'Print Customer Receipt'}
              </Button>
              <Button onClick={handleNewRequest} className="w-full">
                <Plus className="ml-2 h-4 w-4" />
                {isRTL ? 'طلب صيانة جديد' : 'New Repair Request'}
              </Button>
            </div>

            <div className="hidden">
              <div ref={printRef}>
                <div className="store-name">{shopMe?.shopName}</div>
                <div className="barcode-container">
                  <svg ref={barcodeRef}></svg>
                </div>
                <div className="serial">{createdTicket.ticketNumber}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/shop')}>
          <BackIcon className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{isRTL ? 'طلب صيانة جديد' : 'New Repair Request'}</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'معلومات العميل' : 'Customer Info'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isRTL ? 'رقم الهاتف' : 'Phone Number'}</FormLabel>
                      <FormControl>
                        <Input placeholder="07XXXXXXXXX" {...field} data-testid="input-customer-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isRTL ? 'اسم العميل' : 'Customer Name'}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-customer-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isRTL ? 'البريد الإلكتروني (اختياري)' : 'Email (Optional)'}</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} data-testid="input-customer-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {activeTickets.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      {isRTL 
                        ? `تنبيه: هذا العميل لديه ${activeTickets.length} طلبات صيانة نشطة حالياً.`
                        : `Warning: This customer has ${activeTickets.length} active repair requests.`}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'معلومات الجهاز' : 'Device Info'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="deviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isRTL ? 'نوع الجهاز' : 'Device Type'}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="laptop">{isRTL ? 'لابتوب' : 'Laptop'}</SelectItem>
                          <SelectItem value="desktop">{isRTL ? 'كمبيوتر مكتبي' : 'Desktop'}</SelectItem>
                          <SelectItem value="monitor">{isRTL ? 'شاشة' : 'Monitor'}</SelectItem>
                          <SelectItem value="printer">{isRTL ? 'طابعة' : 'Printer'}</SelectItem>
                          <SelectItem value="other">{isRTL ? 'أخرى' : 'Other'}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="deviceBrand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isRTL ? 'الماركة' : 'Brand'}</FormLabel>
                        <FormControl>
                          <Input placeholder="HP, Dell, Apple..." {...field} data-testid="input-device-brand" />
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
                        <FormLabel>{isRTL ? 'الموديل' : 'Model'}</FormLabel>
                        <FormControl>
                          <Input placeholder="G5, XPS, MacBook..." {...field} data-testid="input-device-model" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isRTL ? 'الأولوية' : 'Priority'}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">{isRTL ? 'منخفض' : 'Low'}</SelectItem>
                          <SelectItem value="normal">{isRTL ? 'عادي' : 'Normal'}</SelectItem>
                          <SelectItem value="high">{isRTL ? 'مرتفع' : 'High'}</SelectItem>
                          <SelectItem value="urgent">{isRTL ? 'عاجل' : 'Urgent'}</SelectItem>
                          <SelectItem value="vip">{isRTL ? 'VIP - عميل مميز' : 'VIP'}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'وصف المشكلة' : 'Problem Description'}</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="issueDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea 
                        rows={4} 
                        placeholder={isRTL ? 'اشرح المشكلة بالتفصيل...' : 'Describe the problem in detail...'} 
                        {...field} 
                        data-testid="textarea-issue-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/shop')}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-repair">
              {createMutation.isPending ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ الطلب' : 'Save Request')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
