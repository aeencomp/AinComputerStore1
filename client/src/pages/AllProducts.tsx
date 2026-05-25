import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { CartSidebar } from "@/components/CartSidebar";
import { Product, CartItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { useLocation } from "wouter";
import { Package, Grid3X3, List } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CartItemWithId extends CartItem {
  id: string;
}

export default function AllProducts() {
  const { cartOpen, setCartOpen } = useCart();
  const [loadCart, setLoadCart] = useState(cartOpen);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (cartOpen) {
      setLoadCart(true);
      return;
    }
    const id =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback(() => setLoadCart(true), { timeout: 3000 })
        : window.setTimeout(() => setLoadCart(true), 1500);
    return () => {
      if (typeof requestIdleCallback === "function" && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(id as number);
      } else {
        clearTimeout(id as number);
      }
    };
  }, [cartOpen]);
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const [, setLocation] = useLocation();

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const { data: cartItems = [] } = useQuery<CartItemWithId[]>({
    queryKey: ['/api/cart'],
    enabled: loadCart,
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
          (language === 'ar' ? p.descriptionAr : p.descriptionEn).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;

  const handleCategorySelect = (category: string) => {
    if (category && category !== 'all') {
      setLocation(`/?category=${category}`);
    } else {
      setLocation('/products');
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
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
    try {
      await updateQuantityMutation.mutateAsync({ id, quantity });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('cart.updateError'),
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
      <Header
        cartItemsCount={cartItemsCount}
        onCartClick={() => setCartOpen(true)}
        onSearch={handleSearch}
        onCategorySelect={handleCategorySelect}
        searchValue={searchQuery}
      />

      <main className="flex-1 py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
              <Package className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground" data-testid="text-all-products-title">
                {language === 'ar' ? 'جميع المنتجات' : 'All Products'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {filteredProducts.length} {language === 'ar' ? 'منتج' : 'products'}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground mb-2">
                {language === 'ar' ? 'لا توجد منتجات' : 'No products found'}
              </h3>
              <p className="text-muted-foreground">
                {language === 'ar' 
                  ? 'جرب البحث بكلمات مختلفة'
                  : 'Try searching with different keywords'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={() => handleAddToCart(product)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      <CartSidebar
        open={cartOpen}
        onOpenChange={setCartOpen}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
      />
    </div>
  );
}
