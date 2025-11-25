import { type Product, type InsertProduct, type CartItemRecord, type InsertCartItem, type Order, type InsertOrder, type User, type InsertUser, type StoreSettings, type InsertStoreSettings, type RepairTicket, type InsertRepairTicket } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductsByCategory(category: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<void>;
  getCategories(): Promise<string[]>;
  getCartItems(sessionId: string): Promise<CartItemRecord[]>;
  addToCart(sessionId: string, item: InsertCartItem): Promise<CartItemRecord>;
  updateCartItemQuantity(id: string, sessionId: string, quantity: number): Promise<CartItemRecord | undefined>;
  removeFromCart(id: string, sessionId: string): Promise<void>;
  clearCart(sessionId: string): Promise<void>;
  createOrder(order: InsertOrder, sessionId: string): Promise<any>;
  getOrders(): Promise<any[]>;
  updateOrderStatus(id: string, status: string): Promise<any>;
  getStoreSettings(): Promise<StoreSettings | undefined>;
  updateStoreSettings(settings: Partial<InsertStoreSettings>): Promise<StoreSettings>;
  createRepairTicket(ticket: InsertRepairTicket): Promise<RepairTicket>;
  getRepairTickets(): Promise<RepairTicket[]>;
  getRepairTicket(id: string): Promise<RepairTicket | undefined>;
  getRepairTicketByNumber(ticketNumber: string): Promise<RepairTicket | undefined>;
  updateRepairTicket(id: string, updates: Partial<InsertRepairTicket>): Promise<RepairTicket | undefined>;
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

  async createOrder(insertOrder: InsertOrder, sessionId: string): Promise<any> {
    const id = randomUUID();
    const orderNumber = `ORD-${String(this.orderCounter).padStart(5, '0')}`;
    this.orderCounter++;
    
    const order = {
      ...insertOrder,
      id,
      sessionId,
      orderNumber,
      createdAt: new Date(),
    };
    this.orders.set(id, order);
    return order;
  }

  async getOrders(): Promise<any[]> {
    return Array.from(this.orders.values());
  }

  async updateOrderStatus(id: string, status: string): Promise<any> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    
    order.status = status;
    this.orders.set(id, order);
    return order;
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
}

import { DrizzleStorage } from "./db-storage";

export const storage = new DrizzleStorage();
