import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { customerAuthMeQueryFn, customerAuthMeQueryKey } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'wouter';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CartSidebar } from '@/components/CartSidebar';
import { useCart } from '@/contexts/CartContext';
import { Package, ShoppingBag, ChevronDown, ChevronUp, MapPin, CreditCard, Calendar, ArrowRight, KeyRound } from 'lucide-react';
import { format } from 'date-fns';
import type { User, CartItem } from '@shared/schema';

interface OrderItem {
  productId: string;
  quantity: number;
  price: string;
  product: {
    nameAr: string;
    nameEn: string;
    image: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerCity: string;
  customerPostal: string;
  paymentMethod: string;
  subtotal: string;
  shipping: string;
  total: string;
  status: string;
  createdAt: string;
  itemsWithProducts: OrderItem[];
}

interface CartItemWithId extends CartItem {
  id: string;
}

export default function CustomerDashboard() {
  const { t, language } = useLanguage();
  const { cartOpen, setCartOpen } = useCart();
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const { data: currentUser, isLoading: isAuthLoading, isFetched: isAuthFetched } = useQuery<User | null>({
    queryKey: customerAuthMeQueryKey,
    queryFn: customerAuthMeQueryFn,
  });

  const { data: cartItems = [] } = useQuery<CartItemWithId[]>({
    queryKey: ['/api/cart'],
  });

  const isAuthenticated = isAuthFetched && !!currentUser;

  const { data: orders = [], isLoading: isOrdersLoading, isError } = useQuery<Order[]>({
    queryKey: ['/api/orders/my-orders'],
    enabled: isAuthenticated,
  });

  const cartItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
      case 'confirmed': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
      case 'processing': return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20';
      case 'shipped': return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20';
      case 'delivered': return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20';
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash_on_delivery': return t('orderConfirmation.cashOnDelivery');
      case 'zain_cash': return t('orderConfirmation.zainCash');
      case 'qicard': return t('orderConfirmation.qiCard');
      default: return method;
    }
  };

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    // Always use English numerals for prices
    return `${numPrice.toLocaleString('en-US')} ${language === 'ar' ? 'د.ع' : 'IQD'}`;
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header
          cartItemsCount={cartItemsCount}
          onCartClick={() => setCartOpen(true)}
          onSearch={() => {}}
          onCategorySelect={() => {}}
          searchValue=""
        />
        <main className="flex-1 flex items-center justify-center">
          <div className="space-y-4 text-center">
            <Skeleton className="h-12 w-12 rounded-full mx-auto" />
            <Skeleton className="h-6 w-48 mx-auto" />
          </div>
        </main>
        <Footer />
        <CartSidebar
          open={cartOpen}
          onOpenChange={setCartOpen}
          items={cartItems}
          onUpdateQuantity={() => {}}
          onRemoveItem={() => {}}
          isLoading={false}
          isError={false}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header
          cartItemsCount={cartItemsCount}
          onCartClick={() => setCartOpen(true)}
          onSearch={() => {}}
          onCategorySelect={() => {}}
          searchValue=""
        />
        <main className="flex-1 flex items-center justify-center">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <CardTitle>{t('dashboard.loginRequired')}</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/login">
                <Button data-testid="button-login-redirect">
                  {t('header.login')}
                  <ArrowRight className="h-4 w-4 ms-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
        <CartSidebar
          open={cartOpen}
          onOpenChange={setCartOpen}
          items={cartItems}
          onUpdateQuantity={() => {}}
          onRemoveItem={() => {}}
          isLoading={false}
          isError={false}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        cartItemsCount={cartItemsCount}
        onCartClick={() => setCartOpen(true)}
        onSearch={() => {}}
        onCategorySelect={() => {}}
        searchValue=""
      />

      <main className="flex-1 py-8">
        <div className="max-w-5xl mx-auto px-4">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2" data-testid="text-dashboard-title">
                {t('dashboard.myOrders')}
              </h1>
              <p className="text-muted-foreground">
                {t('dashboard.orderHistory')}
              </p>
            </div>
            <Link href="/account/password">
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-change-password">
                <KeyRound className="h-4 w-4" />
                {t('change.title')}
              </Button>
            </Link>
          </div>

          {isOrdersLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : isError ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-destructive" data-testid="text-load-error">
                  {t('dashboard.loadError')}
                </p>
              </CardContent>
            </Card>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2" data-testid="text-no-orders">
                  {t('dashboard.noOrders')}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {t('dashboard.noOrdersDesc')}
                </p>
                <Link href="/">
                  <Button data-testid="button-start-shopping">
                    {t('dashboard.startShopping')}
                    <ArrowRight className="h-4 w-4 ms-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Collapsible
                  key={order.id}
                  open={expandedOrders.has(order.id)}
                  onOpenChange={() => toggleOrderExpand(order.id)}
                >
                  <Card data-testid={`order-card-${order.orderNumber}`}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover-elevate">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Package className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg" data-testid={`text-order-number-${order.orderNumber}`}>
                                {order.orderNumber}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(order.createdAt), 'PPP')}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={getStatusColor(order.status)} data-testid={`badge-status-${order.orderNumber}`}>
                              {t(`dashboard.status.${order.status}`)}
                            </Badge>
                            <span className="font-bold text-primary" data-testid={`text-total-${order.orderNumber}`}>
                              {formatPrice(order.total)}
                            </span>
                            {expandedOrders.has(order.id) ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-6">
                        <Separator />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium text-sm mb-1">{t('dashboard.shippingAddress')}</p>
                              <p className="text-sm text-muted-foreground">{order.customerName}</p>
                              <p className="text-sm text-muted-foreground">{order.customerCity}</p>
                              <p className="text-sm text-muted-foreground">{order.customerAddress}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                            <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium text-sm mb-1">{t('dashboard.paymentMethod')}</p>
                              <p className="text-sm text-muted-foreground">
                                {getPaymentMethodLabel(order.paymentMethod)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-3">{t('dashboard.items')}</h4>
                          <div className="space-y-2">
                            {order.itemsWithProducts.map((item, index) => (
                              <div 
                                key={index} 
                                className="flex items-center gap-3 p-2 rounded-lg bg-muted/20"
                                data-testid={`order-item-${order.orderNumber}-${index}`}
                              >
                                <div className="w-12 h-12 rounded-md bg-background flex items-center justify-center overflow-hidden">
                                  {item.product.image ? (
                                    <img 
                                      src={`/images/${item.product.image}`} 
                                      alt={language === 'ar' ? item.product.nameAr : item.product.nameEn}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {language === 'ar' ? item.product.nameAr : item.product.nameEn}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatPrice(item.price)} × {item.quantity}
                                  </p>
                                </div>
                                <div className="text-end">
                                  <p className="font-medium text-sm">
                                    {formatPrice(parseFloat(item.price) * item.quantity)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('orderConfirmation.subtotal')}</span>
                            <span>{formatPrice(order.subtotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('orderConfirmation.shipping')}</span>
                            <span>
                              {parseFloat(order.shipping) === 0 
                                ? t('orderConfirmation.free') 
                                : formatPrice(order.shipping)}
                            </span>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between font-bold">
                            <span>{t('orderConfirmation.total')}</span>
                            <span className="text-primary">{formatPrice(order.total)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
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
        onUpdateQuantity={() => {}}
        onRemoveItem={() => {}}
        isLoading={false}
        isError={false}
      />
    </div>
  );
}
