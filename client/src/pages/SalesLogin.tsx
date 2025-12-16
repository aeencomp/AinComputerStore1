import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, User, Lock, Loader2 } from "lucide-react";

export default function SalesLogin() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { data: currentUser, isLoading: authLoading } = useQuery({
    queryKey: ['/api/sales/auth/me'],
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest('POST', '/api/sales/auth/login', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/auth/me'] });
      toast({
        title: language === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Login successful',
      });
      setLocation("/sales");
    },
    onError: (error: any) => {
      toast({
        title: language === 'ar' ? 'فشل تسجيل الدخول' : 'Login failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (currentUser) {
    setLocation("/sales");
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <ShoppingCart className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">
            {language === 'ar' ? 'بوابة المبيعات' : 'Sales Portal'}
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            {language === 'ar' ? 'تسجيل الدخول للوصول إلى نقطة البيع' : 'Login to access Point of Sale'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {language === 'ar' ? 'اسم المستخدم' : 'Username'}
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={language === 'ar' ? 'أدخل اسم المستخدم' : 'Enter username'}
                required
                data-testid="input-sales-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                {language === 'ar' ? 'كلمة المرور' : 'Password'}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={language === 'ar' ? 'أدخل كلمة المرور' : 'Enter password'}
                required
                data-testid="input-sales-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loginMutation.isPending}
              data-testid="button-sales-login"
            >
              {loginMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                language === 'ar' ? 'تسجيل الدخول' : 'Login'
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {language === 'ar' 
              ? 'للوصول إلى لوحة الإدارة الرئيسية، استخدم' 
              : 'For main admin dashboard, use'}
            {' '}
            <a href="/admin/login" className="text-primary hover:underline">
              {language === 'ar' ? 'تسجيل دخول المدير' : 'Admin Login'}
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
