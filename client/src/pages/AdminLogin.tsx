import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const ADMIN_PASSWORD = "admin123";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem("adminAuth", "true");
      toast({
        title: "تسجيل الدخول بنجاح",
        description: "مرحباً بك في لوحة التحكم",
      });
      setLocation("/admin/dashboard");
    } else {
      toast({
        title: "خطأ",
        description: "كلمة المرور غير صحيحة",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>تسجيل دخول الإدارة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="password"
            placeholder="أدخل كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            data-testid="input-admin-password"
          />
          <Button onClick={handleLogin} className="w-full" data-testid="button-admin-login">
            دخول
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
