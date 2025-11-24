import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCartItemSchema, insertOrderSchema, insertUserSchema, insertProductSchema, insertStoreSettingsSchema, insertRepairTicketSchema } from "@shared/schema";
import { z } from "zod";
import { sendOrderConfirmationEmail } from "./utils/email";
import bcrypt from "bcrypt";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/products", async (req, res) => {
    try {
      const { category } = req.query;
      
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

  app.get("/api/store-settings", async (req, res) => {
    try {
      const settings = await storage.getStoreSettings();
      
      if (!settings) {
        return res.status(404).json({ error: "Store settings not found" });
      }
      
      return res.json(settings);
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
      
      const { password: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
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
      
      const { password: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
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
      const cartItems = await storage.getCartItems();
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

      const cartItem = await storage.addToCart(validatedData);
      return res.json({ ...cartItem, product });
    } catch (error) {
      console.error("Error adding to cart:", error);
      return res.status(500).json({ error: "Failed to add to cart" });
    }
  });

  app.patch("/api/cart/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const quantitySchema = z.object({
        quantity: z.number().int().min(1),
      });
      
      const validatedData = quantitySchema.parse(req.body);
      
      const updatedItem = await storage.updateCartItemQuantity(id, validatedData.quantity);
      
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
      const { id } = req.params;
      await storage.removeFromCart(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error removing from cart:", error);
      return res.status(500).json({ error: "Failed to remove from cart" });
    }
  });

  app.delete("/api/cart", async (req, res) => {
    try {
      await storage.clearCart();
      return res.json({ success: true });
    } catch (error) {
      console.error("Error clearing cart:", error);
      return res.status(500).json({ error: "Failed to clear cart" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "يجب تسجيل الدخول لإكمال الطلب" });
      }

      console.log("Received order data:", JSON.stringify(req.body, null, 2));
      const validatedData = insertOrderSchema.parse(req.body);
      console.log("Validated order data:", JSON.stringify(validatedData, null, 2));
      
      const order = await storage.createOrder(validatedData, req.session.userId);
      console.log("Created order:", order.id);
      
      try {
        await storage.clearCart();
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

  app.patch("/api/admin/repair-tickets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertRepairTicketSchema.partial().parse(req.body);
      const ticket = await storage.updateRepairTicket(id, validatedData);
      
      if (!ticket) {
        return res.status(404).json({ error: "Repair ticket not found" });
      }
      
      return res.json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating repair ticket:", error);
      return res.status(500).json({ error: "Failed to update repair ticket" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
