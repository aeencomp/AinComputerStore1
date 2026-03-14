import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Wrench, ArrowLeft, ArrowRight, Mail, ShieldCheck, Loader2 } from 'lucide-react';

export default function TechnicianLogin() {
  const [, navigate] = useLocation();
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [otp, setOtp] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isRTL = language === 'ar';
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await apiRequest('POST', '/api/technician/auth/login', formData);
      const data = await res.json();
      if (data.step === 'otp') {
        setMaskedEmail(data.maskedEmail || '');
        setStep('otp');
        toast({ title: language === 'ar' ? 'تم إرسال رمز التحقق' : 'OTP Sent', description: data.maskedEmail });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/technician/auth/me'] });
        toast({ title: t('technician.login.success.title'), description: t('technician.login.success.description') });
        navigate('/technician/dashboard');
      }
    } catch (error: any) {
      toast({ title: t('technician.login.error.title'), description: error.message || t('technician.login.error.description'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiRequest('POST', '/api/technician/auth/verify-otp', { username: formData.username, otp });
      queryClient.invalidateQueries({ queryKey: ['/api/technician/auth/me'] });
      toast({ title: t('technician.login.success.title') });
      navigate('/technician/dashboard');
    } catch (error: any) {
      toast({ title: language === 'ar' ? 'رمز التحقق غير صحيح' : 'Invalid OTP', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            {step === 'otp' ? <ShieldCheck className="w-8 h-8 text-primary" /> : <Wrench className="w-8 h-8 text-primary" />}
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold" data-testid="text-technician-login-title">
              {step === 'otp' ? (language === 'ar' ? 'التحقق برمز المرور' : 'OTP Verification') : t('technician.login.title')}
            </CardTitle>
            <CardDescription>
              {step === 'otp' ? (language === 'ar' ? `أدخل رمز التحقق المرسل إلى ${maskedEmail}` : `Enter OTP sent to ${maskedEmail}`) : t('technician.login.description')}
            </CardDescription>
          </div>
        </CardHeader>
        {step === 'credentials' ? (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t('technician.login.username')}</Label>
                <Input id="username" type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder={t('technician.login.usernamePlaceholder')} required data-testid="input-technician-username" disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('technician.login.password')}</Label>
                <Input id="password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder={t('technician.login.passwordPlaceholder')} required minLength={6} data-testid="input-technician-password" disabled={isLoading} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-technician-login">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wrench className="w-4 h-4 me-2" />{t('technician.login.submit')}</>}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/")} data-testid="button-technician-back-home">
                <BackIcon className="w-4 h-4 me-2" />{t('technician.login.backToHome')}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp" className="flex items-center gap-2"><Mail className="h-4 w-4" />{language === 'ar' ? 'رمز التحقق' : 'OTP Code'}</Label>
                <Input id="otp" type="text" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={language === 'ar' ? 'أدخل الرمز المكون من 6 أرقام' : 'Enter 6-digit code'} maxLength={6} className="text-center text-xl tracking-widest" autoFocus data-testid="input-technician-otp" disabled={isLoading} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-technician-verify-otp">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === 'ar' ? 'تأكيد الرمز' : 'Verify Code')}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => { setStep('credentials'); setOtp(''); }} data-testid="button-technician-back">
                <BackIcon className="w-4 h-4 me-2" />{language === 'ar' ? 'العودة' : 'Back'}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
