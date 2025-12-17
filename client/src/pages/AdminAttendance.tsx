import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Clock, 
  Calendar, 
  Users, 
  Loader2,
  Search,
  LogIn,
  LogOut,
  Timer,
  Banknote
} from "lucide-react";
import { AdminNav } from "@/components/AdminNav";
import type { SalesShift } from "@shared/schema";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

export default function AdminAttendance() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "closed">("all");
  const [filterDate, setFilterDate] = useState("");

  const { data: currentAdmin, isLoading: authLoading, isError: authError } = useQuery<AdminUser>({
    queryKey: ['/api/admin/auth/me'],
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && (authError || !currentAdmin)) {
      localStorage.removeItem("adminAuth");
      setLocation("/admin/login");
    }
  }, [authLoading, authError, currentAdmin, setLocation]);

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery<SalesShift[]>({
    queryKey: ['/api/admin/shifts'],
    enabled: !!currentAdmin,
  });

  const formatPrice = (price: number | string | null) => {
    if (!price) return "٠";
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat('ar-IQ').format(num);
  };

  const formatDate = (dateVal: Date | string) => {
    const date = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    return date.toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateVal: Date | string | null) => {
    if (!dateVal) return "-";
    const date = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    return date.toLocaleTimeString(language === 'ar' ? 'ar-IQ' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDuration = (start: Date | string, end: Date | string | null) => {
    if (!end) return language === 'ar' ? 'قيد العمل' : 'Ongoing';
    const startDate = typeof start === 'string' ? new Date(start) : start;
    const endDate = typeof end === 'string' ? new Date(end) : end;
    const diffMs = endDate.getTime() - startDate.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const filteredShifts = shifts.filter(shift => {
    const matchesSearch = shift.salesUserName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || shift.status === filterStatus;
    const matchesDate = !filterDate || new Date(shift.startTime).toDateString() === new Date(filterDate).toDateString();
    return matchesSearch && matchesStatus && matchesDate;
  });

  const activeShiftsCount = shifts.filter(s => s.status === 'active').length;
  const todayShifts = shifts.filter(s => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(s.startTime) >= today;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!currentAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <AdminNav currentAdmin={currentAdmin} />
      
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              {language === 'ar' ? 'حضور الموظفين' : 'Staff Attendance'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === 'ar' ? 'تتبع أوقات الدخول والخروج لفريق المبيعات' : 'Track check-in and check-out times for sales staff'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'حاليا في العمل' : 'Currently Working'}
                  </p>
                  <p className="text-2xl font-bold text-green-600">{activeShiftsCount}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'ورديات اليوم' : "Today's Shifts"}
                  </p>
                  <p className="text-2xl font-bold text-blue-600">{todayShifts.length}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'إجمالي السجلات' : 'Total Records'}
                  </p>
                  <p className="text-2xl font-bold text-primary">{shifts.length}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Timer className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg">
                {language === 'ar' ? 'سجل الحضور' : 'Attendance Log'}
              </CardTitle>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={language === 'ar' ? 'بحث بالاسم...' : 'Search by name...'}
                    className="ps-9 w-48"
                    data-testid="input-search-attendance"
                  />
                </div>
                
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "active" | "closed")}>
                  <SelectTrigger className="w-36" data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
                    <SelectItem value="active">{language === 'ar' ? 'قيد العمل' : 'Active'}</SelectItem>
                    <SelectItem value="closed">{language === 'ar' ? 'انتهى' : 'Closed'}</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-40"
                  data-testid="input-date-filter"
                />
                
                {filterDate && (
                  <Button variant="ghost" size="sm" onClick={() => setFilterDate("")}>
                    {language === 'ar' ? 'مسح' : 'Clear'}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {shiftsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredShifts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>{language === 'ar' ? 'لا توجد سجلات حضور' : 'No attendance records found'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                      <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                      <TableHead>{language === 'ar' ? 'وقت الدخول' : 'Check-in'}</TableHead>
                      <TableHead>{language === 'ar' ? 'وقت الخروج' : 'Check-out'}</TableHead>
                      <TableHead>{language === 'ar' ? 'المدة' : 'Duration'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{language === 'ar' ? 'المبيعات' : 'Sales'}</TableHead>
                      <TableHead>{language === 'ar' ? 'المعاملات' : 'Transactions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredShifts.map((shift) => (
                      <TableRow key={shift.id} data-testid={`attendance-row-${shift.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium">{shift.salesUserName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatDate(shift.startTime)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-green-600">
                            <LogIn className="h-3.5 w-3.5" />
                            {formatTime(shift.startTime)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {shift.endTime ? (
                            <div className="flex items-center gap-1 text-sm text-red-600">
                              <LogOut className="h-3.5 w-3.5" />
                              {formatTime(shift.endTime)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                            {calculateDuration(shift.startTime, shift.endTime)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {shift.status === 'active' ? (
                            <Badge className="bg-green-500/10 text-green-600 border-green-200">
                              {language === 'ar' ? 'قيد العمل' : 'Working'}
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              {language === 'ar' ? 'انتهى' : 'Ended'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatPrice(shift.totalSales)} 
                            <span className="text-xs text-muted-foreground">
                              {language === 'ar' ? 'د.ع' : 'IQD'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {shift.totalTransactions || 0}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
