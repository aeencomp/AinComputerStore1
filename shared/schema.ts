import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, jsonb, serial, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("admin"), // admin, manager, editor
  // Permissions (1 = allowed, 0 = not allowed)
  canOrders: integer("can_orders").notNull().default(1), // View/manage orders
  canProducts: integer("can_products").notNull().default(1), // Manage products
  canCategories: integer("can_categories").notNull().default(1), // Manage categories
  canSettings: integer("can_settings").notNull().default(0), // Access settings (admin only)
  canUsers: integer("can_users").notNull().default(0), // Manage admin users (admin only)
  canReports: integer("can_reports").notNull().default(0), // View sales reports
  canPOS: integer("can_pos").notNull().default(1), // Access POS system
  canInventory: integer("can_inventory").notNull().default(0), // Manage inventory
  canCustomers: integer("can_customers").notNull().default(0), // View customer data
  canDiscounts: integer("can_discounts").notNull().default(0), // Manage discount codes
  isActive: integer("is_active").notNull().default(1), // Account status
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
});

export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

// Sales users with role-based permissions
export const salesUsers = pgTable("sales_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("sales"), // sales, sales_admin
  // Permissions
  canPos: integer("can_pos").notNull().default(1), // Access to POS
  canInventory: integer("can_inventory").notNull().default(0), // Access to Inventory
  canInventoryLocation2: integer("can_inventory_location2").notNull().default(0), // Access to Location 2 Inventory
  canManageUsers: integer("can_manage_users").notNull().default(0), // Can create/edit users
  canViewReports: integer("can_view_reports").notNull().default(0), // Access to sales reports
  canViewWithdrawals: integer("can_view_withdrawals").notNull().default(0), // Access to daily cash withdrawals
  canTransferToLoc1: integer("can_transfer_to_loc1").notNull().default(0), // Transfer stock from Location 2 → Location 1
  canApplyDiscount: integer("can_apply_discount").notNull().default(0), // Can apply discounts
  canEditReceipt: integer("can_edit_receipt").notNull().default(0), // Can edit receipts after sale
  isActive: integer("is_active").notNull().default(1), // Account status
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by"), // Who created this user
});

export const insertSalesUserSchema = createInsertSchema(salesUsers).omit({
  id: true,
  createdAt: true,
});

export type InsertSalesUser = z.infer<typeof insertSalesUserSchema>;
export type SalesUser = typeof salesUsers.$inferSelect;

export const salesLocations = pgTable("sales_locations", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SalesLocation = typeof salesLocations.$inferSelect;

export const salesUserLocations = pgTable(
  "sales_user_locations",
  {
    salesUserId: varchar("sales_user_id").notNull(),
    salesLocationId: integer("sales_location_id").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.salesUserId, t.salesLocationId] }),
  }),
);

export const stockTransfers = pgTable("stock_transfers", {
  id: serial("id").primaryKey(),
  fromLocationId: integer("from_location_id").notNull(),
  toLocationId: integer("to_location_id").notNull(),
  productSource: text("product_source").notNull(),
  productId: text("product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  serialNumber: text("serial_number"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StockTransfer = typeof stockTransfers.$inferSelect;

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  descriptionAr: text("description_ar").notNull(),
  descriptionEn: text("description_en").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  oldPrice: decimal("old_price", { precision: 10, scale: 2 }),
  category: text("category").notNull(),
  image: text("image").notNull(),
  images: text("images").array().default([]),
  specs: text("specs").array(),
  badge: text("badge"),
  inStock: integer("in_stock").notNull().default(1),
  componentType: text("component_type"),
  compatibility: jsonb("compatibility"),
  // Inventory management fields
  sku: text("sku"), // Product SKU/barcode for POS integration
  stockQuantity: integer("stock_quantity").notNull().default(0), // Actual inventory count
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5), // Alert when stock falls below this
});

export type ComponentType = 'cpu' | 'motherboard' | 'ram' | 'gpu' | 'storage' | 'psu' | 'case' | 'cooler' | 'monitor' | 'mouse' | 'keyboard';

export interface CPUCompatibility {
  socket: string;
  tdpW: number;
}

export interface MotherboardCompatibility {
  socket: string;
  chipset: string;
  formFactor: string;
  ramType: string;
  ramSlots: number;
  maxRamGB: number;
  m2Slots: number;
  sataPorts: number;
}

export interface RAMCompatibility {
  type: string;
  speedMHz: number;
  modules: number;
  capacityGB: number;
}

export interface GPUCompatibility {
  pcie: string;
  lengthMm: number;
  slotWidth: number;
  tdpW: number;
  powerConnectors8Pin: number;
}

export interface StorageCompatibility {
  kind: 'nvme' | 'sata' | 'hdd';
  interface: string;
  capacityGB: number;
}

export interface PSUCompatibility {
  wattageW: number;
  efficiency: string;
  formFactor: string;
  pcie8pinCount: number;
}

export interface CaseCompatibility {
  supportedMB: string[];
  maxGpuLengthMm: number;
  maxCpuCoolerHeightMm: number;
  radiatorSizes: number[];
  psuFormFactors: string[];
}

export interface CoolerCompatibility {
  type: 'air' | 'aio';
  socketSupport: string[];
  heightMm?: number;
  radiatorSize?: number;
}

export interface MonitorCompatibility {
  sizeInches: number;
  resolution: string;
  refreshRateHz: number;
}

export interface MouseCompatibility {
  dpi: number;
  wireless: boolean;
}

export interface KeyboardCompatibility {
  layout: string;
  mechanical: boolean;
}

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  productId: varchar("product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  sessionId: true,
});

