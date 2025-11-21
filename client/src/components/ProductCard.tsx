import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Product } from "@shared/schema";
import { ShoppingCart } from "lucide-react";
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

function formatPrice(price: string | number): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return numPrice.toLocaleString('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const imageSrc = imageMap[product.image] || laptopImage;
  
  return (
    <Card className="overflow-hidden group hover-elevate" data-testid={`card-product-${product.id}`}>
      <CardContent className="p-0 relative">
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
          <img
            src={imageSrc}
            alt={product.nameAr}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            data-testid={`img-product-${product.id}`}
          />
        </div>
      </CardContent>
      <CardContent className="p-4 space-y-2">
        <h3 className="font-bold text-lg line-clamp-1" data-testid={`text-name-${product.id}`}>
          {product.nameAr}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-description-${product.id}`}>
          {product.descriptionAr}
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
      <CardFooter className="p-4 pt-0 flex flex-col gap-3">
        <div className="w-full flex items-baseline gap-2">
          {product.oldPrice && (
            <span className="text-sm text-muted-foreground line-through" data-testid={`text-old-price-${product.id}`}>
              {formatPrice(product.oldPrice)} ريال
            </span>
          )}
          <span className="text-2xl font-bold text-primary" data-testid={`text-price-${product.id}`}>
            {formatPrice(product.price)} ريال
          </span>
        </div>
        <Button
          className="w-full gap-2"
          onClick={() => onAddToCart(product)}
          disabled={!product.inStock}
          data-testid={`button-add-to-cart-${product.id}`}
        >
          <ShoppingCart className="h-4 w-4" />
          {product.inStock ? 'أضف للسلة' : 'غير متوفر'}
        </Button>
      </CardFooter>
    </Card>
  );
}
