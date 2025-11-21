import { type Product, type InsertProduct, type CartItemRecord, type InsertCartItem } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductsByCategory(category: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  getCategories(): Promise<string[]>;
  getCartItems(): Promise<CartItemRecord[]>;
  addToCart(item: InsertCartItem): Promise<CartItemRecord>;
  updateCartItemQuantity(id: string, quantity: number): Promise<CartItemRecord | undefined>;
  removeFromCart(id: string): Promise<void>;
  clearCart(): Promise<void>;
}

export class MemStorage implements IStorage {
  private products: Map<string, Product>;
  private cartItems: Map<string, CartItemRecord>;

  constructor() {
    this.products = new Map();
    this.cartItems = new Map();
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
      this.products.set(id, { ...product, id });
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
    const product: Product = { ...insertProduct, id };
    this.products.set(id, product);
    return product;
  }

  async getCategories(): Promise<string[]> {
    const categories = new Set<string>();
    for (const product of this.products.values()) {
      categories.add(product.category);
    }
    return Array.from(categories);
  }

  async getCartItems(): Promise<CartItemRecord[]> {
    return Array.from(this.cartItems.values());
  }

  async addToCart(insertItem: InsertCartItem): Promise<CartItemRecord> {
    const existing = Array.from(this.cartItems.values()).find(
      (item) => item.productId === insertItem.productId
    );

    if (existing) {
      existing.quantity += insertItem.quantity;
      this.cartItems.set(existing.id, existing);
      return existing;
    }

    const id = randomUUID();
    const cartItem: CartItemRecord = { ...insertItem, id };
    this.cartItems.set(id, cartItem);
    return cartItem;
  }

  async updateCartItemQuantity(id: string, quantity: number): Promise<CartItemRecord | undefined> {
    const item = this.cartItems.get(id);
    if (!item) return undefined;

    item.quantity = quantity;
    this.cartItems.set(id, item);
    return item;
  }

  async removeFromCart(id: string): Promise<void> {
    this.cartItems.delete(id);
  }

  async clearCart(): Promise<void> {
    this.cartItems.clear();
  }
}

export const storage = new MemStorage();
