import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Wrench, ArrowLeft, ArrowRight } from 'lucide-react';

export default function ShopLogin() {
  const [, navigate] = useLocation();
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const data = await apiRequest('POST', '/api/saas/auth/login', formData);
      if (data?.shop?.shopName) {
        localStorage.setItem('saasShopName', data.shop.shopName);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/saas/auth/me'] });
      toast({
        title: language === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Login successful',
        description: language === 'ar' ? 'مرحباً بك في لوحة تحكم المتجر' : 'Welcome to your shop dashboard',
      });
      navigate('/shop');
    } catch (error: any) {
      let errorMessage = error.message;
      if (error.status === 403) {
        errorMessage = language === 'ar' 
          ? 'عذراً، اشتراك المتجر منتهي أو تم إيقافه. يرجى التواصل مع الإدارة.' 
          : 'Sorry, your shop subscription has expired or is suspended. Please contact administration.';
      }
      toast({
        title: language === 'ar' ? 'خطأ في تسجيل الدخول' : 'Login Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isRTL = language === 'ar';
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Wrench className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold" data-testid="text-shop-login-title">
              {language === 'ar' ? 'نظام إدارة الصيانة' : 'Repair Management System'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? 'تسجيل دخول أصحاب المحلات والتقنيين' : 'Login for shop owners and technicians'}
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{language === 'ar' ? 'اسم المستخدم' : 'Username'}</Label>
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder={language === 'ar' ? 'أدخل اسم المستخدم' : 'Enter username'}
                required
                data-testid="input-shop-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{language === 'ar' ? 'كلمة المرور' : 'Password'}</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={language === 'ar' ? 'أدخل كلمة المرور' : 'Enter password'}
                required
                data-testid="input-shop-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
              data-testid="button-shop-login"
            >
              <Wrench className="w-4 h-4 me-2" />
              {isLoading 
                ? (language === 'ar' ? 'جاري تسجيل الدخول...' : 'Logging in...') 
                : (language === 'ar' ? 'تسجيل الدخول' : 'Login')}
            </Button>
            <Button 
              type="button"
              variant="outline" 
              className="w-full" 
              onClick={() => navigate("/")}
              data-testid="button-shop-back-home"
            >
              <BackIcon className="w-4 h-4 me-2" />
              {language === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
