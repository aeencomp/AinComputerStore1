import { lazy } from "react";

/** Admin, portals, and heavy tools — not needed for storefront first paint. */
export const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
export const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
export const AdminProducts = lazy(() => import("@/pages/AdminProducts"));
export const AdminPrograms = lazy(() => import("@/pages/AdminPrograms"));
export const AdminCustomers = lazy(() => import("@/pages/AdminCustomers"));
export const AdminAttendance = lazy(() => import("@/pages/AdminAttendance"));
export const AdminSettings = lazy(() => import("@/pages/AdminSettings"));
export const AdminMarketPrices = lazy(() => import("@/pages/AdminMarketPrices"));
export const AdminExternalPrices = lazy(() => import("@/pages/AdminExternalPrices"));
export const AdminInventory = lazy(() => import("@/pages/AdminInventory"));
export const AdminPOS = lazy(() => import("@/pages/AdminPOS"));
export const AdminSales = lazy(() => import("@/pages/AdminSales"));
export const AdminReviews = lazy(() => import("@/pages/AdminReviews"));
export const AdminDiscountCodes = lazy(() => import("@/pages/AdminDiscountCodes"));
export const AdminAnalytics = lazy(() => import("@/pages/AdminAnalytics"));
export const PlatformAdmin = lazy(() => import("@/pages/admin/PlatformAdmin"));
export const AdminWhatsApp = lazy(() => import("@/pages/AdminWhatsApp"));
export const AdminSocialPosts = lazy(() => import("@/pages/AdminSocialPosts"));
export const RecycleBin = lazy(() => import("@/pages/RecycleBin"));
export const AdminUsers = lazy(() => import("@/pages/AdminUsers"));

export const SalesLogin = lazy(() => import("@/pages/SalesLogin"));
export const SalesPortal = lazy(() => import("@/pages/SalesPortal"));

export const TechnicianLogin = lazy(() => import("@/pages/technician/TechnicianLogin"));
export const TechnicianDashboard = lazy(() => import("@/pages/technician/TechnicianDashboard"));
export const TechnicianManagement = lazy(() => import("@/pages/technician/TechnicianManagement"));
export const TechnicianDailyReport = lazy(() => import("@/pages/technician/TechnicianDailyReport"));
export const TechnicianWithdrawals = lazy(() => import("@/pages/technician/TechnicianWithdrawals"));
export const TicketDetail = lazy(() => import("@/pages/technician/TicketDetail"));
export const NewRepairRequest = lazy(() => import("@/pages/technician/NewRepairRequest"));
export const CustomerProfile = lazy(() => import("@/pages/technician/CustomerProfile"));

export const PCBuilder = lazy(() => import("@/pages/PCBuilder"));
export const MarketAnalysis = lazy(() => import("@/pages/MarketAnalysis"));
export const CustomerDashboard = lazy(() => import("@/pages/CustomerDashboard"));

export const BatteryRedirectInventory = lazy(() =>
  import("@/pages/BatterySystemRedirect").then((m) => ({ default: m.BatteryRedirectInventory })),
);
export const BatteryRedirectPos = lazy(() =>
  import("@/pages/BatterySystemRedirect").then((m) => ({ default: m.BatteryRedirectPos })),
);
export const BatteryRedirectSalesLogin = lazy(() =>
  import("@/pages/BatterySystemRedirect").then((m) => ({ default: m.BatteryRedirectSalesLogin })),
);

export const ShopLogin = lazy(() => import("@/pages/shop/ShopLogin"));
export const ShopDashboard = lazy(() => import("@/pages/shop/ShopDashboard"));
export const ShopNewRepair = lazy(() => import("@/pages/shop/ShopNewRepair"));
export const ShopCustomerProfile = lazy(() => import("@/pages/shop/ShopCustomerProfile"));
