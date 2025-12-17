import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCartItemSchema, insertOrderSchema, insertUserSchema, insertProductSchema, insertStoreSettingsSchema, insertRepairTicketSchema, insertAdminUserSchema, insertMarketPriceSchema, insertExternalPriceSourceSchema, insertExchangeRateSchema, orders, heldOrders, salesShifts } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte } from "drizzle-orm";
import { z } from "zod";
import { sendOrderConfirmationEmail } from "./utils/email";
import { sendTicketCreatedMessage, sendTicketUpdatedMessage } from "./whatsapp";
import bcrypt from "bcrypt";
import { adminNotifications } from "./admin-notifications";
import { zaincash } from "./zaincash";
import { qicard } from "./qicard";
import Papa from "papaparse";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Initialize WebSocket server for admin notifications
  adminNotifications.initialize(httpServer);
  
  // Initialize default admin technician, admin user, and sales admin
  await storage.initializeDefaultTechnician();
  await storage.initializeDefaultAdmin();
  await storage.initializeDefaultSalesAdmin();

  // Serve uploaded images with no-cache headers to ensure fresh images
  app.use("/uploads", (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  }, (await import("express")).default.static(uploadDir));

  // Image upload route (admin only)
  app.post("/api/upload/image", (req, res, next) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  }, (req, res, next) => {
    imageUpload.single("image")(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: "File too large. Maximum size is 5MB" });
        }
        if (err.message === 'Invalid file type') {
          return res.status(400).json({ error: "Invalid file type. Use JPG, PNG, GIF, or WebP" });
        }
        return res.status(400).json({ error: err.message || "Upload failed" });
      }
      next();
    });
  }, (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const url = `/uploads/${req.file.filename}`;
    return res.json({ url, filename: req.file.filename });
  });

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

  // Sales Portal Authentication Routes
  app.post("/api/sales/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      }
      
      const salesUser = await storage.getSalesUserByUsername(username);
      if (!salesUser) {
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
      
      if (!salesUser.isActive) {
        return res.status(401).json({ error: "الحساب غير نشط" });
      }
      
      const validPassword = await bcrypt.compare(password, salesUser.password);
      if (!validPassword) {
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
      
      // Set sales session
      (req.session as any).salesUserId = salesUser.id;
      (req.session as any).salesUsername = salesUser.username;
      
      return res.json({ 
        success: true, 
        user: { 
          id: salesUser.id, 
          username: salesUser.username, 
          name: salesUser.name, 
          role: salesUser.role,
          permissions: {
            canPos: salesUser.canPos,
            canInventory: salesUser.canInventory,
            canManageUsers: salesUser.canManageUsers,
            canViewReports: salesUser.canViewReports,
            canApplyDiscount: salesUser.canApplyDiscount,
          }
        } 
      });
    } catch (error) {
      console.error("Sales login error:", error);
      return res.status(500).json({ error: "فشل تسجيل الدخول" });
    }
  });

  app.post("/api/sales/auth/logout", async (req, res) => {
    try {
      delete (req.session as any).salesUserId;
      delete (req.session as any).salesUsername;
      return res.json({ success: true });
    } catch (error) {
      console.error("Sales logout error:", error);
      return res.status(500).json({ error: "فشل تسجيل الخروج" });
    }
  });

  app.get("/api/sales/auth/me", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) {
        return res.status(401).json({ error: "غير مسجل الدخول" });
      }
      
      const salesUser = await storage.getSalesUser(salesUserId);
      if (!salesUser || !salesUser.isActive) {
        return res.status(401).json({ error: "المستخدم غير موجود أو غير نشط" });
      }
      
      return res.json({ 
        id: salesUser.id, 
        username: salesUser.username, 
        name: salesUser.name, 
        role: salesUser.role,
        permissions: {
          canPos: salesUser.canPos,
          canInventory: salesUser.canInventory,
          canManageUsers: salesUser.canManageUsers,
          canViewReports: salesUser.canViewReports,
          canApplyDiscount: salesUser.canApplyDiscount,
        }
      });
    } catch (error) {
      console.error("Sales auth check error:", error);
      return res.status(500).json({ error: "فشل التحقق من المستخدم" });
    }
  });

  // Sales User Management Routes (requires canManageUsers permission)
  app.get("/api/sales/users", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const currentUser = await storage.getSalesUser(salesUserId);
      if (!currentUser || !currentUser.canManageUsers) {
        return res.status(403).json({ error: "ليس لديك صلاحية إدارة المستخدمين" });
      }
      
      const users = await storage.getSalesUsers();
      const sanitizedUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        canPos: u.canPos,
        canInventory: u.canInventory,
        canManageUsers: u.canManageUsers,
        canViewReports: u.canViewReports,
        canApplyDiscount: u.canApplyDiscount,
        isActive: u.isActive,
        createdAt: u.createdAt,
      }));
      
      return res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching sales users:", error);
      return res.status(500).json({ error: "فشل جلب المستخدمين" });
    }
  });

  app.post("/api/sales/users", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const currentUser = await storage.getSalesUser(salesUserId);
      if (!currentUser || !currentUser.canManageUsers) {
        return res.status(403).json({ error: "ليس لديك صلاحية إنشاء مستخدمين" });
      }
      
      const { username, password, name, role, canPos, canInventory, canManageUsers, canViewReports, canApplyDiscount, isActive } = req.body;
      
      if (!username || !password || !name) {
        return res.status(400).json({ error: "اسم المستخدم وكلمة المرور والاسم مطلوبين" });
      }
      
      // Check if username already exists
      const existing = await storage.getSalesUserByUsername(username);
      if (existing) {
        return res.status(400).json({ error: "اسم المستخدم موجود مسبقاً" });
      }
      
      const newUser = await storage.createSalesUser({
        username,
        password,
        name,
        role: role || 'sales',
        canPos: canPos ?? 1,
        canInventory: canInventory ?? 0,
        canManageUsers: canManageUsers ?? 0,
        canViewReports: canViewReports ?? 0,
        canApplyDiscount: canApplyDiscount ?? 0,
        isActive: isActive ?? 1,
        createdBy: salesUserId,
      });
      
      return res.json({
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
      });
    } catch (error) {
      console.error("Error creating sales user:", error);
      return res.status(500).json({ error: "فشل إنشاء المستخدم" });
    }
  });

  app.put("/api/sales/users/:id", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const currentUser = await storage.getSalesUser(salesUserId);
      if (!currentUser || !currentUser.canManageUsers) {
        return res.status(403).json({ error: "ليس لديك صلاحية تعديل المستخدمين" });
      }
      
      const { id } = req.params;
      const updates = req.body;
      
      // Don't allow updating username to existing one
      if (updates.username) {
        const existing = await storage.getSalesUserByUsername(updates.username);
        if (existing && existing.id !== id) {
          return res.status(400).json({ error: "اسم المستخدم موجود مسبقاً" });
        }
      }
      
      const updated = await storage.updateSalesUser(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "المستخدم غير موجود" });
      }
      
      return res.json({
        id: updated.id,
        username: updated.username,
        name: updated.name,
        role: updated.role,
      });
    } catch (error) {
      console.error("Error updating sales user:", error);
      return res.status(500).json({ error: "فشل تعديل المستخدم" });
    }
  });

  app.delete("/api/sales/users/:id", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const currentUser = await storage.getSalesUser(salesUserId);
      if (!currentUser || !currentUser.canManageUsers) {
        return res.status(403).json({ error: "ليس لديك صلاحية حذف المستخدمين" });
      }
      
      const { id } = req.params;
      
      // Prevent deleting self
      if (id === salesUserId) {
        return res.status(400).json({ error: "لا يمكنك حذف حسابك الخاص" });
      }
      
      await storage.deleteSalesUser(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting sales user:", error);
      return res.status(500).json({ error: "فشل حذف المستخدم" });
    }
  });

  // Sales Portal POS endpoint (uses sales session)
  app.post("/api/sales/pos", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const currentUser = await storage.getSalesUser(salesUserId);
      if (!currentUser || !currentUser.canPos) {
        return res.status(403).json({ error: "ليس لديك صلاحية استخدام نقطة البيع" });
      }
      
      const { 
        items, 
        customerName, 
        customerPhone, 
        customerEmail,
        paymentMethod, 
        paymentStatus,
        discount,
        discountReason,
        notes 
      } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: "السلة فارغة" });
      }

      // Validate discount permission
      if (discount && parseFloat(discount) > 0 && !currentUser.canApplyDiscount) {
        return res.status(403).json({ error: "ليس لديك صلاحية تطبيق الخصومات" });
      }

      // Calculate totals
      let subtotal = 0;
      for (const item of items) {
        subtotal += parseFloat(item.price) * item.quantity;
      }
      
      const discountAmount = parseFloat(discount || '0');
      const total = subtotal - discountAmount;

      const orderData = {
        customerName: customerName || 'عميل في المتجر',
        customerEmail: customerEmail || '',
        customerPhone: customerPhone || '',
        customerAddress: 'في المتجر',
        customerCity: 'بغداد',
        customerPostal: '',
        items,
        subtotal: subtotal.toString(),
        shipping: '0',
        total: total.toString(),
        paymentMethod: paymentMethod || 'cash',
        paymentStatus: paymentStatus || 'success',
        status: 'completed',
      };

      const order = await storage.createOrder(orderData, `sales-${Date.now()}`, undefined);

      // Update order with additional POS fields
      await db.update(orders).set({
        orderType: 'walk-in',
        discount: discount || "0",
        discountReason: discountReason || null,
        salespersonId: salesUserId,
        notes: notes || null,
      }).where(eq(orders.id, order.id));

      // Update inventory for each item sold
      for (const item of items) {
        try {
          await storage.adjustProductStock(item.productId, -item.quantity, salesUserId, 'walk-in sale', order.orderNumber);
        } catch (stockError) {
          console.error(`Failed to adjust stock for product ${item.productId}:`, stockError);
        }
      }

      return res.json({ 
        success: true, 
        order: {
          ...order,
          orderType: 'walk-in',
          discount,
          discountReason,
        }
      });
    } catch (error) {
      console.error("Error creating sales POS order:", error);
      return res.status(500).json({ error: "فشل إنشاء الطلب" });
    }
  });

  // Held Orders endpoints for POS hold/recall functionality
  app.get("/api/sales/held-orders", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const heldOrdersList = await db.select().from(heldOrders).orderBy(desc(heldOrders.createdAt));
      return res.json(heldOrdersList);
    } catch (error) {
      console.error("Error fetching held orders:", error);
      return res.status(500).json({ error: "فشل جلب الطلبات المعلقة" });
    }
  });

  // Sales customer lookup endpoint
  app.get("/api/sales/customers", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      // Get all orders and aggregate customer data
      const allOrders = await storage.getOrders();
      
      const customerMap = new Map<string, { phone: string; name: string; orderCount: number; totalSpent: number }>();
      
      for (const order of allOrders) {
        if (order.customerPhone && order.customerPhone.trim() !== '') {
          const existing = customerMap.get(order.customerPhone);
          const orderTotal = parseFloat(order.total?.toString() || '0');
          
          if (existing) {
            existing.orderCount++;
            existing.totalSpent += orderTotal;
          } else {
            customerMap.set(order.customerPhone, {
              phone: order.customerPhone,
              name: order.customerName || '',
              orderCount: 1,
              totalSpent: orderTotal,
            });
          }
        }
      }
      
      // Convert to array and sort by order count
      const customers = Array.from(customerMap.values())
        .sort((a, b) => b.orderCount - a.orderCount);
      
      return res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      return res.status(500).json({ error: "فشل جلب العملاء" });
    }
  });

  app.post("/api/sales/held-orders", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const currentUser = await storage.getSalesUser(salesUserId);
      if (!currentUser || !currentUser.canPos) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      
      const { items, customerName, customerPhone, subtotal, notes } = req.body;
      
      if (!items || items.length === 0) {
        return res.status(400).json({ error: "السلة فارغة" });
      }
      
      // Generate hold number
      const holdNumber = `HOLD-${Date.now().toString(36).toUpperCase()}`;
      
      const [heldOrder] = await db.insert(heldOrders).values({
        holdNumber,
        salesUserId,
        salesUserName: currentUser.name,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        items: JSON.stringify(items),
        subtotal: subtotal.toString(),
        notes: notes || null,
      }).returning();
      
      return res.json({ success: true, heldOrder });
    } catch (error) {
      console.error("Error creating held order:", error);
      return res.status(500).json({ error: "فشل حفظ الطلب المعلق" });
    }
  });

  app.delete("/api/sales/held-orders/:id", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { id } = req.params;
      
      // Get the held order before deleting
      const [heldOrder] = await db.select().from(heldOrders).where(eq(heldOrders.id, id));
      
      if (!heldOrder) {
        return res.status(404).json({ error: "الطلب المعلق غير موجود" });
      }
      
      await db.delete(heldOrders).where(eq(heldOrders.id, id));
      
      return res.json({ success: true, heldOrder });
    } catch (error) {
      console.error("Error deleting held order:", error);
      return res.status(500).json({ error: "فشل حذف الطلب المعلق" });
    }
  });

  // Sales Shifts endpoints
  app.get("/api/sales/shifts/current", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const [activeShift] = await db.select().from(salesShifts)
        .where(and(
          eq(salesShifts.salesUserId, salesUserId),
          eq(salesShifts.status, 'active')
        ))
        .orderBy(desc(salesShifts.startTime))
        .limit(1);
      
      return res.json(activeShift || null);
    } catch (error) {
      console.error("Error fetching current shift:", error);
      return res.status(500).json({ error: "فشل جلب الوردية الحالية" });
    }
  });

  app.post("/api/sales/shifts/start", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const currentUser = await storage.getSalesUser(salesUserId);
      if (!currentUser) {
        return res.status(403).json({ error: "المستخدم غير موجود" });
      }
      
      // Check if there's already an active shift
      const [existingShift] = await db.select().from(salesShifts)
        .where(and(
          eq(salesShifts.salesUserId, salesUserId),
          eq(salesShifts.status, 'active')
        ))
        .limit(1);
      
      if (existingShift) {
        return res.status(400).json({ error: "لديك وردية نشطة بالفعل", shift: existingShift });
      }
      
      const { openingCash, notes } = req.body;
      
      const [newShift] = await db.insert(salesShifts).values({
        salesUserId,
        salesUserName: currentUser.name,
        openingCash: (openingCash || 0).toString(),
        notes: notes || null,
        status: 'active',
      }).returning();
      
      return res.json({ success: true, shift: newShift });
    } catch (error) {
      console.error("Error starting shift:", error);
      return res.status(500).json({ error: "فشل بدء الوردية" });
    }
  });

  app.post("/api/sales/shifts/end", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      // Get active shift
      const [activeShift] = await db.select().from(salesShifts)
        .where(and(
          eq(salesShifts.salesUserId, salesUserId),
          eq(salesShifts.status, 'active')
        ))
        .limit(1);
      
      if (!activeShift) {
        return res.status(400).json({ error: "لا توجد وردية نشطة" });
      }
      
      const { closingCash, notes } = req.body;
      
      // Calculate expected cash (opening + sales during shift)
      const shiftOrders = await db.select().from(orders)
        .where(and(
          eq(orders.salespersonId, salesUserId),
          eq(orders.paymentMethod, 'cash'),
          gte(orders.createdAt, activeShift.startTime)
        ));
      
      const cashSales = shiftOrders.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);
      const expectedCash = parseFloat(activeShift.openingCash || '0') + cashSales;
      const closingCashNum = parseFloat(closingCash || '0');
      const cashDifference = closingCashNum - expectedCash;
      
      const [updatedShift] = await db.update(salesShifts)
        .set({
          endTime: new Date(),
          closingCash: closingCash?.toString() || null,
          expectedCash: expectedCash.toString(),
          cashDifference: cashDifference.toString(),
          totalSales: cashSales.toString(),
          totalTransactions: shiftOrders.length,
          notes: notes || activeShift.notes,
          status: 'closed',
        })
        .where(eq(salesShifts.id, activeShift.id))
        .returning();
      
      return res.json({ success: true, shift: updatedShift });
    } catch (error) {
      console.error("Error ending shift:", error);
      return res.status(500).json({ error: "فشل إنهاء الوردية" });
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

  // Admin authenticated orders endpoint with full details
  app.get("/api/admin/orders", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      // Get all orders with full details from database
      const allOrders = await db.select().from(orders).orderBy(orders.createdAt);
      return res.json(allOrders.reverse()); // Most recent first
    } catch (error) {
      console.error("Error fetching admin orders:", error);
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

  // ==================== QiCard Payment Routes ====================
  
  // Check if QiCard is configured
  app.get("/api/qicard/config", async (req, res) => {
    try {
      const config = qicard.getConfig();
      return res.json(config);
    } catch (error) {
      console.error("Error checking QiCard config:", error);
      return res.status(500).json({ error: "Failed to check QiCard configuration" });
    }
  });

  // Initialize QiCard payment for an order
  app.post("/api/qicard/init", async (req, res) => {
    try {
      const { orderId } = req.body;
      
      if (!orderId) {
        return res.status(400).json({ error: "Order ID is required" });
      }
      
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Check if order payment method is qicard
      if (order.paymentMethod !== 'qicard') {
        return res.status(400).json({ error: "Order payment method is not QiCard" });
      }
      
      // Build redirect URL
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['host'];
      const redirectUrl = `${protocol}://${host}/payment/qicard/callback`;
      const callbackUrl = `${protocol}://${host}/api/qicard/webhook`;
      
      // Initialize payment
      const result = await qicard.initPayment({
        amount: Math.round(parseFloat(order.total)),
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        description: `Order ${order.orderNumber}`,
        redirectUrl,
        callbackUrl,
      });
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      // Update order with transaction ID
      await storage.updateOrderPaymentInfo(order.id, {
        qicardTransactionId: result.transactionId,
        paymentStatus: 'pending',
      });
      
      return res.json({
        success: true,
        paymentUrl: result.paymentUrl,
        transactionId: result.transactionId,
      });
    } catch (error) {
      console.error("Error initializing QiCard payment:", error);
      return res.status(500).json({ error: "Failed to initialize payment" });
    }
  });

  // QiCard callback handler (redirect from QiCard after payment)
  app.get("/api/qicard/callback", async (req, res) => {
    try {
      const { transactionId, orderId, status } = req.query;
      
      if (!transactionId || !orderId) {
        console.error("QiCard callback: Missing parameters");
        return res.redirect('/payment/qicard/callback?status=error&msg=missing_params');
      }
      
      // Verify the payment
      const verification = await qicard.verifyPayment(transactionId as string);
      
      if (!verification.success) {
        console.error("QiCard callback: Verification failed");
        return res.redirect('/payment/qicard/callback?status=error&msg=verification_failed');
      }
      
      // Find order by order number
      const order = await storage.getOrderByNumber(orderId as string);
      
      if (!order) {
        console.error("QiCard callback: Order not found:", orderId);
        return res.redirect('/payment/qicard/callback?status=error&msg=order_not_found');
      }
      
      // Map QiCard status to our payment status
      const paymentStatus = qicard.mapStatusToPaymentStatus(verification.status || 'pending');
      let orderStatus = order.status;
      
      // Update order status based on payment result
      if (paymentStatus === 'success') {
        orderStatus = 'confirmed';
        
        // Send confirmation email
        try {
          await sendOrderConfirmationEmail({
            to: order.customerEmail,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            items: order.itemsWithProducts || [],
            subtotal: Number(order.subtotal),
            shipping: Number(order.shipping),
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
        qicardTransactionId: transactionId as string,
      });
      
      if (orderStatus !== order.status) {
        await storage.updateOrderStatus(order.id, orderStatus);
      }
      
      // Redirect to frontend callback page
      return res.redirect(`/payment/qicard/callback?status=${paymentStatus}&order=${order.orderNumber}`);
    } catch (error) {
      console.error("Error handling QiCard callback:", error);
      return res.redirect('/payment/qicard/callback?status=error&msg=internal_error');
    }
  });

  // QiCard webhook handler (server-to-server notification)
  app.post("/api/qicard/webhook", async (req, res) => {
    try {
      const callbackData = qicard.parseCallback(req.body);
      
      if (!callbackData) {
        console.error("QiCard webhook: Invalid callback data");
        return res.status(400).json({ error: "Invalid callback data" });
      }
      
      // Find order by order number
      const order = await storage.getOrderByNumber(callbackData.orderId);
      
      if (!order) {
        console.error("QiCard webhook: Order not found:", callbackData.orderId);
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Map status
      const paymentStatus = qicard.mapStatusToPaymentStatus(callbackData.status);
      let orderStatus = order.status;
      
      if (paymentStatus === 'success') {
        orderStatus = 'confirmed';
      } else if (paymentStatus === 'failed') {
        orderStatus = 'payment_failed';
      }
      
      // Update order
      await storage.updateOrderPaymentInfo(order.id, {
        paymentStatus: paymentStatus,
        qicardTransactionId: callbackData.transactionId,
      });
      
      if (orderStatus !== order.status) {
        await storage.updateOrderStatus(order.id, orderStatus);
      }
      
      return res.json({ success: true });
    } catch (error) {
      console.error("Error handling QiCard webhook:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Check QiCard payment status for an order
  app.get("/api/qicard/status/:orderNumber", async (req, res) => {
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

  // ==================== End QiCard Routes ====================

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
  
  // Admin endpoint to view all sales staff attendance/shifts
  app.get("/api/admin/shifts", async (req, res) => {
    try {
      const allShifts = await db.select().from(salesShifts).orderBy(desc(salesShifts.startTime));
      return res.json(allShifts);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      return res.status(500).json({ error: "Failed to fetch shifts" });
    }
  });

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

  // ===============================
  // Market Price Analysis Routes
  // ===============================
  
  // Public route to get all market prices
  app.get("/api/market-prices", async (req, res) => {
    try {
      const { type } = req.query;
      
      if (type && typeof type === 'string') {
        const prices = await storage.getMarketPricesByType(type);
        return res.json(prices);
      }
      
      const prices = await storage.getMarketPrices();
      return res.json(prices);
    } catch (error) {
      console.error("Error fetching market prices:", error);
      return res.status(500).json({ error: "Failed to fetch market prices" });
    }
  });

  // Admin routes for managing market prices
  app.get("/api/admin/market-prices", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const prices = await storage.getMarketPrices();
      return res.json(prices);
    } catch (error) {
      console.error("Error fetching market prices:", error);
      return res.status(500).json({ error: "Failed to fetch market prices" });
    }
  });

  app.get("/api/admin/market-prices/:id", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { id } = req.params;
      const price = await storage.getMarketPrice(id);
      
      if (!price) {
        return res.status(404).json({ error: "السعر غير موجود" });
      }
      
      return res.json(price);
    } catch (error) {
      console.error("Error fetching market price:", error);
      return res.status(500).json({ error: "Failed to fetch market price" });
    }
  });

  app.post("/api/admin/market-prices", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const validatedData = insertMarketPriceSchema.parse(req.body);
      const price = await storage.createMarketPrice(validatedData);
      
      return res.json(price);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error creating market price:", error);
      return res.status(500).json({ error: "Failed to create market price" });
    }
  });

  app.put("/api/admin/market-prices/:id", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { id } = req.params;
      const validatedData = insertMarketPriceSchema.partial().parse(req.body);
      const price = await storage.updateMarketPrice(id, validatedData);
      
      if (!price) {
        return res.status(404).json({ error: "السعر غير موجود" });
      }
      
      return res.json(price);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating market price:", error);
      return res.status(500).json({ error: "Failed to update market price" });
    }
  });

  app.delete("/api/admin/market-prices/:id", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { id } = req.params;
      await storage.deleteMarketPrice(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting market price:", error);
      return res.status(500).json({ error: "Failed to delete market price" });
    }
  });

  // External Price Sources Routes
  // Public: Get market prices with their external price comparisons
  app.get("/api/market-prices/with-comparisons", async (req, res) => {
    try {
      const { type } = req.query;
      
      let prices;
      if (type && typeof type === 'string') {
        prices = await storage.getMarketPricesByType(type);
      } else {
        prices = await storage.getMarketPrices();
      }
      
      // Get exchange rate for USD to IQD
      const exchangeRate = await storage.getExchangeRate("USD", "IQD");
      const usdToIqdRate = exchangeRate ? parseFloat(exchangeRate.rate) : 1310; // Default rate
      
      // Enrich each price with external sources
      const pricesWithComparisons = await Promise.all(
        prices.map(async (price) => {
          const externalSources = await storage.getExternalPriceSourcesByMarketPrice(price.id);
          return {
            ...price,
            externalSources: externalSources.filter(s => s.isActive === 1),
            exchangeRate: usdToIqdRate
          };
        })
      );
      
      return res.json({
        prices: pricesWithComparisons,
        exchangeRate: usdToIqdRate,
        lastRateUpdate: exchangeRate?.lastUpdated || null
      });
    } catch (error) {
      console.error("Error fetching market prices with comparisons:", error);
      return res.status(500).json({ error: "Failed to fetch market prices" });
    }
  });

  // Admin: Get all external price sources
  app.get("/api/admin/external-prices", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const sources = await storage.getExternalPriceSources();
      return res.json(sources);
    } catch (error) {
      console.error("Error fetching external price sources:", error);
      return res.status(500).json({ error: "Failed to fetch external prices" });
    }
  });

  // Admin: Create external price source
  app.post("/api/admin/external-prices", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const validatedData = insertExternalPriceSourceSchema.parse(req.body);
      
      // Auto-calculate IQD price if USD is provided
      if (validatedData.priceUSD && !validatedData.priceIQD) {
        const exchangeRate = await storage.getExchangeRate("USD", "IQD");
        const rate = exchangeRate ? parseFloat(exchangeRate.rate) : 1310;
        (validatedData as any).priceIQD = (parseFloat(validatedData.priceUSD) * rate).toFixed(2);
      }
      
      const source = await storage.createExternalPriceSource(validatedData);
      return res.json(source);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error creating external price source:", error);
      return res.status(500).json({ error: "Failed to create external price" });
    }
  });

  // Admin: Update external price source
  app.put("/api/admin/external-prices/:id", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { id } = req.params;
      const validatedData = insertExternalPriceSourceSchema.partial().parse(req.body);
      
      // Auto-calculate IQD price if USD is provided
      if (validatedData.priceUSD) {
        const exchangeRate = await storage.getExchangeRate("USD", "IQD");
        const rate = exchangeRate ? parseFloat(exchangeRate.rate) : 1310;
        (validatedData as any).priceIQD = (parseFloat(validatedData.priceUSD) * rate).toFixed(2);
      }
      
      const source = await storage.updateExternalPriceSource(id, validatedData);
      if (!source) {
        return res.status(404).json({ error: "المصدر غير موجود" });
      }
      
      return res.json(source);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating external price source:", error);
      return res.status(500).json({ error: "Failed to update external price" });
    }
  });

  // Admin: Delete external price source
  app.delete("/api/admin/external-prices/:id", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { id } = req.params;
      await storage.deleteExternalPriceSource(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting external price source:", error);
      return res.status(500).json({ error: "Failed to delete external price" });
    }
  });

  // Admin: Get/Update exchange rate
  app.get("/api/admin/exchange-rate", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const rate = await storage.getExchangeRate("USD", "IQD");
      if (!rate) {
        return res.json({ rate: "1310", fromCurrency: "USD", toCurrency: "IQD", lastUpdated: null });
      }
      return res.json(rate);
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
      return res.status(500).json({ error: "Failed to fetch exchange rate" });
    }
  });

  app.put("/api/admin/exchange-rate", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { rate } = req.body;
      if (!rate || isNaN(parseFloat(rate))) {
        return res.status(400).json({ error: "سعر الصرف غير صالح" });
      }
      
      const updatedRate = await storage.upsertExchangeRate({
        fromCurrency: "USD",
        toCurrency: "IQD",
        rate: rate.toString()
      });
      
      return res.json(updatedRate);
    } catch (error) {
      console.error("Error updating exchange rate:", error);
      return res.status(500).json({ error: "Failed to update exchange rate" });
    }
  });

  // Public: Get current exchange rate
  app.get("/api/exchange-rate", async (req, res) => {
    try {
      const rate = await storage.getExchangeRate("USD", "IQD");
      if (!rate) {
        return res.json({ rate: "1310", fromCurrency: "USD", toCurrency: "IQD" });
      }
      return res.json(rate);
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
      return res.status(500).json({ error: "Failed to fetch exchange rate" });
    }
  });

  // ========== INVENTORY MANAGEMENT ROUTES ==========
  
  // Get all products with inventory info
  app.get("/api/admin/inventory", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      const products = await storage.getProductsWithInventory();
      return res.json(products);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      return res.status(500).json({ error: "Failed to fetch inventory" });
    }
  });
  
  // Get low stock products
  app.get("/api/admin/inventory/low-stock", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      const products = await storage.getLowStockProducts();
      return res.json(products);
    } catch (error) {
      console.error("Error fetching low stock products:", error);
      return res.status(500).json({ error: "Failed to fetch low stock products" });
    }
  });
  
  // Update product stock
  app.put("/api/admin/inventory/:productId", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      const { productId } = req.params;
      const { stockQuantity, lowStockThreshold, sku } = req.body;
      
      // Build update object with provided fields
      const updates: Record<string, any> = {};
      if (stockQuantity !== undefined) updates.stockQuantity = stockQuantity;
      if (lowStockThreshold !== undefined) updates.lowStockThreshold = lowStockThreshold;
      if (sku !== undefined) updates.sku = sku || null;
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "لا توجد بيانات للتحديث" });
      }
      
      const product = await storage.updateProduct(productId, updates);
      if (!product) {
        return res.status(404).json({ error: "المنتج غير موجود" });
      }
      return res.json(product);
    } catch (error) {
      console.error("Error updating inventory:", error);
      return res.status(500).json({ error: "Failed to update inventory" });
    }
  });
  
  // Adjust product stock (add/remove)
  app.post("/api/admin/inventory/:productId/adjust", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      const { productId } = req.params;
      const { adjustment, reason, referenceId } = req.body;
      
      if (adjustment === undefined || adjustment === 0) {
        return res.status(400).json({ error: "التعديل غير صالح" });
      }
      
      const product = await storage.adjustProductStock(productId, adjustment, adminId, reason, referenceId);
      if (!product) {
        return res.status(404).json({ error: "المنتج غير موجود" });
      }
      return res.json(product);
    } catch (error) {
      console.error("Error adjusting stock:", error);
      return res.status(500).json({ error: "Failed to adjust stock" });
    }
  });
  
  // Get inventory movements
  app.get("/api/admin/inventory/movements", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      const { productId } = req.query;
      const movements = await storage.getInventoryMovements(productId as string | undefined);
      return res.json(movements);
    } catch (error) {
      console.error("Error fetching movements:", error);
      return res.status(500).json({ error: "Failed to fetch inventory movements" });
    }
  });
  
  // Bulk update stock
  app.post("/api/admin/inventory/bulk-update", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      const { updates } = req.body;
      
      if (!Array.isArray(updates)) {
        return res.status(400).json({ error: "البيانات غير صالحة" });
      }
      
      await storage.bulkUpdateStock(updates);
      return res.json({ success: true, updated: updates.length });
    } catch (error) {
      console.error("Error bulk updating stock:", error);
      return res.status(500).json({ error: "Failed to bulk update stock" });
    }
  });

  // CSV Import for inventory
  app.post("/api/admin/inventory/import", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { csvData } = req.body;
      if (!csvData || typeof csvData !== 'string') {
        return res.status(400).json({ error: "بيانات CSV مطلوبة" });
      }
      
      const parseResult = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase(),
      });
      
      if (parseResult.errors.length > 0) {
        return res.status(400).json({ 
          error: "خطأ في تحليل CSV", 
          details: parseResult.errors.slice(0, 5)
        });
      }
      
      const rows = parseResult.data as Array<Record<string, string>>;
      const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ row: number; error: string; data?: any }>,
        created: 0,
        updated: 0,
      };
      
      // Fetch all products once for SKU matching
      const allProducts = await storage.getProducts();
      const productsBySku = new Map(allProducts.filter(p => p.sku).map(p => [p.sku, p]));
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2; // Account for header row
        
        try {
          const sku = row.sku?.trim();
          const nameAr = row.namear?.trim() || row.name_ar?.trim() || row['الاسم بالعربي']?.trim();
          const nameEn = row.nameen?.trim() || row.name_en?.trim() || row['الاسم بالانجليزي']?.trim();
          const priceStr = row.price?.trim() || row['السعر']?.trim();
          const stockQuantityStr = row.stockquantity?.trim() || row.stock_quantity?.trim() || row.stock?.trim() || row.quantity?.trim() || row['الكمية']?.trim();
          const category = row.category?.trim() || row['الفئة']?.trim();
          const lowStockThresholdStr = row.lowstockthreshold?.trim() || row.low_stock_threshold?.trim() || row.threshold?.trim();
          
          if (!nameAr && !nameEn) {
            results.errors.push({ row: rowNumber, error: "الاسم مطلوب", data: row });
            results.failed++;
            continue;
          }
          
          // Helper to parse numeric values (handles 1,000 and 1.000 formats)
          const parseNumber = (str: string | undefined): number | undefined => {
            if (!str || str.trim() === '') return undefined;
            // Remove thousand separators (comma and period used as thousands sep)
            const cleaned = str.replace(/[,\s]/g, '').replace(/\.(?=\d{3}$)/, '');
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? undefined : Math.floor(parsed);
          };
          
          // Validate numeric fields
          let stockQuantity: number | undefined;
          let lowStockThreshold: number | undefined;
          
          if (stockQuantityStr) {
            stockQuantity = parseNumber(stockQuantityStr);
            if (stockQuantity === undefined || stockQuantity < 0) {
              results.errors.push({ row: rowNumber, error: "الكمية غير صالحة", data: row });
              results.failed++;
              continue;
            }
          }
          
          if (lowStockThresholdStr) {
            lowStockThreshold = parseNumber(lowStockThresholdStr);
            if (lowStockThreshold === undefined || lowStockThreshold < 0) {
              results.errors.push({ row: rowNumber, error: "حد التنبيه غير صالح", data: row });
              results.failed++;
              continue;
            }
          }
          
          // Check if product exists by SKU
          const existingProduct = sku ? productsBySku.get(sku) : null;
          
          if (existingProduct) {
            // Update existing product info (not inventory fields directly)
            await storage.updateProduct(existingProduct.id, {
              ...(nameAr && { nameAr }),
              ...(nameEn && { nameEn }),
              ...(priceStr && { price: priceStr }),
              ...(category && { category }),
              ...(stockQuantity !== undefined && { stockQuantity }),
              ...(lowStockThreshold !== undefined && { lowStockThreshold }),
            });
            results.updated++;
            results.success++;
          } else {
            // Create new product (without inventory fields in insert)
            const productData = {
              nameAr: nameAr || nameEn || 'منتج جديد',
              nameEn: nameEn || nameAr || 'New Product',
              price: priceStr || '0',
              category: category || 'other',
              ...(sku && { sku }),
            };
            
            const newProduct = await storage.createProduct(productData);
            
            // Update inventory separately after creation
            if (stockQuantity !== undefined || lowStockThreshold !== undefined) {
              await storage.updateProduct(newProduct.id, {
                ...(stockQuantity !== undefined && { stockQuantity }),
                ...(lowStockThreshold !== undefined && { lowStockThreshold }),
              });
            }
            
            results.created++;
            results.success++;
          }
        } catch (error: any) {
          results.errors.push({ row: rowNumber, error: error.message || 'خطأ غير متوقع', data: row });
          results.failed++;
        }
      }
      
      return res.json({
        success: true,
        totalRows: rows.length,
        results,
      });
    } catch (error) {
      console.error("Error importing CSV:", error);
      return res.status(500).json({ error: "فشل استيراد البيانات" });
    }
  });

  // Download sample CSV template
  app.get("/api/admin/inventory/import/template", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const sampleData = [
        { sku: 'SKU001', nameAr: 'لابتوب ديل', nameEn: 'Dell Laptop', price: '500000', stockQuantity: '10', category: 'laptops', lowStockThreshold: '5' },
        { sku: 'SKU002', nameAr: 'ماوس لاسلكي', nameEn: 'Wireless Mouse', price: '25000', stockQuantity: '50', category: 'accessories', lowStockThreshold: '10' },
      ];
      
      const csv = Papa.unparse(sampleData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory_template.csv');
      return res.send(csv);
    } catch (error) {
      console.error("Error generating template:", error);
      return res.status(500).json({ error: "Failed to generate template" });
    }
  });

  // POS - Create walk-in order
  app.post("/api/admin/pos/order", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      const {
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        customerCity,
        customerPostal,
        items,
        subtotal,
        discount,
        discountReason,
        total,
        shipping,
        paymentMethod,
        paymentStatus,
        orderType,
        notes,
        salespersonId,
      } = req.body;

      // Validate required fields
      if (!items || items.length === 0) {
        return res.status(400).json({ error: "يجب إضافة منتجات للطلب" });
      }

      // Create the order
      const orderData = {
        customerName: customerName || 'زبون متجر',
        customerEmail: customerEmail || 'walkin@store.local',
        customerPhone: customerPhone || '0000000000',
        customerAddress: customerAddress || 'متجر',
        customerCity: customerCity || 'بغداد',
        customerPostal: customerPostal || '-',
        items: items.map((item: any) => `${item.name} x${item.quantity} - ${item.price}`),
        subtotal,
        shipping: shipping || "0",
        total,
        paymentMethod: paymentMethod || 'cash',
        paymentStatus: paymentStatus || 'success',
        status: 'completed', // Walk-in orders are completed immediately
      };

      const order = await storage.createOrder(orderData, `pos-${Date.now()}`, undefined);

      // Update order with additional POS fields
      await db.update(orders).set({
        orderType: orderType || 'walk-in',
        discount: discount || "0",
        discountReason: discountReason || null,
        salespersonId: salespersonId || adminId,
        notes: notes || null,
      }).where(eq(orders.id, order.id));

      // Update inventory for each item sold
      for (const item of items) {
        try {
          await storage.adjustProductStock(
            item.productId,
            -item.quantity, // Negative for sale
            adminId,
            `POS Sale - Order #${order.orderNumber}`,
            order.orderNumber
          );
        } catch (error) {
          console.error(`Failed to update stock for product ${item.productId}:`, error);
        }
      }

      return res.json({
        success: true,
        orderNumber: order.orderNumber,
        orderId: order.id,
      });
    } catch (error) {
      console.error("Error creating POS order:", error);
      return res.status(500).json({ error: "فشل في إنشاء الطلب" });
    }
  });

  return httpServer;
}
