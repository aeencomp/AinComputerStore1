import { type Product, type InsertProduct, type CartItemRecord, type InsertCartItem, type Order, type InsertOrder, type User, type InsertUser, type StoreSettings, type InsertStoreSettings, type RepairTicket, type InsertRepairTicket, type Technician, type InsertTechnician, type AdminUser, type InsertAdminUser, products, cartItems, orders, users, storeSettings, repairTickets, technicians, adminUsers } from "@shared/schema";
import { db } from "./db.js";
import { eq, sql, and, desc } from "drizzle-orm";
import type { IStorage } from "./storage";
import bcrypt from "bcrypt";

export class DrizzleStorage implements IStorage {
  private sequenceInitialized = false;

  private async ensureOrderSequence(): Promise<void> {
    if (this.sequenceInitialized) return;
    try {
      await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1001 INCREMENT BY 1`);
      await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS repair_ticket_seq START WITH 1001 INCREMENT BY 1`);
      this.sequenceInitialized = true;
    } catch (error) {
      console.error('Failed to create sequences:', error);
    }
  }

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

  async getProductsByComponentType(componentType: string): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.componentType, componentType));
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

  async getCartItems(sessionId: string): Promise<CartItemRecord[]> {
    return await db.select().from(cartItems).where(eq(cartItems.sessionId, sessionId));
  }

  async addToCart(sessionId: string, insertItem: InsertCartItem): Promise<CartItemRecord> {
    const existing = await db.select().from(cartItems)
      .where(and(eq(cartItems.sessionId, sessionId), eq(cartItems.productId, insertItem.productId)))
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
      sessionId,
      quantity: insertItem.quantity ?? 1
    }).returning();
    return result[0];
  }

  async updateCartItemQuantity(id: string, sessionId: string, quantity: number): Promise<CartItemRecord | undefined> {
    const result = await db.update(cartItems)
      .set({ quantity })
      .where(and(eq(cartItems.id, id), eq(cartItems.sessionId, sessionId)))
      .returning();
    return result[0];
  }

  async removeFromCart(id: string, sessionId: string): Promise<void> {
    await db.delete(cartItems).where(and(eq(cartItems.id, id), eq(cartItems.sessionId, sessionId)));
  }

  async clearCart(sessionId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.sessionId, sessionId));
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

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const updateData: any = { ...updates };
    if (updates.password) {
      updateData.password = await bcrypt.hash(updates.password, 10);
    }
    const result = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async createOrder(insertOrder: InsertOrder, sessionId: string, userId?: string): Promise<Order> {
    await this.ensureOrderSequence();
    const sequenceResult = await db.execute(sql`SELECT nextval('order_number_seq') as next_num`);
    const nextNumber = (sequenceResult.rows[0] as any).next_num;
    const orderNumber = `ORD-${String(nextNumber).padStart(5, '0')}`;
    
    const result = await db.insert(orders).values({
      ...insertOrder,
      sessionId,
      userId: userId || null,
      orderNumber,
    }).returning();
    return result[0];
  }

  async getOrders(): Promise<Order[]> {
    return await db.select().from(orders);
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
    return result[0];
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return await db.select().from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }

  async lookupOrderByNumberAndPhone(orderNumber: string, phone: string): Promise<Order | undefined> {
    const normalizedInputPhone = phone.replace(/\D/g, '');
    if (!normalizedInputPhone) return undefined;
    
    const result = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
    const order = result[0];
    if (!order) return undefined;
    
    const normalizedStoredPhone = (order.customerPhone || '').replace(/\D/g, '');
    if (!normalizedStoredPhone || normalizedStoredPhone !== normalizedInputPhone) {
      return undefined;
    }
    
    return order;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const result = await db.update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning();
    return result[0];
  }

  async updateOrderPaymentInfo(id: string, info: { paymentStatus?: string; zaincashTransactionId?: string }): Promise<Order | undefined> {
    const updateData: any = {};
    if (info.paymentStatus) updateData.paymentStatus = info.paymentStatus;
    if (info.zaincashTransactionId) updateData.zaincashTransactionId = info.zaincashTransactionId;
    
    const result = await db.update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    return result[0];
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return result[0];
  }

  async deleteOrder(id: string): Promise<void> {
    await db.delete(orders).where(eq(orders.id, id));
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
    await this.ensureOrderSequence();
    const sequenceResult = await db.execute(sql`SELECT nextval('repair_ticket_seq') as next_num`);
    const nextNumber = (sequenceResult.rows[0] as any).next_num;
    const ticketNumber = `AEEN-${String(nextNumber).padStart(5, '0')}`;
    
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

  async getRepairTicketByPhone(phone: string): Promise<RepairTicket | undefined> {
    const normalizedPhone = phone.replace(/[\s\-+]/g, '');
    const result = await db.select().from(repairTickets)
      .where(eq(sql`REPLACE(REPLACE(REPLACE(${repairTickets.customerPhone}, ' ', ''), '-', ''), '+', '')`, normalizedPhone))
      .limit(1);
    return result[0];
  }

  async updateRepairTicket(id: string, updates: Partial<InsertRepairTicket>): Promise<RepairTicket | undefined> {
    const result = await db.update(repairTickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(repairTickets.id, id))
      .returning();
    return result[0];
  }

  async deleteRepairTicket(id: string): Promise<void> {
    await db.delete(repairTickets).where(eq(repairTickets.id, id));
  }

  // Technician methods
  async createTechnician(insertTechnician: InsertTechnician): Promise<Technician> {
    const hashedPassword = await bcrypt.hash(insertTechnician.password, 10);
    const result = await db.insert(technicians).values({
      ...insertTechnician,
      password: hashedPassword,
    }).returning();
    return result[0];
  }

  async getTechnicians(): Promise<Technician[]> {
    return await db.select().from(technicians);
  }

  async getTechnician(id: string): Promise<Technician | undefined> {
    const result = await db.select().from(technicians).where(eq(technicians.id, id)).limit(1);
    return result[0];
  }

  async getTechnicianByUsername(username: string): Promise<Technician | undefined> {
    const result = await db.select().from(technicians).where(eq(technicians.username, username)).limit(1);
    return result[0];
  }

  async updateTechnician(id: string, updates: Partial<InsertTechnician>): Promise<Technician | undefined> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    
    // Hash password if it's being updated
    if (updates.password) {
      updateData.password = await bcrypt.hash(updates.password, 10);
    }
    
    const result = await db.update(technicians)
      .set(updateData)
      .where(eq(technicians.id, id))
      .returning();
    return result[0];
  }

  async deleteTechnician(id: string): Promise<void> {
    await db.delete(technicians).where(eq(technicians.id, id));
  }

  async initializeDefaultTechnician(): Promise<void> {
    try {
      const existing = await this.getTechnicianByUsername('admin');
      if (!existing) {
        await this.createTechnician({
          username: 'admin',
          password: 'admin123',
          displayName: 'مدير النظام',
          isAdmin: 1,
          isActive: 1,
          permissions: ['view_tickets', 'update_status', 'manage_tickets', 'manage_technicians'],
        });
        console.log('Default admin technician created (username: admin, password: admin123)');
      }
    } catch (error) {
      console.error('Failed to initialize default technician:', error);
    }
  }

  // Admin user methods
  async createAdminUser(insertAdminUser: InsertAdminUser): Promise<AdminUser> {
    const hashedPassword = await bcrypt.hash(insertAdminUser.password, 10);
    const result = await db.insert(adminUsers).values({
      ...insertAdminUser,
      password: hashedPassword,
    }).returning();
    return result[0];
  }

  async getAdminUsers(): Promise<AdminUser[]> {
    return await db.select().from(adminUsers);
  }

  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    const result = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
    return result[0];
  }

  async getAdminUserByUsername(username: string): Promise<AdminUser | undefined> {
    const result = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
    return result[0];
  }

  async updateAdminUser(id: string, updates: Partial<InsertAdminUser>): Promise<AdminUser | undefined> {
    const updateData: any = { ...updates };
    
    // Hash password if it's being updated
    if (updates.password) {
      updateData.password = await bcrypt.hash(updates.password, 10);
    }
    
    const result = await db.update(adminUsers)
      .set(updateData)
      .where(eq(adminUsers.id, id))
      .returning();
    return result[0];
  }

  async deleteAdminUser(id: string): Promise<void> {
    await db.delete(adminUsers).where(eq(adminUsers.id, id));
  }

  async initializeDefaultAdmin(): Promise<void> {
    try {
      const existing = await this.getAdminUserByUsername('admin');
      if (!existing) {
        await this.createAdminUser({
          username: 'admin',
          password: 'admin123',
          name: 'مدير النظام',
          role: 'admin',
        });
        console.log('Default admin user created (username: admin, password: admin123)');
      }
    } catch (error) {
      console.error('Failed to initialize default admin:', error);
    }
  }
}
