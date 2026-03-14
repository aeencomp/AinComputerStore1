import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Languages, Mail, ShieldCheck, Loader2 } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { language, setLanguage, t } = useLanguage();
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await apiRequest('POST', '/api/auth/login', formData);
      const data = await res.json();
      if (data.step === "otp") {
        setMaskedEmail(data.maskedEmail || "");
        setStep("otp");
        toast({ title: language === 'ar' ? 'تم إرسال رمز التحقق' : 'OTP Sent', description: data.maskedEmail });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        toast({ title: t('login.success.title'), description: t('login.success.description') });
        navigate("/");
      }
    } catch (error: any) {
      toast({ title: t('login.error.title'), description: error.message || t('login.error.description'), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiRequest('POST', '/api/auth/verify-otp', { email: formData.email, otp });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({ title: t('login.success.title'), description: t('login.success.description') });
      navigate("/");
    } catch (error: any) {
      toast({ title: language === 'ar' ? 'رمز التحقق غير صحيح' : 'Invalid OTP', description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="absolute top-4 end-4">
        <Button variant="ghost" size="sm" onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')} className="gap-1" data-testid="button-language-switch">
          <Languages className="h-4 w-4" />
          {language === 'ar' ? 'EN' : 'عربي'}
        </Button>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            {step === "otp" ? <ShieldCheck className="w-6 h-6 text-primary" /> : <Mail className="w-6 h-6 text-primary" />}
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            {step === "otp" ? (language === 'ar' ? 'التحقق برمز المرور' : 'OTP Verification') : t('login.title')}
          </CardTitle>
          <CardDescription className="text-center">
            {step === "otp"
              ? (language === 'ar' ? `أدخل رمز التحقق المرسل إلى ${maskedEmail}` : `Enter OTP sent to ${maskedEmail}`)
              : t('login.description')}
          </CardDescription>
        </CardHeader>
        {step === "credentials" ? (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('login.email')}</Label>
                <Input id="email" type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} data-testid="input-email" disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('login.password')}</Label>
                <Input id="password" type="password" required minLength={6} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} data-testid="input-password" disabled={isLoading} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('login.submit')}
              </Button>
              <div className="text-sm text-center text-muted-foreground">
                {t('login.noAccount')}{" "}
                <Button type="button" variant="ghost" className="p-0 h-auto" onClick={() => navigate("/register")} data-testid="link-register">
                  {t('login.register')}
                </Button>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/")} data-testid="button-back-home">
                {t('login.backToHome')}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">{language === 'ar' ? 'رمز التحقق' : 'OTP Code'}</Label>
                <Input id="otp" type="text" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={language === 'ar' ? 'أدخل الرمز المكون من 6 أرقام' : 'Enter 6-digit code'} maxLength={6} className="text-center text-xl tracking-widest" autoFocus data-testid="input-otp" disabled={isLoading} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-verify-otp">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === 'ar' ? 'تأكيد الرمز' : 'Verify Code')}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setStep("credentials"); setOtp(""); }} data-testid="button-back-to-login">
                {language === 'ar' ? 'العودة' : 'Back'}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