export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type CartItemRecord = typeof cartItems.$inferSelect;

export interface CartItem {
  product: Product;
  quantity: number;
}

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id"),
  userId: varchar("user_id"),
  orderNumber: text("order_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerAddress: text("customer_address").notNull(),
  customerCity: text("customer_city").notNull(),
  customerPostal: text("customer_postal").notNull(),
  paymentMethod: text("payment_method").notNull().default("cash_on_delivery"),
  paymentStatus: text("payment_status").default("pending"),
  cashPaidAmount: decimal("cash_paid_amount", { precision: 10, scale: 2 }),
  cardPaidAmount: decimal("card_paid_amount", { precision: 10, scale: 2 }),
  zaincashTransactionId: text("zaincash_transaction_id"),
  qicardTransactionId: text("qicard_transaction_id"),
  items: text("items").array().notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  shipping: decimal("shipping", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  orderType: text("order_type").notNull().default("online"), // "online" or "walk-in"
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  discountCode: text("discount_code"),
  discountReason: text("discount_reason"),
  salespersonId: varchar("salesperson_id"), // Admin who created walk-in order
  salesLocationId: integer("sales_location_id").notNull().default(1),
  notes: text("notes"), // Internal notes for the order
  voidedAt: timestamp("voided_at"),
  voidedBy: varchar("voided_by"),
  voidReason: text("void_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  orderNumber: true,
  createdAt: true,
  sessionId: true,
  userId: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export const storeSettings = pgTable("store_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeNameAr: text("store_name_ar").notNull().default("العين لتجارة الحاسبات"),
  storeNameEn: text("store_name_en").notNull().default("Al-Ain Computer Trading"),
  descriptionAr: text("description_ar").notNull().default("متجرك الموثوق لأحدث الحواسيب والملحقات بأفضل الأسعار وأعلى جودة."),
  descriptionEn: text("description_en").notNull().default("Your trusted store for the latest computers and accessories at the best prices and highest quality."),
  email: text("email").notNull().default("info@alain-computers.com"),
  phone: text("phone").notNull().default("920001234"),
  phoneAr: text("phone_ar").notNull().default("٩٢٠٠٠١٢٣٤"),
  addressAr: text("address_ar").notNull().default("بغداد، العراق"),
  addressEn: text("address_en").notNull().default("Baghdad, Iraq"),
  hoursAr: text("hours_ar").notNull().default("السبت - الخميس ٩ص - ٩م"),
  hoursEn: text("hours_en").notNull().default("Saturday - Thursday 9am - 9pm"),
  facebookUrl: text("facebook_url").default(""),
  twitterUrl: text("twitter_url").default(""),
  instagramUrl: text("instagram_url").default(""),
  whatsappNumber: text("whatsapp_number").default(""),
  whatsappPhoneNumberId: text("whatsapp_phone_number_id").default(""),
  whatsappAccessToken: text("whatsapp_access_token").default(""),
  whatsappWabaId: text("whatsapp_waba_id").default(""),
  /** Owner/manager number for automated daily revenue WhatsApp summaries */
  dailyRevenueWhatsappNumber: text("daily_revenue_whatsapp_number").default(""),

  /** Public storefront URL for product links in social posts */
  publicSiteUrl: text("public_site_url").default("https://aeen-iq.com"),
  /** Facebook Page API — auto-posting */
  facebookPageId: text("facebook_page_id").default(""),
  facebookPageAccessToken: text("facebook_page_access_token").default(""),
  facebookAutoPostEnabled: integer("facebook_auto_post_enabled").notNull().default(0),
  /** Baghdad local time HH:MM — used as guidance for external cron */
  facebookAutoPostTime: text("facebook_auto_post_time").default("18:00"),
  /** product | sale | repair | announcement | rotate */
  facebookAutoPostMode: text("facebook_auto_post_mode").default("rotate"),
  facebookAutoPostsPerDay: integer("facebook_auto_posts_per_day").notNull().default(1),
  facebookAutoPostLastAt: timestamp("facebook_auto_post_last_at"),
  facebookAutoPostCursor: integer("facebook_auto_post_cursor").notNull().default(0),
  /** Meta (Facebook) Pixel ID for ad conversion tracking — e.g. 123456789012345 */
  metaPixelId: text("meta_pixel_id").default(""),

  // Theme & Branding
  logoUrl: text("logo_url").default(""),
  faviconUrl: text("favicon_url").default(""),
  primaryColor: text("primary_color").default("#3B82F6"),
  accentColor: text("accent_color").default("#10B981"),
  
  // SEO Settings
  metaTitleAr: text("meta_title_ar").default("العين لتجارة الحاسبات - أفضل متجر للكمبيوتر في العراق"),
  metaTitleEn: text("meta_title_en").default("Al-Ain Computer Trading - Best Computer Store in Iraq"),
  metaDescriptionAr: text("meta_description_ar").default("تسوق أحدث أجهزة الكمبيوتر والملحقات بأفضل الأسعار مع توصيل سريع في جميع أنحاء العراق"),
  metaDescriptionEn: text("meta_description_en").default("Shop the latest computers and accessories at the best prices with fast delivery across Iraq"),
  metaKeywordsAr: text("meta_keywords_ar").default("كمبيوتر، لابتوب، بغداد، العراق، ألعاب، قطع كمبيوتر"),
  metaKeywordsEn: text("meta_keywords_en").default("computer, laptop, Baghdad, Iraq, gaming, computer parts"),
  
  // Announcement Bar Settings
  announcementTextAr: text("announcement_text_ar").default(""),
  announcementTextEn: text("announcement_text_en").default(""),
  announcementEnabled: integer("announcement_enabled").notNull().default(0),
  announcementBgColor: text("announcement_bg_color").default("#3B82F6"),
  announcementDismissCount: integer("announcement_dismiss_count").notNull().default(0),
  announcementScrollDirection: text("announcement_scroll_direction").default("rtl"),
  
  // Homepage Settings
  heroTitleAr: text("hero_title_ar").default("مرحباً بك في متجرنا"),
  heroTitleEn: text("hero_title_en").default("Welcome to Our Store"),
  heroSubtitleAr: text("hero_subtitle_ar").default("أفضل أجهزة الكمبيوتر والملحقات بأسعار منافسة"),
  heroSubtitleEn: text("hero_subtitle_en").default("Best computers and accessories at competitive prices"),
  heroImageUrl: text("hero_image_url").default(""),
  showHeroBanner: integer("show_hero_banner").notNull().default(1),
  showFeaturedProducts: integer("show_featured_products").notNull().default(1),
  showCategories: integer("show_categories").notNull().default(1),
  featuredProductsCount: integer("featured_products_count").notNull().default(8),
  
  // Footer Settings
  copyrightTextAr: text("copyright_text_ar").default("جميع الحقوق محفوظة"),
  copyrightTextEn: text("copyright_text_en").default("All Rights Reserved"),
  aboutTextAr: text("about_text_ar").default("متجر العين لتجارة الحاسبات يقدم أفضل الأجهزة والملحقات بأسعار منافسة"),
  aboutTextEn: text("about_text_en").default("Al-Ain Computer Trading offers the best devices and accessories at competitive prices"),
  footerLinks: jsonb("footer_links"),
  
  // Shipping Settings
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).default("5000"),
  freeShippingThreshold: decimal("free_shipping_threshold", { precision: 10, scale: 2 }).default("100000"),
  enableFreeShipping: integer("enable_free_shipping").notNull().default(1),
  
  // Payment Settings
  enableCashOnDelivery: integer("enable_cash_on_delivery").notNull().default(1),
  enableElectronicPayment: integer("enable_electronic_payment").notNull().default(0),
  
  // Currency Settings
  currencySymbolAr: text("currency_symbol_ar").default("د.ع"),
  currencySymbolEn: text("currency_symbol_en").default("IQD"),
  
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStoreSettingsSchema = createInsertSchema(storeSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertStoreSettings = z.infer<typeof insertStoreSettingsSchema>;
export type StoreSettings = typeof storeSettings.$inferSelect;

export const facebookPostLog = pgTable("facebook_post_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postType: text("post_type").notNull(),
  productId: varchar("product_id"),
  message: text("message").notNull(),
  imageUrl: text("image_url"),
  linkUrl: text("link_url"),
  facebookPostId: text("facebook_post_id"),
  source: text("source").notNull().default("manual"),
  success: integer("success").notNull().default(1),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FacebookPostLog = typeof facebookPostLog.$inferSelect;

// Footer Links Types
export interface FooterLink {
  id: string;
  labelAr: string;
  labelEn: string;
  url: string;
  isExternal?: boolean;
}

export interface FooterLinkGroup {
  id: string;
  titleAr: string;
  titleEn: string;
  links: FooterLink[];
}

// Repair Customers — unique customer profiles linked across all repair tickets
export const repairCustomers = pgTable("repair_customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: text("customer_id").notNull().unique(), // e.g. "C-001"
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRepairCustomerSchema = createInsertSchema(repairCustomers).omit({
  id: true,
  createdAt: true,
});

export type InsertRepairCustomer = z.infer<typeof insertRepairCustomerSchema>;
export type RepairCustomer = typeof repairCustomers.$inferSelect;

export const repairTickets = pgTable("repair_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: text("ticket_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  repairCustomerId: varchar("repair_customer_id"), // links to repair_customers.id
  deviceType: text("device_type").notNull(), // laptop, desktop, monitor, etc.
  deviceBrand: text("device_brand").notNull(),
  deviceModel: text("device_model").notNull(),
  issueDescriptionAr: text("issue_description_ar").notNull(),
  issueDescriptionEn: text("issue_description_en"),
  status: text("status").notNull().default("pending"), // pending, in-progress, waiting-parts, completed, delivered
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  technicianNotes: text("technician_notes").default(""),
  estimatedCompletion: timestamp("estimated_completion"),
  costEstimate: decimal("cost_estimate", { precision: 10, scale: 2 }),
  finalCost: decimal("final_cost", { precision: 10, scale: 2 }),
  paymentStatus: text("payment_status").default("unpaid"), // unpaid, paid, deferred
  paymentMethod: text("payment_method").default("cash"), // cash, card, split
  cashPaidAmount: decimal("cash_paid_amount", { precision: 10, scale: 2 }),
  cardPaidAmount: decimal("card_paid_amount", { precision: 10, scale: 2 }),
  userId: varchar("user_id"), // optional - if customer has account
  isArchived: integer("is_archived").notNull().default(0),
  completedAt: timestamp("completed_at"),
  deliveredAt: timestamp("delivered_at"),
  /** When payment was first marked paid — stable sales date (not updatedAt). */
  paidAt: timestamp("paid_at"),
  /** When customer brought device in (intake time). */
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  /** Last time we reminded technicians about pending ticket (for 2-day cadence). */
  pendingReminderLastAt: timestamp("pending_reminder_last_at"),
  /** Last time we reminded about completed-not-picked (for 30-day cadence). */
  completedPickupReminderLastAt: timestamp("completed_pickup_reminder_last_at"),
  /** 1 = hidden from sales/shift reports only; technician dashboard unchanged. */
  excludedFromSalesReport: integer("excluded_from_sales_report").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRepairTicketSchema = createInsertSchema(repairTickets).omit({
  id: true,
  ticketNumber: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRepairTicket = z.infer<typeof insertRepairTicketSchema>;
export type RepairTicket = typeof repairTickets.$inferSelect;

export const repairTicketStatusHistory = pgTable("repair_ticket_status_history", {
  id: serial("id").primaryKey(),
  ticketId: varchar("ticket_id").notNull(), // repair_tickets.id
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

export const insertRepairTicketStatusHistorySchema = createInsertSchema(repairTicketStatusHistory).omit({
  id: true,
  changedAt: true,
});

export type InsertRepairTicketStatusHistory = z.infer<typeof insertRepairTicketStatusHistorySchema>;
export type RepairTicketStatusHistory = typeof repairTicketStatusHistory.$inferSelect;

// Technician Users for repair management
export const technicians = pgTable("technicians", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  isAdmin: integer("is_admin").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  permissions: jsonb("permissions").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTechnicianSchema = createInsertSchema(technicians).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTechnician = z.infer<typeof insertTechnicianSchema>;
export type Technician = typeof technicians.$inferSelect;

// Technician permissions enum
export const TECHNICIAN_PERMISSIONS = {
  VIEW_TICKETS: 'view_tickets',
  UPDATE_STATUS: 'update_status',
  ADD_NOTES: 'add_notes',
  SET_COSTS: 'set_costs',
  DELETE_TICKETS: 'delete_tickets',
  MANAGE_TECHNICIANS: 'manage_technicians',
  VIEW_REVENUE: 'view_revenue',
  VIEW_DAILY_REPORT: 'view_daily_report',
  VIEW_WITHDRAWALS: 'view_withdrawals',
} as const;

export type TechnicianPermission = typeof TECHNICIAN_PERMISSIONS[keyof typeof TECHNICIAN_PERMISSIONS];

// Market Analysis for RAM, SSD, M.2 prices
export const marketPrices = pgTable("market_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  componentType: text("component_type").notNull(), // ram, ssd, m2
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  brand: text("brand").notNull(),
  capacity: text("capacity").notNull(), // e.g., "8GB", "256GB", "1TB"
  specs: text("specs"), // e.g., "DDR4 3200MHz", "NVMe Gen4"
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }).notNull(),
  previousPrice: decimal("previous_price", { precision: 10, scale: 2 }),
  priceDate: timestamp("price_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMarketPriceSchema = createInsertSchema(marketPrices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMarketPrice = z.infer<typeof insertMarketPriceSchema>;
export type MarketPrice = typeof marketPrices.$inferSelect;

// External price sources for international price comparison
export const externalPriceSources = pgTable("external_price_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marketPriceId: varchar("market_price_id").references(() => marketPrices.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // "newegg", "amazon"
  sourceProductUrl: text("source_product_url"),
  sourceProductName: text("source_product_name"),
  priceUSD: decimal("price_usd", { precision: 10, scale: 2 }),
  priceIQD: decimal("price_iqd", { precision: 12, scale: 2 }), // Converted to IQD for comparison
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  isActive: integer("is_active").notNull().default(1),
});

export const insertExternalPriceSourceSchema = createInsertSchema(externalPriceSources).omit({
  id: true,
  lastUpdated: true,
});

export type InsertExternalPriceSource = z.infer<typeof insertExternalPriceSourceSchema>;
export type ExternalPriceSource = typeof externalPriceSources.$inferSelect;

// Exchange rate for USD to IQD conversion
export const exchangeRates = pgTable("exchange_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromCurrency: text("from_currency").notNull().default("USD"),
  toCurrency: text("to_currency").notNull().default("IQD"),
  rate: decimal("rate", { precision: 12, scale: 4 }).notNull(), // e.g., 1310.5 for 1 USD = 1310.5 IQD
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({
  id: true,
  lastUpdated: true,
});

export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
export type ExchangeRate = typeof exchangeRates.$inferSelect;

// Inventory movements for tracking stock changes
export const inventoryMovements = pgTable("inventory_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  movementType: text("movement_type").notNull(), // "adjustment", "sale", "purchase", "return", "import"
  quantityChange: integer("quantity_change").notNull(), // Positive for adding, negative for removing
  previousQuantity: integer("previous_quantity").notNull(),
  newQuantity: integer("new_quantity").notNull(),
  reason: text("reason"), // Optional reason for the movement
  referenceId: text("reference_id"), // Order ID, import batch ID, etc.
  createdBy: varchar("created_by"), // Admin user ID who made the change
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements).omit({
  id: true,
  createdAt: true,
});

export type InsertInventoryMovement = z.infer<typeof insertInventoryMovementSchema>;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;

// Held orders for POS hold/recall functionality
export const heldOrders = pgTable("held_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  holdNumber: text("hold_number").notNull(),
  salesUserId: varchar("sales_user_id").notNull(),
  salesUserName: text("sales_user_name").notNull(),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  items: jsonb("items").notNull(), // Cart items JSON
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHeldOrderSchema = createInsertSchema(heldOrders).omit({
  id: true,
  createdAt: true,
});

export type InsertHeldOrder = z.infer<typeof insertHeldOrderSchema>;
export type HeldOrder = typeof heldOrders.$inferSelect;

// Sales shift management
export const salesShifts = pgTable("sales_shifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  salesUserId: varchar("sales_user_id").notNull(),
  salesUserName: text("sales_user_name").notNull(),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  openingCash: decimal("opening_cash", { precision: 10, scale: 2 }).notNull().default("0"),
  closingCash: decimal("closing_cash", { precision: 10, scale: 2 }),
  expectedCash: decimal("expected_cash", { precision: 10, scale: 2 }),
  cashDifference: decimal("cash_difference", { precision: 10, scale: 2 }),
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }).default("0"),
  totalTransactions: integer("total_transactions").default(0),
  notes: text("notes"),
  status: text("status").notNull().default("active"), // "active", "paused", "closed"
  salesLocationId: integer("sales_location_id").notNull().default(1),
  /** When a closed shift was reopened for backfill sales. */
  reopenedAt: timestamp("reopened_at"),
  /** Original end_time preserved when shift is reopened. */
  originalEndTime: timestamp("original_end_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSalesShiftSchema = createInsertSchema(salesShifts).omit({
  id: true,
  createdAt: true,
});

export type InsertSalesShift = z.infer<typeof insertSalesShiftSchema>;
export type SalesShift = typeof salesShifts.$inferSelect;

// Battery system users with separate authentication
export const batteryUsers = pgTable("battery_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("staff"), // staff, admin
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBatteryUserSchema = createInsertSchema(batteryUsers).omit({
  id: true,
  createdAt: true,
});

export type InsertBatteryUser = z.infer<typeof insertBatteryUserSchema>;
export type BatteryUser = typeof batteryUsers.$inferSelect;

// Laptop batteries inventory with compatibility tracking
export const laptopBatteries = pgTable("laptop_batteries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serialNumber: text("serial_number").notNull().unique(), // Battery serial/part number
  partNumber: text("part_number"), // Alternative part numbers
  barcode: text("barcode"), // Barcode for scanning (auto-generated if not provided)
  brand: text("brand").notNull(), // Battery brand (OEM, Replacement, etc.)
  compatibleLaptops: text("compatible_laptops").array().notNull(), // Array of compatible laptop models
  voltage: decimal("voltage", { precision: 4, scale: 2 }), // Voltage (e.g., 11.1V)
  capacity: integer("capacity"), // Capacity in mAh
  cells: integer("cells"), // Number of cells (3, 4, 6, 9)
  stockQuantity: integer("stock_quantity").notNull().default(0),
  minStockLevel: integer("min_stock_level").notNull().default(2), // Alert threshold
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),
  wholesalePrice: decimal("wholesale_price", { precision: 10, scale: 2 }),
  supplier: text("supplier"),
  location: text("location"), // Storage location in warehouse
  notes: text("notes"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLaptopBatterySchema = createInsertSchema(laptopBatteries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLaptopBattery = z.infer<typeof insertLaptopBatterySchema>;
export type LaptopBattery = typeof laptopBatteries.$inferSelect;

// Product reviews for social proof
export const productReviews = pgTable("product_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull(),
  customerName: text("customer_name").notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  isApproved: integer("is_approved").notNull().default(0), // Admin approval
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductReviewSchema = createInsertSchema(productReviews).omit({
  id: true,
  createdAt: true,
  isApproved: true,
});

export type InsertProductReview = z.infer<typeof insertProductReviewSchema>;
export type ProductReview = typeof productReviews.$inferSelect;

// Discount codes for promotions
export const discountCodes = pgTable("discount_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull().default("percentage"), // percentage or fixed
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDiscountCodeSchema = createInsertSchema(discountCodes).omit({
  id: true,
  createdAt: true,
  usedCount: true,
});

export type InsertDiscountCode = z.infer<typeof insertDiscountCodeSchema>;
export type DiscountCode = typeof discountCodes.$inferSelect;

// Battery POS Sales
export const batterySales = pgTable("battery_sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleNumber: text("sale_number").notNull().unique(), // e.g., BSALE-20241224-001
  batteryUserId: varchar("battery_user_id").notNull(), // Staff who made the sale
  customerName: text("customer_name"), // Optional for walk-in
  customerPhone: text("customer_phone"), // Optional
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"), // cash, zaincash, qicard, deferred
  paymentStatus: text("payment_status").notNull().default("paid"), // paid, deferred
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBatterySaleSchema = createInsertSchema(batterySales).omit({
  id: true,
  createdAt: true,
});

export type InsertBatterySale = z.infer<typeof insertBatterySaleSchema>;
export type BatterySale = typeof batterySales.$inferSelect;

// Battery Sale Items
export const batterySaleItems = pgTable("battery_sale_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id").notNull(),
  batteryId: varchar("battery_id").notNull(),
  serialNumber: text("serial_number").notNull(), // Snapshot of battery serial
  brand: text("brand").notNull(), // Snapshot of brand
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

export const insertBatterySaleItemSchema = createInsertSchema(batterySaleItems).omit({
  id: true,
  saleId: true,
});

export type InsertBatterySaleItem = z.infer<typeof insertBatterySaleItemSchema>;
export type BatterySaleItem = typeof batterySaleItems.$inferSelect;

// AC Adapters inventory with compatibility tracking
export const acAdapters = pgTable("ac_adapters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serialNumber: text("serial_number").notNull().unique(), // Adapter serial/part number
  partNumber: text("part_number"), // Alternative part numbers
  barcode: text("barcode"), // Barcode for scanning
  brand: text("brand").notNull(), // Brand (Dell, HP, Lenovo, Universal, etc.)
  compatibleLaptops: text("compatible_laptops").array().notNull(), // Array of compatible laptop models
  inputVoltage: text("input_voltage"), // e.g., "100-240V AC"
  outputVoltage: decimal("output_voltage", { precision: 5, scale: 2 }), // e.g., 19.5V
  amperage: decimal("amperage", { precision: 5, scale: 2 }), // e.g., 3.34A
  wattage: integer("wattage"), // e.g., 65W, 90W, 130W
  connectorType: text("connector_type"), // e.g., "7.4mm x 5.0mm", "USB-C", "4.5mm x 3.0mm"
  tipSize: text("tip_size"), // Tip dimensions
  plugType: text("plug_type"), // e.g., "2-prong", "3-prong", "EU", "UK"
  stockQuantity: integer("stock_quantity").notNull().default(0),
  minStockLevel: integer("min_stock_level").notNull().default(2), // Alert threshold
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),
  wholesalePrice: decimal("wholesale_price", { precision: 10, scale: 2 }),
  supplier: text("supplier"),
  location: text("location"), // Storage location in warehouse
  notes: text("notes"),
  isActive: integer("is_active").notNull().default(1),
  salesLocationId: integer("sales_location_id").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAcAdapterSchema = createInsertSchema(acAdapters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAcAdapter = z.infer<typeof insertAcAdapterSchema>;
export type AcAdapter = typeof acAdapters.$inferSelect;

// AC Adapter Sale Items (to track adapter sales separately)
export const adapterSaleItems = pgTable("adapter_sale_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id").notNull(), // References batterySales (unified sales table)
  adapterId: varchar("adapter_id").notNull(),
  serialNumber: text("serial_number").notNull(), // Snapshot of adapter serial
  brand: text("brand").notNull(), // Snapshot of brand
  wattage: integer("wattage"), // Snapshot of wattage
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

export const insertAdapterSaleItemSchema = createInsertSchema(adapterSaleItems).omit({
  id: true,
  saleId: true,
});

export type InsertAdapterSaleItem = z.infer<typeof insertAdapterSaleItemSchema>;
export type AdapterSaleItem = typeof adapterSaleItems.$inferSelect;

// Laptops inventory (battery system expansion)
export const laptops = pgTable("laptops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serialNumber: text("serial_number").notNull().unique(),
  partNumber: text("part_number"),
  barcode: text("barcode"),
  brand: text("brand").notNull(),
  model: text("model"),
  sizeInch: decimal("size_inch", { precision: 4, scale: 1 }),
  cpu: text("cpu"),
  ram: text("ram"),
  storage: text("storage"),
  gpu: text("gpu"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  minStockLevel: integer("min_stock_level").notNull().default(2),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),
  wholesalePrice: decimal("wholesale_price", { precision: 10, scale: 2 }),
  supplier: text("supplier"),
  location: text("location"),
  notes: text("notes"),
  isActive: integer("is_active").notNull().default(1),
  salesLocationId: integer("sales_location_id").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLaptopSchema = createInsertSchema(laptops).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLaptop = z.infer<typeof insertLaptopSchema>;
export type Laptop = typeof laptops.$inferSelect;

// Desktops inventory (battery system expansion)
export const desktops = pgTable("desktops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serialNumber: text("serial_number").notNull().unique(),
  partNumber: text("part_number"),
  barcode: text("barcode"),
  brand: text("brand").notNull(),
  model: text("model"),
  cpu: text("cpu"),
  ram: text("ram"),
  storage: text("storage"),
  gpu: text("gpu"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  minStockLevel: integer("min_stock_level").notNull().default(2),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),
  wholesalePrice: decimal("wholesale_price", { precision: 10, scale: 2 }),
  supplier: text("supplier"),
  location: text("location"),
  notes: text("notes"),
  isActive: integer("is_active").notNull().default(1),
  salesLocationId: integer("sales_location_id").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDesktopSchema = createInsertSchema(desktops).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDesktop = z.infer<typeof insertDesktopSchema>;
export type Desktop = typeof desktops.$inferSelect;

// Keyboards inventory (battery system expansion)
export const keyboards = pgTable("keyboards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serialNumber: text("serial_number").notNull().unique(),
  partNumber: text("part_number"),
  barcode: text("barcode"),
  brand: text("brand").notNull(),
  layout: text("layout"), // US, UK, AR, etc.
  keyboardType: text("keyboard_type"), // built-in, external, mechanical, membrane
  backlight: integer("backlight").notNull().default(0), // 0/1
  stockQuantity: integer("stock_quantity").notNull().default(0),
  minStockLevel: integer("min_stock_level").notNull().default(2),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),
  wholesalePrice: decimal("wholesale_price", { precision: 10, scale: 2 }),
  supplier: text("supplier"),
  location: text("location"),
  notes: text("notes"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertKeyboardSchema = createInsertSchema(keyboards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKeyboard = z.infer<typeof insertKeyboardSchema>;
export type Keyboard = typeof keyboards.$inferSelect;

// LCD inventory (battery system expansion)
export const lcds = pgTable("lcds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serialNumber: text("serial_number").notNull().unique(),
  partNumber: text("part_number"),
  barcode: text("barcode"),
  brand: text("brand").notNull(),
  sizeInch: decimal("size_inch", { precision: 4, scale: 1 }),
  brightnessNits: integer("brightness_nits"),
  refreshRateHz: integer("refresh_rate_hz"),
  resolution: text("resolution"), // e.g. 1920x1080
  connectorType: text("connector_type"), // eDP 30-pin, eDP 40-pin, etc.
  panelType: text("panel_type"), // IPS, TN, OLED
  stockQuantity: integer("stock_quantity").notNull().default(0),
  minStockLevel: integer("min_stock_level").notNull().default(2),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),
  wholesalePrice: decimal("wholesale_price", { precision: 10, scale: 2 }),
  supplier: text("supplier"),
  location: text("location"),
  notes: text("notes"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLcdSchema = createInsertSchema(lcds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLcd = z.infer<typeof insertLcdSchema>;
export type Lcd = typeof lcds.$inferSelect;

// Laptop sale items
export const laptopSaleItems = pgTable("laptop_sale_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id").notNull(),
  laptopId: varchar("laptop_id").notNull(),
  serialNumber: text("serial_number").notNull(),
  brand: text("brand").notNull(),
  model: text("model"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

export const insertLaptopSaleItemSchema = createInsertSchema(laptopSaleItems).omit({
  id: true,
  saleId: true,
});

export type InsertLaptopSaleItem = z.infer<typeof insertLaptopSaleItemSchema>;
export type LaptopSaleItem = typeof laptopSaleItems.$inferSelect;

// Desktop sale items
export const desktopSaleItems = pgTable("desktop_sale_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id").notNull(),
  desktopId: varchar("desktop_id").notNull(),
  serialNumber: text("serial_number").notNull(),
  brand: text("brand").notNull(),
  model: text("model"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

export const insertDesktopSaleItemSchema = createInsertSchema(desktopSaleItems).omit({
  id: true,
  saleId: true,
});

export type InsertDesktopSaleItem = z.infer<typeof insertDesktopSaleItemSchema>;
export type DesktopSaleItem = typeof desktopSaleItems.$inferSelect;

// Keyboard sale items
export const keyboardSaleItems = pgTable("keyboard_sale_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id").notNull(),
  keyboardId: varchar("keyboard_id").notNull(),
  serialNumber: text("serial_number").notNull(),
  brand: text("brand").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

export const insertKeyboardSaleItemSchema = createInsertSchema(keyboardSaleItems).omit({
  id: true,
  saleId: true,
});

export type InsertKeyboardSaleItem = z.infer<typeof insertKeyboardSaleItemSchema>;
export type KeyboardSaleItem = typeof keyboardSaleItems.$inferSelect;

// LCD sale items
export const lcdSaleItems = pgTable("lcd_sale_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id").notNull(),
  lcdId: varchar("lcd_id").notNull(),
  serialNumber: text("serial_number").notNull(),
  brand: text("brand").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

export const insertLcdSaleItemSchema = createInsertSchema(lcdSaleItems).omit({
  id: true,
  saleId: true,
});

export type InsertLcdSaleItem = z.infer<typeof insertLcdSaleItemSchema>;
export type LcdSaleItem = typeof lcdSaleItems.$inferSelect;

// Product Requests - for customers requesting unavailable products
export const productRequests = pgTable("product_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productName: text("product_name").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"), // pending, contacted, fulfilled, cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductRequestSchema = createInsertSchema(productRequests).omit({
  id: true,
  createdAt: true,
  status: true,
});

export type InsertProductRequest = z.infer<typeof insertProductRequestSchema>;
export type ProductRequest = typeof productRequests.$inferSelect;

// Visitor Sessions - for tracking website analytics
export const visitorSessions = pgTable("visitor_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(), // Unique session identifier
  ipAddress: text("ip_address"),
  country: text("country"),
  countryCode: text("country_code"),
  city: text("city"),
  userAgent: text("user_agent"),
  device: text("device"), // desktop, mobile, tablet
  browser: text("browser"),
  os: text("os"),
  referrer: text("referrer"),
  landingPage: text("landing_page"),
  pagesViewed: integer("pages_viewed").notNull().default(1),
  startTime: timestamp("start_time").defaultNow().notNull(),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration").default(0), // Duration in seconds
  isActive: integer("is_active").notNull().default(1),
});

export const insertVisitorSessionSchema = createInsertSchema(visitorSessions).omit({
  id: true,
  startTime: true,
  lastActivity: true,
});

export type InsertVisitorSession = z.infer<typeof insertVisitorSessionSchema>;
export type VisitorSession = typeof visitorSessions.$inferSelect;

// Page Views - for tracking individual page visits
export const pageViews = pgTable("page_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(),
  pagePath: text("page_path").notNull(),
  pageTitle: text("page_title"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  timeOnPage: integer("time_on_page").default(0), // Time in seconds
});

export const insertPageViewSchema = createInsertSchema(pageViews).omit({
  id: true,
  timestamp: true,
});

export type InsertPageView = z.infer<typeof insertPageViewSchema>;
export type PageView = typeof pageViews.$inferSelect;

// Blocked IPs - for blocking visitors from accessing the site
export const blockedIps = pgTable("blocked_ips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipAddress: text("ip_address").notNull().unique(),
  reason: text("reason"),
  blockedBy: varchar("blocked_by"), // Admin user ID who blocked
  blockedAt: timestamp("blocked_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // Optional expiration (null = permanent)
  isActive: integer("is_active").notNull().default(1),
});

export const insertBlockedIpSchema = createInsertSchema(blockedIps).omit({
  id: true,
  blockedAt: true,
});

export type InsertBlockedIp = z.infer<typeof insertBlockedIpSchema>;
export type BlockedIp = typeof blockedIps.$inferSelect;

// ─── SaaS Platform — Multi-Tenant Repair Management ─────────────────────────

// Subscribed repair shops (the tenants)
export const saasShops = pgTable("saas_shops", {
  id: serial("id").primaryKey(),
  shopName: text("shop_name").notNull(),
  ownerName: text("owner_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  city: text("city").notNull().default(""),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isActive: integer("is_active").notNull().default(1),
  subscriptionStatus: text("subscription_status").notNull().default("trial"), // trial | active | expired | suspended
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  trialEndsAt: timestamp("trial_ends_at").notNull(),
  maxTechnicians: integer("max_technicians").notNull().default(3),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSaasShopSchema = createInsertSchema(saasShops).omit({
  id: true,
  createdAt: true,
});

export type InsertSaasShop = z.infer<typeof insertSaasShopSchema>;
export type SaasShop = typeof saasShops.$inferSelect;

// Staff accounts within each shop
export const saasUsers = pgTable("saas_users", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  isOwner: integer("is_owner").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  permissions: jsonb("permissions").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSaasUserSchema = createInsertSchema(saasUsers).omit({
  id: true,
  createdAt: true,
});

export type InsertSaasUser = z.infer<typeof insertSaasUserSchema>;
export type SaasUser = typeof saasUsers.$inferSelect;

// Repair customers per shop
export const saasRepairCustomers = pgTable("saas_repair_customers", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull(),
  customerId: text("customer_id").notNull(), // e.g. "C-001", scoped per shop
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSaasRepairCustomerSchema = createInsertSchema(saasRepairCustomers).omit({
  id: true,
  createdAt: true,
});

export type InsertSaasRepairCustomer = z.infer<typeof insertSaasRepairCustomerSchema>;
export type SaasRepairCustomer = typeof saasRepairCustomers.$inferSelect;

// Repair tickets per shop
export const saasRepairTickets = pgTable("saas_repair_tickets", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull(),
  ticketNumber: text("ticket_number").notNull(),
  repairCustomerId: integer("repair_customer_id"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  deviceType: text("device_type").notNull(),
  deviceBrand: text("device_brand").notNull(),
  deviceModel: text("device_model").notNull(),
  issueDescriptionAr: text("issue_description_ar").notNull(),
  issueDescriptionEn: text("issue_description_en"),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("normal"),
  technicianNotes: text("technician_notes").default(""),
  estimatedCompletion: timestamp("estimated_completion"),
  costEstimate: decimal("cost_estimate", { precision: 10, scale: 2 }),
  finalCost: decimal("final_cost", { precision: 10, scale: 2 }),
  paymentStatus: text("payment_status").default("unpaid"),
  paymentMethod: text("payment_method").default("cash"), // cash, card
  isArchived: integer("is_archived").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSaasRepairTicketSchema = createInsertSchema(saasRepairTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSaasRepairTicket = z.infer<typeof insertSaasRepairTicketSchema>;
export type SaasRepairTicket = typeof saasRepairTickets.$inferSelect;

// ─── In-Store Products — Separate inventory for physical store sales ──────────
export const inStoreProducts = pgTable("in_store_products", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  sku: text("sku"),
  barcode: text("barcode"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  wholesalePrice: decimal("wholesale_price", { precision: 10, scale: 2 }),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  bulkWholesalePrice: decimal("bulk_wholesale_price", { precision: 10, scale: 2 }),
  category: text("category"),
  description: text("description"),
  image: text("image"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(3),
  isActive: integer("is_active").notNull().default(1),
  salesLocationId: integer("sales_location_id").notNull().default(1),
  productType: text("product_type").notNull().default("generic"),
  specs: jsonb("specs"),
  legacySource: text("legacy_source"),
  legacyId: text("legacy_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInStoreProductSchema = createInsertSchema(inStoreProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInStoreProduct = z.infer<typeof insertInStoreProductSchema>;
export type InStoreProduct = typeof inStoreProducts.$inferSelect;

// ─── Cash Withdrawals — Daily cash withdrawals by employees ───────────────────
export const WITHDRAWAL_SOURCE_SALES = "sales" as const;
export const WITHDRAWAL_SOURCE_TECHNICIAN = "technician" as const;
export type WithdrawalSource =
  | typeof WITHDRAWAL_SOURCE_SALES
  | typeof WITHDRAWAL_SOURCE_TECHNICIAN;

export const cashWithdrawals = pgTable("cash_withdrawals", {
  id: serial("id").primaryKey(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  employeeName: text("employee_name").notNull(),
  salesLocationId: integer("sales_location_id").notNull().default(1),
  /** sales = cashier portal; technician = repair portal */
  source: text("source").notNull().default(WITHDRAWAL_SOURCE_SALES),
  /** timestamptz so list filters and JS Dates agree across server TZ / Postgres */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCashWithdrawalSchema = createInsertSchema(cashWithdrawals).omit({
  id: true,
  createdAt: true,
  source: true,
});

export type InsertCashWithdrawal = z.infer<typeof insertCashWithdrawalSchema>;
export type CashWithdrawal = typeof cashWithdrawals.$inferSelect;

// ==================== Staff Advances ====================

export const staffAdvances = pgTable("staff_advances", {
  id: serial("id").primaryKey(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  staffName: text("staff_name").notNull(),
  reason: text("reason"),
  salesLocationId: integer("sales_location_id").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStaffAdvanceSchema = createInsertSchema(staffAdvances).omit({
  id: true,
  createdAt: true,
});

export type InsertStaffAdvance = z.infer<typeof insertStaffAdvanceSchema>;
export type StaffAdvance = typeof staffAdvances.$inferSelect;

// ==================== Recycle Bin ====================

export const recycleBin = pgTable("recycle_bin", {
  id: serial("id").primaryKey(),
  itemType: text("item_type").notNull(), // 'order' | 'repair_ticket' | 'product'
  itemId: text("item_id").notNull(),
  itemLabel: text("item_label").notNull(),
  section: text("section").notNull(), // 'online' | 'walk-in' | 'repair' | 'product'
  data: jsonb("data").notNull(),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
  deletedBy: text("deleted_by").notNull().default("admin"),
});

export type RecycleBinItem = typeof recycleBin.$inferSelect;
export type InsertRecycleBinItem = typeof recycleBin.$inferInsert;
