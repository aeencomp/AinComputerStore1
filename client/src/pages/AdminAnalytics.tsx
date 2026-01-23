import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdminNav } from "@/components/AdminNav";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Users, 
  Globe, 
  Clock, 
  Monitor, 
  Smartphone, 
  Tablet,
  TrendingUp,
  Eye,
  FileText,
  Activity
} from "lucide-react";

interface AnalyticsData {
  summary: {
    totalVisitors: number;
    activeNow: number;
    avgDuration: number;
    avgPages: number;
    totalPageViews: number;
  };
  countries: { country: string; count: number; percentage: number }[];
  devices: { device: string; count: number; percentage: number }[];
  browsers: { browser: string; count: number; percentage: number }[];
  dailyVisitors: { date: string; count: number }[];
  topPages: { page: string; views: number }[];
  recentSessions: {
    id: string;
    ipAddress: string;
    country: string;
    countryCode: string;
    city: string;
    device: string;
    browser: string;
    os: string;
    pagesViewed: number;
    duration: number;
    startTime: string;
    isActive: number;
    landingPage: string;
  }[];
}

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: string;
  canOrders?: number;
  canProducts?: number;
  canCategories?: number;
  canSettings?: number;
  canUsers?: number;
  canReports?: number;
  canPOS?: number;
  canInventory?: number;
  canCustomers?: number;
  canDiscounts?: number;
}

export default function AdminAnalytics() {
  const { t, language, isRTL } = useLanguage();
  const [period, setPeriod] = useState<string>('7d');

  const { data: currentAdmin } = useQuery<AdminUser>({
    queryKey: ['/api/admin/auth/me'],
  });

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/admin/analytics', period],
    queryFn: async () => {
      const response = await fetch(`/api/admin/analytics?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
  });

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}${language === 'ar' ? ' ثانية' : 's'}`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (language === 'ar') {
      return `${minutes} دقيقة ${secs} ثانية`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    if (language === 'ar') {
      return date.toLocaleDateString('ar-IQ');
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    if (language === 'ar') {
      return date.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'mobile': return <Smartphone className="h-4 w-4" />;
      case 'tablet': return <Tablet className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const periodOptions = [
    { value: '24h', labelAr: '٢٤ ساعة', labelEn: '24 Hours' },
    { value: '7d', labelAr: '٧ أيام', labelEn: '7 Days' },
    { value: '30d', labelAr: '٣٠ يوم', labelEn: '30 Days' },
    { value: '90d', labelAr: '٩٠ يوم', labelEn: '90 Days' },
  ];

  return (
    <div className={`min-h-screen bg-background ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <AdminNav currentAdmin={currentAdmin || null} />
      
      <main className="container mx-auto p-4 md:p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-analytics-title">
                {language === 'ar' ? 'تحليلات الزوار' : 'Visitor Analytics'}
              </h1>
              <p className="text-muted-foreground">
                {language === 'ar' ? 'احصائيات زوار الموقع' : 'Website visitor statistics'}
              </p>
            </div>
            
            <div className="flex gap-2">
              {periodOptions.map((opt) => (
                <Button
                  key={opt.value}
                  variant={period === opt.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPeriod(opt.value)}
                  data-testid={`button-period-${opt.value}`}
                >
                  {language === 'ar' ? opt.labelAr : opt.labelEn}
                </Button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : analytics ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-2xl font-bold" data-testid="text-total-visitors">
                          {analytics.summary.totalVisitors.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {language === 'ar' ? 'إجمالي الزوار' : 'Total Visitors'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold text-green-500" data-testid="text-active-now">
                          {analytics.summary.activeNow}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {language === 'ar' ? 'نشط الآن' : 'Active Now'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-2xl font-bold" data-testid="text-avg-duration">
                          {formatDuration(analytics.summary.avgDuration)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {language === 'ar' ? 'متوسط المدة' : 'Avg Duration'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-purple-500" />
                      <div>
                        <p className="text-2xl font-bold" data-testid="text-avg-pages">
                          {analytics.summary.avgPages}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {language === 'ar' ? 'صفحات/زائر' : 'Pages/Visitor'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-orange-500" />
                      <div>
                        <p className="text-2xl font-bold" data-testid="text-total-pageviews">
                          {analytics.summary.totalPageViews.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {language === 'ar' ? 'مشاهدات الصفحات' : 'Page Views'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      {language === 'ar' ? 'الدول' : 'Countries'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {analytics.countries.map((c, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="text-sm">{c.country}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{c.count}</span>
                              <Badge variant="outline" className="text-xs">
                                {c.percentage}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                        {analytics.countries.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {language === 'ar' ? 'لا توجد بيانات' : 'No data'}
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      {language === 'ar' ? 'الأجهزة' : 'Devices'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.devices.map((d, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getDeviceIcon(d.device)}
                            <span className="text-sm capitalize">{d.device}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{d.count}</span>
                            <Badge variant="outline" className="text-xs">
                              {d.percentage}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      {language === 'ar' ? 'أعلى الصفحات' : 'Top Pages'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {analytics.topPages.map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="text-sm truncate max-w-[150px]" title={p.page}>
                              {p.page}
                            </span>
                            <Badge variant="secondary">{p.views}</Badge>
                          </div>
                        ))}
                        {analytics.topPages.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {language === 'ar' ? 'لا توجد بيانات' : 'No data'}
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {language === 'ar' ? 'الزوار اليوميين' : 'Daily Visitors'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-1 h-[120px]">
                    {analytics.dailyVisitors.map((d, idx) => {
                      const max = Math.max(...analytics.dailyVisitors.map(x => x.count), 1);
                      const height = (d.count / max) * 100;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                          <div 
                            className="w-full bg-primary rounded-t transition-all"
                            style={{ height: `${Math.max(height, 2)}%` }}
                            title={`${d.date}: ${d.count}`}
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(d.date)}
                          </span>
                        </div>
                      );
                    })}
                    {analytics.dailyVisitors.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4 w-full">
                        {language === 'ar' ? 'لا توجد بيانات' : 'No data'}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {language === 'ar' ? 'الجلسات الأخيرة' : 'Recent Sessions'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {analytics.recentSessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            {getDeviceIcon(session.device)}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {session.country}
                                  {session.city && `, ${session.city}`}
                                </span>
                                {session.isActive === 1 && (
                                  <Badge className="bg-green-500 text-white text-xs">
                                    {language === 'ar' ? 'نشط' : 'Active'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground font-mono">
                                IP: {session.ipAddress}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {session.browser} • {session.os}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">
                              {session.pagesViewed} {language === 'ar' ? 'صفحات' : 'pages'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDuration(session.duration || 0)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(session.startTime)}
                            </p>
                          </div>
                        </div>
                      ))}
                      {analytics.recentSessions.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {language === 'ar' ? 'لا توجد جلسات' : 'No sessions'}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {language === 'ar' ? 'فشل في تحميل التحليلات' : 'Failed to load analytics'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}