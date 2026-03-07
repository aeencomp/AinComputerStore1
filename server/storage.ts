import { type Product, type InsertProduct, type CartItemRecord, type InsertCartItem, type Order, type InsertOrder, type User, type InsertUser, type StoreSettings, type InsertStoreSettings, type RepairTicket, type InsertRepairTicket, type RepairCustomer, type InsertRepairCustomer, type Technician, type InsertTechnician, type AdminUser, type InsertAdminUser, type SalesUser, type InsertSalesUser, type MarketPrice, type InsertMarketPrice, type ExternalPriceSource, type InsertExternalPriceSource, type ExchangeRate, type InsertExchangeRate, type InventoryMovement, type InsertInventoryMovement, type BatteryUser, type InsertBatteryUser, type LaptopBattery, type InsertLaptopBattery, type ProductReview, type InsertProductReview, type DiscountCode, type InsertDiscountCode, type BatterySale, type InsertBatterySale, type BatterySaleItem, type InsertBatterySaleItem, type AcAdapter, type InsertAcAdapter, type AdapterSaleItem, type InsertAdapterSaleItem, type SaasShop, type InsertSaasShop, type SaasUser, type InsertSaasUser, type SaasRepairCustomer, type InsertSaasRepairCustomer, type SaasRepairTicket, type InsertSaasRepairTicket, type InStoreProduct, type InsertInStoreProduct, type RecycleBinItem } from "@shared/schema";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

