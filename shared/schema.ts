import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, jsonb } from "drizzle-orm/pg-core";
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
  role: text("role").notNull().default("admin"),
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
  role: text("role").notNull().default("sales"), // sales, sales_admin
  // Permissions
  canPos: integer("can_pos").notNull().default(1), // Access to POS
  canInventory: integer("can_inventory").notNull().default(0), // Access to Inventory
  canManageUsers: integer("can_manage_users").notNull().default(0), // Can create/edit users
  canViewReports: integer("can_view_reports").notNull().default(0), // Access to sales reports
  canApplyDiscount: integer("can_apply_discount").notNull().default(0), // Can apply discounts
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
  notes: text("notes"), // Internal notes for the order
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

export const repairTickets = pgTable("repair_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: text("ticket_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
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
  userId: varchar("user_id"), // optional - if customer has account
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

// Technician Users for repair management
export const technicians = pgTable("technicians", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
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
  status: text("status").notNull().default("active"), // "active", "closed"
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
  paymentMethod: text("payment_method").notNull().default("cash"), // cash, zaincash, qicard
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
