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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  TrendingDown,
  Plus,
  User,
  Clock,
  Pencil,
  Check,
  X,
  BarChart3,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

interface CashWithdrawal {
  id: number;
  amount: string;
  reason: string | null;
  employeeName: string;
  createdAt: string;
}

interface WithdrawalEmployeeReport {
  from: string;
  to: string;
  grandTotal: number;
  grandCount: number;
  employeeNames: string[];
  employees: Array<{
    employeeName: string;
    totalAmount: number;
    entryCount: number;
    byDate: Array<{ date: string; totalAmount: number; entryCount: number }>;
  }>;
}

interface SalesWithdrawalsProps {
  user: {
    name: string;
    username: string;
    role?: string;
    permissions: {
      canViewWithdrawals: number;
    };
  };
}

function describeApiError(err: Error): string {
  const raw = err.message?.replace(/^\d+:\s*/, "") ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const j = JSON.parse(jsonMatch[0]) as { error?: string; message?: string };
      return j.error || j.message || raw;
    } catch {
      return raw;
    }
  }
  return raw;
}

export default function SalesWithdrawals({ user }: SalesWithdrawalsProps) {
  const { language, isRTL } = useLanguage();
  const { toast } = useToast();

  const canViewWithdrawals =
    user.role === 'sales_admin' || user.permissions.canViewWithdrawals === 1;

  if (!canViewWithdrawals) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">
          {language === 'ar' ? 'ليس لديك صلاحية عرض السحوبات' : 'You do not have access to withdrawals'}
        </p>
      </div>
    );
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Baghdad' });
  const monthStart = `${today.slice(0, 8)}01`;
  const [activeTab, setActiveTab] = useState<"daily" | "report">("daily");
  const [selectedDate, setSelectedDate] = useState(today);
  const [reportFrom, setReportFrom] = useState(monthStart);
  const [reportTo, setReportTo] = useState(today);
  const [reportEmployee, setReportEmployee] = useState<string>("all");
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [employeeName, setEmployeeName] = useState(user.name);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editEmployee, setEditEmployee] = useState("");

  const reportQueryKey = [
    "/api/instore/withdrawals/report-by-employee",
    reportFrom,
    reportTo,
    reportEmployee,
  ] as const;

  const { data: employeeReport, isLoading: reportLoading } = useQuery<WithdrawalEmployeeReport>({
    queryKey: reportQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ from: reportFrom, to: reportTo });
      if (reportEmployee !== "all") params.set("employeeName", reportEmployee);
      const r = await fetch(`/api/instore/withdrawals/report-by-employee?${params}`, {
        credentials: "include",
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || r.statusText);
      }
      return r.json();
    },
    enabled: activeTab === "report",
  });

  const { data: withdrawals = [], isLoading } = useQuery<CashWithdrawal[]>({
    queryKey: ["/api/instore/withdrawals", selectedDate],
    queryFn: async () => {
      const r = await fetch(`/api/instore/withdrawals?date=${selectedDate}`, {
        credentials: "include",
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || r.statusText);
      }
      return r.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: { amount: string; reason: string; employeeName: string }) => {
      const res = await apiRequest("POST", "/api/instore/withdrawals", data);
      return res.json() as Promise<CashWithdrawal>;
    },
    onSuccess: (row) => {
      const dateKey = selectedDate;
      queryClient.setQueryData<CashWithdrawal[]>(
        ["/api/instore/withdrawals", dateKey],
        (prev) => {
          const list = prev ?? [];
          if (list.some((w) => w.id === row.id)) return list;
          return [row, ...list];
        },
      );
      queryClient.invalidateQueries({ queryKey: ["/api/instore/withdrawals"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/instore/withdrawals/report-by-employee"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/shifts/active-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/shifts"] });
      setAmount("");
      setReason("");
      toast({
        title: language === "ar" ? "تم تسجيل السحب" : "Withdrawal Recorded",
        description: language === "ar" ? "تم إضافة السحب بنجاح" : "Withdrawal added successfully",
      });
    },
    onError: (err: Error) => {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: describeApiError(err),
        variant: "destructive",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { amount: string; reason: string; employeeName: string } }) =>
      apiRequest("PATCH", `/api/instore/withdrawals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instore/withdrawals"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/instore/withdrawals/report-by-employee"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/shifts/active-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/shifts"] });
      setEditingId(null);
      toast({
        title: language === "ar" ? "تم التعديل" : "Updated",
        description: language === "ar" ? "تم تعديل السحب بنجاح" : "Withdrawal updated successfully",
      });
    },
    onError: (err: Error) => {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: describeApiError(err),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/instore/withdrawals/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instore/withdrawals"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/instore/withdrawals/report-by-employee"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/shifts/active-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/shifts"] });
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

  const startEdit = (w: CashWithdrawal) => {
    setEditingId(w.id);
    setEditAmount(Math.round(parseFloat(w.amount)).toString());
    setEditReason(w.reason || "");
    setEditEmployee(w.employeeName);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = (id: number) => {
    if (!editAmount || parseFloat(editAmount) <= 0) {
      toast({ title: language === "ar" ? "أدخل المبلغ" : "Enter amount", variant: "destructive" });
      return;
    }
    editMutation.mutate({ id, data: { amount: editAmount, reason: editReason, employeeName: editEmployee } });
  };

  const totalWithdrawn = withdrawals.reduce((s, w) => s + parseFloat(w.amount), 0);

  const fmt = (n: number) => Math.round(n).toString();

  const reportEmployees = employeeReport?.employees ?? [];
  const reportEmployeeNames = employeeReport?.employeeNames ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-orange-500" />
            {language === "ar" ? "السحوبات" : "Withdrawals"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "ar"
              ? "تسجيل السحوبات وتقرير إجمالي كل موظف حسب التاريخ"
              : "Record withdrawals and view per-employee totals by date"}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "daily" | "report")}>
        <TabsList>
          <TabsTrigger value="daily" data-testid="tab-withdrawals-daily">
            {language === "ar" ? "اليوم" : "Daily"}
          </TabsTrigger>
          <TabsTrigger value="report" data-testid="tab-withdrawals-report">
            <BarChart3 className="h-4 w-4 me-1" />
            {language === "ar" ? "تقرير الموظفين" : "Employee report"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4 space-y-4">
          <div className="flex items-center gap-2 justify-end">
            <Label className="text-sm">{language === "ar" ? "التاريخ:" : "Date:"}</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-auto"
              data-testid="input-withdrawal-date"
            />
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
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
                    {editingId === w.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">{language === "ar" ? "المبلغ" : "Amount"}</Label>
                            <Input
                              type="number"
                              min="1"
                              step="250"
                              value={editAmount}
                              onChange={e => setEditAmount(e.target.value)}
                              data-testid={`input-edit-amount-${w.id}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{language === "ar" ? "الموظف" : "Employee"}</Label>
                            <Input
                              value={editEmployee}
                              onChange={e => setEditEmployee(e.target.value)}
                              data-testid={`input-edit-employee-${w.id}`}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{language === "ar" ? "السبب" : "Reason"}</Label>
                          <Input
                            value={editReason}
                            onChange={e => setEditReason(e.target.value)}
                            placeholder={language === "ar" ? "السبب (اختياري)" : "Reason (optional)"}
                            data-testid={`input-edit-reason-${w.id}`}
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                            data-testid={`button-cancel-edit-${w.id}`}
                          >
                            <X className="h-3 w-3 me-1" />
                            {language === "ar" ? "إلغاء" : "Cancel"}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveEdit(w.id)}
                            disabled={editMutation.isPending}
                            data-testid={`button-save-edit-${w.id}`}
                          >
                            <Check className="h-3 w-3 me-1" />
                            {language === "ar" ? "حفظ" : "Save"}
                          </Button>
                        </div>
                      </div>
                    ) : (
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
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(w)}
                            data-testid={`button-edit-withdrawal-${w.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(w.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-withdrawal-${w.id}`}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
        </TabsContent>

        <TabsContent value="report" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{language === "ar" ? "من" : "From"}</Label>
                  <Input
                    type="date"
                    value={reportFrom}
                    onChange={(e) => setReportFrom(e.target.value)}
                    className="w-auto"
                    data-testid="input-report-from"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{language === "ar" ? "إلى" : "To"}</Label>
                  <Input
                    type="date"
                    value={reportTo}
                    onChange={(e) => setReportTo(e.target.value)}
                    className="w-auto"
                    data-testid="input-report-to"
                  />
                </div>
                <div className="space-y-1 min-w-[180px]">
                  <Label className="text-xs">{language === "ar" ? "الموظف" : "Employee"}</Label>
                  <Select
                    value={reportEmployee}
                    onValueChange={setReportEmployee}
                  >
                    <SelectTrigger data-testid="select-report-employee">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {language === "ar" ? "كل الموظفين" : "All employees"}
                      </SelectItem>
                      {reportEmployees.map((e) => (
                        <SelectItem key={e.employeeName} value={e.employeeName}>
                          {e.employeeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {reportLoading ? (
            <p className="text-center text-muted-foreground py-8">
              {language === "ar" ? "جاري التحميل..." : "Loading..."}
            </p>
          ) : !employeeReport || reportEmployees.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {language === "ar" ? "لا توجد سحوبات في هذه الفترة" : "No withdrawals in this period"}
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-orange-200 dark:border-orange-900/40">
                <CardContent className="pt-4 flex flex-wrap justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    {language === "ar" ? "إجمالي الفترة" : "Period total"}
                    {" "}
                    ({employeeReport.grandCount}{" "}
                    {language === "ar" ? "عملية" : "entries"})
                  </span>
                  <span className="text-xl font-bold text-orange-500">
                    {fmt(employeeReport.grandTotal)} IQD
                  </span>
                </CardContent>
              </Card>

              <div className="space-y-2">
                {reportEmployees.map((emp) => {
                  const open = expandedEmployee === emp.employeeName;
                  return (
                    <Card key={emp.employeeName} data-testid={`report-employee-${emp.employeeName}`}>
                      <CardContent className="py-3 px-4">
                        <button
                          type="button"
                          className="w-full flex items-center justify-between gap-2 text-start"
                          onClick={() =>
                            setExpandedEmployee(open ? null : emp.employeeName)
                          }
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {open ? (
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0" />
                            )}
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-semibold truncate">{emp.employeeName}</span>
                            <Badge variant="secondary" className="text-xs">
                              {emp.entryCount} {language === "ar" ? "عملية" : "entries"}
                            </Badge>
                          </div>
                          <span className="font-bold text-orange-500 shrink-0">
                            {fmt(emp.totalAmount)} IQD
                          </span>
                        </button>
                        {open && (
                          <div className="mt-3 border-t pt-3 overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-muted-foreground border-b">
                                  <th className="text-start py-2 pe-4">
                                    {language === "ar" ? "التاريخ" : "Date"}
                                  </th>
                                  <th className="text-end py-2 pe-4">
                                    {language === "ar" ? "العمليات" : "Count"}
                                  </th>
                                  <th className="text-end py-2">
                                    {language === "ar" ? "المجموع" : "Total"}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {emp.byDate.map((row) => (
                                  <tr key={row.date} className="border-b border-border/50">
                                    <td className="py-2 pe-4">{row.date}</td>
                                    <td className="text-end py-2 pe-4">{row.entryCount}</td>
                                    <td className="text-end py-2 font-medium text-orange-600">
                                      {fmt(row.totalAmount)} IQD
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
