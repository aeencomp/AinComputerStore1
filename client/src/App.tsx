import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/contexts/CartContext";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ProductDetail from "@/pages/ProductDetail";
import Checkout from "@/pages/Checkout";
import OrderConfirmation from "@/pages/OrderConfirmation";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminProducts from "@/pages/AdminProducts";
import AdminSettings from "@/pages/AdminSettings";
import TechnicianLogin from "@/pages/technician/TechnicianLogin";
import TechnicianDashboard from "@/pages/technician/TechnicianDashboard";
import TicketDetail from "@/pages/technician/TicketDetail";
import RepairRequest from "@/pages/RepairRequest";
import TrackRepair from "@/pages/TrackRepair";
import TrackOrder from "@/pages/TrackOrder";
import PCBuilder from "@/pages/PCBuilder";
import CustomerDashboard from "@/pages/CustomerDashboard";
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
      <Route path="/admin/settings" component={AdminSettings}/>
      <Route path="/technician/login" component={TechnicianLogin}/>
      <Route path="/technician/dashboard" component={TechnicianDashboard}/>
      <Route path="/technician/tickets/:id" component={TicketDetail}/>
      <Route path="/repair-request" component={RepairRequest}/>
      <Route path="/track-repair" component={TrackRepair}/>
      <Route path="/track-order" component={TrackOrder}/>
      <Route path="/pc-builder" component={PCBuilder}/>
      <Route path="/my-orders" component={CustomerDashboard}/>
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
          </TooltipProvider>
        </CartProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
