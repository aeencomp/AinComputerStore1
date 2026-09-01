import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Product } from "@shared/schema";
import { ShoppingCart, ImageOff } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatPrice } from "@/lib/formatters";
import { resolveAssetUrl } from "@/lib/assetUrl";
import laptopImage from "@assets/generated_images/gaming_laptop_product_photo.png";
import desktopImage from "@assets/generated_images/desktop_pc_tower_photo.png";
import monitorImage from "@assets/generated_images/gaming_monitor_product_photo.png";
import keyboardImage from "@assets/generated_images/gaming_keyboard_product_photo.png";
import mouseImage from "@assets/generated_images/gaming_mouse_product_photo.png";
import headsetImage from "@assets/generated_images/gaming_headset_product_photo.png";

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
      return resolveAssetUrl(product.image);
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
          {product.badge && (
            <Badge 
              className="absolute top-2 right-2 z-10"
              variant={product.badge.includes('خصم') ? 'destructive' : 'default'}
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
        <CardContent className="p-5 space-y-3 cursor-pointer">
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
        {/* Product prices are stored in thousands (e.g., 340 = 340,000 IQD) */}
        <div className="w-full flex items-baseline gap-2">
          {product.oldPrice && (
            <span className="text-sm text-muted-foreground line-through" data-testid={`text-old-price-${product.id}`}>
              {formatPrice(parseFloat(product.oldPrice) * 1000, language)} {t('common.currency')}
            </span>
          )}
          <span className="text-2xl font-bold text-primary" data-testid={`text-price-${product.id}`}>
            {formatPrice(parseFloat(product.price) * 1000, language)} {t('common.currency')}
          </span>
        </div>
        <Button
          className="w-full gap-2"
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
