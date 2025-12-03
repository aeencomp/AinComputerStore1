import { useState } from "react";
import { Header } from "@/components/Header";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { HeroSection } from "@/components/HeroSection";
import { CategorySection } from "@/components/CategorySection";
import { ProductCard } from "@/components/ProductCard";
import { CartSidebar } from "@/components/CartSidebar";
import { Footer } from "@/components/Footer";
import { Product, CartItem, StoreSettings, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { Link, useLocation } from "wouter";
import { Wrench, Search, Package } from "lucide-react";

interface CartItemWithId extends CartItem {
  id: string;
}

export default function Home() {
  const { cartOpen, setCartOpen } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const [, setLocation] = useLocation();

  const queryKey = selectedCategory 
    ? `/api/products?category=${selectedCategory}`
    : '/api/products';

  const { data: products = [], isLoading, isError: productsError } = useQuery<Product[]>({
    queryKey: [queryKey],
  });

  const { data: currentUser } = useQuery<User | null>({
    queryKey: ['/api/auth/me'],
  });

  const { data: cartItems = [], isLoading: cartLoading, isError: cartError } = useQuery<CartItemWithId[]>({
    queryKey: ['/api/cart'],
  });

  const { data: storeSettings } = useQuery<StoreSettings>({
    queryKey: ['/api/store-settings'],
  });

  const showHeroBanner = storeSettings?.showHeroBanner !== 0;
  const showCategories = storeSettings?.showCategories !== 0;
  const showFeaturedProducts = storeSettings?.showFeaturedProducts !== 0;
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
    setSelectedCategory(category);
    setSearchQuery("");
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedCategory("");
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

  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Header
        cartItemsCount={cartItemsCount}
        onCartClick={() => setCartOpen(true)}
        onSearch={handleSearch}
        onCategorySelect={handleCategorySelect}
        searchValue={searchQuery}
      />

      <main className="flex-1">
        {!searchQuery && !selectedCategory && showCategories && <CategorySection onCategoryClick={handleCategorySelect} />}

        {!searchQuery && !selectedCategory && (
          <section className="py-12 md:py-16 bg-muted/30" data-testid="section-repair-service">
            <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                    <Wrench className="w-10 h-10 md:w-12 md:h-12 text-primary animate-wrench" />
                  </div>
                </div>
                <div className="flex-1 text-center md:text-start">
                  <h2 className="text-3xl md:text-4xl font-extrabold mb-2" data-testid="text-repair-title">
                    {t('home.repair.title')}
                  </h2>
                  <p className="text-xl text-primary font-bold mb-2" data-testid="text-repair-subtitle">
                    {t('home.repair.subtitle')}
                  </p>
                  <p className="text-muted-foreground font-medium" data-testid="text-repair-description">
                    {t('home.repair.description')}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button asChild size="lg" className="gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg shadow-blue-500/25 font-semibold px-6" data-testid="link-request-repair">
                    <Link href="/repair-request">
                      <Wrench className="w-5 h-5" />
                      {t('home.repair.requestBtn')}
                    </Link>
                  </Button>
                  <Button asChild size="lg" className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/25 font-semibold px-6" data-testid="link-track-repair">
                    <Link href="/track-repair">
                      <Search className="w-5 h-5" />
                      {t('home.repair.trackBtn')}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="py-12 md:py-16" data-testid="section-products">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-products-title">
                {searchQuery 
                  ? t('home.searchResultsFor', { query: searchQuery })
                  : selectedCategory 
                    ? t(`category.${selectedCategory}`)
                    : t('home.featured.title')}
              </h2>
              {(searchQuery || selectedCategory) && (
                <Button 
                  variant="outline" 
                  onClick={() => { setSearchQuery(""); setSelectedCategory(""); }}
                  data-testid="button-clear-filter"
                >
                  {t('home.showAll')}
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-4">
                    <Skeleton className="aspect-square w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-10 w-full" />
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
                {(searchQuery || selectedCategory ? filteredProducts : filteredProducts.slice(0, featuredProductsCount)).map((product) => (
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
      </main>

      <Footer />

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
