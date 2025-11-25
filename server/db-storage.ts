import { type Product, type InsertProduct, type CartItemRecord, type InsertCartItem, type Order, type InsertOrder, type User, type InsertUser, type StoreSettings, type InsertStoreSettings, type RepairTicket, type InsertRepairTicket, products, cartItems, orders, users, storeSettings, repairTickets } from "@shared/schema";
import { db } from "./db.js";
import { eq, sql, and } from "drizzle-orm";
import type { IStorage } from "./storage";
import bcrypt from "bcrypt";

export class DrizzleStorage implements IStorage {
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return result[0];
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.category, category));
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(insertProduct).returning();
    return result[0];
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const result = await db.update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();
    return result[0];
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getCategories(): Promise<string[]> {
    const allProducts = await db.select().from(products);
    const categories = new Set<string>(allProducts.map((p: Product) => p.category));
    return Array.from(categories);
  }

  async getCartItems(userId: string): Promise<CartItemRecord[]> {
    return await db.select().from(cartItems).where(eq(cartItems.userId, userId));
  }

  async addToCart(userId: string, insertItem: InsertCartItem): Promise<CartItemRecord> {
    const existing = await db.select().from(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, insertItem.productId)))
      .limit(1);
    
    if (existing.length > 0) {
      const updated = await db.update(cartItems)
        .set({ quantity: existing[0].quantity + (insertItem.quantity ?? 1) })
        .where(eq(cartItems.id, existing[0].id))
        .returning();
      return updated[0];
    }

    const result = await db.insert(cartItems).values({
      ...insertItem,
      userId,
      quantity: insertItem.quantity ?? 1
    }).returning();
    return result[0];
  }

  async updateCartItemQuantity(id: string, userId: string, quantity: number): Promise<CartItemRecord | undefined> {
    const result = await db.update(cartItems)
      .set({ quantity })
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
      .returning();
    return result[0];
  }

  async removeFromCart(id: string, userId: string): Promise<void> {
    await db.delete(cartItems).where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)));
  }

  async clearCart(userId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const result = await db.insert(users).values({
      ...insertUser,
      password: hashedPassword,
    }).returning();
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getUserById(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async createOrder(insertOrder: InsertOrder, userId: string): Promise<Order> {
    const sequenceResult = await db.execute(sql`SELECT nextval('order_number_seq') as next_num`);
    const nextNumber = (sequenceResult.rows[0] as any).next_num;
    const orderNumber = `ORD-${String(nextNumber).padStart(5, '0')}`;
    
    const result = await db.insert(orders).values({
      ...insertOrder,
      userId,
      orderNumber,
    }).returning();
    return result[0];
  }

  async getOrders(): Promise<Order[]> {
    return await db.select().from(orders);
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.userId, userId));
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const result = await db.update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning();
    return result[0];
  }

  async getStoreSettings(): Promise<StoreSettings | undefined> {
    const result = await db.select().from(storeSettings).limit(1);
    return result[0];
  }

  async updateStoreSettings(updates: Partial<InsertStoreSettings>): Promise<StoreSettings> {
    const existing = await this.getStoreSettings();
    
    if (existing) {
      const result = await db.update(storeSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(storeSettings.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(storeSettings)
        .values(updates as InsertStoreSettings)
        .returning();
      return result[0];
    }
  }

  async createRepairTicket(insertTicket: InsertRepairTicket): Promise<RepairTicket> {
    const sequenceResult = await db.execute(sql`SELECT nextval(pg_get_serial_sequence('repair_tickets', 'id')) as next_num`);
    const nextNumber = (sequenceResult.rows[0] as any)?.next_num || Math.floor(Math.random() * 10000);
    const ticketNumber = `REP-${String(nextNumber).padStart(5, '0')}`;
    
    const result = await db.insert(repairTickets).values({
      ...insertTicket,
      ticketNumber,
    }).returning();
    return result[0];
  }

  async getRepairTickets(): Promise<RepairTicket[]> {
    return await db.select().from(repairTickets);
  }

  async getRepairTicket(id: string): Promise<RepairTicket | undefined> {
    const result = await db.select().from(repairTickets).where(eq(repairTickets.id, id)).limit(1);
    return result[0];
  }

  async getRepairTicketByNumber(ticketNumber: string): Promise<RepairTicket | undefined> {
    const result = await db.select().from(repairTickets).where(eq(repairTickets.ticketNumber, ticketNumber)).limit(1);
    return result[0];
  }

  async updateRepairTicket(id: string, updates: Partial<InsertRepairTicket>): Promise<RepairTicket | undefined> {
    const result = await db.update(repairTickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(repairTickets.id, id))
      .returning();
    return result[0];
  }
}