export interface IStorage {
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductsByCategory(category: string): Promise<Product[]>;
  getProductsByComponentType(componentType: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<void>;
  getCategories(): Promise<string[]>;
  getCartItems(sessionId: string): Promise<CartItemRecord[]>;
  addToCart(sessionId: string, item: InsertCartItem): Promise<CartItemRecord>;
  updateCartItemQuantity(id: string, sessionId: string, quantity: number): Promise<CartItemRecord | undefined>;
  removeFromCart(id: string, sessionId: string): Promise<void>;
  clearCart(sessionId: string): Promise<void>;
  createOrder(order: InsertOrder, sessionId: string, userId?: string): Promise<any>;
  getOrders(): Promise<any[]>;
  getOrderByNumber(orderNumber: string): Promise<any>;
  getOrdersByUserId(userId: string): Promise<any[]>;
  lookupOrderByNumberAndPhone(orderNumber: string, phone: string): Promise<any>;
  updateOrderStatus(id: string, status: string): Promise<any>;
  updateOrderPaymentInfo(id: string, info: { paymentStatus?: string; zaincashTransactionId?: string; qicardTransactionId?: string }): Promise<any>;
  getOrder(id: string): Promise<any>;
  deleteOrder(id: string): Promise<void>;
  getStoreSettings(): Promise<StoreSettings | undefined>;
  updateStoreSettings(settings: Partial<InsertStoreSettings>): Promise<StoreSettings>;
  createRepairTicket(ticket: InsertRepairTicket): Promise<RepairTicket>;
  getRepairTickets(): Promise<RepairTicket[]>;
  getRepairTicket(id: string): Promise<RepairTicket | undefined>;
  getRepairTicketByNumber(ticketNumber: string): Promise<RepairTicket | undefined>;
  getRepairTicketByPhone(phone: string): Promise<RepairTicket | undefined>;
  updateRepairTicket(id: string, updates: Partial<InsertRepairTicket>): Promise<RepairTicket | undefined>;
  archiveRepairTicket(id: string, archived: boolean): Promise<RepairTicket | undefined>;
  archiveDeliveredTickets(): Promise<number>;
  deleteRepairTicket(id: string): Promise<void>;
  createRepairCustomer(data: Omit<InsertRepairCustomer, 'customerId'>): Promise<RepairCustomer>;
  getRepairCustomerByPhone(phone: string): Promise<RepairCustomer | undefined>;
  getRepairCustomerByReadableId(customerId: string): Promise<RepairCustomer | undefined>;
  getRepairCustomerById(id: string): Promise<RepairCustomer | undefined>;
  listRepairCustomers(search?: string): Promise<(RepairCustomer & { ticketCount: number })[]>;
  getTicketsByRepairCustomer(repairCustomerId: string): Promise<RepairTicket[]>;
  updateRepairCustomer(id: string, updates: Partial<Pick<RepairCustomer, 'name' | 'phone' | 'email' | 'notes'>>): Promise<RepairCustomer | undefined>;

  // User methods (for customer management)
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  
  // Technician methods
  createTechnician(technician: InsertTechnician): Promise<Technician>;
  getTechnicians(): Promise<Technician[]>;
  getTechnician(id: string): Promise<Technician | undefined>;
  getTechnicianByUsername(username: string): Promise<Technician | undefined>;
  updateTechnician(id: string, updates: Partial<InsertTechnician>): Promise<Technician | undefined>;
  deleteTechnician(id: string): Promise<void>;
  initializeDefaultTechnician(): Promise<void>;
  
  // Admin user methods
  createAdminUser(user: InsertAdminUser): Promise<AdminUser>;
  getAdminUsers(): Promise<AdminUser[]>;
  getAdminUser(id: string): Promise<AdminUser | undefined>;
  getAdminUserByUsername(username: string): Promise<AdminUser | undefined>;
  updateAdminUser(id: string, updates: Partial<InsertAdminUser>): Promise<AdminUser | undefined>;
  deleteAdminUser(id: string): Promise<void>;
  initializeDefaultAdmin(): Promise<void>;
  
  // Sales user methods
  createSalesUser(user: InsertSalesUser): Promise<SalesUser>;
  getSalesUsers(): Promise<SalesUser[]>;
  getSalesUser(id: string): Promise<SalesUser | undefined>;
  getSalesUserByUsername(username: string): Promise<SalesUser | undefined>;
  updateSalesUser(id: string, updates: Partial<InsertSalesUser>): Promise<SalesUser | undefined>;
  deleteSalesUser(id: string): Promise<void>;
  initializeDefaultSalesAdmin(): Promise<void>;
  
  // Market price methods
  getMarketPrices(): Promise<MarketPrice[]>;
  getMarketPricesByType(componentType: string): Promise<MarketPrice[]>;
  getMarketPrice(id: string): Promise<MarketPrice | undefined>;
  createMarketPrice(price: InsertMarketPrice): Promise<MarketPrice>;
  updateMarketPrice(id: string, updates: Partial<InsertMarketPrice>): Promise<MarketPrice | undefined>;
  deleteMarketPrice(id: string): Promise<void>;
  
  // External price source methods
  getExternalPriceSources(): Promise<ExternalPriceSource[]>;
  getExternalPriceSourcesByMarketPrice(marketPriceId: string): Promise<ExternalPriceSource[]>;
  getExternalPriceSource(id: string): Promise<ExternalPriceSource | undefined>;
  createExternalPriceSource(source: InsertExternalPriceSource): Promise<ExternalPriceSource>;
  updateExternalPriceSource(id: string, updates: Partial<InsertExternalPriceSource>): Promise<ExternalPriceSource | undefined>;
  deleteExternalPriceSource(id: string): Promise<void>;
  
  // Exchange rate methods
  getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate | undefined>;
  upsertExchangeRate(rate: InsertExchangeRate): Promise<ExchangeRate>;
  
  // Inventory management methods
  getProductsWithInventory(): Promise<Product[]>;
  getLowStockProducts(): Promise<Product[]>;
  updateProductStock(productId: string, quantity: number, adminId?: string, reason?: string): Promise<Product | undefined>;
  adjustProductStock(productId: string, adjustment: number, adminId?: string, reason?: string, referenceId?: string): Promise<Product | undefined>;
  getInventoryMovements(productId?: string): Promise<InventoryMovement[]>;
  createInventoryMovement(movement: InsertInventoryMovement): Promise<InventoryMovement>;
  bulkUpdateStock(updates: Array<{ productId: string; quantity: number }>): Promise<void>;
  
  // Battery system user methods
  createBatteryUser(user: InsertBatteryUser): Promise<BatteryUser>;
  getBatteryUsers(): Promise<BatteryUser[]>;
  getBatteryUser(id: string): Promise<BatteryUser | undefined>;
  getBatteryUserByUsername(username: string): Promise<BatteryUser | undefined>;
  updateBatteryUser(id: string, updates: Partial<InsertBatteryUser>): Promise<BatteryUser | undefined>;
  deleteBatteryUser(id: string): Promise<void>;
  initializeDefaultBatteryUser(): Promise<void>;
  
  // Laptop battery methods
  getLaptopBatteries(): Promise<LaptopBattery[]>;
  getLaptopBattery(id: string): Promise<LaptopBattery | undefined>;
  getLaptopBatteryBySerial(serialNumber: string): Promise<LaptopBattery | undefined>;
  searchBatteriesByLaptopModel(laptopModel: string): Promise<LaptopBattery[]>;
  getLowStockBatteries(): Promise<LaptopBattery[]>;
  createLaptopBattery(battery: InsertLaptopBattery): Promise<LaptopBattery>;
  updateLaptopBattery(id: string, updates: Partial<InsertLaptopBattery>): Promise<LaptopBattery | undefined>;
  deleteLaptopBattery(id: string): Promise<void>;
  
  // Product review methods
  getProductReviews(productId: string): Promise<ProductReview[]>;
  getApprovedProductReviews(productId: string): Promise<ProductReview[]>;
  getAllReviews(): Promise<ProductReview[]>;
  createProductReview(review: InsertProductReview): Promise<ProductReview>;
  updateProductReview(id: string, updates: Partial<InsertProductReview>): Promise<ProductReview | undefined>;
  deleteProductReview(id: string): Promise<void>;
  approveProductReview(id: string): Promise<ProductReview | undefined>;
  
  // Discount code methods
  getDiscountCodes(): Promise<DiscountCode[]>;
  getDiscountCode(id: string): Promise<DiscountCode | undefined>;
  getDiscountCodeByCode(code: string): Promise<DiscountCode | undefined>;
  createDiscountCode(code: InsertDiscountCode): Promise<DiscountCode>;
  updateDiscountCode(id: string, updates: Partial<InsertDiscountCode>): Promise<DiscountCode | undefined>;
  deleteDiscountCode(id: string): Promise<void>;
  incrementDiscountUsage(id: string): Promise<DiscountCode | undefined>;
  
  // Battery POS sales methods
  getBatterySales(): Promise<BatterySale[]>;
  clearAllBatterySales(): Promise<void>;
  getBatterySale(id: string): Promise<BatterySale | undefined>;
  getBatterySaleByNumber(saleNumber: string): Promise<BatterySale | undefined>;
  createBatterySale(sale: InsertBatterySale, items: InsertBatterySaleItem[], adapterItems?: InsertAdapterSaleItem[]): Promise<BatterySale>;
  getBatterySaleItems(saleId: string): Promise<BatterySaleItem[]>;
  getAdapterSaleItems(saleId: string): Promise<AdapterSaleItem[]>;
  generateBatterySaleNumber(): Promise<string>;
  
  // AC Adapter methods
  getAcAdapters(): Promise<AcAdapter[]>;
  getAcAdapter(id: string): Promise<AcAdapter | undefined>;
  getAcAdapterBySerial(serialNumber: string): Promise<AcAdapter | undefined>;
  searchAdaptersByLaptopModel(laptopModel: string): Promise<AcAdapter[]>;
  getLowStockAdapters(): Promise<AcAdapter[]>;
  createAcAdapter(adapter: InsertAcAdapter): Promise<AcAdapter>;
  updateAcAdapter(id: string, updates: Partial<InsertAcAdapter>): Promise<AcAdapter | undefined>;
  deleteAcAdapter(id: string): Promise<void>;

  // SaaS Platform methods
  isSaasShopActive(shop: SaasShop): boolean;
  createSaasShop(data: InsertSaasShop): Promise<SaasShop>;
  getSaasShops(): Promise<(SaasShop & { ticketCount: number; userCount: number })[]>;
  getSaasShopById(id: number): Promise<SaasShop | undefined>;
  getSaasShopByUsername(username: string): Promise<SaasShop | undefined>;
  updateSaasShop(id: number, updates: Partial<InsertSaasShop>): Promise<SaasShop | undefined>;
  deleteSaasShop(id: number): Promise<void>;
  createSaasUser(data: InsertSaasUser): Promise<SaasUser>;
  getSaasUsersByShop(shopId: number): Promise<SaasUser[]>;
  getSaasUserByCredentials(shopId: number, username: string): Promise<SaasUser | undefined>;
  updateSaasUser(id: number, updates: Partial<InsertSaasUser>): Promise<SaasUser | undefined>;
  deleteSaasUser(id: number): Promise<void>;
  getOrCreateSaasCustomer(shopId: number, phone: string, name: string, email?: string): Promise<SaasRepairCustomer>;
  getSaasCustomersByShop(shopId: number): Promise<SaasRepairCustomer[]>;
  getSaasCustomerById(id: number): Promise<SaasRepairCustomer | undefined>;
  getSaasCustomerByPhone(shopId: number, phone: string): Promise<SaasRepairCustomer | undefined>;
  createSaasTicket(data: Omit<InsertSaasRepairTicket, 'ticketNumber'>): Promise<SaasRepairTicket>;
  getSaasTicketsByShop(shopId: number, filters?: { status?: string; search?: string; archived?: boolean }): Promise<SaasRepairTicket[]>;
  getSaasTicketById(id: number, shopId: number): Promise<SaasRepairTicket | undefined>;
  updateSaasTicket(id: number, shopId: number, updates: Partial<InsertSaasRepairTicket>): Promise<SaasRepairTicket | undefined>;
  archiveSaasTicket(id: number, shopId: number, archived: boolean): Promise<void>;
  getActiveSaasTicketsByCustomer(repairCustomerId: number, shopId: number): Promise<SaasRepairTicket[]>;
  getSaasStats(shopId: number): Promise<{ pending: number; inProgress: number; completed: number; totalRevenue: number; completedRevenue: number }>;
  // In-Store Products
  getInStoreProducts(): Promise<InStoreProduct[]>;
  getInStoreProductById(id: number): Promise<InStoreProduct | undefined>;
  createInStoreProduct(product: InsertInStoreProduct): Promise<InStoreProduct>;
  updateInStoreProduct(id: number, updates: Partial<InsertInStoreProduct>): Promise<InStoreProduct | undefined>;
  deleteInStoreProduct(id: number): Promise<void>;
  adjustInStoreProductStock(id: number, adjustment: number): Promise<InStoreProduct | undefined>;
  bulkSetInStoreStock(updates: { id: number; quantity: number }[]): Promise<number>;

  // Recycle Bin
  addToRecycleBin(item: { itemType: string; itemId: string; itemLabel: string; section: string; data: any; deletedBy: string }): Promise<RecycleBinItem>;
  getRecycleBin(): Promise<RecycleBinItem[]>;
  getRecycleBinItem(id: number): Promise<RecycleBinItem | undefined>;
  restoreRecycleBinItem(id: number): Promise<{ success: boolean; itemType: string }>;
  deleteFromRecycleBin(id: number): Promise<void>;
  clearRecycleBin(): Promise<void>;
}

export class MemStorage implements IStorage {
  private products: Map<string, Product>;
  private cartItems: Map<string, CartItemRecord>;
  private users: Map<string, User>;
  private orders: Map<string, any>;
  private orderCounter: number;

