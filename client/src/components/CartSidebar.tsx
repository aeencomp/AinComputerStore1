import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CartItem } from "@shared/schema";
import { Minus, Plus, X, ShoppingBag, AlertCircle } from "lucide-react";
import laptopImage from "@assets/generated_images/gaming_laptop_product_photo.png";
import desktopImage from "@assets/generated_images/desktop_pc_tower_photo.png";
import monitorImage from "@assets/generated_images/gaming_monitor_product_photo.png";
import keyboardImage from "@assets/generated_images/gaming_keyboard_product_photo.png";
import mouseImage from "@assets/generated_images/gaming_mouse_product_photo.png";
import headsetImage from "@assets/generated_images/gaming_headset_product_photo.png";

interface CartItemWithId extends CartItem {
  id: string;
}

interface CartSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItemWithId[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  isLoading?: boolean;
  isError?: boolean;
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

export function CartSidebar({
  open,
  onOpenChange,
  items,
  onUpdateQuantity,
  onRemoveItem,
  isLoading = false,
  isError = false,
}: CartSidebarProps) {
  const subtotal = items.reduce(
    (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
    0
  );

  const shipping = subtotal > 0 ? 0 : 0;
  const total = subtotal + shipping;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-lg flex flex-col" data-testid="sheet-cart">
        <SheetHeader>
          <SheetTitle className="text-2xl" data-testid="text-cart-title">سلة التسوق</SheetTitle>
          <SheetDescription>إدارة منتجات سلة التسوق الخاصة بك</SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 overflow-auto py-4">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-20 w-20 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : isError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
            <AlertCircle className="h-16 w-16 text-destructive" />
            <p className="text-lg text-destructive text-center" data-testid="text-cart-error">
              حدث خطأ أثناء تحميل السلة
            </p>
            <Button variant="outline" onClick={() => window.location.reload()} data-testid="button-retry-cart">
              إعادة المحاولة
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
            <ShoppingBag className="h-16 w-16 text-muted-foreground" />
            <p className="text-lg text-muted-foreground" data-testid="text-empty-cart">السلة فارغة</p>
            <Button onClick={() => onOpenChange(false)} data-testid="button-continue-shopping">
              تصفح المنتجات
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto py-4">
              <div className="space-y-4">
                {items.map((item) => {
                  const imageSrc = imageMap[item.product.image] || laptopImage;
                  return (
                  <div
                    key={item.product.id}
                    className="flex gap-4"
                    data-testid={`cart-item-${item.product.id}`}
                  >
                    <div className="h-20 w-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={imageSrc}
                        alt={item.product.nameAr}
                        className="w-full h-full object-cover"
                        data-testid={`img-cart-${item.product.id}`}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm line-clamp-2" data-testid={`text-cart-name-${item.product.id}`}>
                          {item.product.nameAr}
                        </h4>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => onRemoveItem(item.id)}
                          data-testid={`button-remove-${item.product.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() =>
                              onUpdateQuantity(item.id, item.quantity - 1)
                            }
                            disabled={item.quantity <= 1}
                            data-testid={`button-decrease-${item.product.id}`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium" data-testid={`text-quantity-${item.product.id}`}>
                            {item.quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() =>
                              onUpdateQuantity(item.id, item.quantity + 1)
                            }
                            data-testid={`button-increase-${item.product.id}`}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="font-bold text-primary" data-testid={`text-cart-price-${item.product.id}`}>
                          {formatPrice(parseFloat(item.product.price) * item.quantity)} ريال
                        </span>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </div>

            <SheetFooter className="flex-col gap-4">
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground" data-testid="text-subtotal-label">المجموع الفرعي</span>
                  <span className="font-medium" data-testid="text-subtotal">{formatPrice(subtotal)} ريال</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground" data-testid="text-shipping-label">الشحن</span>
                  <span className="font-medium text-primary" data-testid="text-shipping">
                    {shipping === 0 ? 'مجاني' : `${formatPrice(shipping)} ريال`}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-bold" data-testid="text-total-label">الإجمالي</span>
                  <span className="font-bold text-primary" data-testid="text-total">{formatPrice(total)} ريال</span>
                </div>
              </div>
              <Button className="w-full" size="lg" data-testid="button-checkout">
                إتمام الطلب
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onOpenChange(false)}
                data-testid="button-continue-shopping-bottom"
              >
                متابعة التسوق
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
