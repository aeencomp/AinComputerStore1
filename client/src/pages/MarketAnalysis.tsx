import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, MemoryStick, HardDrive, CircuitBoard, ArrowRight, Calendar } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import type { MarketPrice } from "@shared/schema";
import { useState } from "react";

const componentTypes = [
  { value: "ram", labelAr: "ذاكرة عشوائية (RAM)", labelEn: "RAM Memory", icon: MemoryStick, color: "bg-blue-500" },
  { value: "ssd", labelAr: "أقراص SSD", labelEn: "SSD Drives", icon: HardDrive, color: "bg-orange-500" },
  { value: "m2", labelAr: "أقراص M.2 NVMe", labelEn: "M.2 NVMe Drives", icon: CircuitBoard, color: "bg-purple-500" },
];

export default function MarketAnalysis() {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState("ram");

  const { data: marketPrices = [], isLoading } = useQuery<MarketPrice[]>({
    queryKey: ['/api/market-prices'],
  });

  const getPriceChange = (current: string, previous: string | null) => {
    if (!previous) return { change: 0, percentage: 0 };
    const currentNum = parseFloat(current);
    const previousNum = parseFloat(previous);
    const change = currentNum - previousNum;
    const percentage = ((change / previousNum) * 100);
    return { change, percentage };
  };

  const filterByType = (type: string) => {
    return marketPrices.filter(p => p.componentType === type);
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('ar-IQ').format(parseFloat(price));
  };

  const getLastUpdateDate = () => {
    if (marketPrices.length === 0) return null;
    const dates = marketPrices.map(p => new Date(p.priceDate));
    const latestDate = new Date(Math.max(...dates.map(d => d.getTime())));
    return latestDate.toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Header />
      
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link href="/">
              <span className="hover:text-primary cursor-pointer">
                {language === 'ar' ? 'الرئيسية' : 'Home'}
              </span>
            </Link>
            <ArrowRight className="w-4 h-4" />
            <span>{language === 'ar' ? 'تحليل أسعار السوق' : 'Market Price Analysis'}</span>
          </div>
          
          <h1 className="text-3xl font-bold mb-2">
            {language === 'ar' ? 'تحليل أسعار السوق' : 'Market Price Analysis'}
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            {language === 'ar' 
              ? 'تابع آخر تحديثات أسعار الذاكرة وأقراص التخزين في السوق العراقي. نقوم بتحديث الأسعار يومياً لمساعدتك في اتخاذ قرارات الشراء المناسبة.'
              : 'Follow the latest memory and storage prices in the Iraqi market. We update prices daily to help you make informed purchasing decisions.'
            }
          </p>
          
          {getLastUpdateDate() && (
            <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>
                {language === 'ar' ? 'آخر تحديث:' : 'Last update:'} {getLastUpdateDate()}
              </span>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            {componentTypes.map(type => (
              <TabsTrigger key={type.value} value={type.value} data-testid={`tab-${type.value}`}>
                <type.icon className="w-4 h-4 me-2" />
                {language === 'ar' ? type.labelAr : type.labelEn}
              </TabsTrigger>
            ))}
          </TabsList>

          {componentTypes.map(type => (
            <TabsContent key={type.value} value={type.value}>
              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Card key={i}>
                      <CardHeader className="pb-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-8 w-1/2 mb-2" />
                        <Skeleton className="h-4 w-1/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filterByType(type.value).length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <type.icon className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                    <h3 className="text-lg font-semibold mb-2">
                      {language === 'ar' ? 'لا توجد أسعار متاحة' : 'No Prices Available'}
                    </h3>
                    <p className="text-muted-foreground">
                      {language === 'ar' 
                        ? 'سيتم إضافة أسعار هذه الفئة قريباً'
                        : 'Prices for this category will be added soon'
                      }
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filterByType(type.value).map(price => {
                    const { change, percentage } = getPriceChange(price.currentPrice, price.previousPrice);
                    const isUp = change > 0;
                    const isDown = change < 0;
                    
                    return (
                      <Card key={price.id} className="hover-elevate transition-all" data-testid={`price-card-${price.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-lg">
                                {language === 'ar' ? price.nameAr : price.nameEn}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${type.color}`} />
                                {price.brand} - {price.capacity}
                              </CardDescription>
                            </div>
                            {price.previousPrice && (
                              <Badge 
                                variant={isDown ? "default" : isUp ? "destructive" : "secondary"}
                                className={`flex items-center gap-1 ${isDown ? 'bg-green-500 hover:bg-green-600 text-white' : ''}`}
                              >
                                {isUp ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : isDown ? (
                                  <TrendingDown className="w-3 h-3" />
                                ) : (
                                  <Minus className="w-3 h-3" />
                                )}
                                {Math.abs(percentage).toFixed(1)}%
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {price.specs && (
                            <p className="text-sm text-muted-foreground mb-3">{price.specs}</p>
                          )}
                          <div className="space-y-1">
                            <p className="text-2xl font-bold">
                              {formatPrice(price.currentPrice)}
                              <span className="text-sm font-normal text-muted-foreground ms-1">
                                {language === 'ar' ? 'د.ع' : 'IQD'}
                              </span>
                            </p>
                            {price.previousPrice && (
                              <p className="text-sm text-muted-foreground">
                                <span className="line-through">{formatPrice(price.previousPrice)}</span>
                                <span className="ms-2">
                                  {isDown 
                                    ? (language === 'ar' ? '↓ انخفاض' : '↓ Decrease')
                                    : isUp 
                                      ? (language === 'ar' ? '↑ ارتفاع' : '↑ Increase')
                                      : (language === 'ar' ? '— ثابت' : '— Stable')
                                  }
                                </span>
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-3 border-t pt-2">
                            {language === 'ar' ? 'تاريخ التحديث:' : 'Updated:'}{' '}
                            {new Date(price.priceDate).toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US')}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <Card className="mt-8">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">
                  {language === 'ar' ? 'تبحث عن مكونات بأفضل الأسعار؟' : 'Looking for components at the best prices?'}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {language === 'ar' 
                    ? 'تصفح متجرنا واحصل على أفضل العروض مع ضمان الجودة'
                    : 'Browse our store and get the best deals with quality guarantee'
                  }
                </p>
              </div>
              <Link href="/">
                <Button data-testid="button-browse-store">
                  {language === 'ar' ? 'تصفح المتجر' : 'Browse Store'}
                  <ArrowRight className="w-4 h-4 ms-2 rtl:rotate-180" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
