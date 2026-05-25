import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Battery, User, Lock, Loader2, Mail, ShieldCheck } from "lucide-react";

export default function BatteryLogin() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  const { data: currentUser, isLoading: authLoading, isFetched: authFetched } = useQuery({
    queryKey: ['/api/battery/auth/me'],
  });

  useEffect(() => {
    if (authFetched && !authLoading && currentUser) {
      setLocation("/battery");
    }
  }, [authFetched, authLoading, currentUser, setLocation]);

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest('POST', '/api/battery/auth/login', data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.step === "otp") {
        setMaskedEmail(data.maskedEmail || "");
        setStep("otp");
        toast({ title: language === 'ar' ? 'تم إرسال رمز التحقق' : 'OTP Sent', description: data.maskedEmail });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/battery/auth/me'] });
        toast({ title: language === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Login successful' });
        setLocation("/battery");
      }
    },
    onError: (error: any) => {
      toast({ title: language === 'ar' ? 'فشل تسجيل الدخول' : 'Login failed', description: error.message, variant: 'destructive' });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (data: { username: string; otp: string }) => {
      const res = await apiRequest('POST', '/api/battery/auth/verify-otp', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/battery/auth/me'] });
      toast({ title: language === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Login successful' });
      setLocation("/battery");
    },
    onError: (error: any) => {
      toast({ title: language === 'ar' ? 'رمز التحقق غير صحيح' : 'Invalid OTP', description: error.message, variant: 'destructive' });
    },
  });

  if (!authFetched || authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-600 rounded-full flex items-center justify-center">
            {step === "otp" ? <ShieldCheck className="h-8 w-8 text-white" /> : <Battery className="h-8 w-8 text-white" />}
          </div>
          <CardTitle className="text-2xl">
            {step === "otp" ? (language === 'ar' ? 'التحقق برمز المرور' : 'OTP Verification') : (language === 'ar' ? 'نظام البطاريات' : 'Battery System')}
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            {step === "otp"
              ? (language === 'ar' ? `أدخل رمز التحقق المرسل إلى ${maskedEmail}` : `Enter OTP sent to ${maskedEmail}`)
              : (language === 'ar' ? 'تسجيل الدخول لإدارة بطاريات اللابتوب' : 'Login to manage laptop batteries')}
          </p>
        </CardHeader>
        <CardContent>
          {step === "credentials" ? (
            <form onSubmit={(e) => { e.preventDefault(); loginMutation.mutate({ username, password }); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="flex items-center gap-2"><User className="h-4 w-4" />{language === 'ar' ? 'اسم المستخدم' : 'Username'}</Label>
                <Input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={language === 'ar' ? 'أدخل اسم المستخدم' : 'Enter username'} required data-testid="input-battery-username" disabled={loginMutation.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2"><Lock className="h-4 w-4" />{language === 'ar' ? 'كلمة المرور' : 'Password'}</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={language === 'ar' ? 'أدخل كلمة المرور' : 'Enter password'} required data-testid="input-battery-password" disabled={loginMutation.isPending} />
              </div>
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loginMutation.isPending} data-testid="button-battery-login">
                {loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (language === 'ar' ? 'تسجيل الدخول' : 'Login')}
              </Button>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); verifyOtpMutation.mutate({ username, otp }); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp" className="flex items-center gap-2"><Mail className="h-4 w-4" />{language === 'ar' ? 'رمز التحقق' : 'OTP Code'}</Label>
                <Input id="otp" type="text" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={language === 'ar' ? 'أدخل الرمز المكون من 6 أرقام' : 'Enter 6-digit code'} maxLength={6} className="text-center text-xl tracking-widest" autoFocus data-testid="input-battery-otp" disabled={verifyOtpMutation.isPending} />
              </div>
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={verifyOtpMutation.isPending} data-testid="button-battery-verify-otp">
                {verifyOtpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (language === 'ar' ? 'تأكيد الرمز' : 'Verify Code')}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setStep("credentials"); setOtp(""); }} data-testid="button-battery-back">
                {language === 'ar' ? 'العودة' : 'Back'}
              </Button>
            </form>
          )}
          {step === "credentials" && (
            <div className="mt-6 text-center text-xs text-muted-foreground">
              <p>{language === 'ar' ? 'بيانات الدخول الافتراضية:' : 'Default credentials:'}</p>
              <p className="font-mono">battery / battery123</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