  constructor() {
    this.products = new Map();
    this.cartItems = new Map();
    this.users = new Map();
    this.orders = new Map();
    this.orderCounter = 1;
    this.seedProducts();
  }

  private seedProducts() {
    const sampleProducts: Omit<Product, 'id'>[] = [
      {
        nameAr: "لابتوب ألعاب ROG Zephyrus",
        descriptionAr: "لابتوب ألعاب قوي بمعالج Intel Core i9 وكرت شاشة RTX 4080",
        price: "7999.00",
        oldPrice: "9499.00",
        category: "laptops",
        image: "gaming_laptop_product_photo.png",
        specs: ["معالج Intel Core i9-13900H", "ذاكرة عشوائية 32GB DDR5", "كرت شاشة RTX 4080 8GB", "شاشة 15.6 بوصة 240Hz"],
        badge: "خصم ١٥٪",
        inStock: 1,
      },
      {
        nameAr: "جهاز كمبيوتر مكتبي للألعاب",
        descriptionAr: "جهاز كمبيوتر مكتبي عالي الأداء بإضاءة RGB",
        price: "5499.00",
        oldPrice: null,
        category: "desktops",
        image: "desktop_pc_tower_photo.png",
        specs: ["معالج AMD Ryzen 9 7900X", "ذاكرة عشوائية 64GB DDR5", "كرت شاشة RTX 4090 24GB", "SSD 2TB NVMe"],
        badge: "جديد",
        inStock: 1,
      },
      {
        nameAr: "شاشة ألعاب منحنية 34 بوصة",
        descriptionAr: "شاشة ألعاب فائقة العرض بتقنية UWQHD",
        price: "2299.00",
        oldPrice: "2799.00",
        category: "monitors",
        image: "gaming_monitor_product_photo.png",
        specs: ["دقة 3440x1440 بكسل", "معدل تحديث 165Hz", "زمن استجابة 1ms", "تقنية G-Sync"],
        badge: "خصم ٢٠٪",
        inStock: 1,
      },
      {
        nameAr: "لوحة مفاتيح ميكانيكية RGB",
        descriptionAr: "لوحة مفاتيح ميكانيكية احترافية للألعاب",
        price: "449.00",
        oldPrice: null,
        category: "accessories",
        image: "gaming_keyboard_product_photo.png",
        specs: ["مفاتيح Cherry MX Red", "إضاءة RGB قابلة للتخصيص", "إطار معدني متين", "مسند معصم قابل للفصل"],
        badge: null,
        inStock: 1,
      },
      {
        nameAr: "ماوس ألعاب لاسلكي",
        descriptionAr: "ماوس ألعاب عالي الدقة مع إضاءة RGB",
        price: "299.00",
        oldPrice: "399.00",
        category: "accessories",
        image: "gaming_mouse_product_photo.png",
        specs: ["حساس بصري 25600 DPI", "بطارية تدوم 70 ساعة", "8 أزرار قابلة للبرمجة", "وزن قابل للتعديل"],
        badge: "خصم ٢٥٪",
        inStock: 1,
      },
      {
        nameAr: "سماعة ألعاب احترافية",
        descriptionAr: "سماعة محيطية 7.1 مع ميكروفون قابل للفصل",
        price: "549.00",
        oldPrice: null,
        category: "accessories",
        image: "gaming_headset_product_photo.png",
        specs: ["صوت محيطي 7.1", "ميكروفون بإلغاء الضوضاء", "وسائد أذن من الجلد الناعم", "توافق مع جميع المنصات"],
        badge: null,
        inStock: 1,
      },
      {
        nameAr: "لابتوب عمل وإنتاجية",
        descriptionAr: "لابتوب خفيف الوزن مثالي للعمل والدراسة",
        price: "3299.00",
        oldPrice: null,
        category: "laptops",
        image: "gaming_laptop_product_photo.png",
        specs: ["معالج Intel Core i7-13700H", "ذاكرة عشوائية 16GB", "SSD 512GB", "شاشة 14 بوصة Full HD"],
        badge: null,
        inStock: 1,
      },
      {
        nameAr: "جهاز كمبيوتر مكتبي للمكاتب",
        descriptionAr: "جهاز كمبيوتر مكتبي كامل للاستخدام المكتبي",
        price: "2499.00",
        oldPrice: null,
        category: "desktops",
        image: "desktop_pc_tower_photo.png",
        specs: ["معالج Intel Core i5-13400", "ذاكرة عشوائية 16GB", "SSD 512GB", "Windows 11 Pro"],
        badge: null,
        inStock: 1,
      },
    ];

    for (const product of sampleProducts) {
      const id = randomUUID();
      this.products.set(id, { 
        ...product, 
        id,
        oldPrice: product.oldPrice ?? null,
        specs: product.specs ?? null,
        badge: product.badge ?? null,
        inStock: product.inStock ?? 1
      });
    }
  }

  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.category === category
    );
  }

  async getProductsByComponentType(componentType: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.componentType === componentType
    );
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = randomUUID();
    const product: Product = { 
      ...insertProduct, 
      id,
      oldPrice: insertProduct.oldPrice ?? null,
      specs: insertProduct.specs ?? null,
      badge: insertProduct.badge ?? null,
      inStock: insertProduct.inStock ?? 1
    };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const existing = this.products.get(id);
    if (!existing) {
      return undefined;
    }
    
    const updated: Product = {
      ...existing,
      ...updates,
      id: existing.id,
    };
    this.products.set(id, updated);
    return updated;
  }

  async deleteProduct(id: string): Promise<void> {
    this.products.delete(id);
  }

  async getCategories(): Promise<string[]> {
    const categories = new Set<string>();
    const productsArray = Array.from(this.products.values());
    for (const product of productsArray) {
      categories.add(product.category);
    }
    return Array.from(categories);
  }

  async getCartItems(sessionId: string): Promise<CartItemRecord[]> {
    return Array.from(this.cartItems.values()).filter(item => item.sessionId === sessionId);
  }

  async addToCart(sessionId: string, insertItem: InsertCartItem): Promise<CartItemRecord> {
    const existing = Array.from(this.cartItems.values()).find(
      (item) => item.productId === insertItem.productId && item.sessionId === sessionId
    );

    if (existing) {
      existing.quantity += (insertItem.quantity ?? 1);
      this.cartItems.set(existing.id, existing);
      return existing;
    }

    const id = randomUUID();
    const cartItem: CartItemRecord = { 
      ...insertItem, 
      id,
      sessionId,
      quantity: insertItem.quantity ?? 1
    };
    this.cartItems.set(id, cartItem);
    return cartItem;
  }

  async updateCartItemQuantity(id: string, sessionId: string, quantity: number): Promise<CartItemRecord | undefined> {
    const item = this.cartItems.get(id);
    if (!item || item.sessionId !== sessionId) return undefined;

    item.quantity = quantity;
    this.cartItems.set(id, item);
    return item;
  }

  async bulkSetInStoreStock(updates: { id: number; quantity: number }[]): Promise<number> {
    return 0;
  }

  async removeFromCart(id: string, sessionId: string): Promise<void> {
    const item = this.cartItems.get(id);
    if (item && item.sessionId === sessionId) {
      this.cartItems.delete(id);
    }
  }

  async clearCart(sessionId: string): Promise<void> {
    for (const [id, item] of this.cartItems.entries()) {
      if (item.sessionId === sessionId) {
        this.cartItems.delete(id);
      }
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
  }

  async createOrder(insertOrder: InsertOrder, sessionId: string, userId?: string): Promise<any> {
    const id = randomUUID();
    const orderNumber = `ORD-${String(this.orderCounter).padStart(5, '0')}`;
    this.orderCounter++;
    
    const order = {
      ...insertOrder,
      id,
      sessionId,
      userId: userId || null,
      orderNumber,
      createdAt: new Date(),
    };
    this.orders.set(id, order);
    return order;
  }

  async getOrders(): Promise<any[]> {
    return Array.from(this.orders.values());
  }

  async getOrderByNumber(orderNumber: string): Promise<any> {
    return Array.from(this.orders.values()).find(o => o.orderNumber === orderNumber);
  }

  async getOrdersByUserId(userId: string): Promise<any[]> {
    return Array.from(this.orders.values())
      .filter(o => o.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async lookupOrderByNumberAndPhone(orderNumber: string, phone: string): Promise<any> {
    const normalizedInputPhone = phone.replace(/\D/g, '');
    if (!normalizedInputPhone) return undefined;
    
    const order = Array.from(this.orders.values()).find(o => {
      const normalizedStoredPhone = (o.customerPhone || '').replace(/\D/g, '');
      return o.orderNumber === orderNumber && normalizedStoredPhone && normalizedStoredPhone === normalizedInputPhone;
    });
    return order || undefined;
  }

  async updateOrderStatus(id: string, status: string): Promise<any> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    
    order.status = status;
    this.orders.set(id, order);
    return order;
  }

  async updateOrderPaymentInfo(id: string, info: { paymentStatus?: string; zaincashTransactionId?: string }): Promise<any> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    
    if (info.paymentStatus) order.paymentStatus = info.paymentStatus;
    if (info.zaincashTransactionId) order.zaincashTransactionId = info.zaincashTransactionId;
    this.orders.set(id, order);
    return order;
  }

  async getOrder(id: string): Promise<any> {
    return this.orders.get(id);
  }

  async deleteOrder(id: string): Promise<void> {
    this.orders.delete(id);
  }

  async getStoreSettings(): Promise<StoreSettings | undefined> {
    return undefined;
  }

  async updateStoreSettings(settings: Partial<InsertStoreSettings>): Promise<StoreSettings> {
    const defaultSettings: StoreSettings = {
      id: randomUUID(),
      storeNameAr: "العين لتجارة الحاسبات",
      storeNameEn: "Al-Ain Computer Trading",
      descriptionAr: "متجرك الموثوق لأحدث الحواسيب والملحقات بأفضل الأسعار وأعلى جودة.",
      descriptionEn: "Your trusted store for the latest computers and accessories at the best prices and highest quality.",
      email: "info@alain-computers.com",
      phone: "920001234",
      phoneAr: "٩٢٠٠٠١٢٣٤",
      addressAr: "بغداد، العراق",
      addressEn: "Baghdad, Iraq",
      hoursAr: "السبت - الخميس ٩ص - ٩م",
      hoursEn: "Saturday - Thursday 9am - 9pm",
      facebookUrl: "",
      twitterUrl: "",
      instagramUrl: "",
      updatedAt: new Date(),
    };
    return { ...defaultSettings, ...settings };
  }

  async createRepairTicket(ticket: InsertRepairTicket): Promise<RepairTicket> {
    throw new Error("MemStorage does not support repair tickets");
  }

  async getRepairTickets(): Promise<RepairTicket[]> {
    return [];
  }

  async getRepairTicket(id: string): Promise<RepairTicket | undefined> {
    return undefined;
  }

  async getRepairTicketByNumber(ticketNumber: string): Promise<RepairTicket | undefined> {
    return undefined;
  }

  async getRepairTicketByPhone(phone: string): Promise<RepairTicket | undefined> {
    return undefined;
  }

  async updateRepairTicket(id: string, updates: Partial<InsertRepairTicket>): Promise<RepairTicket | undefined> {
    return undefined;
  }

  async archiveRepairTicket(id: string, archived: boolean): Promise<RepairTicket | undefined> {
    return undefined;
  }

  async archiveDeliveredTickets(): Promise<number> {
    return 0;
  }

  async deleteRepairTicket(id: string): Promise<void> {
    // MemStorage does not support repair tickets
  }

  async createRepairCustomer(data: Omit<InsertRepairCustomer, 'customerId'>): Promise<RepairCustomer> {
    throw new Error("MemStorage does not support repair customers");
  }

  async getRepairCustomerByPhone(phone: string): Promise<RepairCustomer | undefined> {
    return undefined;
  }

  async getRepairCustomerByReadableId(customerId: string): Promise<RepairCustomer | undefined> {
    return undefined;
  }

  async getRepairCustomerById(id: string): Promise<RepairCustomer | undefined> {
    return undefined;
  }

  async listRepairCustomers(search?: string): Promise<(RepairCustomer & { ticketCount: number })[]> {
    return [];
  }

  async getTicketsByRepairCustomer(repairCustomerId: string): Promise<RepairTicket[]> {
    return [];
  }

  async updateRepairCustomer(id: string, updates: Partial<Pick<RepairCustomer, 'name' | 'phone' | 'email' | 'notes'>>): Promise<RepairCustomer | undefined> {
    return undefined;
  }

  async createTechnician(technician: InsertTechnician): Promise<Technician> {
    throw new Error("MemStorage does not support technicians");
  }

  async getTechnicians(): Promise<Technician[]> {
    return [];
  }

  async getTechnician(id: string): Promise<Technician | undefined> {
    return undefined;
  }

  async getTechnicianByUsername(username: string): Promise<Technician | undefined> {
    return undefined;
  }

  async updateTechnician(id: string, updates: Partial<InsertTechnician>): Promise<Technician | undefined> {
    return undefined;
  }

  async deleteTechnician(id: string): Promise<void> {
    // MemStorage does not support technicians
  }

  async initializeDefaultTechnician(): Promise<void> {
    // MemStorage does not support technicians
  }

  // Admin user methods (stubs for MemStorage)
  async createAdminUser(user: InsertAdminUser): Promise<AdminUser> {
    throw new Error("MemStorage does not support admin users");
  }

  async getAdminUsers(): Promise<AdminUser[]> {
    return [];
  }

  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    return undefined;
  }

  async getAdminUserByUsername(username: string): Promise<AdminUser | undefined> {
    return undefined;
  }

  async updateAdminUser(id: string, updates: Partial<InsertAdminUser>): Promise<AdminUser | undefined> {
    return undefined;
  }

  async deleteAdminUser(id: string): Promise<void> {
    // MemStorage does not support admin users
  }

  async initializeDefaultAdmin(): Promise<void> {
    // MemStorage does not support admin users
  }
  
  // Sales user methods (stubs for MemStorage)
  async createSalesUser(user: InsertSalesUser): Promise<SalesUser> {
    throw new Error("MemStorage does not support sales users");
  }

  async getSalesUsers(): Promise<SalesUser[]> {
    return [];
  }

  async getSalesUser(id: string): Promise<SalesUser | undefined> {
    return undefined;
  }

  async getSalesUserByUsername(username: string): Promise<SalesUser | undefined> {
    return undefined;
  }

  async updateSalesUser(id: string, updates: Partial<InsertSalesUser>): Promise<SalesUser | undefined> {
    return undefined;
  }

  async deleteSalesUser(id: string): Promise<void> {
    // MemStorage does not support sales users
  }

  async initializeDefaultSalesAdmin(): Promise<void> {
    // MemStorage does not support sales users
  }
  
  // Market price methods (stubs for MemStorage)
  async getMarketPrices(): Promise<MarketPrice[]> {
    return [];
  }
  
  async getMarketPricesByType(componentType: string): Promise<MarketPrice[]> {
    return [];
  }
  
  async getMarketPrice(id: string): Promise<MarketPrice | undefined> {
    return undefined;
  }
  
  async createMarketPrice(price: InsertMarketPrice): Promise<MarketPrice> {
    throw new Error("MemStorage does not support market prices");
  }
  
  async updateMarketPrice(id: string, updates: Partial<InsertMarketPrice>): Promise<MarketPrice | undefined> {
    return undefined;
  }
  
  async deleteMarketPrice(id: string): Promise<void> {
    // MemStorage does not support market prices
  }
  
  // External price source methods (stubs for MemStorage)
  async getExternalPriceSources(): Promise<ExternalPriceSource[]> {
    return [];
  }
  
  async getExternalPriceSourcesByMarketPrice(marketPriceId: string): Promise<ExternalPriceSource[]> {
    return [];
  }
  
  async getExternalPriceSource(id: string): Promise<ExternalPriceSource | undefined> {
    return undefined;
  }
  
  async createExternalPriceSource(source: InsertExternalPriceSource): Promise<ExternalPriceSource> {
    throw new Error("MemStorage does not support external price sources");
  }
  
  async updateExternalPriceSource(id: string, updates: Partial<InsertExternalPriceSource>): Promise<ExternalPriceSource | undefined> {
    return undefined;
  }
  
  async deleteExternalPriceSource(id: string): Promise<void> {
    // MemStorage does not support external price sources
  }
  
  // Exchange rate methods (stubs for MemStorage)
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate | undefined> {
    return undefined;
  }
  
  async upsertExchangeRate(rate: InsertExchangeRate): Promise<ExchangeRate> {
    throw new Error("MemStorage does not support exchange rates");
  }
  
  // Inventory management methods (stubs for MemStorage)
  async getProductsWithInventory(): Promise<Product[]> {
    return Array.from(this.products.values());
  }
  
  async getLowStockProducts(): Promise<Product[]> {
    return Array.from(this.products.values()).filter(p => 
      (p.stockQuantity || 0) <= (p.lowStockThreshold || 5)
    );
  }
  
  async updateProductStock(productId: string, quantity: number, adminId?: string, reason?: string): Promise<Product | undefined> {
    const product = this.products.get(productId);
    if (product) {
      const updated = { ...product, stockQuantity: quantity };
      this.products.set(productId, updated);
      return updated;
    }
    return undefined;
  }
  
  async adjustProductStock(productId: string, adjustment: number, adminId?: string, reason?: string, referenceId?: string): Promise<Product | undefined> {
    const product = this.products.get(productId);
    if (product) {
      const newQuantity = (product.stockQuantity || 0) + adjustment;
      const updated = { ...product, stockQuantity: newQuantity };
      this.products.set(productId, updated);
      return updated;
    }
    return undefined;
  }
  
  async getInventoryMovements(productId?: string): Promise<InventoryMovement[]> {
    return [];
  }
  
  async createInventoryMovement(movement: InsertInventoryMovement): Promise<InventoryMovement> {
    throw new Error("MemStorage does not support inventory movements");
  }
  
  async bulkUpdateStock(updates: Array<{ productId: string; quantity: number }>): Promise<void> {
    for (const update of updates) {
      await this.updateProductStock(update.productId, update.quantity);
    }
  }
  
  // Product review stubs for MemStorage
  async getProductReviews(productId: string): Promise<ProductReview[]> {
    return [];
  }
  
  async getApprovedProductReviews(productId: string): Promise<ProductReview[]> {
    return [];
  }
  
  async getAllReviews(): Promise<ProductReview[]> {
    return [];
  }
  
  async createProductReview(review: InsertProductReview): Promise<ProductReview> {
    throw new Error("MemStorage does not support product reviews");
  }
  
  async updateProductReview(id: string, updates: Partial<InsertProductReview>): Promise<ProductReview | undefined> {
    return undefined;
  }
  
  async deleteProductReview(id: string): Promise<void> {
    // Not implemented
  }
  
  async approveProductReview(id: string): Promise<ProductReview | undefined> {
    return undefined;
  }
  
  // Discount code stubs for MemStorage
  async getDiscountCodes(): Promise<DiscountCode[]> {
    return [];
  }
  
  async getDiscountCode(id: string): Promise<DiscountCode | undefined> {
    return undefined;
  }
  
  async getDiscountCodeByCode(code: string): Promise<DiscountCode | undefined> {
    return undefined;
  }
  
  async createDiscountCode(code: InsertDiscountCode): Promise<DiscountCode> {
    throw new Error("MemStorage does not support discount codes");
  }
  
  async updateDiscountCode(id: string, updates: Partial<InsertDiscountCode>): Promise<DiscountCode | undefined> {
    return undefined;
  }
  
  async deleteDiscountCode(id: string): Promise<void> {
    // Not implemented
  }
  
  async incrementDiscountUsage(id: string): Promise<DiscountCode | undefined> {
    return undefined;
  }
  
  // Battery POS stubs for MemStorage
  async getBatterySales(): Promise<BatterySale[]> {
    return [];
  }
  
  async clearAllBatterySales(): Promise<void> {
    // Not implemented for MemStorage
  }
  
  async getBatterySale(id: string): Promise<BatterySale | undefined> {
    return undefined;
  }
  
  async getBatterySaleByNumber(saleNumber: string): Promise<BatterySale | undefined> {
    return undefined;
  }
  
  async createBatterySale(sale: InsertBatterySale, items: InsertBatterySaleItem[]): Promise<BatterySale> {
    throw new Error("MemStorage does not support battery sales");
  }
  
  async getBatterySaleItems(saleId: string): Promise<BatterySaleItem[]> {
    return [];
  }
  
  async generateBatterySaleNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0,10).replace(/-/g, '');
    return `BSALE-${dateStr}-001`;
  }

  // SaaS stubs
  isSaasShopActive(_shop: SaasShop): boolean { return false; }
  async createSaasShop(_d: InsertSaasShop): Promise<SaasShop> { throw new Error('Not implemented'); }
  async getSaasShops(): Promise<(SaasShop & { ticketCount: number; userCount: number })[]> { return []; }
  async getSaasShopById(_id: number): Promise<SaasShop | undefined> { return undefined; }
  async getSaasShopByUsername(_u: string): Promise<SaasShop | undefined> { return undefined; }
  async updateSaasShop(_id: number, _u: Partial<InsertSaasShop>): Promise<SaasShop | undefined> { return undefined; }
  async deleteSaasShop(_id: number): Promise<void> {}
  async createSaasUser(_d: InsertSaasUser): Promise<SaasUser> { throw new Error('Not implemented'); }
  async getSaasUsersByShop(_shopId: number): Promise<SaasUser[]> { return []; }
  async getSaasUserByCredentials(_shopId: number, _u: string): Promise<SaasUser | undefined> { return undefined; }
  async updateSaasUser(_id: number, _u: Partial<InsertSaasUser>): Promise<SaasUser | undefined> { return undefined; }
  async deleteSaasUser(_id: number): Promise<void> {}
  async getOrCreateSaasCustomer(_shopId: number, _phone: string, _name: string): Promise<SaasRepairCustomer> { throw new Error('Not implemented'); }
  async getSaasCustomersByShop(_shopId: number): Promise<SaasRepairCustomer[]> { return []; }
  async getSaasCustomerById(_id: number): Promise<SaasRepairCustomer | undefined> { return undefined; }
  async getSaasCustomerByPhone(_shopId: number, _phone: string): Promise<SaasRepairCustomer | undefined> { return undefined; }
  async createSaasTicket(_d: Omit<InsertSaasRepairTicket, 'ticketNumber'>): Promise<SaasRepairTicket> { throw new Error('Not implemented'); }
  async getSaasTicketsByShop(_shopId: number): Promise<SaasRepairTicket[]> { return []; }
  async getSaasTicketById(_id: number, _shopId: number): Promise<SaasRepairTicket | undefined> { return undefined; }
  async updateSaasTicket(_id: number, _shopId: number, _u: Partial<InsertSaasRepairTicket>): Promise<SaasRepairTicket | undefined> { return undefined; }
  async archiveSaasTicket(_id: number, _shopId: number, _archived: boolean): Promise<void> {}
  async getActiveSaasTicketsByCustomer(_repairCustomerId: number, _shopId: number): Promise<SaasRepairTicket[]> { return []; }
  async getSaasStats(_shopId: number): Promise<{ pending: number; inProgress: number; completed: number; totalRevenue: number; completedRevenue: number }> { return { pending: 0, inProgress: 0, completed: 0, totalRevenue: 0, completedRevenue: 0 }; }
  async getInStoreProducts(): Promise<InStoreProduct[]> { return []; }
  async getInStoreProductById(_id: number): Promise<InStoreProduct | undefined> { return undefined; }
  async createInStoreProduct(_p: InsertInStoreProduct): Promise<InStoreProduct> { throw new Error('Not implemented'); }
  async updateInStoreProduct(_id: number, _u: Partial<InsertInStoreProduct>): Promise<InStoreProduct | undefined> { return undefined; }
  async deleteInStoreProduct(_id: number): Promise<void> {}
  async adjustInStoreProductStock(_id: number, _adj: number): Promise<InStoreProduct | undefined> { return undefined; }
  async bulkSetInStoreStock(_updates: { id: number; quantity: number }[]): Promise<number> { return 0; }

  async addToRecycleBin(_item: any): Promise<RecycleBinItem> { throw new Error('Not implemented'); }
  async getRecycleBin(): Promise<RecycleBinItem[]> { return []; }
  async getRecycleBinItem(_id: number): Promise<RecycleBinItem | undefined> { return undefined; }
  async restoreRecycleBinItem(_id: number): Promise<{ success: boolean; itemType: string }> { return { success: false, itemType: '' }; }
  async deleteFromRecycleBin(_id: number): Promise<void> {}
  async clearRecycleBin(): Promise<void> {}
}

import { DrizzleStorage } from "./db-storage";

export const storage = new DrizzleStorage();
