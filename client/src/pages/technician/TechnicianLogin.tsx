import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

export default function TechnicianLogin() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      if (password === 'tech123') {
        localStorage.setItem('technicianAuth', 'authenticated');
        toast({
          title: t('repair.technician.login.successTitle') || 'Success',
          description: t('repair.technician.login.successDescription') || 'Welcome back!',
        });
        setLocation('/technician/dashboard');
      } else {
        toast({
          title: t('repair.technician.login.errorTitle') || 'Error',
          description: t('repair.technician.login.errorDescription') || 'Incorrect password',
          variant: 'destructive',
        });
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle data-testid="text-technician-login-title">{t('repair.technician.login.title')}</CardTitle>
          <CardDescription>{t('repair.technician.login.description') || 'Enter your password to access the technician dashboard'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                {t('repair.technician.login.password')}
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('repair.technician.login.passwordPlaceholder') || 'Enter password'}
                required
                data-testid="input-technician-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-technician-login">
              {isLoading ? t('common.loading') : t('repair.technician.login.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
