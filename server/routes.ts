import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCartItemSchema, insertOrderSchema, insertUserSchema, insertProductSchema, insertStoreSettingsSchema, insertRepairTicketSchema } from "@shared/schema";
import { z } from "zod";
import { sendOrderConfirmationEmail } from "./utils/email";
import { sendTicketCreatedMessage, sendTicketUpdatedMessage } from "./whatsapp";
import bcrypt from "bcrypt";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize default admin technician
  await storage.initializeDefaultTechnician();

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

  const httpServer = createServer(app);

  return httpServer;
}
