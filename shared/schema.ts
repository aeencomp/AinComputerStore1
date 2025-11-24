import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp } from "drizzle-orm/pg-core";
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
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
});

export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type CartItemRecord = typeof cartItems.$inferSelect;

export interface CartItem {
  product: Product;
  quantity: number;
}

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
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
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStoreSettingsSchema = createInsertSchema(storeSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertStoreSettings = z.infer<typeof insertStoreSettingsSchema>;
export type StoreSettings = typeof storeSettings.$inferSelect;

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
