import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiRequest('POST', '/api/auth/login', formData);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: language === 'ar' ? "تم تسجيل الدخول بنجاح" : "Login successful",
        description: language === 'ar' ? "مرحباً بك مرة أخرى" : "Welcome back",
      });
      navigate("/");
    } catch (error: any) {
      toast({
        title: language === 'ar' ? "خطأ في تسجيل الدخول" : "Login error",
        description: error.message || (language === 'ar' ? "البريد الإلكتروني أو كلمة المرور غير صحيحة" : "Invalid email or password"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-bold text-center">{t('login.title')}</CardTitle>
          <CardDescription className="text-center">
            {language === 'ar' ? 'سجل دخولك للمتابعة في الشراء' : 'Login to continue shopping'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('login.password')}</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                data-testid="input-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? t('login.loggingIn') : t('login.submit')}
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              {t('login.noAccount')}{" "}
              <Button 
                type="button"
                variant="ghost" 
                className="p-0 h-auto" 
                onClick={() => navigate("/register")}
                data-testid="link-register"
              >
                {t('login.register')}
              </Button>
            </div>
            <Button 
              type="button"
              variant="outline" 
              className="w-full" 
              onClick={() => navigate("/")}
              data-testid="button-back-home"
            >
              {language === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
