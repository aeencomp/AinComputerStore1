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
  items: text("items").array().notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  shipping: decimal("shipping", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
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
