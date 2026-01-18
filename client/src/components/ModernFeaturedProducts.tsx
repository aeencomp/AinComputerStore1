import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChevronRight, ChevronLeft, ShoppingCart, Star, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import type { Product } from "@shared/schema";

interface ModernFeaturedProductsProps {
  onAddToCart: (productId: string) => void;
}

export function ModernFeaturedProducts({ onAddToCart }: ModernFeaturedProductsProps) {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [activeTab, setActiveTab] = useState<'hot' | 'best' | 'new'>('hot');

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const featuredProducts = products
    .filter(p => p.badge || p.oldPrice)
    .slice(0, 8);

  const tabs = [
    { id: 'hot', labelAr: 'عروض ساخنة', labelEn: 'Hot Deals' },
    { id: 'best', labelAr: 'الأكثر مبيعاً', labelEn: 'Best Sellers' },
    { id: 'new', labelAr: 'وصل حديثاً', labelEn: 'New Arrivals' },
  ];

  const formatPrice = (price: string | number) => {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return num.toLocaleString('ar-IQ');
  };

  const getProductImage = (product: Product): string => {
    if (product.image?.startsWith('/uploads/') || product.image?.startsWith('/objects/') || product.image?.startsWith('http')) {
      return product.image;
    }
    return 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80';
  };

  if (isLoading) {
    return (
      <section className="py-16 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="aspect-square rounded-xl mb-4" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-6 w-1/2" />
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-slate-50 dark:bg-slate-800/50" dir={isRTL ? 'rtl' : 'ltr'} data-testid="section-featured">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
          <div className={`text-center ${isRTL ? 'md:text-end' : 'md:text-start'}`}>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">
              {isRTL ? 'العروض المميزة' : 'Featured Offers'}
            </h2>
            <div className={`flex flex-wrap justify-center gap-4 mt-4 ${isRTL ? 'md:justify-end' : 'md:justify-start'}`}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'hot' | 'best' | 'new')}
                  className={`text-sm font-medium transition-colors ${
                    activeTab === tab.id 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  {isRTL ? tab.labelAr : tab.labelEn}
                </button>
              ))}
            </div>
          </div>
          
          <Link href="/?category=offers">
            <Button variant="outline" className="gap-2 rounded-full" data-testid="button-browse-more">
              {isRTL ? 'تصفح المزيد' : 'Browse for More'}
              {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {featuredProducts.map((product) => (
            <Card 
              key={product.id}
              className="group relative overflow-hidden rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-300"
              data-testid={`card-product-${product.id}`}
            >
              <div className="relative aspect-square bg-slate-100 dark:bg-slate-800 p-4">
                {product.oldPrice && parseFloat(product.oldPrice) > parseFloat(product.price) && (
                  <Badge className="absolute top-3 left-3 bg-red-500 text-white font-bold z-10">
                    -{Math.round((1 - parseFloat(product.price) / parseFloat(product.oldPrice)) * 100)}%
                  </Badge>
                )}
                {product.badge && (
                  <Badge className="absolute top-3 right-3 bg-blue-600 text-white z-10">
                    {product.badge}
                  </Badge>
                )}
                <Link href={`/product/${product.id}`} data-testid={`link-product-image-${product.id}`}>
                  <img 
                    src={getProductImage(product)}
                    alt={isRTL ? product.nameAr : product.nameEn}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </Link>
              </div>
              
              <div className="p-4">
                <Link href={`/product/${product.id}`} data-testid={`link-product-title-${product.id}`}>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2 line-clamp-2 transition-colors">
                    {isRTL ? product.nameAr : product.nameEn}
                  </h3>
                </Link>
                
                <div className="flex items-center gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-3 h-3 ${i < 4 ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} 
                    />
                  ))}
                </div>
                
                <div className="flex items-baseline gap-2 mb-3">
                  {product.oldPrice && parseFloat(product.oldPrice) > parseFloat(product.price) && (
                    <span className="text-sm text-slate-400 line-through">
                      {formatPrice(product.oldPrice)}
                    </span>
                  )}
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {isRTL ? 'د.ع' : 'IQD'} {formatPrice(product.price)}
                  </span>
                </div>
                
                <Button 
                  size="sm"
                  className="w-full bg-blue-600 text-white rounded-full gap-2"
                  onClick={() => onAddToCart(product.id)}
                  data-testid={`button-add-cart-${product.id}`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  {isRTL ? 'أضف للسلة' : 'Add to Cart'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
