import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Product } from "@shared/schema";
import { ShoppingCart, ImageOff, Percent, Tag } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatPrice } from "@/lib/formatters";
import laptopImage from "@assets/generated_images/gaming_laptop_product_photo.png";
import desktopImage from "@assets/generated_images/desktop_pc_tower_photo.png";
import monitorImage from "@assets/generated_images/gaming_monitor_product_photo.png";
import keyboardImage from "@assets/generated_images/gaming_keyboard_product_photo.png";
import mouseImage from "@assets/generated_images/gaming_mouse_product_photo.png";
import headsetImage from "@assets/generated_images/gaming_headset_product_photo.png";

function calculateDiscount(oldPrice: string, newPrice: string): number {
  const old = parseFloat(oldPrice);
  const current = parseFloat(newPrice);
  if (old <= 0 || current >= old) return 0;
  return Math.round(((old - current) / old) * 100);
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

const imageMap: Record<string, string> = {
  "gaming_laptop_product_photo.png": laptopImage,
  "desktop_pc_tower_photo.png": desktopImage,
  "gaming_monitor_product_photo.png": monitorImage,
  "gaming_keyboard_product_photo.png": keyboardImage,
  "gaming_mouse_product_photo.png": mouseImage,
  "gaming_headset_product_photo.png": headsetImage,
};

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const { language, t } = useLanguage();
  const [imageError, setImageError] = useState(false);
  
  // Check if image is a URL, uploaded file, or mapped asset
  const getImageSrc = () => {
    if (!product.image) return laptopImage;
    if (product.image.startsWith('/uploads/') || product.image.startsWith('/objects/') || product.image.startsWith('http')) {
      return product.image;
    }
    return imageMap[product.image] || laptopImage;
  };
  const imageSrc = getImageSrc();
  const productName = language === 'ar' ? product.nameAr : product.nameEn;
  const productDescription = language === 'ar' ? product.descriptionAr : product.descriptionEn;
  
  return (
    <Card className="overflow-hidden group hover-elevate" data-testid={`card-product-${product.id}`}>
      <Link href={`/product/${product.id}`}>
        <CardContent className="p-0 relative cursor-pointer">
          {/* Discount Badge - Professional Design */}
          {product.oldPrice && calculateDiscount(product.oldPrice, product.price) > 0 && (
            <div className="absolute top-3 start-3 z-10" data-testid={`discount-badge-${product.id}`}>
              <div className="relative">
                <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-3 py-1.5 rounded-lg shadow-lg shadow-red-500/30 flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5" />
                  <span className="font-bold text-sm">
                    {calculateDiscount(product.oldPrice, product.price)}%
                  </span>
                  <span className="text-xs opacity-90">{language === 'ar' ? 'خصم' : 'OFF'}</span>
                </div>
                <div className="absolute -bottom-1 start-3 w-2 h-2 bg-red-600 rotate-45"></div>
              </div>
            </div>
          )}
          
          {/* Custom Badge (if exists) */}
          {product.badge && (
            <Badge 
              className="absolute top-3 end-3 z-10 shadow-md"
              variant={product.badge.includes('خصم') || product.badge.includes('sale') ? 'destructive' : 'default'}
              data-testid={`badge-${product.id}`}
            >
              {product.badge}
            </Badge>
          )}
          <div className="aspect-square overflow-hidden bg-muted">
            {imageError ? (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <ImageOff className="w-12 h-12 text-muted-foreground" />
              </div>
            ) : (
              <img
                src={imageSrc}
                alt={productName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={() => setImageError(true)}
                data-testid={`img-product-${product.id}`}
              />
            )}
          </div>
        </CardContent>
        <CardContent className="p-4 space-y-2 cursor-pointer">
          <h3 className="font-bold text-lg line-clamp-1" data-testid={`text-name-${product.id}`}>
            {productName}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-description-${product.id}`}>
            {productDescription}
          </p>
          {product.specs && product.specs.length > 0 && (
            <div className="space-y-1">
              {product.specs.slice(0, 2).map((spec, index) => (
                <p key={index} className="text-xs text-muted-foreground" data-testid={`text-spec-${product.id}-${index}`}>
                  • {spec}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Link>
      <CardFooter className="p-4 pt-0 flex flex-col gap-3">
        {/* Price Section - Professional Design */}
        <div className="w-full">
          {product.oldPrice && calculateDiscount(product.oldPrice, product.price) > 0 ? (
            <div className="space-y-1">
              {/* Old Price with Strikethrough */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground line-through decoration-red-500/50 decoration-2" data-testid={`text-old-price-${product.id}`}>
                  {formatPrice(product.oldPrice, language)} {t('common.currency')}
                </span>
                <span className="text-xs bg-red-500/10 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                  -{calculateDiscount(product.oldPrice, product.price)}%
                </span>
              </div>
              {/* Current Price */}
              <div className="flex items-baseline gap-2">
                <Tag className="h-4 w-4 text-primary" />
                <span className="text-2xl font-bold text-primary" data-testid={`text-price-${product.id}`}>
                  {formatPrice(product.price, language)}
                </span>
                <span className="text-sm text-primary font-medium">{t('common.currency')}</span>
              </div>
              {/* Savings Amount */}
              <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                <span>{language === 'ar' ? 'وفر' : 'Save'}</span>
                <span className="font-bold">
                  {formatPrice((parseFloat(product.oldPrice) - parseFloat(product.price)).toString(), language)}
                </span>
                <span>{t('common.currency')}</span>
              </p>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-primary" data-testid={`text-price-${product.id}`}>
                {formatPrice(product.price, language)}
              </span>
              <span className="text-sm text-primary font-medium">{t('common.currency')}</span>
            </div>
          )}
        </div>
        <Button
          className="w-full gap-2 min-h-[44px]"
          onClick={() => onAddToCart(product)}
          disabled={!product.inStock}
          data-testid={`button-add-to-cart-${product.id}`}
        >
          <ShoppingCart className="h-4 w-4" />
          {product.inStock ? t('product.addToCart') : t('product.outOfStock')}
        </Button>
      </CardFooter>
    </Card>
  );
}
