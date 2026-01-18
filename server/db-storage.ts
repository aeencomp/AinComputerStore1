import { type Product, type InsertProduct, type CartItemRecord, type InsertCartItem, type Order, type InsertOrder, type User, type InsertUser, type StoreSettings, type InsertStoreSettings, type RepairTicket, type InsertRepairTicket, type Technician, type InsertTechnician, type AdminUser, type InsertAdminUser, type SalesUser, type InsertSalesUser, type MarketPrice, type InsertMarketPrice, type ExternalPriceSource, type InsertExternalPriceSource, type ExchangeRate, type InsertExchangeRate, type InventoryMovement, type InsertInventoryMovement, type BatteryUser, type InsertBatteryUser, type LaptopBattery, type InsertLaptopBattery, type ProductReview, type InsertProductReview, type DiscountCode, type InsertDiscountCode, type BatterySale, type InsertBatterySale, type BatterySaleItem, type InsertBatterySaleItem, type AcAdapter, type InsertAcAdapter, type AdapterSaleItem, type InsertAdapterSaleItem, type SlideshowSlide, type InsertSlideshowSlide, products, cartItems, orders, users, storeSettings, repairTickets, technicians, adminUsers, salesUsers, marketPrices, externalPriceSources, exchangeRates, inventoryMovements, batteryUsers, laptopBatteries, productReviews, discountCodes, batterySales, batterySaleItems, acAdapters, adapterSaleItems, slideshowSlides } from "@shared/schema";
import { db } from "./db.js";
import { eq, sql, and, desc, lte } from "drizzle-orm";
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

  async updateOrderPaymentInfo(id: string, info: { paymentStatus?: string; zaincashTransactionId?: string; qicardTransactionId?: string }): Promise<Order | undefined> {
    const updateData: any = {};
    if (info.paymentStatus) updateData.paymentStatus = info.paymentStatus;
    if (info.zaincashTransactionId) updateData.zaincashTransactionId = info.zaincashTransactionId;
    if (info.qicardTransactionId) updateData.qicardTransactionId = info.qicardTransactionId;
    
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

  // Sales user methods
  async createSalesUser(user: InsertSalesUser): Promise<SalesUser> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const result = await db.insert(salesUsers).values({
      ...user,
      password: hashedPassword,
    }).returning();
    return result[0];
  }

  async getSalesUsers(): Promise<SalesUser[]> {
    return await db.select().from(salesUsers);
  }

  async getSalesUser(id: string): Promise<SalesUser | undefined> {
    const result = await db.select().from(salesUsers).where(eq(salesUsers.id, id)).limit(1);
    return result[0];
  }

  async getSalesUserByUsername(username: string): Promise<SalesUser | undefined> {
    const result = await db.select().from(salesUsers).where(eq(salesUsers.username, username)).limit(1);
    return result[0];
  }

  async updateSalesUser(id: string, updates: Partial<InsertSalesUser>): Promise<SalesUser | undefined> {
    const updateData = { ...updates };
    if (updates.password) {
      updateData.password = await bcrypt.hash(updates.password, 10);
    }
    const result = await db.update(salesUsers)
      .set(updateData)
      .where(eq(salesUsers.id, id))
      .returning();
    return result[0];
  }

  async deleteSalesUser(id: string): Promise<void> {
    await db.delete(salesUsers).where(eq(salesUsers.id, id));
  }

  async initializeDefaultSalesAdmin(): Promise<void> {
    try {
      const existing = await this.getSalesUserByUsername('salesadmin');
      if (!existing) {
        await this.createSalesUser({
          username: 'salesadmin',
          password: 'sales123',
          name: 'مدير المبيعات',
          role: 'sales_admin',
          canPos: 1,
          canInventory: 1,
          canManageUsers: 1,
          canViewReports: 1,
          canApplyDiscount: 1,
          isActive: 1,
        });
        console.log('Default sales admin created (username: salesadmin, password: sales123)');
      }
    } catch (error) {
      console.error('Failed to initialize default sales admin:', error);
    }
  }

  // Market price methods
  async getMarketPrices(): Promise<MarketPrice[]> {
    return await db.select().from(marketPrices).orderBy(desc(marketPrices.updatedAt));
  }

  async getMarketPricesByType(componentType: string): Promise<MarketPrice[]> {
    return await db.select().from(marketPrices)
      .where(eq(marketPrices.componentType, componentType))
      .orderBy(desc(marketPrices.updatedAt));
  }

  async getMarketPrice(id: string): Promise<MarketPrice | undefined> {
    const result = await db.select().from(marketPrices).where(eq(marketPrices.id, id)).limit(1);
    return result[0];
  }

  async createMarketPrice(insertPrice: InsertMarketPrice): Promise<MarketPrice> {
    const result = await db.insert(marketPrices).values(insertPrice).returning();
    return result[0];
  }

  async updateMarketPrice(id: string, updates: Partial<InsertMarketPrice>): Promise<MarketPrice | undefined> {
    const existing = await this.getMarketPrice(id);
    if (!existing) return undefined;
    
    // If current price is changing, store old current price as previous
    const updateData: any = { ...updates, updatedAt: new Date() };
    if (updates.currentPrice && updates.currentPrice !== existing.currentPrice) {
      updateData.previousPrice = existing.currentPrice;
      updateData.priceDate = new Date();
    }
    
    const result = await db.update(marketPrices)
      .set(updateData)
      .where(eq(marketPrices.id, id))
      .returning();
    return result[0];
  }

  async deleteMarketPrice(id: string): Promise<void> {
    await db.delete(marketPrices).where(eq(marketPrices.id, id));
  }

  // External price source methods
  async getExternalPriceSources(): Promise<ExternalPriceSource[]> {
    return await db.select().from(externalPriceSources).orderBy(desc(externalPriceSources.lastUpdated));
  }

  async getExternalPriceSourcesByMarketPrice(marketPriceId: string): Promise<ExternalPriceSource[]> {
    return await db.select().from(externalPriceSources)
      .where(eq(externalPriceSources.marketPriceId, marketPriceId))
      .orderBy(desc(externalPriceSources.lastUpdated));
  }

  async getExternalPriceSource(id: string): Promise<ExternalPriceSource | undefined> {
    const result = await db.select().from(externalPriceSources).where(eq(externalPriceSources.id, id)).limit(1);
    return result[0];
  }

  async createExternalPriceSource(insertSource: InsertExternalPriceSource): Promise<ExternalPriceSource> {
    const result = await db.insert(externalPriceSources).values(insertSource).returning();
    return result[0];
  }

  async updateExternalPriceSource(id: string, updates: Partial<InsertExternalPriceSource>): Promise<ExternalPriceSource | undefined> {
    const updateData: any = { ...updates, lastUpdated: new Date() };
    const result = await db.update(externalPriceSources)
      .set(updateData)
      .where(eq(externalPriceSources.id, id))
      .returning();
    return result[0];
  }

  async deleteExternalPriceSource(id: string): Promise<void> {
    await db.delete(externalPriceSources).where(eq(externalPriceSources.id, id));
  }

  // Exchange rate methods
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate | undefined> {
    const result = await db.select().from(exchangeRates)
      .where(and(
        eq(exchangeRates.fromCurrency, fromCurrency),
        eq(exchangeRates.toCurrency, toCurrency)
      ))
      .limit(1);
    return result[0];
  }

  async upsertExchangeRate(insertRate: InsertExchangeRate): Promise<ExchangeRate> {
    const existing = await this.getExchangeRate(insertRate.fromCurrency || "USD", insertRate.toCurrency || "IQD");
    if (existing) {
      const result = await db.update(exchangeRates)
        .set({ rate: insertRate.rate, lastUpdated: new Date() })
        .where(eq(exchangeRates.id, existing.id))
        .returning();
      return result[0];
    }
    const result = await db.insert(exchangeRates).values(insertRate).returning();
    return result[0];
  }
  
  // Inventory management methods
  async getProductsWithInventory(): Promise<Product[]> {
    return await db.select().from(products);
  }
  
  async getLowStockProducts(): Promise<Product[]> {
    return await db.select().from(products).where(
      sql`${products.stockQuantity} <= ${products.lowStockThreshold}`
    );
  }
  
  async updateProductStock(productId: string, quantity: number, adminId?: string, reason?: string): Promise<Product | undefined> {
    const product = await this.getProduct(productId);
    if (!product) return undefined;
    
    const previousQuantity = product.stockQuantity || 0;
    
    // Update product stock
    const result = await db.update(products)
      .set({ stockQuantity: quantity })
      .where(eq(products.id, productId))
      .returning();
    
    // Record the movement
    await db.insert(inventoryMovements).values({
      productId,
      movementType: "adjustment",
      quantityChange: quantity - previousQuantity,
      previousQuantity,
      newQuantity: quantity,
      reason: reason || "Manual stock update",
      createdBy: adminId,
    });
    
    return result[0];
  }
  
  async adjustProductStock(productId: string, adjustment: number, adminId?: string, reason?: string, referenceId?: string): Promise<Product | undefined> {
    const product = await this.getProduct(productId);
    if (!product) return undefined;
    
    const previousQuantity = product.stockQuantity || 0;
    const newQuantity = previousQuantity + adjustment;
    
    // Update product stock
    const result = await db.update(products)
      .set({ stockQuantity: newQuantity })
      .where(eq(products.id, productId))
      .returning();
    
    // Record the movement
    await db.insert(inventoryMovements).values({
      productId,
      movementType: adjustment > 0 ? "purchase" : "sale",
      quantityChange: adjustment,
      previousQuantity,
      newQuantity,
      reason,
      referenceId,
      createdBy: adminId,
    });
    
    return result[0];
  }
  
  async getInventoryMovements(productId?: string): Promise<InventoryMovement[]> {
    if (productId) {
      return await db.select().from(inventoryMovements)
        .where(eq(inventoryMovements.productId, productId))
        .orderBy(desc(inventoryMovements.createdAt));
    }
    return await db.select().from(inventoryMovements)
      .orderBy(desc(inventoryMovements.createdAt));
  }
  
  async createInventoryMovement(movement: InsertInventoryMovement): Promise<InventoryMovement> {
    const result = await db.insert(inventoryMovements).values(movement).returning();
    return result[0];
  }
  
  async bulkUpdateStock(updates: Array<{ productId: string; quantity: number }>): Promise<void> {
    for (const update of updates) {
      await this.updateProductStock(update.productId, update.quantity);
    }
  }
  
  // Battery system user methods
  async createBatteryUser(user: InsertBatteryUser): Promise<BatteryUser> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const result = await db.insert(batteryUsers).values({
      ...user,
      password: hashedPassword
    }).returning();
    return result[0];
  }
  
  async getBatteryUsers(): Promise<BatteryUser[]> {
    return await db.select().from(batteryUsers).orderBy(desc(batteryUsers.createdAt));
  }
  
  async getBatteryUser(id: string): Promise<BatteryUser | undefined> {
    const result = await db.select().from(batteryUsers).where(eq(batteryUsers.id, id)).limit(1);
    return result[0];
  }
  
  async getBatteryUserByUsername(username: string): Promise<BatteryUser | undefined> {
    const result = await db.select().from(batteryUsers).where(eq(batteryUsers.username, username)).limit(1);
    return result[0];
  }
  
  async updateBatteryUser(id: string, updates: Partial<InsertBatteryUser>): Promise<BatteryUser | undefined> {
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }
    const result = await db.update(batteryUsers).set(updates).where(eq(batteryUsers.id, id)).returning();
    return result[0];
  }
  
  async deleteBatteryUser(id: string): Promise<void> {
    await db.delete(batteryUsers).where(eq(batteryUsers.id, id));
  }
  
  async initializeDefaultBatteryUser(): Promise<void> {
    const existingUser = await this.getBatteryUserByUsername("battery");
    if (!existingUser) {
      await db.insert(batteryUsers).values({
        username: "battery",
        password: await bcrypt.hash("battery123", 10),
        name: "مدير البطاريات",
        role: "admin",
        isActive: 1
      });
      console.log("Default battery user created: battery / battery123");
    }
  }
  
  // Laptop battery methods
  async getLaptopBatteries(): Promise<LaptopBattery[]> {
    return await db.select().from(laptopBatteries).where(eq(laptopBatteries.isActive, 1)).orderBy(desc(laptopBatteries.createdAt));
  }
  
  async getLaptopBattery(id: string): Promise<LaptopBattery | undefined> {
    const result = await db.select().from(laptopBatteries).where(eq(laptopBatteries.id, id)).limit(1);
    return result[0];
  }
  
  async getLaptopBatteryBySerial(serialNumber: string): Promise<LaptopBattery | undefined> {
    const result = await db.select().from(laptopBatteries).where(eq(laptopBatteries.serialNumber, serialNumber)).limit(1);
    return result[0];
  }
  
  async searchBatteriesByLaptopModel(laptopModel: string): Promise<LaptopBattery[]> {
    // Search batteries where any of the compatible laptops match the search term
    const allBatteries = await db.select().from(laptopBatteries).where(eq(laptopBatteries.isActive, 1));
    const searchLower = laptopModel.toLowerCase();
    return allBatteries.filter(battery => 
      battery.compatibleLaptops.some(laptop => laptop.toLowerCase().includes(searchLower))
    );
  }
  
  async getLowStockBatteries(): Promise<LaptopBattery[]> {
    return await db.select().from(laptopBatteries).where(
      and(
        eq(laptopBatteries.isActive, 1),
        sql`${laptopBatteries.stockQuantity} <= ${laptopBatteries.minStockLevel}`
      )
    );
  }
  
  async createLaptopBattery(battery: InsertLaptopBattery): Promise<LaptopBattery> {
    const result = await db.insert(laptopBatteries).values(battery).returning();
    return result[0];
  }
  
  async updateLaptopBattery(id: string, updates: Partial<InsertLaptopBattery>): Promise<LaptopBattery | undefined> {
    const result = await db.update(laptopBatteries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(laptopBatteries.id, id))
      .returning();
    return result[0];
  }
  
  async deleteLaptopBattery(id: string): Promise<void> {
    // Soft delete
    await db.update(laptopBatteries).set({ isActive: 0 }).where(eq(laptopBatteries.id, id));
  }
  
  // Product Review Methods
  async getProductReviews(productId: string): Promise<ProductReview[]> {
    return await db.select().from(productReviews)
      .where(eq(productReviews.productId, productId))
      .orderBy(desc(productReviews.createdAt));
  }
  
  async getApprovedProductReviews(productId: string): Promise<ProductReview[]> {
    return await db.select().from(productReviews)
      .where(and(
        eq(productReviews.productId, productId),
        eq(productReviews.isApproved, 1)
      ))
      .orderBy(desc(productReviews.createdAt));
  }
  
  async getAllReviews(): Promise<ProductReview[]> {
    return await db.select().from(productReviews).orderBy(desc(productReviews.createdAt));
  }
  
  async createProductReview(review: InsertProductReview): Promise<ProductReview> {
    const result = await db.insert(productReviews).values(review).returning();
    return result[0];
  }
  
  async updateProductReview(id: string, updates: Partial<InsertProductReview>): Promise<ProductReview | undefined> {
    const result = await db.update(productReviews)
      .set(updates)
      .where(eq(productReviews.id, id))
      .returning();
    return result[0];
  }
  
  async deleteProductReview(id: string): Promise<void> {
    await db.delete(productReviews).where(eq(productReviews.id, id));
  }
  
  async approveProductReview(id: string): Promise<ProductReview | undefined> {
    const result = await db.update(productReviews)
      .set({ isApproved: 1 })
      .where(eq(productReviews.id, id))
      .returning();
    return result[0];
  }
  
  // Discount Code Methods
  async getDiscountCodes(): Promise<DiscountCode[]> {
    return await db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt));
  }
  
  async getDiscountCode(id: string): Promise<DiscountCode | undefined> {
    const result = await db.select().from(discountCodes).where(eq(discountCodes.id, id)).limit(1);
    return result[0];
  }
  
  async getDiscountCodeByCode(code: string): Promise<DiscountCode | undefined> {
    const result = await db.select().from(discountCodes)
      .where(eq(discountCodes.code, code))
      .limit(1);
    return result[0];
  }
  
  async createDiscountCode(code: InsertDiscountCode): Promise<DiscountCode> {
    const result = await db.insert(discountCodes).values(code).returning();
    return result[0];
  }
  
  async updateDiscountCode(id: string, updates: Partial<InsertDiscountCode>): Promise<DiscountCode | undefined> {
    const result = await db.update(discountCodes)
      .set(updates)
      .where(eq(discountCodes.id, id))
      .returning();
    return result[0];
  }
  
  async deleteDiscountCode(id: string): Promise<void> {
    await db.delete(discountCodes).where(eq(discountCodes.id, id));
  }
  
  async incrementDiscountUsage(id: string): Promise<DiscountCode | undefined> {
    const result = await db.update(discountCodes)
      .set({ usedCount: sql`${discountCodes.usedCount} + 1` })
      .where(eq(discountCodes.id, id))
      .returning();
    return result[0];
  }
  
  // Battery POS Sales Methods
  async getBatterySales(): Promise<BatterySale[]> {
    return await db.select().from(batterySales).orderBy(desc(batterySales.createdAt));
  }
  
  async clearAllBatterySales(): Promise<void> {
    // Delete all sale items first (foreign key constraint)
    await db.delete(batterySaleItems);
    // Then delete all sales
    await db.delete(batterySales);
  }
  
  async getBatterySale(id: string): Promise<BatterySale | undefined> {
    const result = await db.select().from(batterySales).where(eq(batterySales.id, id)).limit(1);
    return result[0];
  }
  
  async getBatterySaleByNumber(saleNumber: string): Promise<BatterySale | undefined> {
    const result = await db.select().from(batterySales)
      .where(eq(batterySales.saleNumber, saleNumber))
      .limit(1);
    return result[0];
  }
  
  async createBatterySale(sale: InsertBatterySale, items: InsertBatterySaleItem[], adapterItems?: InsertAdapterSaleItem[]): Promise<BatterySale> {
    // Create the sale
    const saleResult = await db.insert(batterySales).values(sale).returning();
    const createdSale = saleResult[0];
    
    // Create battery sale items and update stock
    for (const item of items) {
      await db.insert(batterySaleItems).values({
        ...item,
        saleId: createdSale.id,
      });
      
      // Decrement stock for each battery
      await db.update(laptopBatteries)
        .set({ stockQuantity: sql`${laptopBatteries.stockQuantity} - ${item.quantity}` })
        .where(eq(laptopBatteries.id, item.batteryId));
    }
    
    // Create adapter sale items and update stock
    if (adapterItems && adapterItems.length > 0) {
      for (const item of adapterItems) {
        await db.insert(adapterSaleItems).values({
          ...item,
          saleId: createdSale.id,
        });
        
        // Decrement stock for each adapter
        await db.update(acAdapters)
          .set({ stockQuantity: sql`${acAdapters.stockQuantity} - ${item.quantity}` })
          .where(eq(acAdapters.id, item.adapterId));
      }
    }
    
    return createdSale;
  }
  
  async getBatterySaleItems(saleId: string): Promise<BatterySaleItem[]> {
    return await db.select().from(batterySaleItems).where(eq(batterySaleItems.saleId, saleId));
  }
  
  async updateBatterySale(id: string, data: Partial<InsertBatterySale>): Promise<BatterySale | undefined> {
    const result = await db.update(batterySales)
      .set(data)
      .where(eq(batterySales.id, id))
      .returning();
    return result[0];
  }

  async deleteBatterySale(id: string): Promise<boolean> {
    // First delete sale items, then delete the sale
    await db.delete(batterySaleItems).where(eq(batterySaleItems.saleId, id));
    const result = await db.delete(batterySales).where(eq(batterySales.id, id)).returning();
    return result.length > 0;
  }
  
  async generateBatterySaleNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `BSALE-${dateStr}-`;
    
    // Find the highest existing sale number for today
    const existingSales = await db.select({ saleNumber: batterySales.saleNumber })
      .from(batterySales)
      .where(sql`${batterySales.saleNumber} LIKE ${prefix + '%'}`)
      .orderBy(desc(batterySales.saleNumber))
      .limit(1);
    
    let nextNumber = 1;
    if (existingSales.length > 0) {
      const lastNumber = existingSales[0].saleNumber;
      const numPart = lastNumber.split('-').pop();
      if (numPart) {
        nextNumber = parseInt(numPart, 10) + 1;
      }
    }
    
    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  }
  
  async getAdapterSaleItems(saleId: string): Promise<AdapterSaleItem[]> {
    return await db.select().from(adapterSaleItems).where(eq(adapterSaleItems.saleId, saleId));
  }
  
  // AC Adapter methods
  async getAcAdapters(): Promise<AcAdapter[]> {
    return await db.select().from(acAdapters).where(eq(acAdapters.isActive, 1)).orderBy(desc(acAdapters.createdAt));
  }
  
  async getAcAdapter(id: string): Promise<AcAdapter | undefined> {
    const result = await db.select().from(acAdapters).where(eq(acAdapters.id, id)).limit(1);
    return result[0];
  }
  
  async getAcAdapterBySerial(serialNumber: string): Promise<AcAdapter | undefined> {
    const result = await db.select().from(acAdapters).where(eq(acAdapters.serialNumber, serialNumber)).limit(1);
    return result[0];
  }
  
  async searchAdaptersByLaptopModel(laptopModel: string): Promise<AcAdapter[]> {
    const allAdapters = await db.select().from(acAdapters).where(eq(acAdapters.isActive, 1));
    const searchLower = laptopModel.toLowerCase();
    return allAdapters.filter(adapter => 
      adapter.brand.toLowerCase().includes(searchLower) ||
      adapter.serialNumber.toLowerCase().includes(searchLower) ||
      adapter.wattage?.toString().includes(searchLower) ||
      adapter.compatibleLaptops.some(laptop => laptop.toLowerCase().includes(searchLower))
    );
  }
  
  async getLowStockAdapters(): Promise<AcAdapter[]> {
    return await db.select().from(acAdapters).where(
      and(
        eq(acAdapters.isActive, 1),
        sql`${acAdapters.stockQuantity} <= ${acAdapters.minStockLevel}`
      )
    );
  }
  
  async createAcAdapter(adapter: InsertAcAdapter): Promise<AcAdapter> {
    const result = await db.insert(acAdapters).values(adapter).returning();
    return result[0];
  }
  
  async updateAcAdapter(id: string, updates: Partial<InsertAcAdapter>): Promise<AcAdapter | undefined> {
    const result = await db.update(acAdapters)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(acAdapters.id, id))
      .returning();
    return result[0];
  }
  
  async deleteAcAdapter(id: string): Promise<void> {
    // Soft delete
    await db.update(acAdapters).set({ isActive: 0 }).where(eq(acAdapters.id, id));
  }
  
  // Slideshow slide methods
  async getSlideshowSlides(): Promise<SlideshowSlide[]> {
    return await db.select().from(slideshowSlides).orderBy(slideshowSlides.sortOrder);
  }
  
  async getActiveSlideshowSlides(): Promise<SlideshowSlide[]> {
    return await db.select().from(slideshowSlides)
      .where(eq(slideshowSlides.isActive, 1))
      .orderBy(slideshowSlides.sortOrder);
  }
  
  async getSlideshowSlide(id: string): Promise<SlideshowSlide | undefined> {
    const result = await db.select().from(slideshowSlides).where(eq(slideshowSlides.id, id)).limit(1);
    return result[0];
  }
  
  async createSlideshowSlide(slide: InsertSlideshowSlide): Promise<SlideshowSlide> {
    const result = await db.insert(slideshowSlides).values(slide).returning();
    return result[0];
  }
  
  async updateSlideshowSlide(id: string, updates: Partial<InsertSlideshowSlide>): Promise<SlideshowSlide | undefined> {
    const result = await db.update(slideshowSlides)
      .set(updates)
      .where(eq(slideshowSlides.id, id))
      .returning();
    return result[0];
  }
  
  async deleteSlideshowSlide(id: string): Promise<void> {
    await db.delete(slideshowSlides).where(eq(slideshowSlides.id, id));
  }
}
