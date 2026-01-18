import { useState, useEffect } from "react";
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
import { Link, useLocation, useSearch } from "wouter";
import { Wrench, Search, Package, Send, PackageX, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({
    productName: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    notes: '',
  });

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

  const productRequestMutation = useMutation({
    mutationFn: async (data: typeof requestForm) => {
      return await apiRequest('POST', '/api/product-requests', data);
    },
    onSuccess: () => {
      toast({
        title: t('home.requestProduct.success'),
      });
      setShowRequestForm(false);
      setRequestForm({
        productName: searchQuery,
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        notes: '',
      });
    },
    onError: () => {
      toast({
        title: t('home.requestProduct.error'),
        variant: 'destructive',
      });
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
    <div className="min-h-screen flex flex-col overflow-x-hidden">
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
          <section className="py-12 md:py-16" data-testid="section-repair-service">
            <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
              <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-10 p-6 md:p-8 rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 via-card/80 to-primary/10 shadow-xl shadow-primary/10 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50 pointer-events-none" />
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center animate-pulse shadow-lg shadow-primary/20">
                    <Wrench className="w-10 h-10 md:w-12 md:h-12 text-primary animate-wrench" />
                  </div>
                </div>
                <div className="flex-1 text-center md:text-start relative z-10">
                  <h2 className="text-3xl md:text-4xl font-extrabold mb-2 text-foreground" data-testid="text-repair-title">
                    {t('home.repair.title')}
                  </h2>
                  <p className="text-xl text-primary font-bold mb-2" data-testid="text-repair-subtitle">
                    {t('home.repair.subtitle')}
                  </p>
                  <p className="text-muted-foreground font-medium" data-testid="text-repair-description">
                    {t('home.repair.description')}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 relative z-10">
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

        <section className="py-12 md:py-20" data-testid="section-products">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            {/* Section Header - Enhanced */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="text-products-title">
                    {searchQuery 
                      ? t('home.searchResultsFor', { query: searchQuery })
                      : selectedCategory 
                        ? t(`category.${selectedCategory}`)
                        : t('home.featured.title')}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {searchQuery || selectedCategory 
                      ? `${filteredProducts.length} ${language === 'ar' ? 'منتج' : 'products'}`
                      : language === 'ar' ? 'اكتشف أحدث المنتجات والعروض' : 'Discover the latest products and offers'}
                  </p>
                </div>
              </div>
              {(searchQuery || selectedCategory) && (
                <Button 
                  variant="outline" 
                  size="lg"
                  className="gap-2 border-2 hover:border-primary hover:text-primary"
                  onClick={() => { setSearchQuery(""); setSelectedCategory(""); }}
                  data-testid="button-clear-filter"
                >
                  <X className="h-4 w-4" />
                  {t('home.showAll')}
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-8">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-4 bg-card rounded-2xl p-4 border border-border/50">
                    <Skeleton className="aspect-square w-full rounded-xl" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-11 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            ) : productsError ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
                  <PackageX className="h-10 w-10 text-destructive" />
                </div>
                <p className="text-xl font-semibold text-destructive mb-2" data-testid="text-error-products">
                  {t('home.loadError')}
                </p>
                <p className="text-muted-foreground">{language === 'ar' ? 'يرجى المحاولة مرة أخرى' : 'Please try again'}</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-16">
                <div className="text-center mb-8">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted/50 border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                    <PackageX className="h-12 w-12 text-muted-foreground/40" />
                  </div>
                  <p className="text-2xl font-bold text-foreground mb-2" data-testid="text-no-products">
                    {searchQuery ? t('home.noSearchResults') : t('home.noProducts')}
                  </p>
                  <p className="text-muted-foreground mb-6">
                    {searchQuery 
                      ? (language === 'ar' ? `لم نجد نتائج لـ "${searchQuery}"` : `No results found for "${searchQuery}"`)
                      : (language === 'ar' ? 'لا توجد منتجات حالياً' : 'No products available')}
                  </p>
                  {searchQuery && !showRequestForm && (
                    <Button 
                      size="lg"
                      onClick={() => {
                        setRequestForm(prev => ({ ...prev, productName: searchQuery }));
                        setShowRequestForm(true);
                      }}
                      className="gap-2"
                      data-testid="button-request-product"
                    >
                      <Send className="h-4 w-4" />
                      {t('home.requestProduct')}
                    </Button>
                  )}
                </div>

                {showRequestForm && (
                  <Card className="max-w-lg mx-auto border-primary/30" data-testid="card-product-request">
                    <CardHeader className="text-center">
                      <CardTitle className="text-primary">{t('home.requestProduct.title')}</CardTitle>
                      <CardDescription>{t('home.requestProduct.desc')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          productRequestMutation.mutate(requestForm);
                        }}
                        className="space-y-4"
                      >
                        <div>
                          <Input
                            placeholder={t('home.requestProduct.productName')}
                            value={requestForm.productName}
                            onChange={(e) => setRequestForm(prev => ({ ...prev, productName: e.target.value }))}
                            required
                            data-testid="input-request-product-name"
                          />
                        </div>
                        <div>
                          <Input
                            placeholder={t('home.requestProduct.customerName')}
                            value={requestForm.customerName}
                            onChange={(e) => setRequestForm(prev => ({ ...prev, customerName: e.target.value }))}
                            required
                            data-testid="input-request-customer-name"
                          />
                        </div>
                        <div>
                          <Input
                            type="tel"
                            placeholder={t('home.requestProduct.customerPhone')}
                            value={requestForm.customerPhone}
                            onChange={(e) => setRequestForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                            required
                            data-testid="input-request-phone"
                          />
                        </div>
                        <div>
                          <Input
                            type="email"
                            placeholder={t('home.requestProduct.customerEmail')}
                            value={requestForm.customerEmail}
                            onChange={(e) => setRequestForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                            data-testid="input-request-email"
                          />
                        </div>
                        <div>
                          <Textarea
                            placeholder={t('home.requestProduct.notes')}
                            value={requestForm.notes}
                            onChange={(e) => setRequestForm(prev => ({ ...prev, notes: e.target.value }))}
                            rows={3}
                            data-testid="textarea-request-notes"
                          />
                        </div>
                        <div className="flex gap-3">
                          <Button 
                            type="submit" 
                            className="flex-1"
                            disabled={productRequestMutation.isPending}
                            data-testid="button-submit-request"
                          >
                            <Send className="h-4 w-4 me-2" />
                            {productRequestMutation.isPending ? '...' : t('home.requestProduct.submit')}
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline"
                            onClick={() => setShowRequestForm(false)}
                            data-testid="button-cancel-request"
                          >
                            {t('common.cancel')}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-8">
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
