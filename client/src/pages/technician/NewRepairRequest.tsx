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
import { ArrowLeft, ArrowRight, Plus, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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

  const { data: currentTechnician, isLoading: isAuthLoading, error: authError } = useQuery<Technician>({
    queryKey: ['/api/technician/auth/me'],
    retry: false,
  });

  useEffect(() => {
    if (authError || (!isAuthLoading && !currentTechnician)) {
      navigate('/technician/login');
    }
  }, [authError, isAuthLoading, currentTechnician, navigate]);


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
                size: 25mm 50mm; 
                margin: 0; 
              }
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 0;
                direction: ${isRTL ? 'rtl' : 'ltr'};
              }
              .label-container {
                width: 25mm;
                height: 50mm;
                padding: 1mm;
                box-sizing: border-box;
                font-size: 6px;
                line-height: 1.2;
                text-align: center;
                overflow: hidden;
              }
              .label-container > div {
                margin-bottom: 0.5mm;
              }
              .label-container svg {
                max-width: 22mm;
                height: auto;
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
    form.reset();
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
              {/* Printable Label Preview - Vertical 25mm x 50mm */}
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 bg-white flex justify-center">
                <div ref={printRef} data-testid="print-label">
                  <div className="label-container" style={{ 
                    border: '1px solid #000', 
                    padding: '3px', 
                    width: '94px', 
                    minHeight: '189px',
                    fontSize: '7px',
                    lineHeight: '1.2',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontWeight: 'bold', fontSize: '6px', marginBottom: '2px' }}>
                      {isRTL ? 'العين للحاسبات' : 'Al-Ain Computers'}
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '8px', marginBottom: '2px' }}>
                      {createdTicket.ticketNumber}
                    </div>
                    <div style={{ marginBottom: '2px' }}>
                      <QRCodeSVG value={createdTicket.ticketNumber} size={60} level="M" />
                    </div>
                    <div style={{ textAlign: isRTL ? 'right' : 'left', fontSize: '6px' }}>
                      <div style={{ marginBottom: '1px' }}>
                        <span style={{ fontWeight: 'bold' }}>{isRTL ? 'الاسم: ' : 'Name: '}</span>
                        {createdTicket.customerName}
                      </div>
                      <div style={{ marginBottom: '1px' }} dir="ltr">
                        <span style={{ fontWeight: 'bold' }}>{isRTL ? 'هاتف: ' : 'Tel: '}</span>
                        {createdTicket.customerPhone}
                      </div>
                      <div style={{ marginBottom: '1px' }}>
                        <span style={{ fontWeight: 'bold' }}>{isRTL ? 'جهاز: ' : 'Dev: '}</span>
                        {createdTicket.deviceBrand} {createdTicket.deviceModel}
                      </div>
                      <div style={{ borderTop: '1px dashed #000', paddingTop: '2px', marginTop: '2px' }}>
                        <div style={{ fontWeight: 'bold' }}>{isRTL ? 'المشكلة:' : 'Issue:'}</div>
                        <div style={{ fontSize: '5px', maxHeight: '30px', overflow: 'hidden' }}>
                          {createdTicket.issueDescriptionAr || createdTicket.issueDescriptionEn}
                        </div>
                      </div>
                      <div style={{ fontSize: '5px', textAlign: 'center', marginTop: '2px', color: '#666' }}>
                        {new Date().toLocaleDateString(isRTL ? 'ar-IQ' : 'en-US')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={handlePrint} className="gap-2" data-testid="button-print-label">
                  <Printer className="h-4 w-4" />
                  {isRTL ? 'طباعة البطاقة' : 'Print Label'}
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
