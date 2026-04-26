import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Languages, KeyRound, Loader2 } from "lucide-react";

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { language, setLanguage, t } = useLanguage();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email });
      const data = await res.json();
      toast({
        title: language === "ar" ? "تم" : "Done",
        description: (data as { message?: string }).message || t("forgot.descriptionSent"),
      });
      setStep("reset");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      toast({ title: t("login.error.title"), description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: t("login.error.title"), description: t("forgot.mismatch"), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", {
        email,
        otp,
        newPassword,
      });
      toast({
        title: language === "ar" ? "تم" : "Success",
        description: language === "ar" ? "يمكنك تسجيل الدخول بكلمة المرور الجديدة" : "You can sign in with your new password",
      });
      navigate("/login");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      toast({ title: t("login.error.title"), description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="absolute top-4 end-4">
        <Button variant="ghost" size="sm" onClick={() => setLanguage(language === "ar" ? "en" : "ar")} className="gap-1">
          <Languages className="h-4 w-4" />
          {language === "ar" ? "EN" : "عربي"}
        </Button>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">{t("forgot.title")}</CardTitle>
          <CardDescription className="text-center">
            {step === "email" ? t("forgot.description") : t("forgot.step2")}
          </CardDescription>
        </CardHeader>
        {step === "email" ? (
          <form onSubmit={handleSendCode}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("login.email")}</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("forgot.sendCode")}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => navigate("/login")}>
                {t("forgot.backToLogin")}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-ro">{t("login.email")}</Label>
                <Input id="email-ro" type="email" value={email} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp">{t("login.otpLabel")}</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  className="text-center text-xl tracking-widest"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="np">{t("forgot.newPassword")}</Label>
                <Input id="np" type="password" minLength={6} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp">{t("forgot.confirmPassword")}</Label>
                <Input id="cp" type="password" minLength={6} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("forgot.reset")}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => setStep("email")} disabled={isLoading}>
                {t("login.backToCredentials")}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
