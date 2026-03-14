import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, TrendingDown, Plus, User, Clock } from "lucide-react";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

interface CashWithdrawal {
  id: number;
  amount: string;
  reason: string | null;
  employeeName: string;
  createdAt: string;
}

interface SalesWithdrawalsProps {
  user: { name: string; username: string };
}

export default function SalesWithdrawals({ user }: SalesWithdrawalsProps) {
  const { language, isRTL } = useLanguage();
  const { toast } = useToast();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Baghdad' });
  const [selectedDate, setSelectedDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [employeeName, setEmployeeName] = useState(user.name);

  const { data: withdrawals = [], isLoading } = useQuery<CashWithdrawal[]>({
    queryKey: ["/api/instore/withdrawals", selectedDate],
    queryFn: () =>
      fetch(`/api/instore/withdrawals?date=${selectedDate}`, { credentials: "include" }).then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: (data: { amount: string; reason: string; employeeName: string }) =>
      apiRequest("POST", "/api/instore/withdrawals", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instore/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-report"] });
      setAmount("");
      setReason("");
      toast({
        title: language === "ar" ? "تم تسجيل السحب" : "Withdrawal Recorded",
        description: language === "ar" ? "تم إضافة السحب بنجاح" : "Withdrawal added successfully",
      });
    },
    onError: () => {
      toast({ title: language === "ar" ? "خطأ" : "Error", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/instore/withdrawals/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instore/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-report"] });
      toast({ title: language === "ar" ? "تم الحذف" : "Deleted" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: language === "ar" ? "أدخل المبلغ" : "Enter amount",
        variant: "destructive",
      });
      return;
    }
    if (!employeeName.trim()) {
      toast({
        title: language === "ar" ? "أدخل اسم الموظف" : "Enter employee name",
        variant: "destructive",
      });
      return;
    }
    addMutation.mutate({ amount, reason, employeeName });
  };

  const totalWithdrawn = withdrawals.reduce((s, w) => s + parseFloat(w.amount), 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat(language === "ar" ? "ar-IQ" : "en-US").format(n);

  return (
    <div className="p-4 md:p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-orange-500" />
            {language === "ar" ? "السحوبات اليومية" : "Daily Withdrawals"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "ar"
              ? "تسجيل مبالغ السحب اليومية من الصندوق"
              : "Record daily cash withdrawals from the register"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">{language === "ar" ? "التاريخ:" : "Date:"}</Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-auto"
            data-testid="input-withdrawal-date"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Withdrawal Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              {language === "ar" ? "إضافة سحب جديد" : "Add New Withdrawal"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="withdrawal-employee">
                  {language === "ar" ? "اسم الموظف" : "Employee Name"}
                </Label>
                <Input
                  id="withdrawal-employee"
                  value={employeeName}
                  onChange={e => setEmployeeName(e.target.value)}
                  placeholder={language === "ar" ? "اسم الموظف" : "Employee name"}
                  data-testid="input-withdrawal-employee"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdrawal-amount">
                  {language === "ar" ? "المبلغ (IQD)" : "Amount (IQD)"}
                </Label>
                <Input
                  id="withdrawal-amount"
                  type="number"
                  min="1"
                  step="250"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  data-testid="input-withdrawal-amount"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdrawal-reason">
                  {language === "ar" ? "السبب (اختياري)" : "Reason (optional)"}
                </Label>
                <Textarea
                  id="withdrawal-reason"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={language === "ar" ? "سبب السحب..." : "Reason for withdrawal..."}
                  rows={3}
                  data-testid="input-withdrawal-reason"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={addMutation.isPending}
                data-testid="button-add-withdrawal"
              >
                {addMutation.isPending
                  ? (language === "ar" ? "جاري الحفظ..." : "Saving...")
                  : (language === "ar" ? "تسجيل السحب" : "Record Withdrawal")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Withdrawals List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary Card */}
          <Card className="border-orange-200 dark:border-orange-900/40">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  {language === "ar" ? "إجمالي السحوبات" : "Total Withdrawn"}
                  {" "}
                  ({withdrawals.length} {language === "ar" ? "عملية" : "entries"})
                </span>
                <span className="text-2xl font-bold text-orange-500">
                  {fmt(totalWithdrawn)} IQD
                </span>
              </div>
            </CardContent>
          </Card>

          {/* List */}
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">
              {language === "ar" ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : withdrawals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <TrendingDown className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>{language === "ar" ? "لا توجد سحوبات لهذا اليوم" : "No withdrawals for this day"}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {withdrawals.map(w => (
                <Card key={w.id} data-testid={`card-withdrawal-${w.id}`}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                          <TrendingDown className="h-4 w-4 text-orange-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-orange-500">
                              {fmt(parseFloat(w.amount))} IQD
                            </span>
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {w.employeeName}
                            </Badge>
                          </div>
                          {w.reason && (
                            <p className="text-sm text-muted-foreground truncate mt-0.5">{w.reason}</p>
                          )}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Clock className="h-3 w-3" />
                            {format(new Date(w.createdAt), "hh:mm a", {
                              locale: language === "ar" ? arSA : undefined,
                            })}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(w.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-withdrawal-${w.id}`}
                        className="text-destructive shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
