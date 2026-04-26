import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartSidebar } from "@/components/CartSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/formatters";
import { apiRequest, queryClient, customerAuthMeQueryFn, customerAuthMeQueryKey } from "@/lib/queryClient";
import { resolveAssetUrl } from "@/lib/assetUrl";
import { useMutation, useQuery as useAuthQuery } from "@tanstack/react-query";
import type { Product, User, CartItem } from "@shared/schema";
import { ShoppingCart, ArrowLeft, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { ProductReviews } from "@/components/ProductReviews";
import laptopImage from "@assets/generated_images/gaming_laptop_product_photo.png";
import desktopImage from "@assets/generated_images/desktop_pc_tower_photo.png";
import monitorImage from "@assets/generated_images/gaming_monitor_product_photo.png";
import keyboardImage from "@assets/generated_images/gaming_keyboard_product_photo.png";
import mouseImage from "@assets/generated_images/gaming_mouse_product_photo.png";
import headsetImage from "@assets/generated_images/gaming_headset_product_photo.png";

import _2_096266e1_41b0_4fef_b2db_a9f92c444c5b from "@assets/2_096266e1-41b0-4fef-b2db-a9f92c444c5b.webp";

const imageMap: Record<string, string> = {
  "gaming_laptop_product_photo.png": laptopImage,
  "desktop_pc_tower_photo.png": desktopImage,
  "gaming_monitor_product_photo.png": monitorImage,
  "gaming_keyboard_product_photo.png": keyboardImage,
  "gaming_mouse_product_photo.png": mouseImage,
  "gaming_headset_product_photo.png": headsetImage,
};

interface CartItemWithId extends CartItem {
  id: string;
}

export default function ProductDetail() {
  const [location, setLocation] = useLocation();
  const { language, t } = useLanguage();
  const { cartOpen, setCartOpen } = useCart();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const productId = location.split("/product/")[1];

  const { data: product, isLoading: productLoading } = useQuery<Product>({
    queryKey: [`/api/products/${productId}`],
  });

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  // Get related products from the same category (excluding current product)
  const relatedProducts = allProducts
    .filter(p => p.category === product?.category && p.id !== product?.id)
    .slice(0, 4);

  const { data: currentUser } = useAuthQuery<User | null>({
    queryKey: customerAuthMeQueryKey,
    queryFn: customerAuthMeQueryFn,
  });

  const { data: cartItems = [], isLoading: cartLoading, isError: cartError } = useAuthQuery<CartItemWithId[]>({
    queryKey: ['/api/cart'],
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

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/cart', {
        productId,
        quantity,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      toast({
        title: t('cart.addedToCart'),
        description: `${quantity} ${t('product.addToCart')}`,
      });
      setQuantity(1);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: t('cart.addError'),
        variant: "destructive",
      });
    },
  });

  if (productLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header cartItemsCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)} onCartClick={() => setCartOpen(true)} onSearch={() => {}} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">{t('product.loading')}</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header cartItemsCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)} onCartClick={() => setCartOpen(true)} onSearch={() => {}} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-muted-foreground mb-4">{t('product.notFound')}</p>
            <Button onClick={() => setLocation("/")}>{t('login.backToHome')}</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const productName = language === 'ar' ? product.nameAr : product.nameEn;
  const productDescription = language === 'ar' ? product.descriptionAr : product.descriptionEn;
  
  // Resolve image path - maps asset keys to actual URLs
  const resolveImagePath = (img: string): string => {
    if (!img) return laptopImage;
    if (img.startsWith('/uploads/') || img.startsWith('/objects/') || img.startsWith('http')) {
      return resolveAssetUrl(img);
    }
    return imageMap[img] || laptopImage;
  };
  
  // Get all product images
  const getProductImages = (): string[] => {
    const images: string[] = [];
    const productImagesArray = (product as any).images || [];
    
    // Add images from the images array (resolve each one)
    if (productImagesArray.length > 0) {
      productImagesArray.forEach((img: string) => {
        if (img) images.push(resolveImagePath(img));
      });
    }
    
    // If no images in array, use the main image
    if (images.length === 0 && product.image) {
      images.push(resolveImagePath(product.image));
    }
    
    // Fallback to default
    if (images.length === 0) {
      images.push(laptopImage);
    }
    
    return images;
  };
  const productImages = getProductImages();
  const currentImage = productImages[selectedImageIndex] || productImages[0];
  const cartItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleUpdateQuantity = async (id: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(id);
      return;
    }
    try {
      await updateQuantityMutation.mutateAsync({ id, quantity });
    } catch {
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
    } catch {
      toast({
        title: t('common.error'),
        description: t('cart.removeError'),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header cartItemsCount={cartItemsCount} onCartClick={() => setCartOpen(true)} onSearch={() => {}} />
      <CartSidebar
        open={cartOpen}
        onOpenChange={setCartOpen}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        isLoading={cartLoading}
        isError={cartError}
      />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8">
          {/* Back Button */}
          <Button variant="ghost" className="mb-6 gap-2" onClick={() => setLocation("/")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            {language === 'ar' ? 'العودة للمتجر' : 'Back to Store'}
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Product Image Gallery */}
            <div data-testid={`product-detail-image-${product.id}`} className="space-y-4">
              <Card className="overflow-hidden relative">
                <div className="aspect-square overflow-hidden bg-muted flex items-center justify-center">
                  <img
                    src={currentImage}
                    alt={productName}
                    className="w-full h-full object-cover"
                    data-testid={`img-product-detail-${product.id}`}
                  />
                </div>
                {/* Navigation arrows for multiple images */}
                {productImages.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100"
                      onClick={() => setSelectedImageIndex(prev => prev > 0 ? prev - 1 : productImages.length - 1)}
                      data-testid="button-prev-image"
                    >
                      {language === 'ar' ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100"
                      onClick={() => setSelectedImageIndex(prev => prev < productImages.length - 1 ? prev + 1 : 0)}
                      data-testid="button-next-image"
                    >
                      {language === 'ar' ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </Button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                      {selectedImageIndex + 1} / {productImages.length}
                    </div>
                  </>
                )}
              </Card>
              
              {/* Thumbnail images */}
              {productImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {productImages.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        index === selectedImageIndex ? 'border-primary' : 'border-transparent hover:border-muted-foreground'
                      }`}
                      data-testid={`button-thumbnail-${index}`}
                    >
                      <img
                        src={img}
                        alt={`${productName} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
              {product.badge && (
                <div className="mt-4">
                  <Badge 
                    variant={product.badge.includes('خصم') || product.badge.includes('discount') ? 'destructive' : 'default'}
                    className="text-sm py-1"
                    data-testid={`badge-product-detail-${product.id}`}
                  >
                    {product.badge}
                  </Badge>
                </div>
              )}
            </div>

            {/* Product Details */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid={`text-product-name-${product.id}`}>
                  {productName}
                </h1>
                <p className="text-lg text-muted-foreground" data-testid={`text-product-description-${product.id}`}>
                  {productDescription}
                </p>
              </div>

              {/* Price Section - Prices stored in thousands (e.g., 340 = 340,000 IQD) */}
              <div className="space-y-2">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-primary" data-testid={`text-price-detail-${product.id}`}>
                    {formatPrice(parseFloat(product.price) * 1000, language)} {t('common.currency')}
                  </span>
                  {product.oldPrice && (
                    <span className="text-lg text-muted-foreground line-through" data-testid={`text-old-price-detail-${product.id}`}>
                      {formatPrice(parseFloat(product.oldPrice) * 1000, language)} {t('common.currency')}
                    </span>
                  )}
                </div>
              </div>

              <Separator />

              {/* Stock Status */}
              <div className="flex items-center gap-3">
                {product.inStock ? (
                  <>
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="text-green-600 font-medium" data-testid={`text-in-stock-${product.id}`}>
                      {t('product.inStock')}
                    </span>
                  </>
                ) : (
                  <span className="text-destructive font-medium" data-testid={`text-out-of-stock-${product.id}`}>
                    {t('product.outOfStock')}
                  </span>
                )}
              </div>

              {/* Specifications */}
              {product.specs && product.specs.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h2 className="text-lg font-bold mb-4" data-testid="text-specifications-title">
                      {t('product.specifications')}
                    </h2>
                    <ul className="space-y-3">
                      {product.specs.map((spec, index) => (
                        <li 
                          key={index} 
                          className="flex items-start gap-3"
                          data-testid={`spec-item-${index}`}
                        >
                          <span className="text-primary mt-1">•</span>
                          <span className="text-sm md:text-base">{spec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              <Separator />

              {/* Add to Cart Section */}
              <div className="space-y-4">
                {product.inStock && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center border rounded-md">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        data-testid="button-decrease-quantity"
                      >
                        −
                      </Button>
                      <span className="w-12 text-center font-medium" data-testid="text-quantity">
                        {quantity}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setQuantity(quantity + 1)}
                        data-testid="button-increase-quantity"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                )}

                <Button 
                  className="w-full gap-2 py-6 text-lg"
                  size="lg"
                  disabled={!product.inStock || addToCartMutation.isPending}
                  onClick={() => addToCartMutation.mutate()}
                  data-testid={`button-add-to-cart-detail-${product.id}`}
                >
                  <ShoppingCart className="h-5 w-5" />
                  {addToCartMutation.isPending ? t('product.loading') : t('product.addToCart')}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <ProductReviews productId={productId} />

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <section className="mt-12 border-t pt-8">
            <h2 className="text-2xl font-bold mb-6" data-testid="text-related-products-title">
              {language === 'ar' ? 'منتجات ذات صلة' : 'Related Products'}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((relatedProduct) => {
                const getRelatedImageSrc = () => {
                  if (!relatedProduct.image) return laptopImage;
                  if (relatedProduct.image.startsWith('/uploads/') || relatedProduct.image.startsWith('/objects/') || relatedProduct.image.startsWith('http')) {
                    return resolveAssetUrl(relatedProduct.image);
                  }
                  return imageMap[relatedProduct.image] || laptopImage;
                };
                const relatedProductName = language === 'ar' ? relatedProduct.nameAr : relatedProduct.nameEn;
                
                return (
                  <Link href={`/product/${relatedProduct.id}`} key={relatedProduct.id}>
                    <Card className="overflow-hidden hover-elevate cursor-pointer" data-testid={`card-related-${relatedProduct.id}`}>
                      <div className="aspect-square overflow-hidden bg-muted">
                        <img
                          src={getRelatedImageSrc()}
                          alt={relatedProductName}
                          className="w-full h-full object-cover"
                          data-testid={`img-related-${relatedProduct.id}`}
                        />
                      </div>
                      <div className="p-3">
                        <h3 className="font-medium text-sm line-clamp-2 mb-2" data-testid={`text-related-name-${relatedProduct.id}`}>
                          {relatedProductName}
                        </h3>
                        <p className="text-primary font-bold" data-testid={`text-related-price-${relatedProduct.id}`}>
                          {formatPrice(parseFloat(relatedProduct.price) * 1000, language)} {t('common.currency')}
                        </p>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
