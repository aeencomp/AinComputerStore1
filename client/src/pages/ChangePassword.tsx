import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { Languages, Lock, Loader2 } from "lucide-react";
import type { User } from "@shared/schema";
import { apiRequest, customerAuthMeQueryFn, customerAuthMeQueryKey } from "@/lib/queryClient";

export default function ChangePassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { language, setLanguage, t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { data: user, isLoading: authLoading } = useQuery<User | null>({
    queryKey: customerAuthMeQueryKey,
    queryFn: customerAuthMeQueryFn,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: t("login.error.title"), description: t("change.mismatch"), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      toast({ title: t("change.success"), description: "" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      navigate("/my-orders");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      toast({ title: t("login.error.title"), description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="absolute top-4 end-4">
        <Button variant="ghost" size="sm" onClick={() => setLanguage(language === "ar" ? "en" : "ar")} className="gap-1">
          <Languages className="h-4 w-4" />
          {language === "ar" ? "EN" : "عربي"}
        </Button>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">{t("change.title")}</CardTitle>
          <CardDescription className="text-center">{user.email}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cur">{t("change.current")}</Label>
              <Input id="cur" type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nw">{t("change.new")}</Label>
              <Input id="nw" type="password" minLength={6} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf">{t("change.confirm")}</Label>
              <Input id="cf" type="password" minLength={6} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("change.submit")}
            </Button>
            <Link href="/my-orders">
              <Button type="button" variant="outline" className="w-full">
                {t("login.backToHome")}
              </Button>
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
