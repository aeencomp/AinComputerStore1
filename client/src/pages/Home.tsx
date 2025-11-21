import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { CategorySection } from "@/components/CategorySection";
import { ProductCard } from "@/components/ProductCard";
import { CartSidebar } from "@/components/CartSidebar";
import { Footer } from "@/components/Footer";
import { Product, CartItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";

interface CartItemWithId extends CartItem {
  id: string;
}

export default function Home() {
  const [cartOpen, setCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const { toast } = useToast();
  const { language, t } = useLanguage();

  const queryKey = selectedCategory 
    ? `/api/products?category=${selectedCategory}`
    : '/api/products';

  const { data: products = [], isLoading, isError: productsError } = useQuery<Product[]>({
    queryKey: [queryKey],
  });

  const { data: cartItems = [], isLoading: cartLoading, isError: cartError } = useQuery<CartItemWithId[]>({
    queryKey: ['/api/cart'],
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
      const productName = language === 'ar' ? product.nameAr : product.nameEn;
      toast({
        title: language === 'ar' ? "تمت الإضافة للسلة" : "Added to Cart",
        description: language === 'ar' 
          ? `تم إضافة ${productName} إلى سلة التسوق`
          : `${productName} has been added to your cart`,
      });
    } catch (error) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' 
          ? "حدث خطأ أثناء إضافة المنتج للسلة"
          : "An error occurred while adding the product",
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
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' 
          ? "حدث خطأ أثناء تحديث الكمية"
          : "An error occurred while updating quantity",
        variant: "destructive",
      });
    }
  };

  const handleRemoveItem = async (id: string) => {
    try {
      await removeItemMutation.mutateAsync(id);
      toast({
        title: language === 'ar' ? "تم الحذف" : "Removed",
        description: language === 'ar' 
          ? "تم حذف المنتج من السلة"
          : "Product removed from cart",
      });
    } catch (error) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' 
          ? "حدث خطأ أثناء حذف المنتج"
          : "An error occurred while removing the product",
        variant: "destructive",
      });
    }
  };

  const cartItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        cartItemsCount={cartItemsCount}
        onCartClick={() => setCartOpen(true)}
        onSearch={handleSearch}
        onCategorySelect={handleCategorySelect}
      />

      <main className="flex-1">
        {!searchQuery && !selectedCategory && <HeroSection />}
        {!searchQuery && !selectedCategory && <CategorySection onCategoryClick={handleCategorySelect} />}

        <section className="py-12 md:py-16" data-testid="section-products">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-products-title">
                {searchQuery 
                  ? (language === 'ar' ? `نتائج البحث: "${searchQuery}"` : `Search results: "${searchQuery}"`)
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
                  {language === 'ar' ? 'عرض الكل' : 'Show All'}
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
                  {language === 'ar' 
                    ? 'حدث خطأ أثناء تحميل المنتجات. يرجى المحاولة مرة أخرى.'
                    : 'An error occurred while loading products. Please try again.'}
                </p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground" data-testid="text-no-products">
                  {searchQuery 
                    ? (language === 'ar' ? 'لا توجد منتجات تطابق البحث' : 'No products match your search')
                    : (language === 'ar' ? 'لا توجد منتجات متاحة' : 'No products available')}
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
