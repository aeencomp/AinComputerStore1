import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, MemoryStick, HardDrive, CircuitBoard, ArrowRight, Calendar, Globe, ExternalLink, DollarSign } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link, useLocation } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartSidebar } from "@/components/CartSidebar";
import type { MarketPrice, ExternalPriceSource, CartItem } from "@shared/schema";

import { useState } from "react";

interface CartItemWithId extends CartItem {
  id: string;
}

interface MarketPriceWithComparisons extends MarketPrice {
  externalSources: ExternalPriceSource[];
  exchangeRate: number;
}

interface PriceComparisonResponse {
  prices: MarketPriceWithComparisons[];
  exchangeRate: number;
  lastRateUpdate: string | null;
}

const componentTypes = [
  { value: "ram", labelAr: "ذاكرة عشوائية (RAM)", labelEn: "RAM Memory", icon: MemoryStick, color: "bg-blue-500" },
  { value: "ssd", labelAr: "أقراص SSD", labelEn: "SSD Drives", icon: HardDrive, color: "bg-orange-500" },
  { value: "m2", labelAr: "أقراص M.2 NVMe", labelEn: "M.2 NVMe Drives", icon: CircuitBoard, color: "bg-purple-500" },
];

const sourceLogos: Record<string, { name: string; color: string }> = {
  newegg: { name: "Newegg", color: "bg-orange-500" },
  amazon: { name: "Amazon", color: "bg-yellow-500" },
  aliexpress: { name: "AliExpress", color: "bg-red-500" },
};

