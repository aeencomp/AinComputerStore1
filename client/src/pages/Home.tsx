import { useState, useEffect } from "react";
import { ModernHeader } from "@/components/ModernHeader";
import { ModernHero } from "@/components/ModernHero";
import { ModernCategorySection } from "@/components/ModernCategorySection";
import { ModernFeaturedProducts } from "@/components/ModernFeaturedProducts";
import { TrustBadges } from "@/components/TrustBadges";
import { BrandLogos } from "@/components/BrandLogos";
import { ModernFooter } from "@/components/ModernFooter";
import { ProductCard } from "@/components/ProductCard";
import { CartSidebar } from "@/components/CartSidebar";
import { Product, CartItem, StoreSettings } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { Link, useLocation, useSearch } from "wouter";
import { Wrench, Search, Package } from "lucide-react";

interface CartItemWithId extends CartItem {
  id: string;
}

export default function Home() {
  const { cartOpen, setCartOpen } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  
  const urlParams = new URLSearchParams(searchString);
  const categoryFromUrl = urlParams.get('category') || "";
  const searchFromUrl = urlParams.get('search') || "";
  
  const [selectedCategory, setSelectedCategory] = useState(categoryFromUrl);
  
  useEffect(() => {
    setSelectedCategory(categoryFromUrl);
    if (searchFromUrl) {
      setSearchQuery(searchFromUrl);
    }
  }, [categoryFromUrl, searchFromUrl]);

  const queryKey = selectedCategory 
    ? `/api/products?category=${selectedCategory}`
    : '/api/products';

  const { data: products = [], isLoading, isError: productsError } = useQuery<Product[]>({
    queryKey: [queryKey],
  });

  const { data: cartItems = [], isLoading: cartLoading, isError: cartError } = useQuery<CartItemWithId[]>({
    queryKey: ['/api/cart'],
  });

  const { data: storeSettings } = useQuery<StoreSettings>({
    queryKey: ['/api/store-settings'],
  });

  const featuredProductsCount = storeSettings?.featuredProductsCount || 8;

  const addToCartMutation = useMutation({
    mutationFn: async (productId: string) => {
      return await apiRequest('POST', '/api/cart', {
        productId,
        quantity: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      return await apiRequest('PATCH', `/api/cart/${id}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/cart/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
    },
  });

  const filteredProducts = searchQuery
    ? products.filter(
        (p) =>
          (language === 'ar' ? p.nameAr : p.nameEn).toLowerCase().includes(searchQuery.toLowerCase()) ||
          (language === 'ar' ? p.descriptionAr : p.descriptionEn).toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.includes(searchQuery)
      )
    : products;

  const handleCategorySelect = (category: string) => {
    if (category) {
      setLocation(`/?category=${category}`);
    } else {
      setLocation('/');
    }
    setSearchQuery("");
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query) {
      setLocation(`/?search=${encodeURIComponent(query)}`);
    } else {
      setLocation('/');
    }
  };

  const handleAddToCart = async (product: Product) => {
    try {
      await addToCartMutation.mutateAsync(product.id);
      toast({
        title: t('cart.addedToCart'),
        description: t('cart.addedDescription'),
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: t('cart.addError'),
        variant: "destructive",
      });
    }
  };

  const handleAddToCartById = async (productId: string) => {
    try {
      await addToCartMutation.mutateAsync(productId);
      toast({
        title: t('cart.addedToCart'),
        description: t('cart.addedDescription'),
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: t('cart.addError'),
        variant: "destructive",
      });
    }
  };

  const handleUpdateQuantity = async (id: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(id);
      return;
    }
    try {
      await updateQuantityMutation.mutateAsync({ id, quantity });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('cart.quantityUpdateError'),
        variant: "destructive",
      });
    }
  };

  const handleRemoveItem = async (id: string) => {
    try {
      await removeItemMutation.mutateAsync(id);
      toast({
        title: t('cart.removed'),
        description: t('cart.removedDescription'),
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('cart.removeError'),
        variant: "destructive",
      });
    }
  };

  const cartItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const isHomePage = !searchQuery && !selectedCategory;

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
      <ModernHeader
        cartItemsCount={cartItemsCount}
        onCartClick={() => setCartOpen(true)}
        onSearch={handleSearch}
        searchValue={searchQuery}
      />

      <main className="flex-1">
        {isHomePage && (
          <>
            <ModernHero />
            <ModernCategorySection />
            <ModernFeaturedProducts onAddToCart={handleAddToCartById} />
            
            <section className="py-12 md:py-16 bg-slate-50 dark:bg-slate-800/50" data-testid="section-repair-service">
              <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl p-8 md:p-12">
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/20 flex items-center justify-center">
                      <Wrench className="w-10 h-10 md:w-12 md:h-12 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-start text-white">
                    <h2 className="text-3xl md:text-4xl font-extrabold mb-2" data-testid="text-repair-title">
                      {t('home.repair.title')}
                    </h2>
                    <p className="text-xl text-blue-100 font-medium mb-2" data-testid="text-repair-subtitle">
                      {t('home.repair.subtitle')}
                    </p>
                    <p className="text-blue-100/80" data-testid="text-repair-description">
                      {t('home.repair.description')}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button asChild size="lg" className="gap-2 bg-white text-blue-600 hover:bg-blue-50 font-semibold px-6 rounded-full" data-testid="link-request-repair">
                      <Link href="/repair-request">
                        <Wrench className="w-5 h-5" />
                        {t('home.repair.requestBtn')}
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="gap-2 border-white/30 text-white hover:bg-white/10 font-semibold px-6 rounded-full" data-testid="link-track-repair">
                      <Link href="/track-repair">
                        <Search className="w-5 h-5" />
                        {t('home.repair.trackBtn')}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <TrustBadges />
            <BrandLogos />
          </>
        )}

        {(searchQuery || selectedCategory) && (
          <section className="py-12 md:py-16" data-testid="section-products">
            <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white" data-testid="text-products-title">
                  {searchQuery 
                    ? t('home.searchResultsFor', { query: searchQuery })
                    : t(`category.${selectedCategory}`)}
                </h2>
                <Button 
                  variant="outline" 
                  onClick={() => { setSearchQuery(""); setSelectedCategory(""); setLocation('/'); }}
                  className="rounded-full"
                  data-testid="button-clear-filter"
                >
                  {t('home.showAll')}
                </Button>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="space-y-4">
                      <Skeleton className="aspect-square w-full rounded-2xl" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-10 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              ) : productsError ? (
                <div className="text-center py-12">
                  <p className="text-lg text-destructive" data-testid="text-error-products">
                    {t('home.loadError')}
                  </p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-lg text-muted-foreground" data-testid="text-no-products">
                    {searchQuery ? t('home.noSearchResults') : t('home.noProducts')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <ModernFooter />

      <CartSidebar
        open={cartOpen}
        onOpenChange={setCartOpen}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        isLoading={cartLoading}
        isError={cartError}
      />
    </div>
  );
}
