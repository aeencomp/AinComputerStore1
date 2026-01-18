import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/contexts/CartContext";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ProductDetail from "@/pages/ProductDetail";
import Checkout from "@/pages/Checkout";
import OrderConfirmation from "@/pages/OrderConfirmation";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminProducts from "@/pages/AdminProducts";
import AdminPrograms from "@/pages/AdminPrograms";
import AdminCustomers from "@/pages/AdminCustomers";
import AdminAttendance from "@/pages/AdminAttendance";
import AdminSettings from "@/pages/AdminSettings";
import AdminMarketPrices from "@/pages/AdminMarketPrices";
import AdminExternalPrices from "@/pages/AdminExternalPrices";
import AdminInventory from "@/pages/AdminInventory";
import AdminPOS from "@/pages/AdminPOS";
import AdminSales from "@/pages/AdminSales";
import AdminReviews from "@/pages/AdminReviews";
import AdminDiscountCodes from "@/pages/AdminDiscountCodes";
import AdminSlideshow from "@/pages/AdminSlideshow";
import SalesLogin from "@/pages/SalesLogin";
import SalesPortal from "@/pages/SalesPortal";
import TechnicianLogin from "@/pages/technician/TechnicianLogin";
import TechnicianDashboard from "@/pages/technician/TechnicianDashboard";
import TechnicianManagement from "@/pages/technician/TechnicianManagement";
import TicketDetail from "@/pages/technician/TicketDetail";
import NewRepairRequest from "@/pages/technician/NewRepairRequest";
import RepairRequest from "@/pages/RepairRequest";
import TrackRepair from "@/pages/TrackRepair";
import TrackOrder from "@/pages/TrackOrder";
import PCBuilder from "@/pages/PCBuilder";
import MarketAnalysis from "@/pages/MarketAnalysis";
import CustomerDashboard from "@/pages/CustomerDashboard";
import ZainCashCallback from "@/pages/ZainCashCallback";
import QiCardCallback from "@/pages/QiCardCallback";
import BatteryLogin from "@/pages/BatteryLogin";
import BatteryDashboard from "@/pages/BatteryDashboard";
import BatteryManage from "@/pages/BatteryManage";
import BatteryPOS from "@/pages/BatteryPOS";
import BatterySalesReport from "@/pages/BatterySalesReport";
import BatteryReceiptPrint from "@/pages/BatteryReceiptPrint";
import Portals from "@/pages/Portals";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home}/>
      <Route path="/login" component={Login}/>
      <Route path="/register" component={Register}/>
      <Route path="/product/:id" component={ProductDetail}/>
      <Route path="/checkout" component={Checkout}/>
      <Route path="/order-confirmation/:orderNumber" component={OrderConfirmation}/>
      <Route path="/admin/login" component={AdminLogin}/>
      <Route path="/admin/dashboard" component={AdminDashboard}/>
      <Route path="/admin/products" component={AdminProducts}/>
      <Route path="/admin/programs" component={AdminPrograms}/>
      <Route path="/admin/customers" component={AdminCustomers}/>
      <Route path="/admin/attendance" component={AdminAttendance}/>
      <Route path="/admin/settings" component={AdminSettings}/>
      <Route path="/admin/market-prices" component={AdminMarketPrices}/>
      <Route path="/admin/external-prices" component={AdminExternalPrices}/>
      <Route path="/admin/inventory" component={AdminInventory}/>
      <Route path="/admin/pos" component={AdminPOS}/>
      <Route path="/admin/sales" component={AdminSales}/>
      <Route path="/admin/reviews" component={AdminReviews}/>
      <Route path="/admin/discount-codes" component={AdminDiscountCodes}/>
      <Route path="/admin/slideshow" component={AdminSlideshow}/>
      <Route path="/sales/login" component={SalesLogin}/>
      <Route path="/sales" component={SalesPortal}/>
      <Route path="/sales/:rest*" component={SalesPortal}/>
      <Route path="/technician/login" component={TechnicianLogin}/>
      <Route path="/technician/dashboard" component={TechnicianDashboard}/>
      <Route path="/technician" component={TechnicianDashboard}/>
      <Route path="/technician/manage" component={TechnicianManagement}/>
      <Route path="/technician/tickets/:id" component={TicketDetail}/>
      <Route path="/technician/new-request" component={NewRepairRequest}/>
      <Route path="/repair-request" component={RepairRequest}/>
      <Route path="/track-repair" component={TrackRepair}/>
      <Route path="/track-order" component={TrackOrder}/>
      <Route path="/pc-builder" component={PCBuilder}/>
      <Route path="/market-analysis" component={MarketAnalysis}/>
      <Route path="/my-orders" component={CustomerDashboard}/>
      <Route path="/payment/zaincash/callback" component={ZainCashCallback}/>
      <Route path="/payment/qicard/callback" component={QiCardCallback}/>
      <Route path="/battery/login" component={BatteryLogin}/>
      <Route path="/battery" component={BatteryDashboard}/>
      <Route path="/battery/manage" component={BatteryManage}/>
      <Route path="/battery/pos" component={BatteryPOS}/>
      <Route path="/battery/pos/print" component={BatteryReceiptPrint}/>
      <Route path="/battery/reports" component={BatterySalesReport}/>
      <Route path="/portals" component={Portals}/>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <PWAInstallPrompt />
            <WhatsAppButton />
          </TooltipProvider>
        </CartProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