export default function MarketAnalysis() {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState("ram");
  const [cartOpen, setCartOpen] = useState(false);
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<PriceComparisonResponse>({
    queryKey: ['/api/market-prices/with-comparisons'],
  });

  const { data: cartItems = [] } = useQuery<CartItemWithId[]>({
    queryKey: ['/api/cart'],
  });

  const cartItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const marketPrices = data?.prices || [];
  const exchangeRate = data?.exchangeRate || 1310;
  const lastRateUpdate = data?.lastRateUpdate;

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

  const formatPrice = (price: string | number) => {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat('ar-IQ').format(num);
  };

  const formatUSD = (price: string | number) => {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
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

  const getPriceDifference = (localPrice: string, externalSource: ExternalPriceSource) => {
    const local = parseFloat(localPrice);
    const external = parseFloat(externalSource.priceIQD || '0');
    if (external === 0) return null;
    const diff = ((local - external) / external) * 100;
    return diff;
  };

  const getLowestExternalPrice = (sources: ExternalPriceSource[]) => {
    if (!sources || sources.length === 0) return null;
    const priced = sources.filter(s => s.priceIQD && parseFloat(s.priceIQD) > 0);
    if (priced.length === 0) return null;
    return priced.reduce((min, s) => 
      parseFloat(s.priceIQD!) < parseFloat(min.priceIQD!) ? s : min
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Header 
        cartItemsCount={cartItemsCount} 
        onCartClick={() => setCartOpen(true)} 
        onSearch={() => {}} 
      />
      
      <CartSidebar
        open={cartOpen}
        onOpenChange={setCartOpen}
        items={cartItems}
        onUpdateQuantity={() => {}}
        onRemoveItem={() => {}}
        isLoading={false}
      />
      
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link href="/">
              <span className="hover:text-primary cursor-pointer" data-testid="link-home">
                {language === 'ar' ? 'الرئيسية' : 'Home'}
              </span>
            </Link>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            <span>{language === 'ar' ? 'تحليل أسعار السوق' : 'Market Price Analysis'}</span>
          </div>
          
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
            {language === 'ar' ? 'تحليل أسعار السوق' : 'Market Price Analysis'}
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            {language === 'ar' 
              ? 'تابع أسعار الذاكرة وأقراص التخزين في السوق العراقي مقارنة بالأسعار العالمية. نقوم بتحديث الأسعار بانتظام لمساعدتك في اتخاذ قرارات الشراء المناسبة.'
              : 'Compare Iraqi market prices for memory and storage with international prices. We update prices regularly to help you make informed purchasing decisions.'
            }
          </p>
          
          <div className="flex flex-wrap items-center gap-4 mt-4">
            {getLastUpdateDate() && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  {language === 'ar' ? 'آخر تحديث:' : 'Last update:'} {getLastUpdateDate()}
                </span>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="w-4 h-4" />
              <span data-testid="text-exchange-rate">
                {language === 'ar' ? 'سعر الصرف:' : 'Exchange rate:'} $1 = {formatPrice(exchangeRate)} {language === 'ar' ? 'د.ع' : 'IQD'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-muted/30 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Globe className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium mb-1">
              {language === 'ar' ? 'مقارنة الأسعار الدولية' : 'International Price Comparison'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {language === 'ar'
                ? 'نعرض مقارنة بين أسعار السوق المحلي وأسعار المتاجر العالمية (Newegg, Amazon) محولة إلى الدينار العراقي. هذا يساعدك على معرفة ما إذا كان السعر المحلي مناسباً.'
                : 'We compare local market prices with international store prices (Newegg, Amazon) converted to Iraqi Dinar. This helps you understand if the local price is reasonable.'
              }
            </p>
          </div>
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
                        <Skeleton className="h-20 w-full mt-4" />
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
                    const lowestExternal = getLowestExternalPrice(price.externalSources);
                    const priceDiff = lowestExternal ? getPriceDifference(price.currentPrice, lowestExternal) : null;
                    
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
                            <div className="flex items-baseline justify-between">
                              <span className="text-sm text-muted-foreground">
                                {language === 'ar' ? 'السعر المحلي:' : 'Local Price:'}
                              </span>
                              <p className="text-2xl font-bold" data-testid={`text-local-price-${price.id}`}>
                                {formatPrice(price.currentPrice)}
                                <span className="text-sm font-normal text-muted-foreground ms-1">
                                  {language === 'ar' ? 'د.ع' : 'IQD'}
                                </span>
                              </p>
                            </div>
                            {price.previousPrice && (
                              <p className="text-sm text-muted-foreground text-end">
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

                          {price.externalSources && price.externalSources.length > 0 && (
                            <div className="mt-4 pt-3 border-t">
                              <div className="flex items-center gap-2 mb-2">
                                <Globe className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                  {language === 'ar' ? 'الأسعار العالمية:' : 'International Prices:'}
                                </span>
                              </div>
                              
                              <div className="space-y-2">
                                {price.externalSources.map((source) => {
                                  const sourceInfo = sourceLogos[source.source.toLowerCase()] || { name: source.source, color: 'bg-gray-500' };
                                  const diff = getPriceDifference(price.currentPrice, source);
                                  
                                  return (
                                    <div 
                                      key={source.id} 
                                      className="flex items-center justify-between text-sm bg-muted/50 rounded-md p-2"
                                      data-testid={`external-source-${source.id}`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${sourceInfo.color}`} />
                                        <span className="font-medium">{sourceInfo.name}</span>
                                        {source.sourceProductUrl && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <a 
                                                href={source.sourceProductUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-primary"
                                                data-testid={`link-external-${source.id}`}
                                              >
                                                <ExternalLink className="w-3 h-3" />
                                              </a>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              {language === 'ar' ? 'فتح الرابط' : 'Open link'}
                                            </TooltipContent>
                                          </Tooltip>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="text-end">
                                          <div className="font-medium">
                                            {formatPrice(source.priceIQD || '0')} {language === 'ar' ? 'د.ع' : 'IQD'}
                                          </div>
                                          {source.priceUSD && (
                                            <div className="text-xs text-muted-foreground">
                                              ({formatUSD(source.priceUSD)})
                                            </div>
                                          )}
                                        </div>
                                        {diff !== null && (
                                          <Badge 
                                            variant="outline" 
                                            className={`text-xs ${
                                              diff > 0 
                                                ? 'border-red-200 text-red-600 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-950' 
                                                : diff < 0 
                                                  ? 'border-green-200 text-green-600 bg-green-50 dark:border-green-800 dark:text-green-400 dark:bg-green-950' 
                                                  : ''
                                            }`}
                                          >
                                            {diff > 0 ? '+' : ''}{diff.toFixed(0)}%
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {priceDiff !== null && (
                                <div className={`mt-3 p-2 rounded-md text-sm ${
                                  priceDiff > 15 
                                    ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' 
                                    : priceDiff > 0 
                                      ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300'
                                      : 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                                }`}>
                                  {priceDiff > 15 ? (
                                    language === 'ar' 
                                      ? `⚠️ السعر المحلي أعلى بـ ${priceDiff.toFixed(0)}% من السعر العالمي`
                                      : `⚠️ Local price is ${priceDiff.toFixed(0)}% higher than international`
                                  ) : priceDiff > 0 ? (
                                    language === 'ar'
                                      ? `السعر المحلي أعلى بـ ${priceDiff.toFixed(0)}% من السعر العالمي`
                                      : `Local price is ${priceDiff.toFixed(0)}% higher than international`
                                  ) : priceDiff < 0 ? (
                                    language === 'ar'
                                      ? `✓ السعر المحلي أقل بـ ${Math.abs(priceDiff).toFixed(0)}% من السعر العالمي`
                                      : `✓ Local price is ${Math.abs(priceDiff).toFixed(0)}% lower than international`
                                  ) : (
                                    language === 'ar' ? '✓ السعر مطابق للسعر العالمي' : '✓ Price matches international'
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          
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
