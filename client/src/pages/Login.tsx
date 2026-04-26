import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, customerAuthMeQueryKey } from "@/lib/queryClient";
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

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || res.statusText);
      }
      if ((data as { step?: string }).step === "otp") {
        setMaskedEmail((data as { maskedEmail?: string }).maskedEmail || "");
        setStep("otp");
        toast({
          title: language === "ar" ? "تم إرسال رمز التحقق" : "Verification code sent",
          description: (data as { maskedEmail?: string }).maskedEmail,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("login.error.description");
      toast({ title: t("login.error.title"), description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/verify-login-otp", {
        email: formData.email,
        otp,
      });
      const user = await res.json();
      queryClient.setQueryData(customerAuthMeQueryKey, user);
      void queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({ title: t("login.success.title"), description: t("login.success.description") });
      // Full navigation so the browser reliably sends the session cookie on the next request.
      setTimeout(() => {
        window.location.assign("/");
      }, 150);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      toast({
        title: language === "ar" ? "رمز التحقق غير صحيح" : "Invalid code",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="absolute top-4 end-4">
        <Button variant="ghost" size="sm" onClick={() => setLanguage(language === "ar" ? "en" : "ar")} className="gap-1" data-testid="button-language-switch">
          <Languages className="h-4 w-4" />
          {language === "ar" ? "EN" : "عربي"}
        </Button>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            {step === "otp" ? <ShieldCheck className="w-6 h-6 text-primary" /> : <Mail className="w-6 h-6 text-primary" />}
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            {step === "otp" ? t("login.otpTitle") : t("login.title")}
          </CardTitle>
          <CardDescription className="text-center">
            {step === "otp"
              ? t("login.otpDescription", { email: maskedEmail || "—" })
              : t("login.description")}
          </CardDescription>
        </CardHeader>
        {step === "credentials" ? (
          <form onSubmit={handleCredentials}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("login.email")}</Label>
                <Input id="email" type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} data-testid="input-email" disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("login.password")}</Label>
                <Input id="password" type="password" required minLength={6} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} data-testid="input-password" disabled={isLoading} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("login.submit")}
              </Button>
              <div className="text-sm text-center">
                <Link href="/forgot-password" className="text-primary hover:underline">
                  {t("login.forgotPassword")}
                </Link>
              </div>
              <div className="text-sm text-center text-muted-foreground">
                {t("login.noAccount")}{" "}
                <Button type="button" variant="ghost" className="p-0 h-auto" onClick={() => navigate("/register")} data-testid="link-register">
                  {t("login.register")}
                </Button>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/")} data-testid="button-back-home">
                {t("login.backToHome")}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">{t("login.otpLabel")}</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={t("login.otpPlaceholder")}
                  maxLength={6}
                  className="text-center text-xl tracking-widest"
                  autoFocus
                  data-testid="input-otp"
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-verify-otp">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("login.verifyOtp")}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setStep("credentials"); setOtp(""); }} data-testid="button-back-credentials">
                {t("login.backToCredentials")}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
