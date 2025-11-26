import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Wrench } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function RepairRequest() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');

  const formSchema = useMemo(() => z.object({
    customerName: z.string().min(1, t('validation.required') || 'Required'),
    customerPhone: z.string().min(1, t('validation.required') || 'Required'),
    customerEmail: z.string().email().optional().or(z.literal('')),
    deviceType: z.string().min(1, t('validation.required') || 'Required'),
    deviceBrand: z.string().min(1, t('validation.required') || 'Required'),
    deviceModel: z.string().min(1, t('validation.required') || 'Required'),
    issueDescriptionAr: z.string().min(10, t('validation.minLength') || 'Too short'),
    issueDescriptionEn: z.string().optional(),
    priority: z.string().default('normal'),
  }), [t]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      deviceType: 'laptop',
      deviceBrand: '',
      deviceModel: '',
      issueDescriptionAr: '',
      issueDescriptionEn: '',
      priority: 'normal',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const result = await apiRequest('POST', '/api/repair-tickets', data);
      return result.json();
    },
    onSuccess: (data: any) => {
      setTicketNumber(data.ticketNumber);
      setShowSuccessDialog(true);
      form.reset();
    },
    onError: () => {
      toast({
        title: t('repair.request.errorTitle'),
        description: t('repair.request.errorMessage'),
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="h-6 w-6" />
              <CardTitle data-testid="text-repair-request-title">{t('repair.request.title')}</CardTitle>
            </div>
            <CardDescription>{t('repair.request.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">{t('repair.request.customerInfo')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('repair.request.customerName')}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-customer-name" />
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
                          <FormLabel>{t('repair.request.customerPhone')}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-customer-phone" />
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
                          <FormLabel>{t('repair.request.customerEmail')}</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-customer-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">{t('repair.request.deviceInfo')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="deviceType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('repair.request.deviceType')}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-device-type">
                                <SelectValue />
                              </SelectTrigger>
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
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="deviceBrand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('repair.request.deviceBrand')}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-device-brand" />
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
                          <FormLabel>{t('repair.request.deviceModel')}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-device-model" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="issueDescriptionAr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('repair.request.issueDescription')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('repair.request.issueDescriptionPlaceholder')}
                            rows={6}
                            {...field}
                            data-testid="textarea-issue-description"
                          />
                        </FormControl>
                        <FormDescription>
                          {t('repair.request.issueDescriptionNote') || 'Describe the issue in detail'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-repair-request">
                  {createMutation.isPending ? t('repair.request.submitting') : t('repair.request.submit')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('repair.request.successTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="text-lg font-semibold" data-testid="text-ticket-number">
                {t('repair.request.successMessage').replace('{ticketNumber}', ticketNumber)}
              </p>
              <p>{t('repair.request.successNote')}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={() => {
              setShowSuccessDialog(false);
              setLocation('/');
            }} data-testid="button-close-success">
              {t('common.ok') || 'OK'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
