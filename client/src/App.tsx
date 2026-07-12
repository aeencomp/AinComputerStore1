import { Suspense } from "react";
import { Switch, Route } from "wouter";
import { Loader2 } from "lucide-react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/contexts/CartContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import Home from "@/pages/Home";
import AllProducts from "@/pages/AllProducts";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ChangePassword from "@/pages/ChangePassword";
import ProductDetail from "@/pages/ProductDetail";
import Checkout from "@/pages/Checkout";
import OrderConfirmation from "@/pages/OrderConfirmation";
import RepairRequest from "@/pages/RepairRequest";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import PromoLanding from "@/pages/PromoLanding";
import { MetaPixel } from "@/components/MetaPixel";
import TrackRepair from "@/pages/TrackRepair";
import TrackOrder from "@/pages/TrackOrder";
import ZainCashCallback from "@/pages/ZainCashCallback";
import QiCardCallback from "@/pages/QiCardCallback";
import Portals from "@/pages/Portals";
import NotFound from "@/pages/not-found";
import { VisitorTracker } from "@/components/VisitorTracker";
import { BlockedChecker } from "@/components/BlockedChecker";
import * as Lazy from "@/lazyPages";

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/products" component={AllProducts} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/account/password" component={ChangePassword} />
        <Route path="/product/:id" component={ProductDetail} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/order-confirmation/:orderNumber" component={OrderConfirmation} />
        <Route path="/admin/login" component={Lazy.AdminLogin} />
        <Route path="/admin/dashboard" component={Lazy.AdminDashboard} />
        <Route path="/admin/products" component={Lazy.AdminProducts} />
        <Route path="/admin/programs" component={Lazy.AdminPrograms} />
        <Route path="/admin/customers" component={Lazy.AdminCustomers} />
        <Route path="/admin/attendance" component={Lazy.AdminAttendance} />
        <Route path="/admin/settings" component={Lazy.AdminSettings} />
        <Route path="/admin/market-prices" component={Lazy.AdminMarketPrices} />
        <Route path="/admin/external-prices" component={Lazy.AdminExternalPrices} />
        <Route path="/admin/inventory" component={Lazy.AdminInventory} />
        <Route path="/admin/pos" component={Lazy.AdminPOS} />
        <Route path="/admin/sales" component={Lazy.AdminSales} />
        <Route path="/admin/reviews" component={Lazy.AdminReviews} />
        <Route path="/admin/discount-codes" component={Lazy.AdminDiscountCodes} />
        <Route path="/admin/analytics" component={Lazy.AdminAnalytics} />
        <Route path="/admin/whatsapp" component={Lazy.AdminWhatsApp} />
        <Route path="/admin/social" component={Lazy.AdminSocialPosts} />
        <Route path="/admin/platform" component={Lazy.PlatformAdmin} />
        <Route path="/admin/recycle-bin" component={Lazy.RecycleBin} />
        <Route path="/admin/users" component={Lazy.AdminUsers} />
        <Route path="/sales/login" component={Lazy.SalesLogin} />
        <Route path="/sales" component={Lazy.SalesPortal} />
        <Route path="/sales/:rest*" component={Lazy.SalesPortal} />
        <Route path="/technician/login" component={Lazy.TechnicianLogin} />
        <Route path="/technician/dashboard" component={Lazy.TechnicianDashboard} />
        <Route path="/technician" component={Lazy.TechnicianDashboard} />
        <Route path="/technician/manage" component={Lazy.TechnicianManagement} />
        <Route path="/technician/daily-report" component={Lazy.TechnicianDailyReport} />
        <Route path="/technician/withdrawals" component={Lazy.TechnicianWithdrawals} />
        <Route path="/technician/tickets/:id" component={Lazy.TicketDetail} />
        <Route path="/technician/new-request" component={Lazy.NewRepairRequest} />
        <Route path="/technician/customer/:customerId" component={Lazy.CustomerProfile} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/promo" component={PromoLanding} />
        <Route path="/repair-request" component={RepairRequest} />
        <Route path="/track-repair" component={TrackRepair} />
        <Route path="/track-order" component={TrackOrder} />
        <Route path="/pc-builder" component={Lazy.PCBuilder} />
        <Route path="/market-analysis" component={Lazy.MarketAnalysis} />
        <Route path="/my-orders" component={Lazy.CustomerDashboard} />
        <Route path="/payment/zaincash/callback" component={ZainCashCallback} />
        <Route path="/payment/qicard/callback" component={QiCardCallback} />
        <Route path="/battery/login" component={Lazy.BatteryRedirectSalesLogin} />
        <Route path="/battery/manage" component={Lazy.BatteryRedirectInventory} />
        <Route path="/battery/pos" component={Lazy.BatteryRedirectPos} />
        <Route path="/battery/pos/print" component={Lazy.BatteryRedirectPos} />
        <Route path="/battery" component={Lazy.BatteryRedirectInventory} />
        <Route path="/battery/reports" component={Lazy.BatteryRedirectInventory} />
        <Route path="/portals" component={Portals} />
        <Route path="/shop/login" component={Lazy.ShopLogin} />
        <Route path="/shop/new-request" component={Lazy.ShopNewRepair} />
        <Route path="/shop/customer/:customerId" component={Lazy.ShopCustomerProfile} />
        <Route path="/shop/dashboard" component={Lazy.ShopDashboard} />
        <Route path="/shop" component={Lazy.ShopDashboard} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <CartProvider>
            <TooltipProvider>
              <Toaster />
              <VisitorTracker />
              <MetaPixel />
              <BlockedChecker>
                <Router />
                <PWAInstallPrompt />
                <WhatsAppButton />
              </BlockedChecker>
            </TooltipProvider>
          </CartProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
