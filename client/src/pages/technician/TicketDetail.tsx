import { useState, useEffect, useMemo } from 'react';
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
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export default function TicketDetail() {
  const [, params] = useRoute('/technician/tickets/:id');
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();

  useEffect(() => {
    const isAuth = localStorage.getItem('technicianAuth');
    if (!isAuth) {
      setLocation('/technician/login');
    }
  }, [setLocation]);

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
      return await apiRequest(`/api/admin/repair-tickets/${params.id}`, 'PATCH', {
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

  const onSubmit = (data: z.infer<typeof updateSchema>) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t('common.loading')}</p>
      </div>
    );
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

                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-ticket">
                  {updateMutation.isPending ? t('repair.edit.saving') : t('repair.edit.save')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
