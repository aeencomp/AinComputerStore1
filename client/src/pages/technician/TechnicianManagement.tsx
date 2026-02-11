import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { ArrowLeft, ArrowRight, Plus, Pencil, Trash2, Wrench, Shield, User, Users, LogOut } from 'lucide-react';

interface Technician {
  id: string;
  username: string;
  displayName: string;
  isAdmin: number;
  isActive: number;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

const AVAILABLE_PERMISSIONS = [
  'view_tickets',
  'update_status',
  'manage_tickets',
  'manage_technicians',
  'view_revenue',
];

export default function TechnicianManagement() {
  const [, navigate] = useLocation();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    displayName: '',
    isAdmin: false,
    permissions: [] as string[],
  });

  const { data: currentTechnician, isLoading: isAuthLoading, error: authError } = useQuery<Technician>({
    queryKey: ['/api/technician/auth/me'],
    retry: false,
  });

  const { data: technicians, isLoading: isTechniciansLoading } = useQuery<Technician[]>({
    queryKey: ['/api/admin/technicians'],
    enabled: !!currentTechnician && currentTechnician.isAdmin === 1,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest('POST', '/api/admin/technicians', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/technicians'] });
      toast({
        title: t('technician.management.created'),
      });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest('PATCH', `/api/admin/technicians/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/technicians'] });
      toast({
        title: t('technician.management.updated'),
      });
      setEditingTechnician(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/admin/technicians/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/technicians'] });
      toast({
        title: t('technician.management.deleted'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/technician/auth/logout');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/technician/auth/me'] });
      navigate('/technician/login');
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('common.errorOccurred'),
        variant: 'destructive',
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      displayName: '',
      isAdmin: false,
      permissions: [],
    });
  };

  const handleAdd = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const handleEdit = (technician: Technician) => {
    setEditingTechnician(technician);
    setFormData({
      username: technician.username,
      password: '',
      displayName: technician.displayName,
      isAdmin: technician.isAdmin === 1,
      permissions: technician.permissions || [],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTechnician) {
      const updateData: any = {
        username: formData.username,
        displayName: formData.displayName,
        isAdmin: formData.isAdmin,
        permissions: formData.permissions,
      };
      if (formData.password) {
        updateData.password = formData.password;
      }
      updateMutation.mutate({ id: editingTechnician.id, data: updateData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const togglePermission = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Wrench className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (authError || !currentTechnician) {
    navigate('/technician/login');
    return null;
  }

  if (currentTechnician.isAdmin !== 1) {
    navigate('/technician/dashboard');
    return null;
  }

  const isRTL = language === 'ar';
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const TechnicianForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">{t('technician.management.username')}</Label>
        <Input
          id="username"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          required
          minLength={3}
          data-testid="input-technician-form-username"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="displayName">{t('technician.management.displayName')}</Label>
        <Input
          id="displayName"
          value={formData.displayName}
          onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
          required
          minLength={2}
          data-testid="input-technician-form-displayname"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password">
          {editingTechnician ? t('technician.management.newPassword') : t('technician.management.password')}
        </Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required={!editingTechnician}
          minLength={6}
          placeholder={editingTechnician ? t('technician.management.leaveBlankPassword') : ''}
          data-testid="input-technician-form-password"
        />
      </div>
      
      <div className="flex items-center justify-between">
        <Label htmlFor="isAdmin">{t('technician.management.isAdmin')}</Label>
        <Switch
          id="isAdmin"
          checked={formData.isAdmin}
          onCheckedChange={(checked) => setFormData({ ...formData, isAdmin: checked })}
          data-testid="switch-technician-form-admin"
        />
      </div>
      
      <div className="space-y-3">
        <Label>{t('technician.management.permissions')}</Label>
        <div className="space-y-2">
          {AVAILABLE_PERMISSIONS.map((permission) => (
            <div key={permission} className="flex items-center gap-2">
              <Checkbox
                id={permission}
                checked={formData.permissions.includes(permission)}
                onCheckedChange={() => togglePermission(permission)}
                data-testid={`checkbox-permission-${permission}`}
              />
              <Label htmlFor={permission} className="font-normal cursor-pointer">
                {t(`technician.management.permission.${permission}`)}
              </Label>
            </div>
          ))}
        </div>
      </div>
      
      <DialogFooter>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-technician-form-submit">
          {editingTechnician ? t('common.save') : t('technician.management.addNew')}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/technician/dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back-to-dashboard">
                <BackIcon className="h-5 w-5" />
              </Button>
            </Link>
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-technician-management-title">
                {t('technician.management.title')}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleAdd} data-testid="button-add-technician">
                  <Plus className="h-4 w-4 me-2" />
                  {t('technician.management.addNew')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('technician.management.addNew')}</DialogTitle>
                </DialogHeader>
                <TechnicianForm />
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={handleLogout} disabled={logoutMutation.isPending} data-testid="button-technician-logout">
              <LogOut className="h-4 w-4 me-2" />
              {t('technician.dashboard.logout')}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {isTechniciansLoading ? (
          <div className="text-center py-12">
            {t('common.loading')}
          </div>
        ) : technicians && technicians.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {technicians.map((technician) => (
              <Card key={technician.id} data-testid={`card-technician-${technician.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        {technician.isAdmin === 1 ? (
                          <Shield className="h-5 w-5 text-primary" />
                        ) : (
                          <User className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{technician.displayName}</CardTitle>
                        <CardDescription>@{technician.username}</CardDescription>
                      </div>
                    </div>
                    <Badge className={technician.isActive === 1 ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'}>
                      {technician.isActive === 1 ? t('technician.management.active') : t('technician.management.inactive')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-1">
                    {technician.isAdmin === 1 && (
                      <Badge variant="secondary" className="text-xs">
                        <Shield className="h-3 w-3 me-1" />
                        {t('technician.management.isAdmin')}
                      </Badge>
                    )}
                    {technician.permissions?.map((perm) => (
                      <Badge key={perm} variant="outline" className="text-xs">
                        {t(`technician.management.permission.${perm}`)}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <Dialog open={editingTechnician?.id === technician.id} onOpenChange={(open) => !open && setEditingTechnician(null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(technician)} data-testid={`button-edit-technician-${technician.id}`}>
                          <Pencil className="h-4 w-4 me-1" />
                          {t('technician.management.edit')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t('technician.management.edit')}</DialogTitle>
                        </DialogHeader>
                        <TechnicianForm />
                      </DialogContent>
                    </Dialog>
                    
                    {technician.id !== currentTechnician?.id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" data-testid={`button-delete-technician-${technician.id}`}>
                            <Trash2 className="h-4 w-4 me-1" />
                            {t('technician.management.delete')}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('technician.management.confirmDelete')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {technician.displayName} (@{technician.username})
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(technician.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t('technician.management.delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {t('technician.management.noTechnicians')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
