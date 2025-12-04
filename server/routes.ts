import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCartItemSchema, insertOrderSchema, insertUserSchema, insertProductSchema, insertStoreSettingsSchema, insertRepairTicketSchema, insertAdminUserSchema } from "@shared/schema";
import { z } from "zod";
import { sendOrderConfirmationEmail } from "./utils/email";
import { sendTicketCreatedMessage, sendTicketUpdatedMessage } from "./whatsapp";
import bcrypt from "bcrypt";
import { adminNotifications } from "./admin-notifications";
import { zaincash } from "./zaincash";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Initialize WebSocket server for admin notifications
  adminNotifications.initialize(httpServer);
  
  // Initialize default admin technician and admin user
  await storage.initializeDefaultTechnician();
  await storage.initializeDefaultAdmin();

  // Admin Authentication Routes
  app.post("/api/admin/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      }
      
      const admin = await storage.getAdminUserByUsername(username);
      if (!admin) {
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
      
      const validPassword = await bcrypt.compare(password, admin.password);
      if (!validPassword) {
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
      
      // Set admin session
      (req.session as any).adminId = admin.id;
      (req.session as any).adminUsername = admin.username;
      
      return res.json({ 
        success: true, 
        admin: { 
          id: admin.id, 
          username: admin.username, 
          name: admin.name, 
          role: admin.role 
        } 
      });
    } catch (error) {
      console.error("Admin login error:", error);
      return res.status(500).json({ error: "فشل تسجيل الدخول" });
    }
  });

  app.post("/api/admin/auth/logout", async (req, res) => {
    try {
      delete (req.session as any).adminId;
      delete (req.session as any).adminUsername;
      return res.json({ success: true });
    } catch (error) {
      console.error("Admin logout error:", error);
      return res.status(500).json({ error: "فشل تسجيل الخروج" });
    }
  });

  app.get("/api/admin/auth/me", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مسجل الدخول" });
      }
      
      const admin = await storage.getAdminUser(adminId);
      if (!admin) {
        return res.status(401).json({ error: "المستخدم غير موجود" });
      }
      
      return res.json({ 
        id: admin.id, 
        username: admin.username, 
        name: admin.name, 
        role: admin.role 
      });
    } catch (error) {
      console.error("Admin auth check error:", error);
      return res.status(500).json({ error: "فشل التحقق من المستخدم" });
    }
  });

  // Admin User Management Routes
  app.get("/api/admin/users", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const admins = await storage.getAdminUsers();
      // Don't send passwords
      const sanitizedAdmins = admins.map(a => ({
        id: a.id,
        username: a.username,
        name: a.name,
        role: a.role,
        createdAt: a.createdAt,
      }));
      
      return res.json(sanitizedAdmins);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      return res.status(500).json({ error: "فشل جلب المستخدمين" });
    }
  });

  app.post("/api/admin/users", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const validatedData = insertAdminUserSchema.parse(req.body);
      
      // Check if username already exists
      const existing = await storage.getAdminUserByUsername(validatedData.username);
      if (existing) {
        return res.status(400).json({ error: "اسم المستخدم موجود بالفعل" });
      }
      
      const admin = await storage.createAdminUser(validatedData);
      
      return res.json({ 
        id: admin.id, 
        username: admin.username, 
        name: admin.name, 
        role: admin.role,
        createdAt: admin.createdAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error creating admin user:", error);
      return res.status(500).json({ error: "فشل إنشاء المستخدم" });
    }
  });

  app.put("/api/admin/users/:id", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { id } = req.params;
      const updates = req.body;
      
      // If changing username, check if it already exists
      if (updates.username) {
        const existing = await storage.getAdminUserByUsername(updates.username);
        if (existing && existing.id !== id) {
          return res.status(400).json({ error: "اسم المستخدم موجود بالفعل" });
        }
      }
      
      const admin = await storage.updateAdminUser(id, updates);
      if (!admin) {
        return res.status(404).json({ error: "المستخدم غير موجود" });
      }
      
      return res.json({ 
        id: admin.id, 
        username: admin.username, 
        name: admin.name, 
        role: admin.role,
        createdAt: admin.createdAt,
      });
    } catch (error) {
      console.error("Error updating admin user:", error);
      return res.status(500).json({ error: "فشل تحديث المستخدم" });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { id } = req.params;
      
      // Prevent deleting yourself
      if (id === adminId) {
        return res.status(400).json({ error: "لا يمكنك حذف حسابك الخاص" });
      }
      
      await storage.deleteAdminUser(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting admin user:", error);
      return res.status(500).json({ error: "فشل حذف المستخدم" });
    }
  });

  app.put("/api/admin/auth/change-password", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "كلمة المرور الحالية والجديدة مطلوبتان" });
      }
      
      if (newPassword.length < 4) {
        return res.status(400).json({ error: "كلمة المرور يجب أن تكون 4 أحرف على الأقل" });
      }
      
      const admin = await storage.getAdminUser(adminId);
      if (!admin) {
        return res.status(404).json({ error: "المستخدم غير موجود" });
      }
      
      const validPassword = await bcrypt.compare(currentPassword, admin.password);
      if (!validPassword) {
        return res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة" });
      }
      
      await storage.updateAdminUser(adminId, { password: newPassword });
      return res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
    } catch (error) {
      console.error("Error changing password:", error);
      return res.status(500).json({ error: "فشل تغيير كلمة المرور" });
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
      const { category, componentType } = req.query;
      
      if (componentType && typeof componentType === 'string') {
        const products = await storage.getProductsByComponentType(componentType);
        return res.json(products);
      }
      
      if (category && typeof category === 'string') {
        const products = await storage.getProductsByCategory(category);
        return res.json(products);
      }
      
      const products = await storage.getProducts();
      return res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      return res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      return res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      return res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      return res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      return res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/admin/products", async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      return res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error creating product:", error);
      return res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.put("/api/admin/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, validatedData);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      return res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating product:", error);
      return res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/admin/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProduct(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting product:", error);
      return res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Default footer links
  const defaultFooterLinks = [
    {
      id: "quick-links",
      titleAr: "روابط سريعة",
      titleEn: "Quick Links",
      links: [
        { id: "about", labelAr: "من نحن", labelEn: "About Us", url: "/about", isExternal: false },
        { id: "contact", labelAr: "اتصل بنا", labelEn: "Contact Us", url: "/contact", isExternal: false },
        { id: "branches", labelAr: "فروعنا", labelEn: "Our Branches", url: "/branches", isExternal: false },
        { id: "careers", labelAr: "وظائف", labelEn: "Careers", url: "/careers", isExternal: false },
      ]
    },
    {
      id: "customer-service",
      titleAr: "خدمة العملاء",
      titleEn: "Customer Service",
      links: [
        { id: "shipping", labelAr: "الشحن والتوصيل", labelEn: "Shipping & Delivery", url: "/shipping", isExternal: false },
        { id: "returns", labelAr: "الإرجاع والاستبدال", labelEn: "Returns & Exchange", url: "/returns", isExternal: false },
        { id: "warranty", labelAr: "الضمان", labelEn: "Warranty", url: "/warranty", isExternal: false },
        { id: "faq", labelAr: "الأسئلة الشائعة", labelEn: "FAQ", url: "/faq", isExternal: false },
      ]
    }
  ];

  app.get("/api/store-settings", async (req, res) => {
    try {
      const settings = await storage.getStoreSettings();
      
      if (!settings) {
        return res.status(404).json({ error: "Store settings not found" });
      }
      
      // Return settings with default footer links if none are set
      const settingsWithDefaults = {
        ...settings,
        footerLinks: settings.footerLinks || defaultFooterLinks
      };
      
      return res.json(settingsWithDefaults);
    } catch (error) {
      console.error("Error fetching store settings:", error);
      return res.status(500).json({ error: "Failed to fetch store settings" });
    }
  });

  app.put("/api/admin/store-settings", async (req, res) => {
    try {
      const validatedData = insertStoreSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateStoreSettings(validatedData);
      return res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating store settings:", error);
      return res.status(500).json({ error: "Failed to update store settings" });
    }
  });

  app.post("/api/announcement-dismiss", async (req, res) => {
    try {
      const settings = await storage.getStoreSettings();
      if (settings) {
        const currentCount = settings.announcementDismissCount || 0;
        await storage.updateStoreSettings({ announcementDismissCount: currentCount + 1 });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error("Error incrementing dismiss count:", error);
      return res.status(500).json({ error: "Failed to increment dismiss count" });
    }
  });

  app.post("/api/admin/reset-announcement-dismiss-count", async (req, res) => {
    try {
      await storage.updateStoreSettings({ announcementDismissCount: 0 });
      return res.json({ success: true });
    } catch (error) {
      console.error("Error resetting dismiss count:", error);
      return res.status(500).json({ error: "Failed to reset dismiss count" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const registerSchema = insertUserSchema.extend({
        email: z.string().email("البريد الإلكتروني غير صحيح"),
        password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
        name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
        phone: z.string().min(10, "رقم الهاتف يجب أن يكون 10 أرقام على الأقل"),
      });

      const validatedData = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ error: "البريد الإلكتروني مستخدم بالفعل" });
      }

      const user = await storage.createUser(validatedData);
      
      req.session.userId = user.id;
      
      return new Promise((resolve) => {
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
          }
          const { password: _, ...userWithoutPassword } = user;
          resolve(res.json(userWithoutPassword));
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error registering user:", error);
      return res.status(500).json({ error: "خطأ في إنشاء الحساب" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const loginSchema = z.object({
        email: z.string().email("البريد الإلكتروني غير صحيح"),
        password: z.string().min(1, "كلمة المرور مطلوبة"),
      });

      const validatedData = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(validatedData.email);
      if (!user) {
        return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      }

      const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      }

      req.session.userId = user.id;
      
      return new Promise((resolve) => {
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
          }
          const { password: _, ...userWithoutPassword } = user;
          resolve(res.json(userWithoutPassword));
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error logging in:", error);
      return res.status(500).json({ error: "خطأ في تسجيل الدخول" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error logging out:", err);
        return res.status(500).json({ error: "خطأ في تسجيل الخروج" });
      }
      res.clearCookie('connect.sid');
      return res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "غير مسجل الدخول" });
      }

      const user = await storage.getUserById(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "المستخدم غير موجود" });
      }

      const { password: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching current user:", error);
      return res.status(500).json({ error: "خطأ في جلب بيانات المستخدم" });
    }
  });

  app.get("/api/cart", async (req, res) => {
    try {
      const sessionId = req.session.id;
      const cartItems = await storage.getCartItems(sessionId);
      const itemsWithProducts = await Promise.all(
        cartItems.map(async (item) => {
          const product = await storage.getProduct(item.productId);
          return product ? { product, quantity: item.quantity, id: item.id } : null;
        })
      );
      
      const validItems = itemsWithProducts.filter((item): item is { product: any; quantity: number; id: string } => item !== null);
      return res.json(validItems);
    } catch (error) {
      console.error("Error fetching cart:", error);
      return res.status(500).json({ error: "Failed to fetch cart" });
    }
  });

  app.post("/api/cart", async (req, res) => {
    try {
      const validatedData = insertCartItemSchema.parse(req.body);
      const product = await storage.getProduct(validatedData.productId);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      req.session.cartInitialized = true;
      
      return new Promise((resolve, reject) => {
        req.session.save(async (err) => {
          if (err) {
            console.error("Session save error:", err);
            reject(err);
            return;
          }
          
          try {
            const sessionId = req.session.id;
            const cartItem = await storage.addToCart(sessionId, validatedData);
            resolve(res.json({ ...cartItem, product }));
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error("Error adding to cart:", error);
      return res.status(500).json({ error: "Failed to add to cart" });
    }
  });

  // Batch add to cart for PC Builder
  app.post("/api/cart/batch", async (req, res) => {
    try {
      const batchSchema = z.object({
        items: z.array(z.object({
          productId: z.string(),
          quantity: z.number().int().min(1).default(1),
        })),
      });
      
      const { items } = batchSchema.parse(req.body);
      
      // Validate all products exist
      const productIds = items.map(item => item.productId);
      const products = await Promise.all(productIds.map(id => storage.getProduct(id)));
      
      const missingProducts = productIds.filter((id, index) => !products[index]);
      if (missingProducts.length > 0) {
        return res.status(404).json({ error: "Some products not found", missingProducts });
      }

      req.session.cartInitialized = true;
      
      return new Promise((resolve, reject) => {
        req.session.save(async (err) => {
          if (err) {
            console.error("Session save error:", err);
            reject(err);
            return;
          }
          
          try {
            const sessionId = req.session.id;
            const results = await Promise.all(
              items.map(item => storage.addToCart(sessionId, { productId: item.productId, quantity: item.quantity }))
            );
            resolve(res.json({ success: true, addedItems: results.length }));
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      console.error("Error batch adding to cart:", error);
      return res.status(500).json({ error: "Failed to add items to cart" });
    }
  });

  app.patch("/api/cart/:id", async (req, res) => {
    try {
      const sessionId = req.session.id;
      const { id } = req.params;
      
      const quantitySchema = z.object({
        quantity: z.number().int().min(1),
      });
      
      const validatedData = quantitySchema.parse(req.body);
      
      const updatedItem = await storage.updateCartItemQuantity(id, sessionId, validatedData.quantity);
      
      if (!updatedItem) {
        return res.status(404).json({ error: "Cart item not found" });
      }

      const product = await storage.getProduct(updatedItem.productId);
      return res.json({ ...updatedItem, product });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid quantity", details: error.errors });
      }
      console.error("Error updating cart item:", error);
      return res.status(500).json({ error: "Failed to update cart item" });
    }
  });

  app.delete("/api/cart/:id", async (req, res) => {
    try {
      const sessionId = req.session.id;
      const { id } = req.params;
      await storage.removeFromCart(id, sessionId);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error removing from cart:", error);
      return res.status(500).json({ error: "Failed to remove from cart" });
    }
  });

  app.delete("/api/cart", async (req, res) => {
    try {
      const sessionId = req.session.id;
      await storage.clearCart(sessionId);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error clearing cart:", error);
      return res.status(500).json({ error: "Failed to clear cart" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const sessionId = req.session.id;
      const userId = (req.session as any)?.userId;

      console.log("Received order data:", JSON.stringify(req.body, null, 2));
      const validatedData = insertOrderSchema.parse(req.body);
      console.log("Validated order data:", JSON.stringify(validatedData, null, 2));
      
      const order = await storage.createOrder(validatedData, sessionId, userId);
      console.log("Created order:", order.id);
      
      try {
        await storage.clearCart(sessionId);
      } catch (clearError) {
        console.error("Warning: Failed to clear cart after order creation:", clearError);
      }
      
      try {
        const allOrderItems = order.items.map(itemStr => JSON.parse(itemStr));
        const total = Number(order.total);
        
        if (isNaN(total)) {
          throw new Error("Invalid order total");
        }
        
        const itemsWithProducts = await Promise.all(
          allOrderItems.map(async (item: any) => {
            const product = await storage.getProduct(item.productId);
            if (!product) {
              throw new Error(`Product not found: ${item.productId}`);
            }
            const price = Number(item.price);
            if (isNaN(price)) {
              throw new Error(`Invalid price for product ${product.nameAr}`);
            }
            return {
              name: product.nameAr,
              quantity: item.quantity,
              price: price,
            };
          })
        );
        
        const emailData = {
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          customerAddress: order.customerAddress,
          customerCity: order.customerCity,
          customerPostalCode: order.customerPostal,
          items: itemsWithProducts,
          total: total,
        };
        
        await sendOrderConfirmationEmail(emailData);
      } catch (emailError) {
        console.error("Warning: Failed to send order confirmation email:", emailError);
      }
      
      // Broadcast new order notification to admin dashboard
      try {
        adminNotifications.broadcastNewOrder({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          total: order.total,
          createdAt: order.createdAt,
        });
      } catch (notifyError) {
        console.error("Warning: Failed to broadcast order notification:", notifyError);
      }
      
      return res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: "Invalid order data", details: error.errors });
      }
      console.error("Error creating order:", error);
      return res.status(500).json({ error: "Failed to create order", message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/orders", async (req, res) => {
    try {
      const allOrders = await storage.getOrders();
      return res.json(allOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      return res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Public order lookup by order number and phone (no auth required)
  app.post("/api/orders/lookup", async (req, res) => {
    try {
      const { orderNumber, phone } = req.body;
      
      // Validate order number format (ORD-XXXXX)
      if (!orderNumber || !/^ORD-\d{5}$/.test(orderNumber)) {
        return res.status(400).json({ error: "Invalid order number format" });
      }
      
      // Validate phone format (Iraqi: 07XXXXXXXXX - 11 digits starting with 07)
      const normalizedPhone = phone?.replace(/\D/g, '') || '';
      if (!normalizedPhone || normalizedPhone.length !== 11 || !normalizedPhone.startsWith('07')) {
        return res.status(400).json({ error: "Invalid phone number format" });
      }
      
      const order = await storage.lookupOrderByNumberAndPhone(orderNumber, normalizedPhone);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Parse items and fetch product details
      const itemsWithProducts = await Promise.all(
        order.items.map(async (itemStr: string) => {
          const item = JSON.parse(itemStr);
          const product = await storage.getProduct(item.productId);
          return {
            ...item,
            product: product || { nameAr: 'منتج غير متوفر', nameEn: 'Product unavailable' }
          };
        })
      );
      
      // Return order without sensitive fields (sessionId)
      const { sessionId, ...safeOrder } = order;
      return res.json({ ...safeOrder, itemsWithProducts });
    } catch (error) {
      console.error("Error looking up order:", error);
      return res.status(500).json({ error: "Failed to lookup order" });
    }
  });

  // Get orders for the authenticated user
  app.get("/api/orders/my-orders", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const userOrders = await storage.getOrdersByUserId(userId);
      
      // Enrich orders with product details
      const ordersWithProducts = await Promise.all(
        userOrders.map(async (order) => {
          const itemsWithProducts = await Promise.all(
            order.items.map(async (itemStr: string) => {
              const item = JSON.parse(itemStr);
              const product = await storage.getProduct(item.productId);
              return {
                ...item,
                product: product || { nameAr: 'منتج غير متوفر', nameEn: 'Product unavailable' }
              };
            })
          );
          const { sessionId, ...safeOrder } = order;
          return { ...safeOrder, itemsWithProducts };
        })
      );
      
      return res.json(ordersWithProducts);
    } catch (error) {
      console.error("Error fetching user orders:", error);
      return res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/by-number/:orderNumber", async (req, res) => {
    try {
      const { orderNumber } = req.params;
      const order = await storage.getOrderByNumber(orderNumber);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Parse items and fetch product details
      const itemsWithProducts = await Promise.all(
        order.items.map(async (itemStr: string) => {
          const item = JSON.parse(itemStr);
          const product = await storage.getProduct(item.productId);
          return {
            ...item,
            product: product || { nameAr: 'منتج غير متوفر', nameEn: 'Product unavailable' }
          };
        })
      );
      
      return res.json({ ...order, itemsWithProducts });
    } catch (error) {
      console.error("Error fetching order:", error);
      return res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updated = await storage.updateOrderStatus(id, status);
      if (!updated) {
        return res.status(404).json({ error: "Order not found" });
      }
      return res.json(updated);
    } catch (error) {
      console.error("Error updating order:", error);
      return res.status(500).json({ error: "Failed to update order" });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteOrder(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting order:", error);
      return res.status(500).json({ error: "Failed to delete order" });
    }
  });

  // ==================== Zain Cash Payment Routes ====================
  
  // Check if Zain Cash is configured
  app.get("/api/zaincash/config", async (req, res) => {
    try {
      const config = zaincash.getConfig();
      return res.json(config);
    } catch (error) {
      console.error("Error checking Zain Cash config:", error);
      return res.status(500).json({ error: "Failed to check Zain Cash configuration" });
    }
  });

  // Initialize Zain Cash payment for an order
  app.post("/api/zaincash/init", async (req, res) => {
    try {
      const { orderId } = req.body;
      
      if (!orderId) {
        return res.status(400).json({ error: "Order ID is required" });
      }
      
      // Get the order
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Check if order payment method is zaincash
      if (order.paymentMethod !== 'zaincash') {
        return res.status(400).json({ error: "Order payment method is not Zain Cash" });
      }
      
      // Build redirect URL
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['host'];
      const redirectUrl = `${protocol}://${host}/payment/zaincash/callback`;
      
      // Initialize transaction
      const result = await zaincash.initTransaction({
        amount: Math.round(parseFloat(order.total)),
        orderId: order.orderNumber,
        serviceType: 'العين لتجارة الحاسبات - طلب رقم ' + order.orderNumber,
        redirectUrl: redirectUrl,
      });
      
      if (!result.success) {
        console.error("Zain Cash init failed:", result.error);
        return res.status(500).json({ error: result.error || "Failed to initialize payment" });
      }
      
      // Update order with transaction ID
      await storage.updateOrderPaymentInfo(order.id, {
        zaincashTransactionId: result.transactionId,
        paymentStatus: 'pending',
      });
      
      return res.json({
        success: true,
        paymentUrl: result.paymentUrl,
        transactionId: result.transactionId,
      });
    } catch (error) {
      console.error("Error initializing Zain Cash payment:", error);
      return res.status(500).json({ error: "Failed to initialize payment" });
    }
  });

  // Zain Cash callback handler (called by Zain Cash after payment)
  app.get("/api/zaincash/callback", async (req, res) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        console.error("Zain Cash callback: No token received");
        return res.redirect('/payment/zaincash/callback?status=error&msg=no_token');
      }
      
      // Verify the callback token
      const callbackData = zaincash.verifyCallback(token);
      
      if (!callbackData) {
        console.error("Zain Cash callback: Invalid token");
        return res.redirect('/payment/zaincash/callback?status=error&msg=invalid_token');
      }
      
      console.log("Zain Cash callback data:", callbackData);
      
      // Get the order by order number
      const order = await storage.getOrderByNumber(callbackData.orderId);
      
      if (!order) {
        console.error("Zain Cash callback: Order not found:", callbackData.orderId);
        return res.redirect('/payment/zaincash/callback?status=error&msg=order_not_found');
      }
      
      // Update order based on payment status
      const paymentStatus = callbackData.status;
      let orderStatus = order.status;
      
      if (paymentStatus === 'success' || paymentStatus === 'completed') {
        orderStatus = 'processing';
        
        // Broadcast notification to admins
        adminNotifications.broadcastNewOrder({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          total: order.total,
          createdAt: order.createdAt,
        });
        
        // Send confirmation email
        try {
          const allOrderItems = order.items.map(itemStr => JSON.parse(itemStr));
          const itemsWithProducts = await Promise.all(
            allOrderItems.map(async (item: any) => {
              const product = await storage.getProduct(item.productId);
              return {
                name: product?.nameAr || 'منتج',
                quantity: item.quantity,
                price: Number(item.price),
              };
            })
          );
          
          await sendOrderConfirmationEmail({
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            customerPhone: order.customerPhone,
            customerAddress: order.customerAddress,
            customerCity: order.customerCity,
            customerPostalCode: order.customerPostal,
            items: itemsWithProducts,
            total: Number(order.total),
          });
        } catch (emailError) {
          console.error("Failed to send confirmation email:", emailError);
        }
      } else if (paymentStatus === 'failed') {
        orderStatus = 'payment_failed';
      }
      
      // Update order with payment status
      await storage.updateOrderPaymentInfo(order.id, {
        paymentStatus: paymentStatus,
        zaincashTransactionId: callbackData.transactionId,
      });
      
      if (orderStatus !== order.status) {
        await storage.updateOrderStatus(order.id, orderStatus);
      }
      
      // Redirect to frontend callback page
      return res.redirect(`/payment/zaincash/callback?status=${paymentStatus}&order=${order.orderNumber}`);
    } catch (error) {
      console.error("Error handling Zain Cash callback:", error);
      return res.redirect('/payment/zaincash/callback?status=error&msg=internal_error');
    }
  });

  // Check payment status for an order
  app.get("/api/zaincash/status/:orderNumber", async (req, res) => {
    try {
      const { orderNumber } = req.params;
      const order = await storage.getOrderByNumber(orderNumber);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      return res.json({
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        paymentStatus: (order as any).paymentStatus || 'pending',
        orderStatus: order.status,
      });
    } catch (error) {
      console.error("Error checking payment status:", error);
      return res.status(500).json({ error: "Failed to check payment status" });
    }
  });

  // ==================== End Zain Cash Routes ====================

  app.post("/api/repair-tickets", async (req, res) => {
    try {
      const validatedData = insertRepairTicketSchema.parse(req.body);
      const ticket = await storage.createRepairTicket(validatedData);
      
      // Send WhatsApp notification (non-blocking)
      sendTicketCreatedMessage(
        ticket.customerPhone,
        ticket.customerName,
        ticket.ticketNumber,
        ticket.deviceType,
        ticket.deviceBrand
      ).catch(err => console.error('WhatsApp notification failed:', err));
      
      return res.json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error creating repair ticket:", error);
      return res.status(500).json({ error: "Failed to create repair ticket" });
    }
  });

  app.get("/api/repair-tickets", async (req, res) => {
    try {
      const tickets = await storage.getRepairTickets();
      return res.json(tickets);
    } catch (error) {
      console.error("Error fetching repair tickets:", error);
      return res.status(500).json({ error: "Failed to fetch repair tickets" });
    }
  });

  app.get("/api/repair-tickets/lookup/phone/:phone", async (req, res) => {
    try {
      const { phone } = req.params;
      const ticket = await storage.getRepairTicketByPhone(phone);
      
      if (!ticket) {
        return res.status(404).json({ error: "Repair ticket not found" });
      }
      
      return res.json(ticket);
    } catch (error) {
      console.error("Error looking up repair ticket by phone:", error);
      return res.status(500).json({ error: "Failed to lookup repair ticket" });
    }
  });

  app.get("/api/repair-tickets/lookup/:ticketNumber", async (req, res) => {
    try {
      const { ticketNumber } = req.params;
      const ticket = await storage.getRepairTicketByNumber(ticketNumber);
      
      if (!ticket) {
        return res.status(404).json({ error: "Repair ticket not found" });
      }
      
      return res.json(ticket);
    } catch (error) {
      console.error("Error looking up repair ticket:", error);
      return res.status(500).json({ error: "Failed to lookup repair ticket" });
    }
  });

  app.get("/api/repair-tickets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const ticket = await storage.getRepairTicket(id);
      
      if (!ticket) {
        return res.status(404).json({ error: "Repair ticket not found" });
      }
      
      return res.json(ticket);
    } catch (error) {
      console.error("Error fetching repair ticket:", error);
      return res.status(500).json({ error: "Failed to fetch repair ticket" });
    }
  });

  app.patch("/api/admin/repair-tickets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Build update object with only the fields that are being updated
      const updateData: Record<string, any> = {};
      
      if (req.body.status !== undefined) {
        updateData.status = req.body.status;
      }
      if (req.body.priority !== undefined) {
        updateData.priority = req.body.priority;
      }
      if (req.body.technicianNotes !== undefined) {
        updateData.technicianNotes = req.body.technicianNotes || '';
      }
      if (req.body.estimatedCompletion !== undefined) {
        updateData.estimatedCompletion = req.body.estimatedCompletion ? new Date(req.body.estimatedCompletion) : null;
      }
      if (req.body.costEstimate !== undefined) {
        updateData.costEstimate = req.body.costEstimate && req.body.costEstimate !== '' ? req.body.costEstimate : null;
      }
      if (req.body.finalCost !== undefined) {
        updateData.finalCost = req.body.finalCost && req.body.finalCost !== '' ? req.body.finalCost : null;
      }
      
      const ticket = await storage.updateRepairTicket(id, updateData);
      
      if (!ticket) {
        return res.status(404).json({ error: "Repair ticket not found" });
      }
      
      // Send WhatsApp update notification (non-blocking)
      sendTicketUpdatedMessage(
        ticket.customerPhone,
        ticket.customerName,
        ticket.ticketNumber,
        ticket.status,
        ticket.technicianNotes,
        ticket.costEstimate,
        ticket.finalCost
      ).catch(err => console.error('WhatsApp update notification failed:', err));
      
      return res.json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating repair ticket:", error);
      return res.status(500).json({ error: "Failed to update repair ticket" });
    }
  });

  app.delete("/api/admin/repair-tickets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteRepairTicket(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting repair ticket:", error);
      return res.status(500).json({ error: "Failed to delete repair ticket" });
    }
  });

  // ===============================
  // Technician Auth Routes
  // ===============================

  app.post("/api/technician/auth/login", async (req, res) => {
    try {
      const loginSchema = z.object({
        username: z.string().min(1, "اسم المستخدم مطلوب"),
        password: z.string().min(1, "كلمة المرور مطلوبة"),
      });

      const validatedData = loginSchema.parse(req.body);
      
      const technician = await storage.getTechnicianByUsername(validatedData.username);
      if (!technician) {
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      if (!technician.isActive) {
        return res.status(401).json({ error: "هذا الحساب معطل" });
      }

      const isPasswordValid = await bcrypt.compare(validatedData.password, technician.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      // Store technician session
      (req.session as any).technicianId = technician.id;
      (req.session as any).technicianUsername = technician.username;
      (req.session as any).technicianIsAdmin = technician.isAdmin;
      (req.session as any).technicianPermissions = technician.permissions;
      
      return new Promise((resolve) => {
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
          }
          const { password: _, ...technicianWithoutPassword } = technician;
          resolve(res.json(technicianWithoutPassword));
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error logging in technician:", error);
      return res.status(500).json({ error: "خطأ في تسجيل الدخول" });
    }
  });

  app.post("/api/technician/auth/logout", async (req, res) => {
    // Only clear technician-related session data
    delete (req.session as any).technicianId;
    delete (req.session as any).technicianUsername;
    delete (req.session as any).technicianIsAdmin;
    delete (req.session as any).technicianPermissions;
    
    return new Promise((resolve) => {
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
        }
        resolve(res.json({ success: true }));
      });
    });
  });

  app.get("/api/technician/auth/me", async (req, res) => {
    try {
      const technicianId = (req.session as any)?.technicianId;
      
      if (!technicianId) {
        return res.status(401).json({ error: "غير مسجل الدخول" });
      }

      const technician = await storage.getTechnician(technicianId);
      if (!technician) {
        return res.status(401).json({ error: "الفني غير موجود" });
      }

      if (!technician.isActive) {
        return res.status(401).json({ error: "هذا الحساب معطل" });
      }

      const { password: _, ...technicianWithoutPassword } = technician;
      return res.json(technicianWithoutPassword);
    } catch (error) {
      console.error("Error fetching current technician:", error);
      return res.status(500).json({ error: "خطأ في جلب بيانات الفني" });
    }
  });

  // ===============================
  // Technician Management Routes (Admin only)
  // ===============================

  // Middleware to check if user is technician admin
  const requireTechnicianAdmin = (req: any, res: any, next: any) => {
    const technicianId = req.session?.technicianId;
    const isAdmin = req.session?.technicianIsAdmin;
    
    if (!technicianId || !isAdmin) {
      return res.status(403).json({ error: "غير مصرح لك بالوصول" });
    }
    next();
  };

  app.get("/api/admin/technicians", requireTechnicianAdmin, async (req, res) => {
    try {
      const technicians = await storage.getTechnicians();
      // Remove passwords from response
      const techsWithoutPasswords = technicians.map(t => {
        const { password: _, ...tech } = t;
        return tech;
      });
      return res.json(techsWithoutPasswords);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      return res.status(500).json({ error: "Failed to fetch technicians" });
    }
  });

  app.post("/api/admin/technicians", requireTechnicianAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        username: z.string().min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"),
        password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
        displayName: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
        isAdmin: z.boolean().optional().default(false),
        permissions: z.array(z.string()).optional().default([]),
      });

      const validatedData = createSchema.parse(req.body);
      
      // Check if username already exists
      const existing = await storage.getTechnicianByUsername(validatedData.username);
      if (existing) {
        return res.status(400).json({ error: "اسم المستخدم مستخدم بالفعل" });
      }

      // Convert boolean to number for database
      const dbData = {
        ...validatedData,
        isAdmin: validatedData.isAdmin ? 1 : 0,
      };

      const technician = await storage.createTechnician(dbData);
      const { password: _, ...techWithoutPassword } = technician;
      return res.json(techWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error creating technician:", error);
      return res.status(500).json({ error: "Failed to create technician" });
    }
  });

  app.patch("/api/admin/technicians/:id", requireTechnicianAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const updateSchema = z.object({
        username: z.string().min(3).optional(),
        password: z.string().min(6).optional(),
        displayName: z.string().min(2).optional(),
        isAdmin: z.boolean().optional(),
        isActive: z.boolean().optional(),
        permissions: z.array(z.string()).optional(),
      });

      const validatedData = updateSchema.parse(req.body);
      
      // If updating username, check it doesn't conflict with another user
      if (validatedData.username) {
        const existing = await storage.getTechnicianByUsername(validatedData.username);
        if (existing && existing.id !== id) {
          return res.status(400).json({ error: "اسم المستخدم مستخدم بالفعل" });
        }
      }

      // Convert booleans to numbers for database
      const dbData: any = { ...validatedData };
      if (validatedData.isAdmin !== undefined) {
        dbData.isAdmin = validatedData.isAdmin ? 1 : 0;
      }
      if (validatedData.isActive !== undefined) {
        dbData.isActive = validatedData.isActive ? 1 : 0;
      }

      const technician = await storage.updateTechnician(id, dbData);
      
      if (!technician) {
        return res.status(404).json({ error: "الفني غير موجود" });
      }

      const { password: _, ...techWithoutPassword } = technician;
      return res.json(techWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating technician:", error);
      return res.status(500).json({ error: "Failed to update technician" });
    }
  });

  app.delete("/api/admin/technicians/:id", requireTechnicianAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const currentTechnicianId = (req.session as any)?.technicianId;
      
      // Prevent deleting yourself
      if (id === currentTechnicianId) {
        return res.status(400).json({ error: "لا يمكنك حذف حسابك الخاص" });
      }
      
      await storage.deleteTechnician(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting technician:", error);
      return res.status(500).json({ error: "Failed to delete technician" });
    }
  });

  // ===============================
  // Customer Management Routes (Admin panel)
  // ===============================
  
  app.get("/api/admin/customers", async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Remove passwords from response
      const usersWithoutPasswords = users.map(u => {
        const { password: _, ...user } = u;
        return user;
      });
      return res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error fetching customers:", error);
      return res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/admin/customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUserById(id);
      
      if (!user) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      const { password: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching customer:", error);
      return res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.patch("/api/admin/customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const updateSchema = z.object({
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        phone: z.string().min(10).optional(),
        password: z.string().min(6).optional(),
      });

      const validatedData = updateSchema.parse(req.body);
      
      // If updating email, check it doesn't conflict with another user
      if (validatedData.email) {
        const existing = await storage.getUserByEmail(validatedData.email);
        if (existing && existing.id !== id) {
          return res.status(400).json({ error: "البريد الإلكتروني مستخدم بالفعل" });
        }
      }

      const user = await storage.updateUser(id, validatedData);
      
      if (!user) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const { password: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating customer:", error);
      return res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.delete("/api/admin/customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUser(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting customer:", error);
      return res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  return httpServer;
}
