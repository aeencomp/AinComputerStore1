import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Lock, User, Mail, ShieldCheck } from "lucide-react";

export default function AdminLogin() {
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const response = await apiRequest("POST", "/api/admin/auth/login", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.step === "otp") {
        setMaskedEmail(data.maskedEmail || "");
        setStep("otp");
        toast({ title: "تم إرسال رمز التحقق", description: `تم إرسال رمز التحقق إلى ${data.maskedEmail}` });
      } else if (data.success) {
        localStorage.setItem("adminAuth", "true");
        toast({ title: "تسجيل الدخول بنجاح", description: `مرحباً بك ${data.admin.name}` });
        setLocation("/admin/dashboard");
      }
    },
    onError: (error: any) => {
      toast({ title: "خطأ في تسجيل الدخول", description: error.message || "اسم المستخدم أو كلمة المرور غير صحيحة", variant: "destructive" });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (data: { username: string; otp: string }) => {
      const response = await apiRequest("POST", "/api/admin/auth/verify-otp", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        localStorage.setItem("adminAuth", "true");
        toast({ title: "تسجيل الدخول بنجاح", description: `مرحباً بك ${data.admin.name}` });
        setLocation("/admin/dashboard");
      }
    },
    onError: (error: any) => {
      toast({ title: "رمز التحقق غير صحيح", description: error.message || "يرجى التحقق من الرمز والمحاولة مرة أخرى", variant: "destructive" });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم المستخدم وكلمة المرور", variant: "destructive" });
      return;
    }
    loginMutation.mutate({ username, password });
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال رمز التحقق", variant: "destructive" });
      return;
    }
    verifyOtpMutation.mutate({ username, otp });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            {step === "otp" ? <ShieldCheck className="w-6 h-6 text-primary" /> : <Lock className="w-6 h-6 text-primary" />}
          </div>
          <CardTitle className="text-2xl">لوحة تحكم الإدارة</CardTitle>
          <CardDescription>
            {step === "otp" ? `أدخل رمز التحقق المرسل إلى ${maskedEmail}` : "قم بتسجيل الدخول للوصول إلى لوحة التحكم"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "credentials" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="أدخل اسم المستخدم"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pr-10"
                    disabled={loginMutation.isPending}
                    data-testid="input-admin-username"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="أدخل كلمة المرور"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    disabled={loginMutation.isPending}
                    data-testid="input-admin-password"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-admin-login">
                {loginMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin ml-2" />جاري التحقق...</> : "تسجيل الدخول"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">رمز التحقق</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="أدخل الرمز المكون من 6 أرقام"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="pr-10 text-center text-xl tracking-widest"
                    disabled={verifyOtpMutation.isPending}
                    maxLength={6}
                    data-testid="input-admin-otp"
                    autoFocus
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={verifyOtpMutation.isPending} data-testid="button-admin-verify-otp">
                {verifyOtpMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin ml-2" />جاري التحقق...</> : "تأكيد الرمز"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setStep("credentials"); setOtp(""); }} data-testid="button-admin-back">
                العودة
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
