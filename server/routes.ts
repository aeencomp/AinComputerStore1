import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCartItemSchema, insertOrderSchema, insertUserSchema, insertProductSchema, insertStoreSettingsSchema, insertRepairTicketSchema, insertAdminUserSchema, insertMarketPriceSchema, insertExternalPriceSourceSchema, insertExchangeRateSchema, orders, heldOrders, salesShifts, repairTickets, repairTicketStatusHistory, cashWithdrawals, staffAdvances, insertStaffAdvanceSchema, insertProductReviewSchema, insertDiscountCodeSchema, visitorSessions, pageViews, blockedIps, laptopBatteries, acAdapters, laptops, desktops, keyboards, lcds, laptopSaleItems, desktopSaleItems, keyboardSaleItems, lcdSaleItems, adminUsers, products, salesLocations, salesUserLocations, stockTransfers, inStoreProducts } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql, count, between, isNull, isNotNull, inArray, or, lte } from "drizzle-orm";
import { z } from "zod";
import { sendOrderConfirmationEmail } from "./utils/email";
import { sendTicketCreatedMessage, sendTicketUpdatedMessage, sendWhatsAppMessage, sendWhatsAppTemplate } from "./whatsapp";
import bcrypt from "bcrypt";
import { generateOTP, storeOTP, verifyOTP } from "./otp";
import { sendOTPEmail } from "./resend-client";
import { adminNotifications } from "./admin-notifications";
import { intercomService } from "./intercom";
import { zaincash } from "./zaincash";
import { qicard } from "./qicard";
import Papa from "papaparse";
import multer from "multer";
import path from "path";
import fs from "fs";
import { startPriceSync, syncPrices, getSyncStatus, startDesktopPriceSync, syncDesktopPrices, getDesktopSyncStatus } from "./price-sync";
import { normalizeCustomerEmail } from "./auth-email";
import { runDbMigrations } from "./db-migrations";
import {
  resolveRequestLocationId,
  getSessionLocationId,
  getAllowedLocationIdsForUser,
  userCanAccessLocation,
  setUserLocationAssignments,
  executeStockTransfer,
  canTransferStockBetween,
  canSearchInventoryForTransfer,
  searchInventoryAtLocation,
  LOCATION_MAIN_ID,
  LOCATION_SHOP2_ID,
} from "./sales-locations";
import {
  syncLaptopBatteryToInStore,
  syncAcAdapterToInStore,
  syncLaptopBatteryById,
  syncAcAdapterById,
  deactivateSyncedBatteryInStore,
  deactivateSyncedAdapterInStore,
} from "./battery-instore-sync";
import {
  isOrderDeferred,
  isInStoreCash,
  isInStoreCard,
  isInStoreZainCash,
  isInStoreQiCard,
  paymentFieldsFromMethod,
} from "./order-payment";

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

/** Same calendar day as GET /api/instore/withdrawals?date= (Asia/Baghdad). */
function baghdadCalendarDateString(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
}

/**
 * Block edit/delete when the timestamp falls only in a closed shift window.
 * Withdrawals are listed by Baghdad calendar day, so early-morning rows can
 * still match a previous closed shift while the store already has a new open
 * shift — allow those when it's still "today" in Baghdad and any shift is active.
 */
async function isCashWithdrawalEditBlocked(recordTime: Date): Promise<boolean> {
  const [containingShift] = await db
    .select()
    .from(salesShifts)
    .where(
      and(
        lte(salesShifts.startTime, recordTime),
        or(isNull(salesShifts.endTime), gte(salesShifts.endTime, recordTime)),
      ),
    )
    .orderBy(desc(salesShifts.startTime))
    .limit(1);

  if (!containingShift || containingShift.status !== "closed") {
    return false;
  }

  if (
    baghdadCalendarDateString(recordTime) === baghdadCalendarDateString(new Date())
  ) {
    const [anyActive] = await db
      .select({ id: salesShifts.id })
      .from(salesShifts)
      .where(eq(salesShifts.status, "active"))
      .limit(1);
    if (anyActive) {
      return false;
    }
  }

  return true;
}

function isSalesAdminRole(role: string | null | undefined): boolean {
  return String(role ?? "").trim().toLowerCase() === "sales_admin";
}

async function salesUserCanViewWithdrawals(req: Request): Promise<boolean> {
  if ((req.session as any).adminId) return true;
  const salesUserId = (req.session as any).salesUserId as string | undefined;
  if (!salesUserId) return false;
  const salesUser = await storage.getSalesUser(salesUserId);
  if (!salesUser) return false;
  if (isSalesAdminRole(salesUser.role)) return true;
  return salesUser.canViewWithdrawals === 1;
}

function salesPermissionsPayload(user: {
  canPos: number;
  canInventory: number;
  canInventoryLocation2: number;
  canManageUsers: number;
  canViewReports: number;
  canViewWithdrawals?: number | null;
  canTransferToLoc1?: number | null;
  canApplyDiscount: number;
  canEditReceipt?: number | null;
}) {
  return {
    canPos: user.canPos,
    canInventory: user.canInventory,
    canInventoryLocation2: user.canInventoryLocation2,
    canManageUsers: user.canManageUsers,
    canViewReports: user.canViewReports,
    canViewWithdrawals: user.canViewWithdrawals ?? 0,
    canTransferToLoc1: user.canTransferToLoc1 ?? 0,
    canApplyDiscount: user.canApplyDiscount,
    canEditReceipt: user.canEditReceipt ?? 0,
  };
}

function isDbSchemaError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? error ?? "");
  return /does not exist|column .* does not|can_view_withdrawals|can_transfer_to_loc1/i.test(msg);
}

/** Cost price (سعر الشراء): sales_admin on sales portal; admin panel when no sales session. */
async function canViewInStoreCostPrice(req: Request): Promise<boolean> {
  const salesUserId = (req.session as any).salesUserId as string | undefined;
  if (salesUserId) {
    const salesUser = await storage.getSalesUser(salesUserId);
    return isSalesAdminRole(salesUser?.role);
  }
  if ((req.session as any).adminId) return true;
  return false;
}

function stripInStoreCostPrice<T extends Record<string, unknown>>(product: T): Omit<T, "costPrice"> {
  const { costPrice: _omit, ...rest } = product;
  return rest;
}

function sanitizeInStoreProductBody(
  body: Record<string, unknown>,
  canViewCost: boolean,
): Record<string, unknown> {
  if (canViewCost) return body;
  const { costPrice: _omit, ...rest } = body;
  return rest;
}

type OnlineStockAllocation = {
  locationId: number;
  locationName: string;
  sourceInventoryId: number;
  quantity: number;
};

function onlineLocationName(locationId: number): string {
  return locationId === LOCATION_SHOP2_ID ? "Location 2" : "Location 1";
}

async function getOnlineInventoryMatches(product: any) {
  const sku = String(product?.sku || "").trim();
  if (!sku) return [];

  return db
    .select()
    .from(inStoreProducts)
    .where(
      and(
        inArray(inStoreProducts.salesLocationId, [LOCATION_MAIN_ID, LOCATION_SHOP2_ID]),
        or(eq(inStoreProducts.sku, sku), eq(inStoreProducts.barcode, sku)),
      ),
    );
}

async function getOnlineStockInfo(product: any) {
  const matches = await getOnlineInventoryMatches(product);
  if (matches.length === 0) {
    const fallbackQty = product?.stockQuantity || 0;
    return {
      hasLocationStock: false,
      totalStock: fallbackQty,
      byLocation: [
        { locationId: LOCATION_MAIN_ID, quantity: fallbackQty },
      ],
      matches,
    };
  }

  const byLocationMap = new Map<number, number>();
  for (const row of matches) {
    const locationId = row.salesLocationId || LOCATION_MAIN_ID;
    byLocationMap.set(locationId, (byLocationMap.get(locationId) || 0) + (row.stockQuantity || 0));
  }

  const byLocation = Array.from(byLocationMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([locationId, quantity]) => ({ locationId, quantity }));

  return {
    hasLocationStock: true,
    totalStock: byLocation.reduce((sum, item) => sum + item.quantity, 0),
    byLocation,
    matches,
  };
}

async function withOnlineStock(product: any) {
  const stock = await getOnlineStockInfo(product);
  return {
    ...product,
    stockQuantity: stock.totalStock,
    inStock: stock.totalStock > 0 ? 1 : 0,
    onlineStockByLocation: stock.byLocation,
    onlineStockSource: stock.hasLocationStock ? "locations" : "products",
  };
}

async function findInStoreCodeDuplicate(
  payload: Record<string, unknown>,
  salesLocationId: number,
  ignoreId?: number,
) {
  const codes = [payload.sku, payload.barcode]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (codes.length === 0) return null;

  const matches = await db
    .select()
    .from(inStoreProducts)
    .where(
      and(
        eq(inStoreProducts.salesLocationId, salesLocationId),
        or(inArray(inStoreProducts.sku, codes), inArray(inStoreProducts.barcode, codes)),
      ),
    );

  return matches.find((row) => row.id !== ignoreId) || null;
}

async function allocateOnlineOrderItem(item: any): Promise<{
  item: any;
  allocations: OnlineStockAllocation[];
  fallbackProductStock: boolean;
}> {
  const product = await storage.getProduct(item.productId);
  if (!product) throw new Error(`Product not found: ${item.productId}`);

  const quantity = parseInt(String(item.quantity || 0), 10);
  if (!quantity || quantity < 1) throw new Error(`Invalid quantity for ${product.nameAr}`);

  const stock = await getOnlineStockInfo(product);
  if (stock.totalStock < quantity) {
    throw new Error(`Insufficient stock for ${product.nameAr}`);
  }

  if (!stock.hasLocationStock) {
    return {
      item: {
        ...item,
        fulfillmentLocationId: LOCATION_MAIN_ID,
        fulfillmentLocationName: onlineLocationName(LOCATION_MAIN_ID),
        fulfillmentAllocations: [{
          locationId: LOCATION_MAIN_ID,
          locationName: onlineLocationName(LOCATION_MAIN_ID),
          quantity,
          source: "products",
        }],
      },
      allocations: [],
      fallbackProductStock: true,
    };
  }

  let remaining = quantity;
  const allocations: OnlineStockAllocation[] = [];
  const sortedMatches = stock.matches
    .filter((row) => (row.stockQuantity || 0) > 0)
    .sort((a, b) => (a.salesLocationId || LOCATION_MAIN_ID) - (b.salesLocationId || LOCATION_MAIN_ID));

  for (const row of sortedMatches) {
    if (remaining <= 0) break;
    const take = Math.min(row.stockQuantity || 0, remaining);
    if (take <= 0) continue;
    const locationId = row.salesLocationId || LOCATION_MAIN_ID;
    allocations.push({
      locationId,
      locationName: onlineLocationName(locationId),
      sourceInventoryId: row.id,
      quantity: take,
    });
    remaining -= take;
  }

  if (remaining > 0) throw new Error(`Insufficient stock for ${product.nameAr}`);

  const primary = allocations[0];
  return {
    item: {
      ...item,
      fulfillmentLocationId: primary.locationId,
      fulfillmentLocationName: primary.locationName,
      sourceInventoryId: primary.sourceInventoryId,
      fulfillmentAllocations: allocations,
    },
    allocations,
    fallbackProductStock: false,
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  await runDbMigrations();

  const httpServer = createServer(app);
  
  adminNotifications.initialize(httpServer);
  intercomService.initialize(httpServer);

  async function closeDuplicateActiveShiftsForUser(salesUserId: string) {
    const actives = await db
      .select()
      .from(salesShifts)
      .where(and(eq(salesShifts.salesUserId, salesUserId), eq(salesShifts.status, "active")))
      .orderBy(desc(salesShifts.startTime));

    if (actives.length <= 1) return actives[0] ?? null;

    const keep = actives[0];
    const toClose = actives.slice(1);
    const endTime = new Date();

    await db
      .update(salesShifts)
      .set({
        status: "closed",
        endTime,
        notes: sql`COALESCE(${salesShifts.notes}, '') || '\n[auto] closed duplicate active shift on ' || ${endTime.toISOString()}`,
      })
      .where(inArray(salesShifts.id, toClose.map((s) => s.id)));

    console.warn(
      `[shift-fix] Closed ${toClose.length} duplicate active shifts for user ${salesUserId}. Kept ${keep.id}.`,
    );
    return keep;
  }

  async function closeDuplicateActiveShiftsAllUsers() {
    const actives = await db
      .select()
      .from(salesShifts)
      .where(sql`lower(${salesShifts.status}) = 'active'`)
      .orderBy(desc(salesShifts.startTime));

    if (actives.length <= 1) return;

    const keepByUser = new Map<string, typeof salesShifts.$inferSelect>();
    const toCloseIds: string[] = [];

    for (const s of actives) {
      const key = s.salesUserId;
      if (!keepByUser.has(key)) {
        keepByUser.set(key, s);
      } else {
        toCloseIds.push(s.id);
      }
    }

    if (toCloseIds.length === 0) return;

    const endTime = new Date();
    await db
      .update(salesShifts)
      .set({
        status: "closed",
        endTime,
        notes: sql`COALESCE(${salesShifts.notes}, '') || '\n[auto] closed duplicate active shift on ' || ${endTime.toISOString()}`,
      })
      .where(inArray(salesShifts.id, toCloseIds));

    console.warn(`[shift-fix] Closed ${toCloseIds.length} duplicate active shifts (global).`);
  }

  async function ensureSalesShiftConstraints() {
    // Enforce at DB level: at most one active shift per sales user.
    // Use lower(status) in predicate to tolerate legacy values like 'Active'.
    try {
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS sales_shifts_one_active_per_user
        ON sales_shifts (sales_user_id)
        WHERE (lower(status) = 'active')
      `);
    } catch (e) {
      console.error("[shift-fix] failed to create unique index sales_shifts_one_active_per_user:", e);
    }
  }

  httpServer.on('upgrade', (req, socket, head) => {
    const pathname = req.url ? req.url.split('?')[0] : '';
    switch (pathname) {
      case '/ws/admin':
        adminNotifications.handleAdminUpgrade(req, socket, head);
        break;
      case '/ws/sales':
        adminNotifications.handleSalesUpgrade(req, socket, head);
        break;
      case '/ws/intercom':
        intercomService.handleUpgrade(req, socket, head);
        break;
      default:
        break;
    }
  });
  
  // Initialize default admin technician, admin user, and sales admin
  await storage.initializeDefaultTechnician();
  await storage.initializeDefaultAdmin();
  await storage.initializeDefaultSalesAdmin();

  // One-time hygiene: ensure there is at most one active shift per sales user.
  // This prevents duplicate actives from breaking reports/closing logic.
  try {
    await closeDuplicateActiveShiftsAllUsers();
    await ensureSalesShiftConstraints();
  } catch (e) {
    console.error("[shift-fix] failed global duplicate cleanup:", e);
  }

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

  // Image upload route for sales users
  app.post("/api/sales/upload/image", (req, res, next) => {
    const salesUserId = (req.session as any).salesUserId;
    const adminId = (req.session as any).adminId;
    if (!salesUserId && !adminId) {
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
      
      if (admin.isActive === 0) {
        return res.status(403).json({ error: "هذا الحساب غير مفعّل" });
      }

      const emailNorm = (admin.email ?? "").trim();
      const hasEmail =
        emailNorm.length > 3 &&
        emailNorm !== "-" &&
        emailNorm !== "—" &&
        emailNorm.toLowerCase() !== "none" &&
        emailNorm.includes("@");

      if (hasEmail) {
        const otp = generateOTP();
        storeOTP(`admin:${username}`, otp);
        try {
          await sendOTPEmail(emailNorm, otp, "لوحة تحكم الإدارة");
        } catch (emailErr) {
          console.error("Failed to send admin OTP email:", emailErr);
          return res.status(500).json({ error: "فشل إرسال رمز التحقق. تحقق من إعدادات البريد الإلكتروني." });
        }
        return res.json({ step: "otp", maskedEmail: emailNorm.replace(/(.{2}).+(@.+)/, "$1***$2") });
      }
      
      // No email configured — log in directly
      (req.session as any).adminId = admin.id;
      (req.session as any).adminUsername = admin.username;
      
      return res.json({ 
        success: true, 
        admin: { id: admin.id, username: admin.username, name: admin.name, role: admin.role } 
      });
    } catch (error) {
      console.error("Admin login error:", error);
      return res.status(500).json({ error: "فشل تسجيل الدخول" });
    }
  });

  app.post("/api/admin/auth/verify-otp", async (req, res) => {
    try {
      const { username, otp } = req.body;
      if (!username || !otp) return res.status(400).json({ error: "البيانات غير مكتملة" });

      if (!verifyOTP(`admin:${username}`, otp)) {
        return res.status(401).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية" });
      }

      const admin = await storage.getAdminUserByUsername(username);
      if (!admin || admin.isActive === 0) return res.status(401).json({ error: "الحساب غير موجود" });

      (req.session as any).adminId = admin.id;
      (req.session as any).adminUsername = admin.username;

      return res.json({ 
        success: true, 
        admin: { id: admin.id, username: admin.username, name: admin.name, role: admin.role } 
      });
    } catch (error) {
      console.error("Admin OTP verify error:", error);
      return res.status(500).json({ error: "فشل التحقق" });
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
      
      // Check if user is still active
      if (admin.isActive === 0) {
        delete (req.session as any).adminId;
        delete (req.session as any).adminUsername;
        return res.status(403).json({ error: "هذا الحساب غير مفعّل" });
      }
      
      return res.json({ 
        id: admin.id, 
        username: admin.username, 
        name: admin.name, 
        role: admin.role,
        canOrders: admin.canOrders,
        canProducts: admin.canProducts,
        canCategories: admin.canCategories,
        canSettings: admin.canSettings,
        canUsers: admin.canUsers,
        canReports: admin.canReports,
        canPOS: admin.canPOS,
        canInventory: admin.canInventory,
        canCustomers: admin.canCustomers,
        canDiscounts: admin.canDiscounts,
        isActive: admin.isActive,
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
      
      // Check if caller has permission to manage users
      const caller = await storage.getAdminUser(adminId);
      if (!caller || (caller.role !== 'admin' && caller.canUsers !== 1)) {
        return res.status(403).json({ error: "ليس لديك صلاحية إدارة المستخدمين" });
      }
      
      const admins = await storage.getAdminUsers();
      // Don't send passwords
      const sanitizedAdmins = admins.map(a => ({
        id: a.id,
        username: a.username,
        name: a.name,
        role: a.role,
        createdAt: a.createdAt,
        canOrders: a.canOrders,
        canProducts: a.canProducts,
        canCategories: a.canCategories,
        canSettings: a.canSettings,
        canUsers: a.canUsers,
        canReports: a.canReports,
        canPOS: a.canPOS,
        canInventory: a.canInventory,
        canCustomers: a.canCustomers,
        canDiscounts: a.canDiscounts,
        isActive: a.isActive,
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
      
      // Check if caller has permission to manage users
      const caller = await storage.getAdminUser(adminId);
      if (!caller || (caller.role !== 'admin' && caller.canUsers !== 1)) {
        return res.status(403).json({ error: "ليس لديك صلاحية إنشاء مستخدمين" });
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
        canOrders: admin.canOrders,
        canProducts: admin.canProducts,
        canCategories: admin.canCategories,
        canSettings: admin.canSettings,
        canUsers: admin.canUsers,
        canReports: admin.canReports,
        canPOS: admin.canPOS,
        canInventory: admin.canInventory,
        canCustomers: admin.canCustomers,
        canDiscounts: admin.canDiscounts,
        isActive: admin.isActive,
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
      
      // Check if caller has permission to manage users
      const caller = await storage.getAdminUser(adminId);
      if (!caller || (caller.role !== 'admin' && caller.canUsers !== 1)) {
        return res.status(403).json({ error: "ليس لديك صلاحية تعديل المستخدمين" });
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
        canOrders: admin.canOrders,
        canProducts: admin.canProducts,
        canCategories: admin.canCategories,
        canSettings: admin.canSettings,
        canUsers: admin.canUsers,
        canReports: admin.canReports,
        canPOS: admin.canPOS,
        canInventory: admin.canInventory,
        canCustomers: admin.canCustomers,
        canDiscounts: admin.canDiscounts,
        isActive: admin.isActive,
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
      
      // Check if caller has permission to manage users
      const caller = await storage.getAdminUser(adminId);
      if (!caller || (caller.role !== 'admin' && caller.canUsers !== 1)) {
        return res.status(403).json({ error: "ليس لديك صلاحية حذف المستخدمين" });
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

  // Centralized portal user management — GET all users from all portals
  app.get("/api/admin/portal-users", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) return res.status(401).json({ error: "غير مصرح" });
      const caller = await storage.getAdminUser(adminId);
      if (!caller) return res.status(401).json({ error: "غير مصرح" });

      const [admins, salesUsers, technicians, batteryUsers, saasShops] = await Promise.all([
        storage.getAdminUsers(),
        storage.getSalesUsers(),
        storage.getTechnicians(),
        storage.getBatteryUsers(),
        storage.getSaasShops(),
      ]);

      // Fetch saas users for each shop
      const saasUsersAll: any[] = [];
      for (const shop of saasShops) {
        const users = await storage.getSaasUsersByShop(shop.id);
        for (const u of users) {
          saasUsersAll.push({
            id: String(u.id), username: u.username, displayName: u.username,
            email: (u as any).email || null, portal: 'saas',
            portalLabel: shop.shopName, shopId: shop.id,
          });
        }
      }

      return res.json({
        admins: admins.map(u => ({ id: u.id, username: u.username, displayName: u.name, email: u.email || null, portal: 'admin', role: u.role })),
        salesUsers: salesUsers.map(u => ({ id: u.id, username: u.username, displayName: u.name, email: u.email || null, portal: 'sales', role: u.role })),
        technicians: technicians.map(u => ({ id: u.id, username: u.username, displayName: u.displayName, email: u.email || null, portal: 'technician', isAdmin: u.isAdmin })),
        batteryUsers: batteryUsers.map(u => ({ id: u.id, username: u.username, displayName: u.username, email: u.email || null, portal: 'battery' })),
        saasUsers: saasUsersAll,
        saasShops: saasShops.map(s => ({ id: String(s.id), username: s.username, displayName: s.shopName, email: s.email || null, portal: 'saasShop' })),
      });
    } catch (error) {
      console.error("Error fetching portal users:", error);
      return res.status(500).json({ error: "فشل جلب المستخدمين" });
    }
  });

  // Centralized portal user management — PATCH email/password for a specific portal user
  app.patch("/api/admin/portal-users/:portal/:id", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) return res.status(401).json({ error: "غير مصرح" });
      const caller = await storage.getAdminUser(adminId);
      if (!caller) return res.status(401).json({ error: "غير مصرح" });

      const { portal, id } = req.params;
      const { email, password } = req.body;
      const emailVal = email === '' ? null : (email || null);

      const updateData: any = { email: emailVal };
      if (password && password.length >= 6) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      let updated: any;
      if (portal === 'admin') {
        updated = await storage.updateAdminUser(id, updateData);
      } else if (portal === 'sales') {
        updated = await storage.updateSalesUser(id, updateData);
      } else if (portal === 'technician') {
        updated = await storage.updateTechnician(id, updateData);
      } else if (portal === 'battery') {
        updated = await storage.updateBatteryUser(id, updateData);
      } else if (portal === 'saasShop') {
        updated = await storage.updateSaasShop(parseInt(id), updateData);
      } else if (portal === 'saas') {
        updated = await storage.updateSaasUser(parseInt(id), updateData);
      } else {
        return res.status(400).json({ error: "نوع البوابة غير معروف" });
      }

      if (!updated) return res.status(404).json({ error: "المستخدم غير موجود" });
      return res.json({ success: true });
    } catch (error) {
      console.error("Error updating portal user:", error);
      return res.status(500).json({ error: "فشل تحديث المستخدم" });
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

      if (salesUser.email) {
        const otp = generateOTP();
        storeOTP(`sales:${username}`, otp);
        try {
          await sendOTPEmail(salesUser.email, otp, "بوابة المبيعات");
        } catch (emailErr) {
          console.error("Failed to send sales OTP email:", emailErr);
          return res.status(500).json({ error: "فشل إرسال رمز التحقق" });
        }
        return res.json({ step: "otp", maskedEmail: salesUser.email.replace(/(.{2}).+(@.+)/, "$1***$2") });
      }
      
      // No email — log in directly
      (req.session as any).salesUserId = salesUser.id;
      (req.session as any).salesUsername = salesUser.username;
      (req.session as any).salesUserRole = salesUser.role;
      const allowedLocs = await getAllowedLocationIdsForUser(salesUser.id, salesUser.role);
      if (allowedLocs.length === 1) {
        (req.session as any).activeSalesLocationId = allowedLocs[0];
      }
      
      return res.json({ 
        success: true, 
        user: { 
          id: salesUser.id, username: salesUser.username, name: salesUser.name, role: salesUser.role,
          permissions: salesPermissionsPayload(salesUser),
        } 
      });
    } catch (error) {
      console.error("Sales login error:", error);
      return res.status(500).json({
        error: isDbSchemaError(error)
          ? "قاعدة البيانات تحتاج تحديث — أعد تشغيل الخادم (pm2 restart all)"
          : "فشل تسجيل الدخول",
      });
    }
  });

  app.post("/api/sales/auth/verify-otp", async (req, res) => {
    try {
      const { username, otp } = req.body;
      if (!username || !otp) return res.status(400).json({ error: "البيانات غير مكتملة" });

      if (!verifyOTP(`sales:${username}`, otp)) {
        return res.status(401).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية" });
      }

      const salesUser = await storage.getSalesUserByUsername(username);
      if (!salesUser || !salesUser.isActive) return res.status(401).json({ error: "الحساب غير موجود" });

      (req.session as any).salesUserId = salesUser.id;
      (req.session as any).salesUsername = salesUser.username;
      (req.session as any).salesUserRole = salesUser.role;
      const allowedLocs = await getAllowedLocationIdsForUser(salesUser.id, salesUser.role);
      if (allowedLocs.length === 1) {
        (req.session as any).activeSalesLocationId = allowedLocs[0];
      }

      return res.json({ 
        success: true, 
        user: { 
          id: salesUser.id, username: salesUser.username, name: salesUser.name, role: salesUser.role,
          permissions: salesPermissionsPayload(salesUser),
        }
      });
    } catch (error) {
      console.error("Sales OTP verify error:", error);
      return res.status(500).json({
        error: isDbSchemaError(error)
          ? "قاعدة البيانات تحتاج تحديث — أعد تشغيل الخادم (pm2 restart all)"
          : "فشل التحقق",
      });
    }
  });

  app.post("/api/sales/auth/logout", async (req, res) => {
    try {
      delete (req.session as any).salesUserId;
      delete (req.session as any).salesUsername;
      delete (req.session as any).activeSalesLocationId;
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
      
      const allowedLocationIds = await getAllowedLocationIdsForUser(salesUser.id, salesUser.role);
      const locationRows = await db
        .select()
        .from(salesLocations)
        .where(inArray(salesLocations.id, allowedLocationIds));

      const activeSalesLocationId = getSessionLocationId(req);
      const needsLocationPick =
        allowedLocationIds.length > 1 && !activeSalesLocationId;

      return res.json({ 
        id: salesUser.id, 
        username: salesUser.username, 
        name: salesUser.name, 
        role: salesUser.role,
        canViewInStoreCostPrice: isSalesAdminRole(salesUser.role),
        allowedLocations: locationRows.map((l) => ({
          id: l.id,
          code: l.code,
          nameAr: l.nameAr,
          nameEn: l.nameEn,
        })),
        activeSalesLocationId: activeSalesLocationId ?? null,
        needsLocationPick,
        permissions: salesPermissionsPayload(salesUser),
      });
    } catch (error) {
      console.error("Sales auth check error:", error);
      return res.status(500).json({
        error: isDbSchemaError(error)
          ? "قاعدة البيانات تحتاج تحديث — أعد تشغيل الخادم (pm2 restart all)"
          : "فشل التحقق من المستخدم",
      });
    }
  });

  app.get("/api/sales/locations", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) return res.status(401).json({ error: "غير مصرح" });
      const salesUser = await storage.getSalesUser(salesUserId);
      if (!salesUser) return res.status(401).json({ error: "غير مصرح" });

      const allowedIds = await getAllowedLocationIdsForUser(salesUser.id, salesUser.role);
      const rows = await db
        .select()
        .from(salesLocations)
        .where(and(inArray(salesLocations.id, allowedIds), eq(salesLocations.isActive, 1)));

      return res.json(rows.map((l) => ({
        id: l.id,
        code: l.code,
        nameAr: l.nameAr,
        nameEn: l.nameEn,
      })));
    } catch (error) {
      console.error("Error listing sales locations:", error);
      return res.status(500).json({ error: "فشل جلب المواقع" });
    }
  });

  app.post("/api/sales/locations/select", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) return res.status(401).json({ error: "غير مصرح" });

      const salesUser = await storage.getSalesUser(salesUserId);
      if (!salesUser) return res.status(401).json({ error: "غير مصرح" });

      const locationId = parseInt(String(req.body?.locationId ?? ""), 10);
      if (Number.isNaN(locationId) || locationId < 1) {
        return res.status(400).json({ error: "موقع غير صالح" });
      }

      const allowed = await userCanAccessLocation(salesUser.id, salesUser.role, locationId);
      if (!allowed) return res.status(403).json({ error: "ليس لديك صلاحية لهذا الموقع" });

      (req.session as any).activeSalesLocationId = locationId;
      return res.json({ success: true, activeSalesLocationId: locationId });
    } catch (error) {
      console.error("Error selecting sales location:", error);
      return res.status(500).json({ error: "فشل اختيار الموقع" });
    }
  });

  app.get("/api/sales/transfers", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) return res.status(401).json({ error: "غير مصرح" });
      const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 200);
      const rows = await db
        .select()
        .from(stockTransfers)
        .orderBy(desc(stockTransfers.createdAt))
        .limit(limit);
      return res.json(rows);
    } catch (error) {
      console.error("Error listing transfers:", error);
      return res.status(500).json({ error: "فشل جلب سجل النقل" });
    }
  });

  app.post("/api/sales/transfers", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) return res.status(401).json({ error: "غير مصرح" });

      const salesUser = await storage.getSalesUser(salesUserId);
      if (!salesUser) return res.status(401).json({ error: "غير مصرح" });

      const {
        productSource,
        productId,
        quantity,
        notes,
        fromLocationId = LOCATION_MAIN_ID,
        toLocationId = LOCATION_SHOP2_ID,
      } = req.body;

      const fromLoc = parseInt(String(fromLocationId), 10);
      const toLoc = parseInt(String(toLocationId), 10);
      if (
        !canTransferStockBetween(salesUser.role, fromLoc, toLoc, salesUser)
      ) {
        return res.status(403).json({ error: "ليس لديك صلاحية هذا النقل" });
      }

      const result = await executeStockTransfer({
        fromLocationId: fromLoc,
        toLocationId: toLoc,
        productSource,
        productId: String(productId),
        quantity: parseInt(String(quantity || 1), 10),
        notes,
        createdBy: salesUserId,
        createdByName: salesUser.name,
      });

      return res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Error transferring stock:", error);
      return res.status(400).json({ error: error.message || "فشل نقل المخزون" });
    }
  });

  app.post("/api/sales/transfers/batch", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) return res.status(401).json({ error: "غير مصرح" });

      const salesUser = await storage.getSalesUser(salesUserId);
      if (!salesUser) return res.status(401).json({ error: "غير مصرح" });

      const {
        items,
        notes,
        fromLocationId = LOCATION_MAIN_ID,
        toLocationId = LOCATION_SHOP2_ID,
      } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "أضف صنفاً واحداً على الأقل للنقل" });
      }

      const fromLoc = parseInt(String(fromLocationId), 10);
      const toLoc = parseInt(String(toLocationId), 10);
      if (
        !canTransferStockBetween(salesUser.role, fromLoc, toLoc, salesUser)
      ) {
        return res.status(403).json({ error: "ليس لديك صلاحية هذا النقل" });
      }

      const transferIds: number[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const productSource = item?.productSource;
        const productId = item?.productId;
        const quantity = parseInt(String(item?.quantity ?? 1), 10);
        if (!productSource || !productId) {
          return res.status(400).json({ error: `صنف غير صالح في السطر ${i + 1}` });
        }
        const result = await executeStockTransfer({
          fromLocationId: fromLoc,
          toLocationId: toLoc,
          productSource,
          productId: String(productId),
          quantity: quantity > 0 ? quantity : 1,
          notes: i === 0 ? notes : null,
          createdBy: salesUserId,
          createdByName: salesUser.name,
        });
        transferIds.push(result.transferId);
      }

      return res.json({ success: true, count: items.length, transferIds });
    } catch (error: any) {
      console.error("Error batch transferring stock:", error);
      return res.status(400).json({ error: error.message || "فشل نقل المخزون" });
    }
  });

  app.get("/api/sales/inventory/search-loc1", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) return res.status(401).json({ error: "غير مصرح" });
      const salesUser = await storage.getSalesUser(salesUserId);
      if (!salesUser) return res.status(401).json({ error: "غير مصرح" });
      if (!canSearchInventoryForTransfer(salesUser.role, LOCATION_MAIN_ID, salesUser)) {
        return res.status(403).json({ error: "ليس لديك صلاحية البحث في مخزون الموقع 1" });
      }
      const q = String(req.query.q || "");
      const results = await searchInventoryAtLocation(LOCATION_MAIN_ID, q);
      return res.json(results);
    } catch (error) {
      console.error("Error searching loc1 inventory:", error);
      return res.status(500).json({ error: "فشل البحث" });
    }
  });

  app.get("/api/sales/inventory/search-loc2", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) return res.status(401).json({ error: "غير مصرح" });
      const salesUser = await storage.getSalesUser(salesUserId);
      if (!salesUser) return res.status(401).json({ error: "غير مصرح" });
      if (!canSearchInventoryForTransfer(salesUser.role, LOCATION_SHOP2_ID, salesUser)) {
        return res.status(403).json({ error: "ليس لديك صلاحية البحث في مخزون الموقع 2" });
      }
      const q = String(req.query.q || "");
      const results = await searchInventoryAtLocation(LOCATION_SHOP2_ID, q);
      return res.json(results);
    } catch (error) {
      console.error("Error searching loc2 inventory:", error);
      return res.status(500).json({ error: "فشل البحث" });
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
      const sanitizedUsers = await Promise.all(users.map(async (u) => {
        const locIds = await getAllowedLocationIdsForUser(u.id, u.role);
        return {
          id: u.id,
          username: u.username,
          name: u.name,
          role: u.role,
          canPos: u.canPos,
          canInventory: u.canInventory,
          canInventoryLocation2: u.canInventoryLocation2,
          canManageUsers: u.canManageUsers,
          canViewReports: u.canViewReports,
          canViewWithdrawals: u.canViewWithdrawals ?? 0,
          canTransferToLoc1: u.canTransferToLoc1 ?? 0,
          canApplyDiscount: u.canApplyDiscount,
          canEditReceipt: (u as any).canEditReceipt ?? 0,
          isActive: u.isActive,
          createdAt: u.createdAt,
          locationIds: locIds,
        };
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
      
      const { username, password, name, email, role, canPos, canInventory, canInventoryLocation2, canManageUsers, canViewReports, canViewWithdrawals, canTransferToLoc1, canApplyDiscount, canEditReceipt, isActive, locationIds } = req.body;
      
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
        email: email || null,
        role: role || 'sales',
        canPos: canPos ?? 1,
        canInventory: canInventory ?? 0,
        canInventoryLocation2: canInventoryLocation2 ?? 0,
        canManageUsers: canManageUsers ?? 0,
        canViewReports: canViewReports ?? 0,
        canViewWithdrawals: canViewWithdrawals ?? 0,
        canTransferToLoc1: canTransferToLoc1 ?? 0,
        canApplyDiscount: canApplyDiscount ?? 0,
        canEditReceipt: canEditReceipt ?? 0,
        isActive: isActive ?? 1,
        createdBy: salesUserId,
      });

      const locIds = Array.isArray(locationIds)
        ? locationIds.map((id: unknown) => parseInt(String(id), 10)).filter((n: number) => !Number.isNaN(n))
        : [LOCATION_MAIN_ID];
      if ((canInventoryLocation2 ?? 0) === 1 && !locIds.includes(LOCATION_SHOP2_ID)) {
        locIds.push(LOCATION_SHOP2_ID);
      }
      await setUserLocationAssignments(newUser.id, locIds.length ? locIds : [LOCATION_MAIN_ID]);
      
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
      const { locationIds, ...updates } = req.body;
      
      // Don't allow updating username to existing one
      if (updates.username) {
        const existing = await storage.getSalesUserByUsername(updates.username);
        if (existing && existing.id !== id) {
          return res.status(400).json({ error: "اسم المستخدم موجود مسبقاً" });
        }
      }
      
      const updated = await storage.updateSalesUser(id, updates);
      if (updated && Array.isArray(locationIds)) {
        const locIds = locationIds
          .map((lid: unknown) => parseInt(String(lid), 10))
          .filter((n: number) => !Number.isNaN(n));
        if ((updates as any).canInventoryLocation2 === 1 && !locIds.includes(LOCATION_SHOP2_ID)) {
          locIds.push(LOCATION_SHOP2_ID);
        }
        await setUserLocationAssignments(id, locIds.length ? locIds : [LOCATION_MAIN_ID]);
      }
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
        customerAddress,
        customerEmail,
        paymentMethod, 
        paymentStatus,
        discount,
        discountReason,
        notes,
        orderType: requestedOrderType,
        salesLocationId: requestedSalesLocationId,
      } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: "السلة فارغة" });
      }

      const salesLocationId = requestedSalesLocationId != null
        ? parseInt(String(requestedSalesLocationId), 10)
        : resolveRequestLocationId(req);
      const locOk = await userCanAccessLocation(salesUserId, currentUser.role, salesLocationId);
      if (!locOk) {
        return res.status(403).json({ error: "ليس لديك صلاحية البيع من هذا الموقع" });
      }

      const allowedOrderTypes = ['walk-in', 'in-store'];
      const resolvedOrderType = allowedOrderTypes.includes(requestedOrderType) ? requestedOrderType : 'walk-in';

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
        customerAddress: customerAddress?.trim() || 'في المتجر',
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
        orderType: resolvedOrderType,
        discount: discount || "0",
        discountReason: discountReason || null,
        salespersonId: salesUserId,
        salesLocationId,
        notes: notes || null,
      }).where(eq(orders.id, order.id));

      // Update inventory for each item sold
      for (const item of items) {
        try {
          if (item.productSource === 'battery' && item.batteryId) {
            await db.update(laptopBatteries)
              .set({ stockQuantity: sql`stock_quantity - ${item.quantity}` })
              .where(eq(laptopBatteries.id, item.batteryId));
            await syncLaptopBatteryById(item.batteryId);
          } else if (item.productSource === 'adapter' && item.adapterId) {
            await db.update(acAdapters)
              .set({ stockQuantity: sql`stock_quantity - ${item.quantity}` })
              .where(eq(acAdapters.id, item.adapterId));
            await syncAcAdapterById(item.adapterId);
          } else if (item.productSource === 'keyboard' && item.keyboardId) {
            await db.update(keyboards)
              .set({ stockQuantity: sql`stock_quantity - ${item.quantity}` })
              .where(eq(keyboards.id, item.keyboardId));
          } else if (item.productSource === 'lcd' && item.lcdId) {
            await db.update(lcds)
              .set({ stockQuantity: sql`stock_quantity - ${item.quantity}` })
              .where(eq(lcds.id, item.lcdId));
          } else if (item.productSource === 'laptop' && item.laptopId) {
            await db.update(laptops)
              .set({ stockQuantity: sql`stock_quantity - ${item.quantity}`, updatedAt: new Date() })
              .where(eq(laptops.id, item.laptopId));
          } else if (item.productSource === 'desktop' && item.desktopId) {
            await db.update(desktops)
              .set({ stockQuantity: sql`stock_quantity - ${item.quantity}`, updatedAt: new Date() })
              .where(eq(desktops.id, item.desktopId));
          } else if (resolvedOrderType === 'in-store') {
            await storage.adjustInStoreProductStock(parseInt(item.productId), -item.quantity);
          } else {
            await storage.adjustProductStock(item.productId, -item.quantity, salesUserId, 'walk-in sale', order.orderNumber);
          }
        } catch (stockError) {
          console.error(`Failed to adjust stock for product ${item.productId}:`, stockError);
        }
      }

      return res.json({ 
        success: true, 
        order: {
          ...order,
          orderType: resolvedOrderType,
          discount,
          discountReason,
          notes: notes || null,
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
  // Same auth/selection rules as GET /api/sales/shifts/active-snapshot so the withdrawals
  // UI can show "active shift" for admins/supervisors, not only for salesUserId sessions.
  app.get("/api/sales/shifts/current", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const salesUserRole = (req.session as any).salesUserRole as string | undefined;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      const isSupervisor = !!adminId || salesUserRole === 'sales_admin';

      const locationId = resolveRequestLocationId(req);

      let activeShift;
      if (!isSupervisor && salesUserId) {
        // Self-heal: if the DB has multiple active shifts for this user, auto-close the older ones.
        activeShift = await closeDuplicateActiveShiftsForUser(salesUserId);
        if (activeShift) return res.json(activeShift);
        [activeShift] = await db.select().from(salesShifts)
          .where(and(
            eq(salesShifts.salesUserId, salesUserId),
            eq(salesShifts.status, 'active'),
            eq(salesShifts.salesLocationId, locationId),
          ))
          .orderBy(desc(salesShifts.startTime))
          .limit(1);
      } else {
        [activeShift] = await db.select().from(salesShifts)
          .where(and(
            eq(salesShifts.status, 'active'),
            eq(salesShifts.salesLocationId, locationId),
          ))
          .orderBy(desc(salesShifts.startTime))
          .limit(1);
      }

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
      
      // Self-heal duplicates then check if an active shift remains.
      const existingShift = await closeDuplicateActiveShiftsForUser(salesUserId);
      
      if (existingShift) {
        return res.status(400).json({ error: "لديك وردية نشطة بالفعل", shift: existingShift });
      }
      
      const { openingCash, notes, salesLocationId: bodyLocId } = req.body;
      const salesLocationId = bodyLocId != null
        ? parseInt(String(bodyLocId), 10)
        : resolveRequestLocationId(req);

      const locOk = await userCanAccessLocation(salesUserId, currentUser.role, salesLocationId);
      if (!locOk) {
        return res.status(403).json({ error: "ليس لديك صلاحية لهذا الموقع" });
      }

      const [existingAtLoc] = await db.select().from(salesShifts)
        .where(and(
          eq(salesShifts.salesUserId, salesUserId),
          eq(salesShifts.status, 'active'),
          eq(salesShifts.salesLocationId, salesLocationId),
        ))
        .limit(1);
      if (existingAtLoc) {
        return res.status(400).json({ error: "لديك وردية نشطة في هذا الموقع", shift: existingAtLoc });
      }
      
      const [newShift] = await db.insert(salesShifts).values({
        salesUserId,
        salesUserName: currentUser.name,
        openingCash: (openingCash || 0).toString(),
        notes: notes || null,
        status: 'active',
        salesLocationId,
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
      const salesUserRole = (req.session as any).salesUserRole as string | undefined;
      const adminId = (req.session as any).adminId;
      const isSupervisor = !!adminId || salesUserRole === 'sales_admin';
      const canViewAll =
        isSupervisor ||
        (!!salesUserId && (await storage.getSalesUser(salesUserId))?.canViewReports);
      
      // Get active shift
      // Regular users can only end their own shift.
      // Supervisors/report-enabled users may need to end the currently-active register shift
      // even when it's owned by a different cashier account.
      let activeShift;
      if (!canViewAll) {
        // Self-heal: if the DB has multiple active shifts for this user, auto-close the older ones.
        activeShift = await closeDuplicateActiveShiftsForUser(salesUserId);
        if (!activeShift) {
          return res.status(400).json({ error: "لا توجد وردية نشطة" });
        }
        [activeShift] = await db.select().from(salesShifts)
          .where(and(
            eq(salesShifts.salesUserId, salesUserId),
            eq(salesShifts.status, 'active')
          ))
          .orderBy(desc(salesShifts.startTime))
          .limit(1);
      } else {
        [activeShift] = await db.select().from(salesShifts)
          .where(eq(salesShifts.status, 'active'))
          .orderBy(desc(salesShifts.startTime))
          .limit(1);
      }
      
      if (!activeShift) {
        return res.status(400).json({ error: "لا توجد وردية نشطة" });
      }
      
      const { closingCash, notes } = req.body;
      // Use DB-local Baghdad timestamp (matches timestamp columns).
      const endTime = sql`timezone('Asia/Baghdad', now())`;
      
      // In-store orders during shift window (all users)
      const shiftOrders = await db
        .select()
        .from(orders)
        .where(and(
          inArray(orders.orderType, ['walk-in', 'in-store']),
          sql`${orders.createdAt} >= ${activeShift.startTime}`,
          sql`${orders.createdAt} <= ${endTime}`,
        ));

      // Repair tickets paid/delivered during this shift
      const shiftRepairs = await db.select().from(repairTickets)
        .where(
          or(
            and(
              eq(repairTickets.paymentStatus, 'paid'),
              sql`${repairTickets.updatedAt} >= ${activeShift.startTime}`,
              sql`${repairTickets.updatedAt} <= ${endTime}`
            ),
            and(
              eq(repairTickets.status, 'delivered'),
              isNotNull(repairTickets.deliveredAt),
              sql`${repairTickets.deliveredAt} >= ${activeShift.startTime}`,
              sql`${repairTickets.deliveredAt} <= ${endTime}`
            )
          )
        );

      // Cash-only amounts for expected cash calculation
      const cashSalesOrders = shiftOrders
        .filter(o => isInStoreCash(o))
        .reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);
      const cashRepairs = shiftRepairs
        .filter(t => t.paymentStatus !== 'deferred' && (t.paymentMethod === 'cash' || !t.paymentMethod))
        .reduce((sum, t) => sum + parseFloat(t.finalCost || t.costEstimate || '0'), 0);
      const totalCash = cashSalesOrders + cashRepairs;

      // Total sales across all payment methods (excluding deferred)
      const totalOrderSales = shiftOrders
        .filter(o => !isOrderDeferred(o))
        .reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);
      const totalRepairSales = shiftRepairs
        .filter(t => t.paymentStatus !== 'deferred')
        .reduce((sum, t) => sum + parseFloat(t.finalCost || t.costEstimate || '0'), 0);
      const totalAllSales = totalOrderSales + totalRepairSales;

      const expectedCash = parseFloat(activeShift.openingCash || '0') + totalCash;
      const closingCashNum = parseFloat(closingCash || '0');
      const cashDifference = closingCashNum - expectedCash;
      
      const [updatedShift] = await db.update(salesShifts)
        .set({
          endTime,
          closingCash: closingCash?.toString() || null,
          expectedCash: expectedCash.toString(),
          cashDifference: cashDifference.toString(),
          totalSales: totalAllSales.toString(),
          totalTransactions: shiftOrders.length + shiftRepairs.filter(t => t.paymentStatus !== 'deferred').length,
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

  // ─── Shift List & Shift Report ───────────────────────────────────────────────

  // Helper: compute shift report using DB-local timestamps.
  //
  // IMPORTANT: This project stores many timestamps as `timestamp` (no timezone).
  // If we pull them into JS Dates, Node/pg will interpret them as UTC which shifts
  // Baghdad-local values by +3h and breaks comparisons (end < start).
  //
  // So we compute the shift window entirely in SQL:
  //   start := sales_shifts.start_time
  //   end   := COALESCE(sales_shifts.end_time, timezone('Asia/Baghdad', now()))
  async function computeShiftReportForShift(shiftId: string) {
    const [shift] = await db.select().from(salesShifts).where(eq(salesShifts.id, shiftId)).limit(1);
    const salesLocationId = shift?.salesLocationId ?? LOCATION_MAIN_ID;
    const shiftStartSql = sql`(select start_time from sales_shifts where id = ${shiftId} limit 1)`;
    const shiftEndSql = sql`(select coalesce(end_time, timezone('Asia/Baghdad', now())) from sales_shifts where id = ${shiftId} limit 1)`;

    const inStoreOrders = await db
      .select()
      .from(orders)
      .where(and(
        inArray(orders.orderType, ['walk-in', 'in-store']),
        eq(orders.salesLocationId, salesLocationId),
        sql`${orders.createdAt} >= ${shiftStartSql}`,
        sql`${orders.createdAt} <= ${shiftEndSql}`,
      ));

    const paidRepairTickets = salesLocationId === LOCATION_MAIN_ID
      ? await db
        .select()
        .from(repairTickets)
        .where(
          or(
            and(
              eq(repairTickets.paymentStatus, 'paid'),
              sql`${repairTickets.updatedAt} >= ${shiftStartSql}`,
              sql`${repairTickets.updatedAt} <= ${shiftEndSql}`,
            ),
            and(
              eq(repairTickets.status, 'delivered'),
              isNotNull(repairTickets.deliveredAt),
              sql`${repairTickets.deliveredAt} >= ${shiftStartSql}`,
              sql`${repairTickets.deliveredAt} <= ${shiftEndSql}`,
            ),
          ),
        )
      : [];

    // Note: cashWithdrawals table has no salesUserId column so withdrawals are scoped
    // by time range only. If multiple employees work concurrently and all record withdrawals,
    // those withdrawals appear in every overlapping shift report. Adding per-employee
    // withdrawal attribution would require a schema migration.
    const dailyWithdrawals = await db
      .select()
      .from(cashWithdrawals)
      .where(and(
        eq(cashWithdrawals.salesLocationId, salesLocationId),
        sql`${cashWithdrawals.createdAt} >= ${shiftStartSql}`,
        sql`${cashWithdrawals.createdAt} <= ${shiftEndSql}`,
      ))
      .orderBy(desc(cashWithdrawals.createdAt));

    // Staff advances in the same time window (no salesUserId column, scoped by time only)
    const dailyAdvances = await db
      .select()
      .from(staffAdvances)
      .where(and(
        eq(staffAdvances.salesLocationId, salesLocationId),
        sql`${staffAdvances.createdAt} >= ${shiftStartSql}`,
        sql`${staffAdvances.createdAt} <= ${shiftEndSql}`,
      ))
      .orderBy(desc(staffAdvances.createdAt));

    const inStoreTotalCash = inStoreOrders.filter(o => isInStoreCash(o)).reduce((s, o) => s + parseFloat(o.total || '0'), 0);
    const inStoreTotalCard = inStoreOrders.filter(o => isInStoreCard(o)).reduce((s, o) => s + parseFloat(o.total || '0'), 0);
    const inStoreTotalZain = inStoreOrders.filter(o => isInStoreZainCash(o)).reduce((s, o) => s + parseFloat(o.total || '0'), 0);
    const inStoreTotalQi = inStoreOrders.filter(o => isInStoreQiCard(o)).reduce((s, o) => s + parseFloat(o.total || '0'), 0);
    const inStoreTotalDeferred = inStoreOrders.filter(o => isOrderDeferred(o)).reduce((s, o) => s + parseFloat(o.total || '0'), 0);
    const inStoreTotal = inStoreOrders.filter(o => !isOrderDeferred(o)).reduce((s, o) => s + parseFloat(o.total || '0'), 0);
    const totalWithdrawals = dailyWithdrawals.reduce((s, w) => s + parseFloat(w.amount), 0);
    const totalAdvances = dailyAdvances.reduce((s, a) => s + parseFloat(a.amount), 0);
    const repairTotalDeferred = paidRepairTickets.filter(t => t.paymentStatus === 'deferred').reduce((s, t) => s + parseFloat(t.finalCost || t.costEstimate || '0'), 0);
    const repairTotal = paidRepairTickets.filter(t => t.paymentStatus !== 'deferred').reduce((s, t) => s + parseFloat(t.finalCost || t.costEstimate || '0'), 0);
    const repairTotalCash = paidRepairTickets.filter(t => t.paymentStatus !== 'deferred' && (t.paymentMethod === 'cash' || !t.paymentMethod)).reduce((s, t) => s + parseFloat(t.finalCost || t.costEstimate || '0'), 0);
    const repairTotalCard = paidRepairTickets.filter(t => t.paymentStatus !== 'deferred' && t.paymentMethod === 'card').reduce((s, t) => s + parseFloat(t.finalCost || t.costEstimate || '0'), 0);

    const baseGrandTotal = inStoreTotal + repairTotal;
    const grandTotal = baseGrandTotal + totalAdvances;

    return {
      inStoreSales: inStoreOrders,
      repairSales: paidRepairTickets,
      withdrawals: dailyWithdrawals,
      advances: dailyAdvances,
      summary: {
        inStoreCount: inStoreOrders.length,
        inStoreTotal,
        inStoreTotalCash,
        inStoreTotalCard,
        inStoreTotalZain,
        inStoreTotalQi,
        inStoreTotalDeferred,
        repairCount: paidRepairTickets.filter(t => t.paymentStatus !== 'deferred').length,
        repairTotal,
        repairTotalDeferred,
        repairTotalCash,
        repairTotalCard,
        repairTotalZain: 0,
        repairTotalQi: 0,
        totalWithdrawals,
        withdrawalCount: dailyWithdrawals.length,
        advancesTotal: totalAdvances,
        advancesCount: dailyAdvances.length,
        grandTotal,
        grandTotalCash: inStoreTotalCash + repairTotalCash,
        grandTotalCard: inStoreTotalCard + repairTotalCard,
        grandTotalZain: inStoreTotalZain,
        grandTotalQi: inStoreTotalQi,
        netTotal: grandTotal - totalWithdrawals,
      }
    };
  }

  // GET /api/sales/shifts — list shifts for the report screen
  // - Regular sales user: own CLOSED shifts only (active handled by /active-snapshot)
  // - sales_admin role or main adminId: return CLOSED + ACTIVE shifts so they can select
  //   the correct active cashier shift when multiple shifts run concurrently.
  app.get("/api/sales/shifts", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const salesUserRole = (req.session as any).salesUserRole as string | undefined;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });

      const isSupervisor = !!adminId || salesUserRole === 'sales_admin';
      const canViewAll =
        isSupervisor ||
        (!!salesUserId && (await storage.getSalesUser(salesUserId))?.canViewReports);

      // Keep list clean even if bad historical data exists.
      await closeDuplicateActiveShiftsAllUsers();

      const locationId = resolveRequestLocationId(req);
      const conditions: any[] = [];
      conditions.push(eq(salesShifts.salesLocationId, locationId));
      if (canViewAll) {
        // show both active+closed for all employees (lets supervisors pick correct active shift)
        conditions.push(inArray(salesShifts.status, ['active', 'closed']));
      } else {
        // regular user: only own closed shifts
        conditions.push(eq(salesShifts.status, 'closed'));
        if (salesUserId) conditions.push(eq(salesShifts.salesUserId, salesUserId));
      }
      const shifts = await db.select().from(salesShifts)
        .where(and(...conditions))
        .orderBy(desc(salesShifts.startTime));
      // Defensive: even if legacy data still has duplicates, only return newest active per user.
      const newestActiveByUser = new Set<string>();
      const filtered = shifts.filter((s) => {
        if (String(s.status).toLowerCase() !== "active") return true;
        if (newestActiveByUser.has(s.salesUserId)) return false;
        newestActiveByUser.add(s.salesUserId);
        return true;
      });
      return res.json(filtered);
    } catch (error) {
      console.error("Error fetching shifts list:", error);
      return res.status(500).json({ error: "فشل جلب الورديات" });
    }
  });

  // GET /api/sales/shifts/active-snapshot — live summary for current open shift
  // - Regular sales user: their own active shift
  // - sales_admin or main admin: most recent active shift across all users
  //   (orders always scoped to the shift owner for accurate per-employee totals)
  app.get("/api/sales/shifts/active-snapshot", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const salesUserRole = (req.session as any).salesUserRole as string | undefined;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });

      const isSupervisor = !!adminId || salesUserRole === 'sales_admin';
      const canViewAll =
        isSupervisor ||
        (!!salesUserId && (await storage.getSalesUser(salesUserId))?.canViewReports);

      let activeShift;
      const locationId = resolveRequestLocationId(req);
      if (!canViewAll && salesUserId) {
        [activeShift] = await db.select().from(salesShifts)
          .where(and(
            eq(salesShifts.salesUserId, salesUserId),
            eq(salesShifts.status, 'active'),
            eq(salesShifts.salesLocationId, locationId),
          ))
          .orderBy(desc(salesShifts.startTime)).limit(1);
      } else {
        [activeShift] = await db.select().from(salesShifts)
          .where(and(
            eq(salesShifts.status, 'active'),
            eq(salesShifts.salesLocationId, locationId),
          ))
          .orderBy(desc(salesShifts.startTime)).limit(1);
      }

      if (!activeShift) return res.json(null);

      // Note: when supervisors/admin view the snapshot, only the most-recent active shift
      // is returned. If multiple employees have concurrent open shifts, the others are not
      // included in this endpoint. For a full view, supervisors can navigate to each
      // individual shift via GET /api/sales/shifts/:id/report.
      // Orders are always scoped to the shift owner so totals are per-employee accurate.
      const reportData = await computeShiftReportForShift(activeShift.id);
      return res.json({ shift: activeShift, ...reportData });
    } catch (error) {
      console.error("Error fetching active snapshot:", error);
      return res.status(500).json({ error: "فشل جلب بيانات الوردية النشطة" });
    }
  });

  // GET /api/sales/shifts/:id/report — full report for a specific shift
  // - Regular sales user: own shifts only (403 for others')
  // - sales_admin or main admin: any shift
  // Orders are always scoped to the shift owner to keep totals consistent with shift-close
  app.get("/api/sales/shifts/:id/report", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const salesUserRole = (req.session as any).salesUserRole as string | undefined;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });

      const isSupervisor = !!adminId || salesUserRole === 'sales_admin';
      const canViewAll =
        isSupervisor ||
        (!!salesUserId && (await storage.getSalesUser(salesUserId))?.canViewReports);

      const [shift] = await db.select().from(salesShifts).where(eq(salesShifts.id, req.params.id));
      if (!shift) return res.status(404).json({ error: "الوردية غير موجودة" });

      // Regular sales users can only view their own shifts
      if (!canViewAll && salesUserId && shift.salesUserId !== salesUserId) {
        return res.status(403).json({ error: "غير مصرح" });
      }

      const reportData = await computeShiftReportForShift(shift.id);
      res.set('Cache-Control', 'no-store');
      return res.json({ shift, ...reportData });
    } catch (error) {
      console.error("Error fetching shift report:", error);
      return res.status(500).json({ error: "فشل جلب تقرير الوردية" });
    }
  });

  // ─── In-Store Products CRUD ─────────────────────────────────────────────────
  app.get("/api/instore/capabilities", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });
      const canViewCostPrice = await canViewInStoreCostPrice(req);
      return res.json({ canViewCostPrice });
    } catch (error) {
      console.error("Error fetching in-store capabilities:", error);
      return res.status(500).json({ error: "فشل التحقق من الصلاحيات" });
    }
  });

  async function canManageInStoreLocation(req: Request, locationId: number): Promise<boolean> {
    if ((req.session as any).adminId) return true;
    const salesUserId = (req.session as any).salesUserId as string | undefined;
    if (!salesUserId) return false;
    const salesUser = await storage.getSalesUser(salesUserId);
    if (!salesUser) return false;
    if (salesUser.role === "sales_admin") return true;
    if (locationId === LOCATION_SHOP2_ID) return salesUser.canInventoryLocation2 === 1;
    return salesUser.canInventory === 1;
  }

  app.get("/api/instore/products", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });
      const locationId = resolveRequestLocationId(req);
      const products = await storage.getInStoreProducts(locationId);
      const canViewCost = await canViewInStoreCostPrice(req);
      return res.json(
        canViewCost ? products : products.map((p) => stripInStoreCostPrice(p)),
      );
    } catch (error) {
      console.error("Error fetching in-store products:", error);
      return res.status(500).json({ error: "فشل تحميل المنتجات" });
    }
  });

  app.post("/api/instore/products", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });
      const canViewCost = await canViewInStoreCostPrice(req);
      const body = sanitizeInStoreProductBody(req.body, canViewCost);
      const locationId = parseInt(String((body as any).salesLocationId ?? resolveRequestLocationId(req)), 10);
      const resolvedLocationId = Number.isNaN(locationId) ? LOCATION_MAIN_ID : locationId;
      if (!(await canManageInStoreLocation(req, resolvedLocationId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية تعديل مخزون هذا الموقع" });
      }
      const duplicate = await findInStoreCodeDuplicate(body, resolvedLocationId);
      if (duplicate) {
        return res.status(409).json({
          error: "منتج بنفس SKU أو الباركود موجود مسبقاً في هذا الموقع",
          duplicate: {
            id: duplicate.id,
            nameAr: duplicate.nameAr,
            sku: duplicate.sku,
            barcode: duplicate.barcode,
            stockQuantity: duplicate.stockQuantity,
            salesLocationId: duplicate.salesLocationId,
          },
        });
      }
      const product = await storage.createInStoreProduct({
        ...(body as any),
        salesLocationId: resolvedLocationId,
      });
      return res.json(canViewCost ? product : stripInStoreCostPrice(product));
    } catch (error) {
      console.error("Error creating in-store product:", error);
      return res.status(500).json({ error: "فشل إضافة المنتج" });
    }
  });

  app.put("/api/instore/products/:id", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });
      const canViewCost = await canViewInStoreCostPrice(req);
      const body = sanitizeInStoreProductBody(req.body, canViewCost);
      const existing = await storage.getInStoreProductById(parseInt(req.params.id));
      if (!existing) return res.status(404).json({ error: "المنتج غير موجود" });
      if (!(await canManageInStoreLocation(req, existing.salesLocationId ?? LOCATION_MAIN_ID))) {
        return res.status(403).json({ error: "ليس لديك صلاحية تعديل مخزون هذا الموقع" });
      }
      const duplicate = await findInStoreCodeDuplicate(body, existing.salesLocationId ?? LOCATION_MAIN_ID, existing.id);
      if (duplicate) {
        return res.status(409).json({
          error: "منتج بنفس SKU أو الباركود موجود مسبقاً في هذا الموقع",
          duplicate: {
            id: duplicate.id,
            nameAr: duplicate.nameAr,
            sku: duplicate.sku,
            barcode: duplicate.barcode,
            stockQuantity: duplicate.stockQuantity,
            salesLocationId: duplicate.salesLocationId,
          },
        });
      }
      const product = await storage.updateInStoreProduct(parseInt(req.params.id), body as any);
      if (!product) return res.status(404).json({ error: "المنتج غير موجود" });
      return res.json(canViewCost ? product : stripInStoreCostPrice(product));
    } catch (error) {
      console.error("Error updating in-store product:", error);
      return res.status(500).json({ error: "فشل تحديث المنتج" });
    }
  });

  app.delete("/api/instore/products/:id", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });
      const existing = await storage.getInStoreProductById(parseInt(req.params.id));
      if (!existing) return res.status(404).json({ error: "المنتج غير موجود" });
      if (!(await canManageInStoreLocation(req, existing.salesLocationId ?? LOCATION_MAIN_ID))) {
        return res.status(403).json({ error: "ليس لديك صلاحية حذف مخزون هذا الموقع" });
      }
      await storage.deleteInStoreProduct(parseInt(req.params.id));
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting in-store product:", error);
      return res.status(500).json({ error: "فشل حذف المنتج" });
    }
  });

  app.patch("/api/instore/products/:id/stock", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });
      const { adjustment } = req.body;
      const existing = await storage.getInStoreProductById(parseInt(req.params.id));
      if (!existing) return res.status(404).json({ error: "المنتج غير موجود" });
      if (!(await canManageInStoreLocation(req, existing.salesLocationId ?? LOCATION_MAIN_ID))) {
        return res.status(403).json({ error: "ليس لديك صلاحية تعديل مخزون هذا الموقع" });
      }
      const product = await storage.adjustInStoreProductStock(parseInt(req.params.id), adjustment);
      if (!product) return res.status(404).json({ error: "المنتج غير موجود" });
      return res.json(product);
    } catch (error) {
      console.error("Error adjusting in-store product stock:", error);
      return res.status(500).json({ error: "فشل تعديل المخزون" });
    }
  });

  app.post("/api/instore/stock-count/apply", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });
      const { updates } = req.body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: "لا توجد تحديثات" });
      }
      const valid = updates.every((u: any) => {
        const source = u?.source || "instore";
        const sourceValid = ["instore", "battery", "adapter", "keyboard", "lcd"].includes(source);
        const idValid = typeof u?.id === "number" || typeof u?.id === "string";
        return sourceValid && idValid && typeof u?.quantity === "number" && u.quantity >= 0;
      });
      if (!valid) return res.status(400).json({ error: "بيانات غير صالحة" });

      const inStoreUpdates: Array<{ id: number; quantity: number }> = [];
      let updated = 0;

      for (const u of updates) {
        const source = u.source || "instore";
        if (source === "instore") {
          if (typeof u.id === "number") inStoreUpdates.push({ id: u.id, quantity: u.quantity });
          continue;
        }
        if (source === "battery") {
          const row = await storage.updateLaptopBattery(String(u.id), { stockQuantity: u.quantity });
          if (row) updated++;
          continue;
        }
        if (source === "adapter") {
          const row = await storage.updateAcAdapter(String(u.id), { stockQuantity: u.quantity });
          if (row) updated++;
          continue;
        }
        if (source === "laptop") {
          const result = await db.update(laptops).set({ stockQuantity: u.quantity, updatedAt: new Date() }).where(eq(laptops.id, String(u.id))).returning();
          if (result.length > 0) updated++;
          continue;
        }
        if (source === "desktop") {
          const result = await db.update(desktops).set({ stockQuantity: u.quantity, updatedAt: new Date() }).where(eq(desktops.id, String(u.id))).returning();
          if (result.length > 0) updated++;
          continue;
        }
        if (source === "keyboard") {
          const result = await db.update(keyboards).set({ stockQuantity: u.quantity, updatedAt: new Date() }).where(eq(keyboards.id, String(u.id))).returning();
          if (result.length > 0) updated++;
          continue;
        }
        if (source === "lcd") {
          const result = await db.update(lcds).set({ stockQuantity: u.quantity, updatedAt: new Date() }).where(eq(lcds.id, String(u.id))).returning();
          if (result.length > 0) updated++;
        }
      }

      if (inStoreUpdates.length > 0) {
        updated += await storage.bulkSetInStoreStock(inStoreUpdates);
      }

      return res.json({ updated });
    } catch (error) {
      console.error("Error applying stock count:", error);
      return res.status(500).json({ error: "فشل تطبيق الجرد" });
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
      const { category, componentType } = req.query;
      
      if (componentType && typeof componentType === 'string') {
        const products = await storage.getProductsByComponentType(componentType);
        return res.json(await Promise.all(products.map(withOnlineStock)));
      }
      
      if (category && typeof category === 'string') {
        const products = await storage.getProductsByCategory(category);
        return res.json(await Promise.all(products.map(withOnlineStock)));
      }
      
      const products = await storage.getProducts();
      return res.json(await Promise.all(products.map(withOnlineStock)));
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
      
      return res.json(await withOnlineStock(product));
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
      const product = await storage.getProduct(id);
      if (product) {
        await storage.addToRecycleBin({
          itemType: 'product',
          itemId: id,
          itemLabel: (product as any).nameAr || (product as any).nameEn || id,
          section: 'product',
          data: product,
          deletedBy: 'admin',
        });
      }
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

  // Product Request API - for unavailable products
  app.post("/api/product-requests", async (req, res) => {
    try {
      const requestSchema = z.object({
        productName: z.string().min(2, "اسم المنتج مطلوب"),
        customerName: z.string().min(2, "الاسم مطلوب"),
        customerPhone: z.string().min(10, "رقم الهاتف مطلوب"),
        customerEmail: z.string().email().optional().or(z.literal("")),
        notes: z.string().optional(),
      });

      const validatedData = requestSchema.parse(req.body);
      
      await db.execute(
        sql`INSERT INTO product_requests (id, product_name, customer_name, customer_phone, customer_email, notes, status, created_at)
         VALUES (gen_random_uuid(), ${validatedData.productName}, ${validatedData.customerName}, ${validatedData.customerPhone}, ${validatedData.customerEmail || null}, ${validatedData.notes || null}, 'pending', NOW())`
      );
      
      return res.status(201).json({ success: true, message: "تم إرسال طلبك بنجاح" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error creating product request:", error);
      return res.status(500).json({ error: "حدث خطأ أثناء إرسال الطلب" });
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
      const emailNorm = normalizeCustomerEmail(validatedData.email);

      const existingUser = await storage.getUserByEmail(emailNorm);
      if (existingUser) {
        return res.status(400).json({ error: "البريد الإلكتروني مستخدم بالفعل" });
      }

      const user = await storage.createUser({ ...validatedData, email: emailNorm });

      req.session.userId = user.id;
      try {
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error("Session save error (register):", err);
              reject(err);
            } else resolve();
          });
        });
      } catch {
        return res.status(503).json({ error: "تعذر حفظ الجلسة. تحقق من قاعدة البيانات وحاول مرة أخرى." });
      }
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
      const emailNorm = normalizeCustomerEmail(validatedData.email);

      const user = await storage.getUserByEmail(emailNorm);
      if (!user) {
        return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      }

      const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      }

      const otp = generateOTP();
      storeOTP(`customer:login:${emailNorm}`, otp);
      if (process.env.NODE_ENV !== "production") {
        console.log(`[auth] Login OTP for ${emailNorm}: ${otp}`);
      }
      try {
        await sendOTPEmail(emailNorm, otp, "بوابة العملاء", "login");
      } catch (emailErr) {
        console.error("Failed to send login OTP email:", emailErr);
        return res.status(500).json({ error: "فشل إرسال رمز التحقق. تحقق من إعدادات البريد." });
      }
      return res.json({
        step: "otp",
        maskedEmail: emailNorm.replace(/(.{2}).+(@.+)/, "$1***$2"),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error logging in:", error);
      return res.status(500).json({ error: "خطأ في تسجيل الدخول" });
    }
  });

  app.post("/api/auth/verify-login-otp", async (req, res) => {
    try {
      const bodySchema = z.object({
        email: z.string().email("البريد الإلكتروني غير صحيح"),
        otp: z.string().min(4, "أدخل رمز التحقق"),
      });
      const { email, otp } = bodySchema.parse(req.body);
      const emailNorm = normalizeCustomerEmail(email);

      if (!verifyOTP(`customer:login:${emailNorm}`, String(otp).trim())) {
        return res.status(401).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية" });
      }

      const user = await storage.getUserByEmail(emailNorm);
      if (!user) return res.status(401).json({ error: "المستخدم غير موجود" });

      req.session.userId = user.id;
      try {
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error("Session save error (verify-login-otp):", err);
              reject(err);
            } else resolve();
          });
        });
      } catch {
        return res.status(503).json({
          error:
            "تعذر حفظ جلسة تسجيل الدخول. تحقق من الاتصال بقاعدة البيانات أو أعد تحميل الصفحة والمحاولة مرة أخرى.",
        });
      }

      const { password: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("verify-login-otp error:", error);
      return res.status(500).json({ error: "فشل التحقق" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const bodySchema = z.object({
        email: z.string().email("البريد الإلكتروني غير صحيح"),
      });
      const { email } = bodySchema.parse(req.body);
      const emailNorm = normalizeCustomerEmail(email);

      const user = await storage.getUserByEmail(emailNorm);
      if (user) {
        const otp = generateOTP();
        storeOTP(`customer:reset:${emailNorm}`, otp);
        if (process.env.NODE_ENV !== "production") {
          console.log(`[auth] Password reset OTP for ${emailNorm}: ${otp}`);
        }
        try {
          await sendOTPEmail(emailNorm, otp, "متجر العين", "reset");
        } catch (emailErr) {
          console.error("Failed to send reset OTP email:", emailErr);
          return res.status(500).json({ error: "فشل إرسال رمز التحقق" });
        }
      }
      return res.json({
        ok: true,
        message:
          "إذا كان هذا البريد مسجلاً لدينا، ستصلك رسالة تحتوي على رمز التحقق خلال دقائق.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("forgot-password error:", error);
      return res.status(500).json({ error: "حدث خطأ" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const bodySchema = z.object({
        email: z.string().email("البريد الإلكتروني غير صحيح"),
        otp: z.string().min(4, "أدخل رمز التحقق"),
        newPassword: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
      });
      const { email, otp, newPassword } = bodySchema.parse(req.body);
      const emailNorm = normalizeCustomerEmail(email);

      if (!verifyOTP(`customer:reset:${emailNorm}`, String(otp).trim())) {
        return res.status(401).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية" });
      }

      const user = await storage.getUserByEmail(emailNorm);
      if (!user) {
        return res.status(404).json({ error: "المستخدم غير موجود" });
      }

      await storage.updateUser(user.id, { password: newPassword });

      return res.json({ ok: true, message: "تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("reset-password error:", error);
      return res.status(500).json({ error: "فشل إعادة تعيين كلمة المرور" });
    }
  });

  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const userId = (req.session as any).userId as string | undefined;
      if (!userId) {
        return res.status(401).json({ error: "يجب تسجيل الدخول" });
      }
      const bodySchema = z.object({
        currentPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
        newPassword: z.string().min(6, "كلمة المرور الجديدة 6 أحرف على الأقل"),
      });
      const { currentPassword, newPassword } = bodySchema.parse(req.body);

      const user = await storage.getUserById(userId);
      if (!user) return res.status(401).json({ error: "المستخدم غير موجود" });

      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok) {
        return res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة" });
      }

      await storage.updateUser(userId, { password: newPassword });
      return res.json({ ok: true, message: "تم تغيير كلمة المرور" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("change-password error:", error);
      return res.status(500).json({ error: "فشل تغيير كلمة المرور" });
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
          return product ? { product: await withOnlineStock(product), quantity: item.quantity, id: item.id } : null;
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

      const sessionId = req.session.id;
      const currentCartItems = await storage.getCartItems(sessionId);
      const existingQty = currentCartItems
        .filter((item) => item.productId === validatedData.productId)
        .reduce((sum, item) => sum + item.quantity, 0);
      const onlineStock = await getOnlineStockInfo(product);
      const addQuantity = validatedData.quantity ?? 1;
      const desiredQty = existingQty + addQuantity;
      if (desiredQty > onlineStock.totalStock) {
        return res.status(400).json({ error: "Insufficient stock", available: onlineStock.totalStock });
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
            const cartItem = await storage.addToCart(sessionId, validatedData);
            res.json({ ...cartItem, product: await withOnlineStock(product) });
            resolve();
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

      const requestedByProduct = new Map<string, number>();
      for (const item of items) {
        requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) || 0) + item.quantity);
      }
      const existingCartItems = await storage.getCartItems(req.session.id);
      for (const item of existingCartItems) {
        requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) || 0) + item.quantity);
      }
      for (const [productId, requestedQty] of Array.from(requestedByProduct.entries())) {
        const product = products.find((p) => p?.id === productId);
        if (!product) continue;
        const onlineStock = await getOnlineStockInfo(product);
        if (requestedQty > onlineStock.totalStock) {
          return res.status(400).json({
            error: "Insufficient stock",
            productId,
            available: onlineStock.totalStock,
          });
        }
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
            res.json({ success: true, addedItems: results.length });
            resolve();
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

      const currentItems = await storage.getCartItems(sessionId);
      const currentItem = currentItems.find((item) => item.id === id);
      if (!currentItem) {
        return res.status(404).json({ error: "Cart item not found" });
      }
      const currentProduct = await storage.getProduct(currentItem.productId);
      if (currentProduct) {
        const onlineStock = await getOnlineStockInfo(currentProduct);
        if (validatedData.quantity > onlineStock.totalStock) {
          return res.status(400).json({ error: "Insufficient stock", available: onlineStock.totalStock });
        }
      }

      const updatedItem = await storage.updateCartItemQuantity(id, sessionId, validatedData.quantity);
      
      if (!updatedItem) {
        return res.status(404).json({ error: "Cart item not found" });
      }

      const product = await storage.getProduct(updatedItem.productId);
      return res.json({ ...updatedItem, product: product ? await withOnlineStock(product) : product });
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

      const rawOrderItems = (validatedData.items || []).map((item: any) => {
        if (typeof item === "string") return JSON.parse(item);
        return item;
      });

      const allocatedItems = [];
      const stockDeductions: Array<{
        productId: string;
        quantity: number;
        fallbackProductStock: boolean;
        allocations: OnlineStockAllocation[];
      }> = [];

      for (const item of rawOrderItems) {
        const allocated = await allocateOnlineOrderItem(item);
        allocatedItems.push(allocated.item);
        stockDeductions.push({
          productId: item.productId,
          quantity: parseInt(String(item.quantity || 0), 10),
          fallbackProductStock: allocated.fallbackProductStock,
          allocations: allocated.allocations,
        });
      }

      const orderData = {
        ...validatedData,
        items: allocatedItems.map((item) => JSON.stringify(item)),
      };

      const order = await storage.createOrder(orderData, sessionId, userId);
      console.log("Created order:", order.id);

      for (const deduction of stockDeductions) {
        if (deduction.fallbackProductStock) {
          await storage.adjustProductStock(deduction.productId, -deduction.quantity, userId, 'online sale', order.orderNumber);
          continue;
        }
        for (const allocation of deduction.allocations) {
          await db
            .update(inStoreProducts)
            .set({
              stockQuantity: sql`${inStoreProducts.stockQuantity} - ${allocation.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(inStoreProducts.id, allocation.sourceInventoryId));
        }
      }
      
      // Increment discount code usage if a discount code was applied
      if (validatedData.discountCode) {
        try {
          const discountCodeObj = await storage.getDiscountCodeByCode(validatedData.discountCode);
          if (discountCodeObj) {
            await storage.incrementDiscountUsage(discountCodeObj.id);
            console.log(`Incremented usage count for discount code: ${discountCodeObj.code}`);
          }
        } catch (discountError) {
          console.error("Warning: Failed to update discount code usage:", discountError);
        }
      }
      
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
      const locationParam = req.query.locationId;
      if (locationParam != null && locationParam !== "") {
        const locationId = parseInt(String(locationParam), 10);
        if (!Number.isNaN(locationId)) {
          const rows = await db
            .select()
            .from(orders)
            .where(eq(orders.salesLocationId, locationId))
            .orderBy(desc(orders.createdAt));
          return res.json(rows);
        }
      }

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

  app.patch("/api/sales/orders/:id/receipt", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      if (!salesUserId) return res.status(401).json({ error: "غير مصرح" });

      const currentUser = await storage.getSalesUser(salesUserId);
      const canEditReceipt =
        currentUser?.role === "sales_admin" ||
        ((currentUser as any)?.canEditReceipt ?? 0) === 1;
      if (!currentUser || !canEditReceipt) {
        return res.status(403).json({ error: "ليس لديك صلاحية تعديل الوصل" });
      }

      const { id } = req.params;
      const receiptSchema = z.object({
        customerName: z.string().optional(),
        customerPhone: z.string().optional().nullable(),
        paymentMethod: z.string().optional(),
        discount: z.union([z.string(), z.number()]).optional(),
        notes: z.string().optional().nullable(),
        items: z.array(z.record(z.any())).min(1),
      });
      const data = receiptSchema.parse(req.body);

      const sanitizedItems = data.items.map((item) => ({
        ...item,
        nameAr: String(item.nameAr || item.name || item.nameEn || "-"),
        nameEn: item.nameEn ? String(item.nameEn) : null,
        sku: item.sku ? String(item.sku) : null,
        price: String(Math.max(0, parseFloat(String(item.price || item.unitPrice || "0")) || 0)),
        quantity: Math.max(1, parseInt(String(item.quantity || "1"), 10) || 1),
      }));

      const subtotal = sanitizedItems.reduce((sum, item) => {
        return sum + (parseFloat(String(item.price)) || 0) * (parseInt(String(item.quantity), 10) || 1);
      }, 0);
      const discount = Math.min(Math.max(0, parseFloat(String(data.discount || "0")) || 0), subtotal);
      const total = Math.max(0, subtotal - discount);

      const payment = paymentFieldsFromMethod(data.paymentMethod);

      const [updated] = await db
        .update(orders)
        .set({
          customerName: data.customerName || "عميل في المتجر",
          customerPhone: data.customerPhone || "",
          paymentMethod: payment.paymentMethod,
          paymentStatus: payment.paymentStatus,
          items: sanitizedItems.map((item) => JSON.stringify(item)),
          subtotal: subtotal.toString(),
          discount: discount.toString(),
          total: total.toString(),
          notes: data.notes || null,
        })
        .where(eq(orders.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: "الطلب غير موجود" });
      return res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات الوصل غير صحيحة", details: error.errors });
      }
      console.error("Error updating receipt:", error);
      return res.status(500).json({ error: "فشل تعديل الوصل" });
    }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      const order = await storage.updateOrderStatus(id, status);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      return res.json(order);
    } catch (error) {
      console.error("Error updating order status:", error);
      return res.status(500).json({ error: "Failed to update order status" });
    }
  });

  app.post("/api/instore/stock-count/apply", async (req, res) => {
    try {
      const { updates } = req.body;
      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ error: "Updates array is required" });
      }
      const inStoreUpdates: Array<{ id: number; quantity: number }> = [];
      let updated = 0;
      for (const u of updates) {
        const source = u?.source || "instore";
        if (source === "instore") {
          if (typeof u.id === "number") inStoreUpdates.push({ id: u.id, quantity: u.quantity });
          continue;
        }
        if (source === "battery") {
          const row = await storage.updateLaptopBattery(String(u.id), { stockQuantity: u.quantity });
          if (row) updated++;
          continue;
        }
        if (source === "adapter") {
          const row = await storage.updateAcAdapter(String(u.id), { stockQuantity: u.quantity });
          if (row) updated++;
          continue;
        }
        if (source === "keyboard") {
          const result = await db.update(keyboards).set({ stockQuantity: u.quantity, updatedAt: new Date() }).where(eq(keyboards.id, String(u.id))).returning();
          if (result.length > 0) updated++;
          continue;
        }
        if (source === "lcd") {
          const result = await db.update(lcds).set({ stockQuantity: u.quantity, updatedAt: new Date() }).where(eq(lcds.id, String(u.id))).returning();
          if (result.length > 0) updated++;
        }
      }
      if (inStoreUpdates.length > 0) {
        updated += await storage.bulkSetInStoreStock(inStoreUpdates);
      }
      return res.json({ updated });
    } catch (error) {
      console.error("Error applying stock count:", error);
      return res.status(500).json({ error: "Failed to apply stock count" });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrder(id);
      if (order) {
        await storage.addToRecycleBin({
          itemType: 'order',
          itemId: id,
          itemLabel: order.orderNumber || id,
          section: order.orderType || 'online',
          data: order,
          deletedBy: 'admin',
        });

        // Restore inventory for completed in-store / walk-in orders
        const isPosOrder = order.orderType === 'walk-in' || order.orderType === 'in-store';
        if (isPosOrder && order.items && order.items.length > 0) {
          for (const rawItem of order.items) {
            try {
              const item = typeof rawItem === 'string' ? JSON.parse(rawItem) : rawItem;
              const qty = parseInt(item.quantity) || 1;
              const productIdStr = item.productId ? String(item.productId) : "";
              const numericProductId = productIdStr && !isNaN(parseInt(productIdStr, 10)) ? parseInt(productIdStr, 10) : null;
              const inferredSource =
                item.productSource
                || (item.batteryId ? "battery" : null)
                || (item.adapterId ? "adapter" : null)
                || (item.keyboardId ? "keyboard" : null)
                || (item.lcdId ? "lcd" : null)
                || (item.laptopId ? "laptop" : null)
                || (item.desktopId ? "desktop" : null)
                || (productIdStr.startsWith("bat-") ? "battery" : null)
                || (productIdStr.startsWith("ada-") ? "adapter" : null)
                || (productIdStr.startsWith("kbd-") ? "keyboard" : null)
                || (productIdStr.startsWith("lcd-") ? "lcd" : null)
                || (productIdStr.startsWith("lap-") ? "laptop" : null)
                || (productIdStr.startsWith("des-") ? "desktop" : null)
                || (numericProductId !== null ? "instore" : null);

              if (inferredSource === 'battery' && (item.batteryId || productIdStr.startsWith("bat-"))) {
                const targetId = item.batteryId || productIdStr.replace(/^bat-/, "");
                await db.update(laptopBatteries)
                  .set({ stockQuantity: sql`stock_quantity + ${qty}` })
                  .where(eq(laptopBatteries.id, String(targetId)));
              } else if (inferredSource === 'adapter' && (item.adapterId || productIdStr.startsWith("ada-"))) {
                const targetId = item.adapterId || productIdStr.replace(/^ada-/, "");
                await db.update(acAdapters)
                  .set({ stockQuantity: sql`stock_quantity + ${qty}` })
                  .where(eq(acAdapters.id, String(targetId)));
              } else if (inferredSource === 'keyboard' && (item.keyboardId || productIdStr.startsWith("kbd-"))) {
                const targetId = item.keyboardId || productIdStr.replace(/^kbd-/, "");
                await db.update(keyboards)
                  .set({ stockQuantity: sql`stock_quantity + ${qty}`, updatedAt: new Date() })
                  .where(eq(keyboards.id, String(targetId)));
              } else if (inferredSource === 'lcd' && (item.lcdId || productIdStr.startsWith("lcd-"))) {
                const targetId = item.lcdId || productIdStr.replace(/^lcd-/, "");
                await db.update(lcds)
                  .set({ stockQuantity: sql`stock_quantity + ${qty}`, updatedAt: new Date() })
                  .where(eq(lcds.id, String(targetId)));
              } else if (inferredSource === 'laptop' && (item.laptopId || productIdStr.startsWith("lap-"))) {
                const targetId = item.laptopId || productIdStr.replace(/^lap-/, "");
                await db.update(laptops)
                  .set({ stockQuantity: sql`stock_quantity + ${qty}`, updatedAt: new Date() })
                  .where(eq(laptops.id, String(targetId)));
              } else if (inferredSource === 'desktop' && (item.desktopId || productIdStr.startsWith("des-"))) {
                const targetId = item.desktopId || productIdStr.replace(/^des-/, "");
                await db.update(desktops)
                  .set({ stockQuantity: sql`stock_quantity + ${qty}`, updatedAt: new Date() })
                  .where(eq(desktops.id, String(targetId)));
              } else if (inferredSource === 'instore' && numericProductId !== null) {
                await storage.adjustInStoreProductStock(numericProductId, qty);
              } else if (item.productId && isNaN(parseInt(item.productId))) {
                // UUID productId = regular product stock
                await storage.adjustProductStock(item.productId, qty, undefined, `Void order ${order.orderNumber}`, order.orderNumber);
              }
            } catch (itemErr) {
              console.error(`Failed to restore stock for item in order ${order.orderNumber}:`, itemErr);
            }
          }
        }
      }
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
      const whatsappResult = await sendTicketCreatedMessage(
        ticket.customerPhone,
        ticket.customerName,
        ticket.ticketNumber,
        ticket.deviceType,
        ticket.deviceBrand
      ).catch(err => {
        console.error('WhatsApp notification failed:', err);
        return { success: false, error: err.message };
      });
      
      return res.json({
        ...ticket,
        _whatsappStatus: whatsappResult.success ? 'queued' : `failed: ${whatsappResult.error || 'unknown'}`
      });
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

  app.get("/api/repair-tickets/search/:query", async (req, res) => {
    try {
      const query = req.params.query.trim();
      let ticket;

      ticket = await storage.getRepairTicketByNumber(query);

      if (!ticket) {
        ticket = await storage.getRepairTicketByNumber(query.toUpperCase());
      }

      if (!ticket) {
        ticket = await storage.getRepairTicketByPhone(query);
      }

      if (!ticket) {
        return res.status(404).json({ error: "Repair ticket not found" });
      }

      return res.json(ticket);
    } catch (error) {
      console.error("Error searching repair ticket:", error);
      return res.status(500).json({ error: "Failed to search repair ticket" });
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

  app.get("/api/repair-tickets/:id/status-history", async (req, res) => {
    try {
      const { id } = req.params;
      const ticket = await storage.getRepairTicket(id);
      if (!ticket) return res.status(404).json({ error: "Repair ticket not found" });
      const rows = await db
        .select()
        .from(repairTicketStatusHistory)
        .where(eq(repairTicketStatusHistory.ticketId, id))
        .orderBy(desc(repairTicketStatusHistory.changedAt));
      return res.json(rows);
    } catch (error) {
      console.error("Error fetching status history:", error);
      return res.status(500).json({ error: "Failed to fetch status history" });
    }
  });

  app.get("/api/admin/repair-tickets/reminders", async (req, res) => {
    try {
      const techUserId = (req.session as any).technicianId;
      const adminId = (req.session as any).adminId;
      if (!techUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });

      const now = new Date();

      const all = await db.select().from(repairTickets).where(eq(repairTickets.isArchived, 0));

      const pendingDue: string[] = [];
      const completedPickupDue: string[] = [];

      const daysBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));

      for (const t of all) {
        // Pending reminder every 2 days from last reminder, starting 2 days after intake
        if (t.status === "pending") {
          const intakeAt = (t as any).receivedAt || t.createdAt;
          const intakeDate = new Date(intakeAt as any);
          const ageFromIntake = daysBetween(now, intakeDate);
          if (ageFromIntake >= 2) {
            const last = (t as any).pendingReminderLastAt ? new Date((t as any).pendingReminderLastAt) : null;
            const sinceLast = last ? daysBetween(now, last) : ageFromIntake;
            if (sinceLast >= 2) pendingDue.push(t.id);
          }
        }

        // Completed-not-picked reminder every 30 days from last reminder, starting 30 days after completion
        if (t.status === "completed") {
          const completedAtFallback = (t as any).completedAt || (t as any).updatedAt || (t as any).createdAt;
          if (completedAtFallback) {
            const completedDate = new Date(completedAtFallback as any);
            const ageFromCompleted = daysBetween(now, completedDate);
            if (ageFromCompleted >= 30) {
              const last = (t as any).completedPickupReminderLastAt ? new Date((t as any).completedPickupReminderLastAt) : null;
              const sinceLast = last ? daysBetween(now, last) : ageFromCompleted;
              if (sinceLast >= 30) completedPickupDue.push(t.id);
            }
          }
        }
      }

      return res.json({
        pendingDueCount: pendingDue.length,
        completedNotPickedDueCount: completedPickupDue.length,
        pendingDueIds: pendingDue,
        completedNotPickedDueIds: completedPickupDue,
      });
    } catch (error) {
      console.error("Error computing repair reminders:", error);
      return res.status(500).json({ error: "Failed to compute reminders" });
    }
  });

  app.post("/api/admin/repair-tickets/reminders/ack", async (req, res) => {
    try {
      const techUserId = (req.session as any).technicianId;
      const adminId = (req.session as any).adminId;
      if (!techUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });

      const now = new Date();
      const body = req.body && typeof req.body === "object" ? req.body as any : {};
      const pendingIds: string[] = Array.isArray(body.pendingIds) ? body.pendingIds.filter((x: any) => typeof x === "string") : [];
      const completedNotPickedIds: string[] = Array.isArray(body.completedNotPickedIds) ? body.completedNotPickedIds.filter((x: any) => typeof x === "string") : [];

      if (pendingIds.length === 0 && completedNotPickedIds.length === 0) {
        return res.json({ success: true, pendingAcked: 0, completedAcked: 0 });
      }

      if (pendingIds.length > 0) {
        await db.update(repairTickets)
          .set({ pendingReminderLastAt: now, updatedAt: now })
          .where(inArray(repairTickets.id, pendingIds));
      }

      if (completedNotPickedIds.length > 0) {
        await db.update(repairTickets)
          .set({ completedPickupReminderLastAt: now, updatedAt: now })
          .where(inArray(repairTickets.id, completedNotPickedIds));
      }

      return res.json({ success: true, pendingAcked: pendingIds.length, completedAcked: completedNotPickedIds.length });
    } catch (error) {
      console.error("Error acknowledging repair reminders:", error);
      return res.status(500).json({ error: "Failed to acknowledge reminders" });
    }
  });

  app.patch("/api/admin/repair-tickets/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Locked states: once delivered+paid or delivered+deferred, ticket is immutable
      const existing = await storage.getRepairTicket(id);
      if (existing && existing.status === 'delivered' &&
          (existing.paymentStatus === 'paid' || existing.paymentStatus === 'deferred')) {
        return res.status(403).json({ error: "لا يمكن تعديل التذكرة بعد التسليم النهائي" });
      }

      // Build update object with all fields including prices (all technicians can edit prices)
      const updateData: Record<string, any> = {};
      
      if (req.body.status !== undefined) {
        updateData.status = req.body.status;
        // Auto-set completedAt when status changes to "completed"
        if (req.body.status === 'completed') {
          const existingTicket = await storage.getRepairTicket(id);
          if (existingTicket && !existingTicket.completedAt) {
            updateData.completedAt = new Date();
          }
        }
        // Auto-set deliveredAt when status changes to "delivered"
        if (req.body.status === 'delivered') {
          const existingTicket = await storage.getRepairTicket(id);
          if (existingTicket && !existingTicket.deliveredAt) {
            updateData.deliveredAt = new Date();
          }
        }
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
      // Customer & device info fields
      if (req.body.customerName !== undefined && req.body.customerName.trim()) {
        updateData.customerName = req.body.customerName.trim();
      }
      if (req.body.customerPhone !== undefined && req.body.customerPhone.trim()) {
        updateData.customerPhone = req.body.customerPhone.trim();
      }
      if (req.body.customerEmail !== undefined) {
        updateData.customerEmail = req.body.customerEmail.trim() || null;
      }
      if (req.body.deviceType !== undefined && req.body.deviceType.trim()) {
        updateData.deviceType = req.body.deviceType.trim();
      }
      if (req.body.deviceBrand !== undefined && req.body.deviceBrand.trim()) {
        updateData.deviceBrand = req.body.deviceBrand.trim();
      }
      if (req.body.deviceModel !== undefined && req.body.deviceModel.trim()) {
        updateData.deviceModel = req.body.deviceModel.trim();
      }
      if (req.body.issueDescriptionAr !== undefined && req.body.issueDescriptionAr.trim()) {
        updateData.issueDescriptionAr = req.body.issueDescriptionAr.trim();
      }
      if (req.body.issueDescriptionEn !== undefined) {
        updateData.issueDescriptionEn = req.body.issueDescriptionEn.trim() || null;
      }
      if (req.body.paymentStatus !== undefined) {
        updateData.paymentStatus = req.body.paymentStatus;
      }
      if (req.body.paymentMethod !== undefined) {
        updateData.paymentMethod = req.body.paymentMethod;
      }
      
      const ticket = await storage.updateRepairTicket(id, updateData);
      
      if (!ticket) {
        return res.status(404).json({ error: "Repair ticket not found" });
      }

      if (existing && updateData.status && existing.status !== updateData.status) {
        await db.insert(repairTicketStatusHistory).values({
          ticketId: ticket.id,
          fromStatus: existing.status,
          toStatus: updateData.status,
          changedAt: new Date(),
        });
      }
      
      // Send WhatsApp update notification (non-blocking)
      const whatsappResult = await sendTicketUpdatedMessage(
        ticket.customerPhone,
        ticket.customerName,
        ticket.ticketNumber,
        ticket.status,
        ticket.technicianNotes,
        ticket.costEstimate,
        ticket.finalCost
      ).catch(err => {
        console.error('WhatsApp update notification failed:', err);
        return { success: false, error: err.message };
      });

      if (!whatsappResult.success) {
        console.warn(
          `WhatsApp status update not sent for ticket ${ticket.ticketNumber}. ` +
          `phone="${ticket.customerPhone}" status="${ticket.status}" ` +
          `errorCode=${(whatsappResult as any).errorCode ?? 'n/a'} error="${whatsappResult.error ?? 'unknown'}"`
        );
      }
      
      return res.json({
        ...ticket,
        _whatsappStatus: whatsappResult.success ? 'queued' : `failed: ${whatsappResult.error || 'unknown'}`
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating repair ticket:", error);
      return res.status(500).json({ error: "Failed to update repair ticket" });
    }
  });

  app.post("/api/admin/repair-tickets/bulk-send-completion-whatsapp", async (_req, res) => {
    try {
      const all = await storage.getRepairTickets();
      const targets = all.filter((t) => t.status === "completed" && t.isArchived !== 1);
      const results: { id: string; ticketNumber: string; _whatsappStatus: string }[] = [];
      for (const ticket of targets) {
        const whatsappResult = await sendTicketUpdatedMessage(
          ticket.customerPhone,
          ticket.customerName,
          ticket.ticketNumber,
          "completed",
          ticket.technicianNotes,
          ticket.costEstimate,
          ticket.finalCost
        ).catch((err) => {
          console.error(`WhatsApp bulk completion failed for ${ticket.ticketNumber}:`, err);
          return { success: false, error: err.message };
        });
        results.push({
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          _whatsappStatus: whatsappResult.success
            ? "sent"
            : `failed: ${whatsappResult.error || "unknown"}`,
        });
        await new Promise((r) => setTimeout(r, 350));
      }
      const sent = results.filter((r) => r._whatsappStatus === "sent").length;
      return res.json({
        total: targets.length,
        sent,
        failed: targets.length - sent,
        results,
      });
    } catch (error) {
      console.error("Error bulk sending completion WhatsApp:", error);
      return res.status(500).json({ error: "Failed to send bulk WhatsApp notifications" });
    }
  });

  app.patch("/api/admin/repair-tickets/:id/archive", async (req, res) => {
    try {
      const { id } = req.params;
      const { archived } = req.body;
      const ticket = await storage.archiveRepairTicket(id, archived !== false);
      if (!ticket) {
        return res.status(404).json({ error: "Repair ticket not found" });
      }
      return res.json(ticket);
    } catch (error) {
      console.error("Error archiving repair ticket:", error);
      return res.status(500).json({ error: "Failed to archive repair ticket" });
    }
  });

  app.post("/api/admin/repair-tickets/archive-delivered", async (req, res) => {
    try {
      const count = await storage.archiveDeliveredTickets();
      return res.json({ success: true, count });
    } catch (error) {
      console.error("Error archiving delivered tickets:", error);
      return res.status(500).json({ error: "Failed to archive delivered tickets" });
    }
  });

  app.delete("/api/admin/repair-tickets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const ticket = await storage.getRepairTicket(id);
      if (ticket) {
        await storage.addToRecycleBin({
          itemType: 'repair_ticket',
          itemId: id,
          itemLabel: ticket.ticketNumber || id,
          section: 'repair',
          data: ticket,
          deletedBy: 'admin',
        });
      }
      await storage.deleteRepairTicket(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting repair ticket:", error);
      return res.status(500).json({ error: "Failed to delete repair ticket" });
    }
  });

  // ===============================
  // Repair Customer Routes
  // ===============================

  app.get("/api/repair-customers", async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const customers = await storage.listRepairCustomers(search);
      return res.json(customers);
    } catch (error) {
      console.error("Error fetching repair customers:", error);
      return res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/repair-customers/id/:customerId", async (req, res) => {
    try {
      const customer = await storage.getRepairCustomerByReadableId(req.params.customerId);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      return res.json(customer);
    } catch (error) {
      console.error("Error fetching repair customer:", error);
      return res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.get("/api/repair-customers/:id", async (req, res) => {
    try {
      const customer = await storage.getRepairCustomerById(req.params.id);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      return res.json(customer);
    } catch (error) {
      console.error("Error fetching repair customer by id:", error);
      return res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.get("/api/repair-customers/:id/active-tickets", async (req, res) => {
    try {
      const tickets = await storage.getActiveTicketsByRepairCustomer(req.params.id);
      return res.json(tickets);
    } catch (error) {
      console.error("Error fetching active customer tickets:", error);
      return res.status(500).json({ error: "Failed to fetch active tickets" });
    }
  });

  app.get("/api/repair-customers/:id/tickets", async (req, res) => {
    try {
      const tickets = await storage.getTicketsByRepairCustomer(req.params.id);
      return res.json(tickets);
    } catch (error) {
      console.error("Error fetching customer tickets:", error);
      return res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.patch("/api/repair-customers/:id", async (req, res) => {
    try {
      const { name, phone, email, notes } = req.body;
      const customer = await storage.updateRepairCustomer(req.params.id, { name, phone, email, notes });
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      return res.json(customer);
    } catch (error) {
      console.error("Error updating repair customer:", error);
      return res.status(500).json({ error: "Failed to update customer" });
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

      if (technician.email) {
        const otp = generateOTP();
        storeOTP(`technician:${validatedData.username}`, otp);
        try {
          await sendOTPEmail(technician.email, otp, "بوابة الفنيين");
        } catch (emailErr) {
          console.error("Failed to send technician OTP email:", emailErr);
          return res.status(500).json({ error: "فشل إرسال رمز التحقق" });
        }
        return res.json({ step: "otp", maskedEmail: technician.email.replace(/(.{2}).+(@.+)/, "$1***$2") });
      }

      // No email — log in directly
      (req.session as any).technicianId = technician.id;
      (req.session as any).technicianUsername = technician.username;
      (req.session as any).technicianIsAdmin = technician.isAdmin;
      (req.session as any).technicianPermissions = technician.permissions;
      
      return new Promise((resolve) => {
        req.session.save((err) => {
          if (err) console.error("Session save error:", err);
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

  app.post("/api/technician/auth/verify-otp", async (req, res) => {
    try {
      const { username, otp } = req.body;
      if (!username || !otp) return res.status(400).json({ error: "البيانات غير مكتملة" });

      if (!verifyOTP(`technician:${username}`, otp)) {
        return res.status(401).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية" });
      }

      const technician = await storage.getTechnicianByUsername(username);
      if (!technician || !technician.isActive) return res.status(401).json({ error: "الحساب غير موجود" });

      (req.session as any).technicianId = technician.id;
      (req.session as any).technicianUsername = technician.username;
      (req.session as any).technicianIsAdmin = technician.isAdmin;
      (req.session as any).technicianPermissions = technician.permissions;

      return new Promise((resolve) => {
        req.session.save((err) => {
          if (err) console.error("Session save error:", err);
          const { password: _, ...technicianWithoutPassword } = technician;
          resolve(res.json(technicianWithoutPassword));
        });
      });
    } catch (error) {
      console.error("Technician OTP verify error:", error);
      return res.status(500).json({ error: "فشل التحقق" });
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
        email: z.string().email().optional().nullable(),
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
        email: z.string().email().optional().nullable(),
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
  
  // Admin endpoint to view battery sales
  app.get("/api/admin/battery-sales", async (req, res) => {
    try {
      const adminId = (req.session as any).adminId;
      if (!adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const sales = await storage.getBatterySales();
      // Include items for each sale
      const salesWithItems = await Promise.all(
        sales.map(async (sale) => {
          const items = await storage.getBatterySaleItems(sale.id);
          return { ...sale, items };
        })
      );
      return res.json(salesWithItems);
    } catch (error) {
      console.error("Error getting battery sales for admin:", error);
      return res.status(500).json({ error: "خطأ في جلب مبيعات البطاريات" });
    }
  });

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

  // ==================== BATTERY SYSTEM ROUTES ====================
  
  // Initialize default battery user
  await storage.initializeDefaultBatteryUser();
  
  // Battery system authentication
  app.post("/api/battery/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      }
      
      const user = await storage.getBatteryUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
      
      if (user.isActive !== 1) {
        return res.status(401).json({ error: "الحساب معطل" });
      }
      
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      if (user.email) {
        const otp = generateOTP();
        storeOTP(`battery:${username}`, otp);
        try {
          await sendOTPEmail(user.email, otp, "بوابة البطاريات");
        } catch (emailErr) {
          console.error("Failed to send battery OTP email:", emailErr);
          return res.status(500).json({ error: "فشل إرسال رمز التحقق" });
        }
        return res.json({ step: "otp", maskedEmail: user.email.replace(/(.{2}).+(@.+)/, "$1***$2") });
      }
      
      // No email — log in directly
      (req.session as any).batteryUserId = user.id;
      (req.session as any).batteryUsername = user.username;
      
      return res.json({ 
        success: true, 
        user: { id: user.id, username: user.username, name: user.name, role: user.role } 
      });
    } catch (error) {
      console.error("Battery login error:", error);
      return res.status(500).json({ error: "خطأ في تسجيل الدخول" });
    }
  });

  app.post("/api/battery/auth/verify-otp", async (req, res) => {
    try {
      const { username, otp } = req.body;
      if (!username || !otp) return res.status(400).json({ error: "البيانات غير مكتملة" });

      if (!verifyOTP(`battery:${username}`, otp)) {
        return res.status(401).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية" });
      }

      const user = await storage.getBatteryUserByUsername(username);
      if (!user || user.isActive !== 1) return res.status(401).json({ error: "الحساب غير موجود" });

      (req.session as any).batteryUserId = user.id;
      (req.session as any).batteryUsername = user.username;

      return res.json({ 
        success: true, 
        user: { id: user.id, username: user.username, name: user.name, role: user.role }
      });
    } catch (error) {
      console.error("Battery OTP verify error:", error);
      return res.status(500).json({ error: "فشل التحقق" });
    }
  });
  
  app.post("/api/battery/auth/logout", (req, res) => {
    (req.session as any).batteryUserId = null;
    (req.session as any).batteryUsername = null;
    return res.json({ success: true });
  });
  
  app.get("/api/battery/auth/me", async (req, res) => {
    const batteryUserId = (req.session as any).batteryUserId;
    if (!batteryUserId) {
      return res.status(401).json({ error: "غير مصرح" });
    }
    
    const user = await storage.getBatteryUser(batteryUserId);
    if (!user) {
      return res.status(401).json({ error: "المستخدم غير موجود" });
    }
    
    return res.json({ 
      id: user.id, 
      username: user.username, 
      name: user.name, 
      role: user.role 
    });
  });
  
  // Battery CRUD operations
  app.get("/api/battery/batteries", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      const salesUserId = (req.session as any).salesUserId;
      if (!batteryUserId && !salesUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const batteries = await storage.getLaptopBatteries();
      return res.json(batteries);
    } catch (error) {
      console.error("Error getting batteries:", error);
      return res.status(500).json({ error: "خطأ في جلب البطاريات" });
    }
  });
  
  app.get("/api/battery/batteries/low-stock", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const batteries = await storage.getLowStockBatteries();
      return res.json(batteries);
    } catch (error) {
      console.error("Error getting low stock batteries:", error);
      return res.status(500).json({ error: "خطأ في جلب البطاريات" });
    }
  });

  // Battery Backup - Export batteries/adapters/keyboards/LCDs/laptops/desktops as JSON
  app.get("/api/battery/batteries/backup", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const batteries = await storage.getLaptopBatteries();
      const adapters = await storage.getAcAdapters();
      
      const keyboardRows = await db.select().from(keyboards).where(eq(keyboards.isActive, 1));
      const lcdRows = await db.select().from(lcds).where(eq(lcds.isActive, 1));
      const laptopRows = await db.select().from(laptops).where(eq(laptops.isActive, 1));
      const desktopRows = await db.select().from(desktops).where(eq(desktops.isActive, 1));

      const backupData = {
        schemaVersion: "1.3",
        generatedAt: new Date().toISOString(),
        backupLabel: "Battery inventory backup (batteries, adapters, laptops, desktops, keyboards, lcds)",
        batteryCount: batteries.length,
        adapterCount: adapters.length,
        laptopCount: laptopRows.length,
        desktopCount: desktopRows.length,
        keyboardCount: keyboardRows.length,
        lcdCount: lcdRows.length,
        batteries: batteries.map(b => ({
          serialNumber: b.serialNumber,
          partNumber: b.partNumber,
          barcode: b.barcode,
          brand: b.brand,
          compatibleLaptops: b.compatibleLaptops,
          voltage: b.voltage,
          capacity: b.capacity,
          cells: b.cells,
          stockQuantity: b.stockQuantity,
          minStockLevel: b.minStockLevel,
          purchasePrice: b.purchasePrice,
          sellingPrice: b.sellingPrice,
          wholesalePrice: b.wholesalePrice,
          supplier: b.supplier,
          location: b.location,
          notes: b.notes,
          isActive: b.isActive,
        })),
        adapters: adapters.map(a => ({
          serialNumber: a.serialNumber,
          partNumber: a.partNumber,
          barcode: a.barcode,
          brand: a.brand,
          compatibleLaptops: a.compatibleLaptops,
          inputVoltage: a.inputVoltage,
          outputVoltage: a.outputVoltage,
          amperage: a.amperage,
          wattage: a.wattage,
          connectorType: a.connectorType,
          tipSize: a.tipSize,
          plugType: a.plugType,
          stockQuantity: a.stockQuantity,
          minStockLevel: a.minStockLevel,
          purchasePrice: a.purchasePrice,
          sellingPrice: a.sellingPrice,
          wholesalePrice: a.wholesalePrice,
          supplier: a.supplier,
          location: a.location,
          notes: a.notes,
          isActive: a.isActive,
        })),
        laptops: laptopRows.map(l => ({
          serialNumber: l.serialNumber,
          partNumber: l.partNumber,
          barcode: l.barcode,
          brand: l.brand,
          model: l.model,
          sizeInch: l.sizeInch,
          cpu: l.cpu,
          ram: l.ram,
          storage: l.storage,
          gpu: l.gpu,
          stockQuantity: l.stockQuantity,
          minStockLevel: l.minStockLevel,
          purchasePrice: l.purchasePrice,
          sellingPrice: l.sellingPrice,
          wholesalePrice: l.wholesalePrice,
          supplier: l.supplier,
          location: l.location,
          notes: l.notes,
          isActive: l.isActive,
        })),
        desktops: desktopRows.map(d => ({
          serialNumber: d.serialNumber,
          partNumber: d.partNumber,
          barcode: d.barcode,
          brand: d.brand,
          model: d.model,
          cpu: d.cpu,
          ram: d.ram,
          storage: d.storage,
          gpu: d.gpu,
          stockQuantity: d.stockQuantity,
          minStockLevel: d.minStockLevel,
          purchasePrice: d.purchasePrice,
          sellingPrice: d.sellingPrice,
          wholesalePrice: d.wholesalePrice,
          supplier: d.supplier,
          location: d.location,
          notes: d.notes,
          isActive: d.isActive,
        })),
        keyboards: keyboardRows.map(k => ({
          serialNumber: k.serialNumber,
          partNumber: k.partNumber,
          barcode: k.barcode,
          brand: k.brand,
          layout: k.layout,
          keyboardType: k.keyboardType,
          backlight: k.backlight,
          stockQuantity: k.stockQuantity,
          minStockLevel: k.minStockLevel,
          purchasePrice: k.purchasePrice,
          sellingPrice: k.sellingPrice,
          wholesalePrice: k.wholesalePrice,
          supplier: k.supplier,
          location: k.location,
          notes: k.notes,
          isActive: k.isActive,
        })),
        lcds: lcdRows.map(l => ({
          serialNumber: l.serialNumber,
          partNumber: l.partNumber,
          barcode: l.barcode,
          brand: l.brand,
          sizeInch: l.sizeInch,
          brightnessNits: l.brightnessNits,
          refreshRateHz: l.refreshRateHz,
          resolution: l.resolution,
          connectorType: l.connectorType,
          panelType: l.panelType,
          stockQuantity: l.stockQuantity,
          minStockLevel: l.minStockLevel,
          purchasePrice: l.purchasePrice,
          sellingPrice: l.sellingPrice,
          wholesalePrice: l.wholesalePrice,
          supplier: l.supplier,
          location: l.location,
          notes: l.notes,
          isActive: l.isActive,
        })),
      };
      
      const filename = `inventory-backup-${new Date().toISOString().split('T')[0]}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json(backupData);
    } catch (error) {
      console.error("Error creating backup:", error);
      return res.status(500).json({ error: "خطأ في إنشاء النسخة الاحتياطية" });
    }
  });

  // Battery Restore - Import batteries/adapters/keyboards/LCDs/laptops/desktops from JSON backup
  app.post("/api/battery/batteries/restore", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { schemaVersion, data, batteries, adapters, laptops: laptopDataInput, desktops: desktopDataInput, keyboards: keyboardDataInput, lcds: lcdDataInput, mode = 'merge' } = req.body;
      
      // Support both old format (data array) and new format (batteries/adapters arrays)
      const batteryData = batteries || data || [];
      const adapterData = adapters || [];
      const laptopData = laptopDataInput || [];
      const desktopData = desktopDataInput || [];
      const keyboardData = keyboardDataInput || [];
      const lcdData = lcdDataInput || [];
      
      if (!schemaVersion || (!Array.isArray(batteryData) && !Array.isArray(adapterData) && !Array.isArray(laptopData) && !Array.isArray(desktopData) && !Array.isArray(keyboardData) && !Array.isArray(lcdData))) {
        return res.status(400).json({ error: "ملف النسخة الاحتياطية غير صالح" });
      }
      
      if (schemaVersion !== "1.0" && schemaVersion !== "1.1" && schemaVersion !== "1.2" && schemaVersion !== "1.3") {
        return res.status(400).json({ error: "إصدار النسخة الاحتياطية غير مدعوم" });
      }
      
      const results = {
        batteriesAdded: 0,
        batteriesUpdated: 0,
        batteriesSkipped: 0,
        adaptersAdded: 0,
        adaptersUpdated: 0,
        adaptersSkipped: 0,
        laptopsAdded: 0,
        laptopsUpdated: 0,
        laptopsSkipped: 0,
        desktopsAdded: 0,
        desktopsUpdated: 0,
        desktopsSkipped: 0,
        keyboardsAdded: 0,
        keyboardsUpdated: 0,
        keyboardsSkipped: 0,
        lcdsAdded: 0,
        lcdsUpdated: 0,
        lcdsSkipped: 0,
        errors: [] as string[],
      };
      
      // Process batteries
      for (const item of batteryData) {
        try {
          if (!item.serialNumber || !item.brand || !item.compatibleLaptops) {
            results.errors.push(`بيانات ناقصة للبطارية: ${item.serialNumber || 'غير معروف'}`);
            results.batteriesSkipped++;
            continue;
          }
          
          const existing = await storage.getLaptopBatteryBySerial(item.serialNumber);
          
          if (existing) {
            if (mode === 'merge') {
              const updated = await storage.updateLaptopBattery(existing.id, {
                partNumber: item.partNumber,
                barcode: item.barcode,
                brand: item.brand,
                compatibleLaptops: item.compatibleLaptops,
                voltage: item.voltage,
                capacity: item.capacity,
                cells: item.cells,
                stockQuantity: item.stockQuantity,
                minStockLevel: item.minStockLevel,
                purchasePrice: item.purchasePrice,
                sellingPrice: item.sellingPrice,
                wholesalePrice: item.wholesalePrice,
                supplier: item.supplier,
                location: item.location,
                notes: item.notes,
                isActive: item.isActive,
              });
              if (updated) await syncLaptopBatteryToInStore(updated);
              results.batteriesUpdated++;
            } else {
              results.batteriesSkipped++;
            }
          } else {
            const created = await storage.createLaptopBattery({
              serialNumber: item.serialNumber,
              partNumber: item.partNumber,
              barcode: item.barcode,
              brand: item.brand,
              compatibleLaptops: item.compatibleLaptops,
              voltage: item.voltage,
              capacity: item.capacity,
              cells: item.cells,
              stockQuantity: item.stockQuantity || 0,
              minStockLevel: item.minStockLevel || 2,
              purchasePrice: item.purchasePrice,
              sellingPrice: item.sellingPrice,
              wholesalePrice: item.wholesalePrice,
              supplier: item.supplier,
              location: item.location,
              notes: item.notes,
              isActive: item.isActive ?? 1,
            });
            await syncLaptopBatteryToInStore(created);
            results.batteriesAdded++;
          }
        } catch (itemError: any) {
          results.errors.push(`خطأ في البطارية ${item.serialNumber}: ${itemError.message}`);
          results.batteriesSkipped++;
        }
      }
      
      // Process adapters
      for (const item of adapterData) {
        try {
          if (!item.serialNumber || !item.brand || !item.compatibleLaptops) {
            results.errors.push(`بيانات ناقصة للشاحن: ${item.serialNumber || 'غير معروف'}`);
            results.adaptersSkipped++;
            continue;
          }
          
          const existing = await storage.getAcAdapterBySerial(item.serialNumber);
          
          if (existing) {
            if (mode === 'merge') {
              const updated = await storage.updateAcAdapter(existing.id, {
                partNumber: item.partNumber,
                barcode: item.barcode,
                brand: item.brand,
                compatibleLaptops: item.compatibleLaptops,
                inputVoltage: item.inputVoltage,
                outputVoltage: item.outputVoltage,
                amperage: item.amperage,
                wattage: item.wattage,
                connectorType: item.connectorType,
                tipSize: item.tipSize,
                plugType: item.plugType,
                stockQuantity: item.stockQuantity,
                minStockLevel: item.minStockLevel,
                purchasePrice: item.purchasePrice,
                sellingPrice: item.sellingPrice,
                wholesalePrice: item.wholesalePrice,
                supplier: item.supplier,
                location: item.location,
                notes: item.notes,
                isActive: item.isActive,
              });
              if (updated) await syncAcAdapterToInStore(updated);
              results.adaptersUpdated++;
            } else {
              results.adaptersSkipped++;
            }
          } else {
            const created = await storage.createAcAdapter({
              serialNumber: item.serialNumber,
              partNumber: item.partNumber,
              barcode: item.barcode || item.serialNumber,
              brand: item.brand,
              compatibleLaptops: item.compatibleLaptops,
              inputVoltage: item.inputVoltage,
              outputVoltage: item.outputVoltage,
              amperage: item.amperage,
              wattage: item.wattage,
              connectorType: item.connectorType,
              tipSize: item.tipSize,
              plugType: item.plugType,
              stockQuantity: item.stockQuantity || 0,
              minStockLevel: item.minStockLevel || 2,
              purchasePrice: item.purchasePrice,
              sellingPrice: item.sellingPrice,
              wholesalePrice: item.wholesalePrice,
              supplier: item.supplier,
              location: item.location,
              notes: item.notes,
              isActive: item.isActive ?? 1,
            });
            await syncAcAdapterToInStore(created);
            results.adaptersAdded++;
          }
        } catch (itemError: any) {
          results.errors.push(`خطأ في الشاحن ${item.serialNumber}: ${itemError.message}`);
          results.adaptersSkipped++;
        }
      }

      // Process laptops
      for (const item of laptopData) {
        try {
          if (!item.serialNumber || !item.brand) {
            results.errors.push(`بيانات ناقصة للابتوب: ${item.serialNumber || 'غير معروف'}`);
            results.laptopsSkipped++;
            continue;
          }
          const [existing] = await db.select().from(laptops).where(eq(laptops.serialNumber, item.serialNumber)).limit(1);
          const nextValues = {
            partNumber: item.partNumber,
            barcode: item.barcode || item.serialNumber,
            brand: item.brand,
            model: item.model,
            sizeInch: item.sizeInch,
            cpu: item.cpu,
            ram: item.ram,
            storage: item.storage,
            gpu: item.gpu,
            stockQuantity: item.stockQuantity ?? 0,
            minStockLevel: item.minStockLevel ?? 2,
            purchasePrice: item.purchasePrice,
            sellingPrice: item.sellingPrice,
            wholesalePrice: item.wholesalePrice,
            supplier: item.supplier,
            location: item.location,
            notes: item.notes,
            isActive: item.isActive ?? 1,
            updatedAt: new Date(),
          };
          if (existing) {
            if (mode === 'merge') {
              await db.update(laptops).set(nextValues).where(eq(laptops.id, existing.id));
              results.laptopsUpdated++;
            } else {
              results.laptopsSkipped++;
            }
          } else {
            await db.insert(laptops).values({
              serialNumber: item.serialNumber,
              ...nextValues,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            results.laptopsAdded++;
          }
        } catch (err: any) {
          results.errors.push(`خطأ في معالجة لابتوب ${item.serialNumber || 'غير معروف'}: ${err.message}`);
          results.laptopsSkipped++;
        }
      }

      // Process desktops
      for (const item of desktopData) {
        try {
          if (!item.serialNumber || !item.brand) {
            results.errors.push(`بيانات ناقصة للديسكتوب: ${item.serialNumber || 'غير معروف'}`);
            results.desktopsSkipped++;
            continue;
          }
          const [existing] = await db.select().from(desktops).where(eq(desktops.serialNumber, item.serialNumber)).limit(1);
          const nextValues = {
            partNumber: item.partNumber,
            barcode: item.barcode || item.serialNumber,
            brand: item.brand,
            model: item.model,
            cpu: item.cpu,
            ram: item.ram,
            storage: item.storage,
            gpu: item.gpu,
            stockQuantity: item.stockQuantity ?? 0,
            minStockLevel: item.minStockLevel ?? 2,
            purchasePrice: item.purchasePrice,
            sellingPrice: item.sellingPrice,
            wholesalePrice: item.wholesalePrice,
            supplier: item.supplier,
            location: item.location,
            notes: item.notes,
            isActive: item.isActive ?? 1,
            updatedAt: new Date(),
          };
          if (existing) {
            if (mode === 'merge') {
              await db.update(desktops).set(nextValues).where(eq(desktops.id, existing.id));
              results.desktopsUpdated++;
            } else {
              results.desktopsSkipped++;
            }
          } else {
            await db.insert(desktops).values({
              serialNumber: item.serialNumber,
              ...nextValues,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            results.desktopsAdded++;
          }
        } catch (err: any) {
          results.errors.push(`خطأ في معالجة ديسكتوب ${item.serialNumber || 'غير معروف'}: ${err.message}`);
          results.desktopsSkipped++;
        }
      }

      // Process keyboards
      for (const item of keyboardData) {
        try {
          if (!item.serialNumber || !item.brand) {
            results.errors.push(`بيانات ناقصة للكيبورد: ${item.serialNumber || 'غير معروف'}`);
            results.keyboardsSkipped++;
            continue;
          }

          const existing = await db.select().from(keyboards).where(eq(keyboards.serialNumber, item.serialNumber)).limit(1);

          if (existing.length) {
            if (mode === 'merge') {
              await db.update(keyboards).set({
                partNumber: item.partNumber,
                barcode: item.barcode || item.serialNumber,
                brand: item.brand,
                layout: item.layout,
                keyboardType: item.keyboardType,
                backlight: item.backlight ?? 0,
                stockQuantity: item.stockQuantity,
                minStockLevel: item.minStockLevel,
                purchasePrice: item.purchasePrice,
                sellingPrice: item.sellingPrice,
                wholesalePrice: item.wholesalePrice,
                supplier: item.supplier,
                location: item.location,
                notes: item.notes,
                isActive: item.isActive ?? 1,
                updatedAt: new Date(),
              }).where(eq(keyboards.id, existing[0].id));
              results.keyboardsUpdated++;
            } else {
              results.keyboardsSkipped++;
            }
          } else {
            await db.insert(keyboards).values({
              serialNumber: item.serialNumber,
              partNumber: item.partNumber,
              barcode: item.barcode || item.serialNumber,
              brand: item.brand,
              layout: item.layout,
              keyboardType: item.keyboardType,
              backlight: item.backlight ?? 0,
              stockQuantity: item.stockQuantity || 0,
              minStockLevel: item.minStockLevel || 2,
              purchasePrice: item.purchasePrice,
              sellingPrice: item.sellingPrice,
              wholesalePrice: item.wholesalePrice,
              supplier: item.supplier,
              location: item.location,
              notes: item.notes,
              isActive: item.isActive ?? 1,
            });
            results.keyboardsAdded++;
          }
        } catch (itemError: any) {
          results.errors.push(`خطأ في الكيبورد ${item.serialNumber}: ${itemError.message}`);
          results.keyboardsSkipped++;
        }
      }

      // Process LCDs
      for (const item of lcdData) {
        try {
          if (!item.serialNumber || !item.brand) {
            results.errors.push(`بيانات ناقصة لشاشة LCD: ${item.serialNumber || 'غير معروف'}`);
            results.lcdsSkipped++;
            continue;
          }

          const existing = await db.select().from(lcds).where(eq(lcds.serialNumber, item.serialNumber)).limit(1);

          if (existing.length) {
            if (mode === 'merge') {
              await db.update(lcds).set({
                partNumber: item.partNumber,
                barcode: item.barcode || item.serialNumber,
                brand: item.brand,
                sizeInch: item.sizeInch,
                brightnessNits: item.brightnessNits,
                refreshRateHz: item.refreshRateHz,
                resolution: item.resolution,
                connectorType: item.connectorType,
                panelType: item.panelType,
                stockQuantity: item.stockQuantity,
                minStockLevel: item.minStockLevel,
                purchasePrice: item.purchasePrice,
                sellingPrice: item.sellingPrice,
                wholesalePrice: item.wholesalePrice,
                supplier: item.supplier,
                location: item.location,
                notes: item.notes,
                isActive: item.isActive ?? 1,
                updatedAt: new Date(),
              }).where(eq(lcds.id, existing[0].id));
              results.lcdsUpdated++;
            } else {
              results.lcdsSkipped++;
            }
          } else {
            await db.insert(lcds).values({
              serialNumber: item.serialNumber,
              partNumber: item.partNumber,
              barcode: item.barcode || item.serialNumber,
              brand: item.brand,
              sizeInch: item.sizeInch,
              brightnessNits: item.brightnessNits,
              refreshRateHz: item.refreshRateHz,
              resolution: item.resolution,
              connectorType: item.connectorType,
              panelType: item.panelType,
              stockQuantity: item.stockQuantity || 0,
              minStockLevel: item.minStockLevel || 2,
              purchasePrice: item.purchasePrice,
              sellingPrice: item.sellingPrice,
              wholesalePrice: item.wholesalePrice,
              supplier: item.supplier,
              location: item.location,
              notes: item.notes,
              isActive: item.isActive ?? 1,
            });
            results.lcdsAdded++;
          }
        } catch (itemError: any) {
          results.errors.push(`خطأ في شاشة LCD ${item.serialNumber}: ${itemError.message}`);
          results.lcdsSkipped++;
        }
      }
      
      const totalAdded = results.batteriesAdded + results.adaptersAdded + results.laptopsAdded + results.desktopsAdded + results.keyboardsAdded + results.lcdsAdded;
      const totalUpdated = results.batteriesUpdated + results.adaptersUpdated + results.laptopsUpdated + results.desktopsUpdated + results.keyboardsUpdated + results.lcdsUpdated;
      const totalSkipped = results.batteriesSkipped + results.adaptersSkipped + results.laptopsSkipped + results.desktopsSkipped + results.keyboardsSkipped + results.lcdsSkipped;
      
      return res.json({
        success: true,
        message: `تمت الاستعادة: ${totalAdded} جديد، ${totalUpdated} محدث، ${totalSkipped} تخطي`,
        added: totalAdded,
        updated: totalUpdated,
        skipped: totalSkipped,
        ...results,
      });
    } catch (error) {
      console.error("Error restoring backup:", error);
      return res.status(500).json({ error: "خطأ في استعادة النسخة الاحتياطية" });
    }
  });
  
  app.get("/api/battery/batteries/search", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { q, type } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.json([]);
      }
      
      let results: any[] = [];
      
      if (type === 'serial') {
        // Search by battery serial number
        const searchLower = q.toLowerCase();
        const allBatteries = await storage.getLaptopBatteries();
        results = allBatteries.filter(b => 
          b.serialNumber.toLowerCase().includes(searchLower) ||
          (b.partNumber && b.partNumber.toLowerCase().includes(searchLower)) ||
          b.brand.toLowerCase().includes(searchLower)
        );
      } else if (type === 'laptop') {
        // Search by laptop model
        const searchLower = q.toLowerCase();
        const allBatteries = await storage.getLaptopBatteries();
        results = allBatteries.filter(b => 
          b.compatibleLaptops.some(laptop => laptop.toLowerCase().includes(searchLower))
        );
      } else {
        // Advanced Fuzzy-like Search
        const searchLower = q.toLowerCase();
        const allBatteries = await storage.getLaptopBatteries();
        
        // Multi-term search support (e.g. "Dell Latitude")
        const terms = searchLower.split(/\s+/).filter(t => t.length > 0);
        
        results = allBatteries.filter(b => {
          const batteryStr = `${b.serialNumber} ${b.partNumber || ''} ${b.brand} ${b.compatibleLaptops.join(' ')}`.toLowerCase();
          return terms.every(term => batteryStr.includes(term));
        });
      }
      
      return res.json(results);
    } catch (error) {
      console.error("Error searching batteries:", error);
      return res.status(500).json({ error: "خطأ في البحث" });
    }
  });
  
  app.get("/api/battery/batteries/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const battery = await storage.getLaptopBattery(req.params.id);
      if (!battery) {
        return res.status(404).json({ error: "البطارية غير موجودة" });
      }
      return res.json(battery);
    } catch (error) {
      console.error("Error getting battery:", error);
      return res.status(500).json({ error: "خطأ في جلب البطارية" });
    }
  });
  
  /** One-time / manual: mirror all active batteries & adapters into in_store_products. */
  app.post("/api/battery/sync-instore", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      const batteries = await storage.getLaptopBatteries();
      const adapters = await storage.getAcAdapters();
      let batteriesSynced = 0;
      let adaptersSynced = 0;
      for (const b of batteries) {
        if ((b.isActive ?? 1) === 1) {
          await syncLaptopBatteryToInStore(b);
          batteriesSynced++;
        }
      }
      for (const a of adapters) {
        if ((a.isActive ?? 1) === 1) {
          await syncAcAdapterToInStore(a);
          adaptersSynced++;
        }
      }
      return res.json({ batteriesSynced, adaptersSynced });
    } catch (error) {
      console.error("Error syncing battery catalog to instore:", error);
      return res.status(500).json({ error: "خطأ في مزامنة المخزون مع نقطة البيع" });
    }
  });

  app.post("/api/battery/batteries", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { serialNumber, partNumber, barcode, brand, compatibleLaptops, voltage, capacity, cells, stockQuantity, minStockLevel, purchasePrice, wholesalePrice, sellingPrice, supplier, location, notes } = req.body;
      
      if (!serialNumber || !brand || !compatibleLaptops || compatibleLaptops.length === 0) {
        return res.status(400).json({ error: "الرقم التسلسلي والعلامة التجارية والأجهزة المتوافقة مطلوبة" });
      }
      
      // Check if serial number already exists
      const existing = await storage.getLaptopBatteryBySerial(serialNumber);
      if (existing) {
        return res.status(400).json({ error: "الرقم التسلسلي موجود مسبقاً" });
      }
      
      // Auto-generate barcode from serial number if not provided
      const generatedBarcode = barcode || `BAT-${serialNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`;
      
      const battery = await storage.createLaptopBattery({
        serialNumber,
        partNumber: partNumber || null,
        barcode: generatedBarcode,
        brand,
        compatibleLaptops,
        voltage: voltage || null,
        capacity: capacity || null,
        cells: cells || null,
        stockQuantity: stockQuantity || 0,
        minStockLevel: minStockLevel || 2,
        purchasePrice: purchasePrice || null,
        wholesalePrice: wholesalePrice || null,
        sellingPrice: sellingPrice || null,
        supplier: supplier || null,
        location: location || null,
        notes: notes || null,
        isActive: 1
      });

      await syncLaptopBatteryToInStore(battery);
      
      return res.json(battery);
    } catch (error) {
      console.error("Error creating battery:", error);
      return res.status(500).json({ error: "خطأ في إضافة البطارية" });
    }
  });
  
  app.put("/api/battery/batteries/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const updateData = { ...req.body };
      
      // Auto-regenerate barcode when serial number changes
      if (updateData.serialNumber) {
        updateData.barcode = `BAT-${updateData.serialNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`;
      }
      
      const battery = await storage.updateLaptopBattery(req.params.id, updateData);
      if (!battery) {
        return res.status(404).json({ error: "البطارية غير موجودة" });
      }
      await syncLaptopBatteryToInStore(battery);
      return res.json(battery);
    } catch (error) {
      console.error("Error updating battery:", error);
      return res.status(500).json({ error: "خطأ في تحديث البطارية" });
    }
  });
  
  app.delete("/api/battery/batteries/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      await storage.deleteLaptopBattery(req.params.id);
      await deactivateSyncedBatteryInStore(req.params.id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting battery:", error);
      return res.status(500).json({ error: "خطأ في حذف البطارية" });
    }
  });
  
  // AC Adapter Routes
  app.get("/api/battery/adapters", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      const salesUserId = (req.session as any).salesUserId;
      if (!batteryUserId && !salesUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      const locationId = req.query.locationId != null
        ? parseInt(String(req.query.locationId), 10)
        : (salesUserId ? resolveRequestLocationId(req) : null);
      if (locationId && !Number.isNaN(locationId)) {
        const rows = await db
          .select()
          .from(acAdapters)
          .where(and(eq(acAdapters.isActive, 1), eq(acAdapters.salesLocationId, locationId)))
          .orderBy(desc(acAdapters.createdAt));
        return res.json(rows);
      }

      const adapters = await storage.getAcAdapters();
      return res.json(adapters);
    } catch (error) {
      console.error("Error getting adapters:", error);
      return res.status(500).json({ error: "خطأ في جلب الشواحن" });
    }
  });
  
  app.get("/api/battery/adapters/low-stock", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const adapters = await storage.getLowStockAdapters();
      return res.json(adapters);
    } catch (error) {
      console.error("Error getting low stock adapters:", error);
      return res.status(500).json({ error: "خطأ في جلب الشواحن منخفضة المخزون" });
    }
  });
  
  app.get("/api/battery/adapters/search", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { q, type } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: "يرجى إدخال كلمة البحث" });
      }
      
      let results;
      if (type === 'serial') {
        const adapter = await storage.getAcAdapterBySerial(q);
        results = adapter ? [adapter] : [];
      } else {
        results = await storage.searchAdaptersByLaptopModel(q);
      }
      
      return res.json(results);
    } catch (error) {
      console.error("Error searching adapters:", error);
      return res.status(500).json({ error: "خطأ في البحث" });
    }
  });
  
  app.get("/api/battery/adapters/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const adapter = await storage.getAcAdapter(req.params.id);
      if (!adapter) {
        return res.status(404).json({ error: "الشاحن غير موجود" });
      }
      return res.json(adapter);
    } catch (error) {
      console.error("Error getting adapter:", error);
      return res.status(500).json({ error: "خطأ في جلب الشاحن" });
    }
  });
  
  app.post("/api/battery/adapters", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { serialNumber, brand, compatibleLaptops, ...rest } = req.body;
      
      if (!brand || !compatibleLaptops || !Array.isArray(compatibleLaptops)) {
        return res.status(400).json({ error: "العلامة التجارية والأجهزة المتوافقة مطلوبة" });
      }

      let finalSerial = (serialNumber || "").trim();
      if (!finalSerial) {
        const allAdapters = await storage.getAcAdapters();
        const used = new Set(allAdapters.map(a => (a.serialNumber || "").trim().toUpperCase()));
        let max = 0;
        for (const a of allAdapters) {
          const m = (a.serialNumber || "").match(/^ADP-(\d+)$/i);
          if (m) max = Math.max(max, parseInt(m[1], 10));
        }
        let next = max + 1;
        do {
          finalSerial = `ADP-${String(next).padStart(4, "0")}`;
          next++;
        } while (used.has(finalSerial.toUpperCase()));
      }

      const existing = await storage.getAcAdapterBySerial(finalSerial);
      if (existing) return res.status(400).json({ error: "الرقم التسلسلي موجود مسبقاً" });

      const barcode = rest.barcode || finalSerial;
      
      const adapter = await storage.createAcAdapter({
        serialNumber: finalSerial,
        brand,
        compatibleLaptops,
        barcode,
        ...rest
      });

      await syncAcAdapterToInStore(adapter);
      
      return res.status(201).json(adapter);
    } catch (error) {
      console.error("Error creating adapter:", error);
      return res.status(500).json({ error: "خطأ في إضافة الشاحن" });
    }
  });
  
  app.put("/api/battery/adapters/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const updateData = { ...req.body };
      
      // If serial changes and barcode not explicitly provided, keep barcode synced to serial
      if (updateData.serialNumber && !updateData.barcode) {
        updateData.barcode = updateData.serialNumber;
      }
      
      const adapter = await storage.updateAcAdapter(req.params.id, updateData);
      if (!adapter) {
        return res.status(404).json({ error: "الشاحن غير موجود" });
      }
      await syncAcAdapterToInStore(adapter);
      return res.json(adapter);
    } catch (error) {
      console.error("Error updating adapter:", error);
      return res.status(500).json({ error: "خطأ في تحديث الشاحن" });
    }
  });
  
  app.delete("/api/battery/adapters/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      await storage.deleteAcAdapter(req.params.id);
      await deactivateSyncedAdapterInStore(req.params.id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting adapter:", error);
      return res.status(500).json({ error: "خطأ في حذف الشاحن" });
    }
  });

  // One-time migration: sync adapter/keyboard/LCD barcodes with serial numbers
  app.post("/api/battery/migrations/sync-barcodes-to-serial", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      const currentUser = await storage.getBatteryUser(batteryUserId);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ error: "غير مسموح" });
      }

      const adapterRows = await storage.getAcAdapters();
      const laptopRows = await db.select().from(laptops).where(eq(laptops.isActive, 1));
      const desktopRows = await db.select().from(desktops).where(eq(desktops.isActive, 1));
      const keyboardRows = await db.select().from(keyboards).where(eq(keyboards.isActive, 1));
      const lcdRows = await db.select().from(lcds).where(eq(lcds.isActive, 1));

      let adaptersUpdated = 0;
      let adaptersSerialFixed = 0;
      let adaptersSerialFixSkipped = 0;
      let laptopsUpdated = 0;
      let desktopsUpdated = 0;
      let keyboardsUpdated = 0;
      let lcdsUpdated = 0;

      for (const row of adapterRows) {
        // Legacy fix: old data sometimes stored brand in serialNumber.
        // If serialNumber equals brand and partNumber exists, promote partNumber as serial.
        const isLegacySerial = (row.serialNumber || "").trim() === (row.brand || "").trim();
        const candidateSerial = (row.partNumber || "").trim();
        if (isLegacySerial && candidateSerial && candidateSerial !== row.serialNumber) {
          const serialConflict = await storage.getAcAdapterBySerial(candidateSerial);
          if (!serialConflict || serialConflict.id === row.id) {
            await storage.updateAcAdapter(row.id, {
              serialNumber: candidateSerial,
              barcode: candidateSerial,
            });
            adaptersUpdated++;
            adaptersSerialFixed++;
            continue;
          } else {
            adaptersSerialFixSkipped++;
          }
        }

        if ((row.barcode || "") !== row.serialNumber) {
          await storage.updateAcAdapter(row.id, { barcode: row.serialNumber });
          adaptersUpdated++;
        }
      }

      for (const row of keyboardRows) {
        if ((row.barcode || "") !== row.serialNumber) {
          await db
            .update(keyboards)
            .set({ barcode: row.serialNumber, updatedAt: new Date() })
            .where(eq(keyboards.id, row.id));
          keyboardsUpdated++;
        }
      }

      for (const row of lcdRows) {
        if ((row.barcode || "") !== row.serialNumber) {
          await db
            .update(lcds)
            .set({ barcode: row.serialNumber, updatedAt: new Date() })
            .where(eq(lcds.id, row.id));
          lcdsUpdated++;
        }
      }

      for (const row of laptopRows) {
        if ((row.barcode || "") !== row.serialNumber) {
          await db
            .update(laptops)
            .set({ barcode: row.serialNumber, updatedAt: new Date() })
            .where(eq(laptops.id, row.id));
          laptopsUpdated++;
        }
      }

      for (const row of desktopRows) {
        if ((row.barcode || "") !== row.serialNumber) {
          await db
            .update(desktops)
            .set({ barcode: row.serialNumber, updatedAt: new Date() })
            .where(eq(desktops.id, row.id));
          desktopsUpdated++;
        }
      }

      const totalUpdated = adaptersUpdated + laptopsUpdated + desktopsUpdated + keyboardsUpdated + lcdsUpdated;
      return res.json({
        success: true,
        message: `Barcode sync completed. Updated ${totalUpdated} items.`,
        adaptersUpdated,
        adaptersSerialFixed,
        adaptersSerialFixSkipped,
        laptopsUpdated,
        desktopsUpdated,
        keyboardsUpdated,
        lcdsUpdated,
        totalUpdated,
      });
    } catch (error) {
      console.error("Error syncing barcodes to serial:", error);
      return res.status(500).json({ error: "فشل في مزامنة الباركود مع الرقم التسلسلي" });
    }
  });

  // Regenerate barcodes in ordered sequence for all battery system inventory
  app.post("/api/battery/migrations/regenerate-sequence-barcodes", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      const currentUser = await storage.getBatteryUser(batteryUserId);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ error: "غير مسموح" });
      }

      const batteriesRows = [...await storage.getLaptopBatteries()].sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
      const adapterRows = [...await storage.getAcAdapters()].sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
      const laptopRows = [...await db.select().from(laptops).where(eq(laptops.isActive, 1))].sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
      const desktopRows = [...await db.select().from(desktops).where(eq(desktops.isActive, 1))].sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
      const keyboardRows = [...await db.select().from(keyboards).where(eq(keyboards.isActive, 1))].sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
      const lcdRows = [...await db.select().from(lcds).where(eq(lcds.isActive, 1))].sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
      const productRows = await db.select({ id: products.id, sku: products.sku }).from(products);

      const productsBySku = new Map<string, Array<{ id: string; sku: string | null }>>();
      for (const p of productRows) {
        const k = (p.sku || "").trim().toLowerCase();
        if (!k) continue;
        const arr = productsBySku.get(k) || [];
        arr.push(p);
        productsBySku.set(k, arr);
      }

      const makeCode = (prefix: string, index: number) => `${prefix}-${String(index).padStart(6, "0")}`;
      const updatedProductIds = new Set<string>();

      const syncInstoreSku = async (newBarcode: string, ...matchKeys: Array<string | null | undefined>) => {
        const matched = new Map<string, string | null>();
        for (const key of matchKeys) {
          const k = (key || "").trim().toLowerCase();
          if (!k) continue;
          const rows = productsBySku.get(k) || [];
          for (const row of rows) {
            matched.set(row.id, row.sku);
          }
        }

        let changed = 0;
        for (const [productId, currentSku] of matched.entries()) {
          if (updatedProductIds.has(productId)) continue;
          if ((currentSku || "") === newBarcode) {
            updatedProductIds.add(productId);
            continue;
          }
          await db.update(products).set({ sku: newBarcode }).where(eq(products.id, productId));
          updatedProductIds.add(productId);
          changed++;
        }
        return { matched: matched.size, changed };
      };

      let batteriesUpdated = 0;
      let adaptersUpdated = 0;
      let laptopsUpdated = 0;
      let desktopsUpdated = 0;
      let keyboardsUpdated = 0;
      let lcdsUpdated = 0;
      let inStoreSkuUpdated = 0;
      let inStoreMatched = 0;

      for (let i = 0; i < batteriesRows.length; i++) {
        const row = batteriesRows[i];
        const newBarcode = makeCode("BAT", i + 1);
        if ((row.barcode || "") !== newBarcode) {
          await storage.updateLaptopBattery(row.id, { barcode: newBarcode });
          batteriesUpdated++;
        }
        const linked = await syncInstoreSku(newBarcode, row.serialNumber, row.partNumber, row.barcode);
        inStoreSkuUpdated += linked.changed;
        inStoreMatched += linked.matched;
      }

      for (let i = 0; i < adapterRows.length; i++) {
        const row = adapterRows[i];
        const newBarcode = makeCode("ADP", i + 1);
        if ((row.barcode || "") !== newBarcode) {
          await storage.updateAcAdapter(row.id, { barcode: newBarcode });
          adaptersUpdated++;
        }
        const linked = await syncInstoreSku(newBarcode, row.serialNumber, row.partNumber, row.barcode);
        inStoreSkuUpdated += linked.changed;
        inStoreMatched += linked.matched;
      }

      for (let i = 0; i < laptopRows.length; i++) {
        const row = laptopRows[i];
        const newBarcode = makeCode("LAP", i + 1);
        if ((row.barcode || "") !== newBarcode) {
          await db
            .update(laptops)
            .set({ barcode: newBarcode, updatedAt: new Date() })
            .where(eq(laptops.id, row.id));
          laptopsUpdated++;
        }
        const linked = await syncInstoreSku(newBarcode, row.serialNumber, row.partNumber, row.barcode);
        inStoreSkuUpdated += linked.changed;
        inStoreMatched += linked.matched;
      }

      for (let i = 0; i < desktopRows.length; i++) {
        const row = desktopRows[i];
        const newBarcode = makeCode("DES", i + 1);
        if ((row.barcode || "") !== newBarcode) {
          await db
            .update(desktops)
            .set({ barcode: newBarcode, updatedAt: new Date() })
            .where(eq(desktops.id, row.id));
          desktopsUpdated++;
        }
        const linked = await syncInstoreSku(newBarcode, row.serialNumber, row.partNumber, row.barcode);
        inStoreSkuUpdated += linked.changed;
        inStoreMatched += linked.matched;
      }

      for (let i = 0; i < keyboardRows.length; i++) {
        const row = keyboardRows[i];
        const newBarcode = makeCode("KEY", i + 1);
        if ((row.barcode || "") !== newBarcode) {
          await db
            .update(keyboards)
            .set({ barcode: newBarcode, updatedAt: new Date() })
            .where(eq(keyboards.id, row.id));
          keyboardsUpdated++;
        }
        const linked = await syncInstoreSku(newBarcode, row.serialNumber, row.partNumber, row.barcode);
        inStoreSkuUpdated += linked.changed;
        inStoreMatched += linked.matched;
      }

      for (let i = 0; i < lcdRows.length; i++) {
        const row = lcdRows[i];
        const newBarcode = makeCode("LCD", i + 1);
        if ((row.barcode || "") !== newBarcode) {
          await db
            .update(lcds)
            .set({ barcode: newBarcode, updatedAt: new Date() })
            .where(eq(lcds.id, row.id));
          lcdsUpdated++;
        }
        const linked = await syncInstoreSku(newBarcode, row.serialNumber, row.partNumber, row.barcode);
        inStoreSkuUpdated += linked.changed;
        inStoreMatched += linked.matched;
      }

      const totalUpdated = batteriesUpdated + adaptersUpdated + laptopsUpdated + desktopsUpdated + keyboardsUpdated + lcdsUpdated;
      return res.json({
        success: true,
        message: `Sequence barcode regeneration completed. Updated ${totalUpdated} items.`,
        batteriesUpdated,
        adaptersUpdated,
        laptopsUpdated,
        desktopsUpdated,
        keyboardsUpdated,
        lcdsUpdated,
        inStoreSkuUpdated,
        inStoreMatched,
        totalUpdated,
      });
    } catch (error) {
      console.error("Error regenerating sequence barcodes:", error);
      return res.status(500).json({ error: "فشل في إعادة توليد الباركود التسلسلي" });
    }
  });

  // Sync in-store inventory SKU with battery-system barcodes
  app.post("/api/battery/migrations/sync-barcodes-with-instore", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      const currentUser = await storage.getBatteryUser(batteryUserId);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ error: "غير مسموح" });
      }

      const productRows = await db
        .select({ id: products.id, sku: products.sku, nameAr: products.nameAr, nameEn: products.nameEn })
        .from(products);

      const index = new Map<string, Set<string>>();
      const addIndex = (value: string | null | undefined, productId: string) => {
        const key = (value || "").trim().toLowerCase();
        if (!key) return;
        const set = index.get(key) ?? new Set<string>();
        set.add(productId);
        index.set(key, set);
      };

      for (const p of productRows) {
        addIndex(p.sku, p.id);
        addIndex(p.nameAr, p.id);
        addIndex(p.nameEn, p.id);
      }

      const claimedProductIds = new Set<string>();
      const findProductIds = (...keys: Array<string | null | undefined>) => {
        const ids = new Set<string>();
        const normalized = keys.map(k => (k || "").trim()).filter(Boolean);

        for (const key of normalized) {
          const exact = index.get(key.toLowerCase());
          if (exact) for (const id of exact) ids.add(id);
        }

        // Fallback: partial match in product names for meaningful keys (serial/part-like)
        for (const key of normalized) {
          if (key.length < 4) continue;
          const lk = key.toLowerCase();
          for (const p of productRows) {
            const n1 = (p.nameAr || "").toLowerCase();
            const n2 = (p.nameEn || "").toLowerCase();
            if (n1.includes(lk) || n2.includes(lk)) ids.add(p.id);
          }
        }

        const available = [...ids].filter(id => !claimedProductIds.has(id));
        return available;
      };

      let batteriesMatched = 0;
      let adaptersMatched = 0;
      let laptopsMatched = 0;
      let desktopsMatched = 0;
      let keyboardsMatched = 0;
      let lcdsMatched = 0;
      let inStoreSkuUpdated = 0;
      let unmatched = 0;

      const batteriesRows = await storage.getLaptopBatteries();
      for (const row of batteriesRows) {
        const targetBarcode = row.barcode || row.serialNumber;
        const matches = findProductIds(row.serialNumber, row.partNumber, row.barcode);
        if (matches.length === 0) {
          unmatched++;
          continue;
        }
        batteriesMatched++;
        for (const productId of matches) {
          const product = productRows.find(p => p.id === productId);
          if (product && (product.sku || "") !== targetBarcode) {
            await db.update(products).set({ sku: targetBarcode }).where(eq(products.id, productId));
            inStoreSkuUpdated++;
          }
          claimedProductIds.add(productId);
        }
      }

      const adaptersRows = await storage.getAcAdapters();
      for (const row of adaptersRows) {
        const targetBarcode = row.barcode || row.serialNumber;
        const matches = findProductIds(row.serialNumber, row.partNumber, row.barcode);
        if (matches.length === 0) {
          unmatched++;
          continue;
        }
        adaptersMatched++;
        for (const productId of matches) {
          const product = productRows.find(p => p.id === productId);
          if (product && (product.sku || "") !== targetBarcode) {
            await db.update(products).set({ sku: targetBarcode }).where(eq(products.id, productId));
            inStoreSkuUpdated++;
          }
          claimedProductIds.add(productId);
        }
      }

      const laptopRows = await db.select().from(laptops).where(eq(laptops.isActive, 1));
      for (const row of laptopRows) {
        const targetBarcode = row.barcode || row.serialNumber;
        const matches = findProductIds(row.serialNumber, row.partNumber, row.barcode);
        if (matches.length === 0) {
          unmatched++;
          continue;
        }
        laptopsMatched++;
        for (const productId of matches) {
          const product = productRows.find(p => p.id === productId);
          if (product && (product.sku || "") !== targetBarcode) {
            await db.update(products).set({ sku: targetBarcode }).where(eq(products.id, productId));
            inStoreSkuUpdated++;
          }
          claimedProductIds.add(productId);
        }
      }

      const desktopRows = await db.select().from(desktops).where(eq(desktops.isActive, 1));
      for (const row of desktopRows) {
        const targetBarcode = row.barcode || row.serialNumber;
        const matches = findProductIds(row.serialNumber, row.partNumber, row.barcode);
        if (matches.length === 0) {
          unmatched++;
          continue;
        }
        desktopsMatched++;
        for (const productId of matches) {
          const product = productRows.find(p => p.id === productId);
          if (product && (product.sku || "") !== targetBarcode) {
            await db.update(products).set({ sku: targetBarcode }).where(eq(products.id, productId));
            inStoreSkuUpdated++;
          }
          claimedProductIds.add(productId);
        }
      }

      const keyboardRows = await db.select().from(keyboards).where(eq(keyboards.isActive, 1));
      for (const row of keyboardRows) {
        const targetBarcode = row.barcode || row.serialNumber;
        const matches = findProductIds(row.serialNumber, row.partNumber, row.barcode);
        if (matches.length === 0) {
          unmatched++;
          continue;
        }
        keyboardsMatched++;
        for (const productId of matches) {
          const product = productRows.find(p => p.id === productId);
          if (product && (product.sku || "") !== targetBarcode) {
            await db.update(products).set({ sku: targetBarcode }).where(eq(products.id, productId));
            inStoreSkuUpdated++;
          }
          claimedProductIds.add(productId);
        }
      }

      const lcdRows = await db.select().from(lcds).where(eq(lcds.isActive, 1));
      for (const row of lcdRows) {
        const targetBarcode = row.barcode || row.serialNumber;
        const matches = findProductIds(row.serialNumber, row.partNumber, row.barcode);
        if (matches.length === 0) {
          unmatched++;
          continue;
        }
        lcdsMatched++;
        for (const productId of matches) {
          const product = productRows.find(p => p.id === productId);
          if (product && (product.sku || "") !== targetBarcode) {
            await db.update(products).set({ sku: targetBarcode }).where(eq(products.id, productId));
            inStoreSkuUpdated++;
          }
          claimedProductIds.add(productId);
        }
      }

      const totalUpdated = inStoreSkuUpdated;
      return res.json({
        success: true,
        message: `In-store barcode sync completed. Updated ${totalUpdated} SKU values.`,
        batteriesMatched,
        adaptersMatched,
        laptopsMatched,
        desktopsMatched,
        keyboardsMatched,
        lcdsMatched,
        inStoreSkuUpdated,
        unmatched,
        totalUpdated,
      });
    } catch (error) {
      console.error("Error syncing barcodes with in-store inventory:", error);
      return res.status(500).json({ error: "فشل في مزامنة باركود نظام البطاريات مع باركود المخزن" });
    }
  });

  // Keyboard Routes
  app.get("/api/battery/keyboards", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      const salesUserId = (req.session as any).salesUserId;
      if (!batteryUserId && !salesUserId) return res.status(401).json({ error: "غير مصرح" });
      const rows = await db.select().from(keyboards).where(eq(keyboards.isActive, 1)).orderBy(desc(keyboards.createdAt));
      return res.json(rows);
    } catch (error) {
      console.error("Error getting keyboards:", error);
      return res.status(500).json({ error: "خطأ في جلب لوحات المفاتيح" });
    }
  });

  app.get("/api/battery/keyboards/low-stock", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const rows = await db.select().from(keyboards).where(and(
        eq(keyboards.isActive, 1),
        sql`${keyboards.stockQuantity} <= ${keyboards.minStockLevel}`
      ));
      return res.json(rows);
    } catch (error) {
      console.error("Error getting low stock keyboards:", error);
      return res.status(500).json({ error: "خطأ في جلب لوحات المفاتيح منخفضة المخزون" });
    }
  });

  app.get("/api/battery/keyboards/search", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      if (!q) return res.json([]);
      const rows = await db.select().from(keyboards).where(eq(keyboards.isActive, 1));
      const terms = q.split(/\s+/).filter(Boolean);
      const filtered = rows.filter(k => {
        const s = `${k.serialNumber} ${k.partNumber || ""} ${k.brand} ${k.layout || ""} ${k.keyboardType || ""} ${k.barcode || ""}`.toLowerCase();
        return terms.every(t => s.includes(t));
      });
      return res.json(filtered);
    } catch (error) {
      console.error("Error searching keyboards:", error);
      return res.status(500).json({ error: "خطأ في البحث" });
    }
  });

  app.post("/api/battery/keyboards", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const { serialNumber, brand, ...rest } = req.body;
      if (!brand) return res.status(400).json({ error: "الماركة مطلوبة" });
      let finalSerial = (serialNumber || "").trim();
      if (!finalSerial) {
        const rows = await db.select({ serialNumber: keyboards.serialNumber }).from(keyboards);
        const used = new Set(rows.map(r => (r.serialNumber || "").trim().toUpperCase()));
        let max = 0;
        for (const r of rows) {
          const m = (r.serialNumber || "").match(/^KBD-(\d+)$/i);
          if (m) max = Math.max(max, parseInt(m[1], 10));
        }
        let next = max + 1;
        do {
          finalSerial = `KBD-${String(next).padStart(4, "0")}`;
          next++;
        } while (used.has(finalSerial.toUpperCase()));
      }
      const existing = await db.select().from(keyboards).where(eq(keyboards.serialNumber, finalSerial)).limit(1);
      if (existing.length) return res.status(400).json({ error: "الرقم التسلسلي موجود مسبقاً" });
      const barcode = rest.barcode || finalSerial;
      const [row] = await db.insert(keyboards).values({ serialNumber: finalSerial, brand, barcode, ...rest }).returning();
      return res.status(201).json(row);
    } catch (error) {
      console.error("Error creating keyboard:", error);
      return res.status(500).json({ error: "خطأ في إضافة لوحة المفاتيح" });
    }
  });

  app.put("/api/battery/keyboards/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const updateData = { ...req.body };
      if (updateData.serialNumber) {
        updateData.barcode = updateData.serialNumber;
      }
      const [row] = await db.update(keyboards).set({ ...updateData, updatedAt: new Date() }).where(eq(keyboards.id, req.params.id)).returning();
      if (!row) return res.status(404).json({ error: "لوحة المفاتيح غير موجودة" });
      return res.json(row);
    } catch (error) {
      console.error("Error updating keyboard:", error);
      return res.status(500).json({ error: "خطأ في تحديث لوحة المفاتيح" });
    }
  });

  app.delete("/api/battery/keyboards/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      await db.update(keyboards).set({ isActive: 0, updatedAt: new Date() }).where(eq(keyboards.id, req.params.id));
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting keyboard:", error);
      return res.status(500).json({ error: "خطأ في حذف لوحة المفاتيح" });
    }
  });

  // LCD Routes
  app.get("/api/battery/lcds", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      const salesUserId = (req.session as any).salesUserId;
      if (!batteryUserId && !salesUserId) return res.status(401).json({ error: "غير مصرح" });
      const rows = await db.select().from(lcds).where(eq(lcds.isActive, 1)).orderBy(desc(lcds.createdAt));
      return res.json(rows);
    } catch (error) {
      console.error("Error getting LCDs:", error);
      return res.status(500).json({ error: "خطأ في جلب شاشات LCD" });
    }
  });

  app.get("/api/battery/lcds/low-stock", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const rows = await db.select().from(lcds).where(and(
        eq(lcds.isActive, 1),
        sql`${lcds.stockQuantity} <= ${lcds.minStockLevel}`
      ));
      return res.json(rows);
    } catch (error) {
      console.error("Error getting low stock LCDs:", error);
      return res.status(500).json({ error: "خطأ في جلب شاشات LCD منخفضة المخزون" });
    }
  });

  app.get("/api/battery/lcds/search", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      if (!q) return res.json([]);
      const rows = await db.select().from(lcds).where(eq(lcds.isActive, 1));
      const terms = q.split(/\s+/).filter(Boolean);
      const filtered = rows.filter(l => {
        const s = `${l.serialNumber} ${l.partNumber || ""} ${l.brand} ${l.sizeInch || ""} ${l.resolution || ""} ${l.barcode || ""}`.toLowerCase();
        return terms.every(t => s.includes(t));
      });
      return res.json(filtered);
    } catch (error) {
      console.error("Error searching LCDs:", error);
      return res.status(500).json({ error: "خطأ في البحث" });
    }
  });

  app.post("/api/battery/lcds", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const { serialNumber, brand, ...rest } = req.body;
      if (!brand) return res.status(400).json({ error: "الماركة مطلوبة" });
      let finalSerial = (serialNumber || "").trim();
      if (!finalSerial) {
        const rows = await db.select({ serialNumber: lcds.serialNumber }).from(lcds);
        const used = new Set(rows.map(r => (r.serialNumber || "").trim().toUpperCase()));
        let max = 0;
        for (const r of rows) {
          const m = (r.serialNumber || "").match(/^LCD-(\d+)$/i);
          if (m) max = Math.max(max, parseInt(m[1], 10));
        }
        let next = max + 1;
        do {
          finalSerial = `LCD-${String(next).padStart(4, "0")}`;
          next++;
        } while (used.has(finalSerial.toUpperCase()));
      }
      const existing = await db.select().from(lcds).where(eq(lcds.serialNumber, finalSerial)).limit(1);
      if (existing.length) return res.status(400).json({ error: "الرقم التسلسلي موجود مسبقاً" });
      const barcode = rest.barcode || finalSerial;
      const [row] = await db.insert(lcds).values({ serialNumber: finalSerial, brand, barcode, ...rest }).returning();
      return res.status(201).json(row);
    } catch (error) {
      console.error("Error creating LCD:", error);
      return res.status(500).json({ error: "خطأ في إضافة شاشة LCD" });
    }
  });

  app.put("/api/battery/lcds/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const updateData = { ...req.body };
      if (updateData.serialNumber) {
        updateData.barcode = updateData.serialNumber;
      }
      const [row] = await db.update(lcds).set({ ...updateData, updatedAt: new Date() }).where(eq(lcds.id, req.params.id)).returning();
      if (!row) return res.status(404).json({ error: "شاشة LCD غير موجودة" });
      return res.json(row);
    } catch (error) {
      console.error("Error updating LCD:", error);
      return res.status(500).json({ error: "خطأ في تحديث شاشة LCD" });
    }
  });

  app.delete("/api/battery/lcds/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      await db.update(lcds).set({ isActive: 0, updatedAt: new Date() }).where(eq(lcds.id, req.params.id));
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting LCD:", error);
      return res.status(500).json({ error: "خطأ في حذف شاشة LCD" });
    }
  });

  // Laptop Routes
  app.get("/api/battery/laptops", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      const salesUserId = (req.session as any).salesUserId;
      if (!batteryUserId && !salesUserId) return res.status(401).json({ error: "غير مصرح" });
      const locationId = req.query.locationId != null
        ? parseInt(String(req.query.locationId), 10)
        : (salesUserId ? resolveRequestLocationId(req) : null);
      const rows = locationId && !Number.isNaN(locationId)
        ? await db.select().from(laptops).where(and(eq(laptops.isActive, 1), eq(laptops.salesLocationId, locationId))).orderBy(desc(laptops.createdAt))
        : await db.select().from(laptops).where(eq(laptops.isActive, 1)).orderBy(desc(laptops.createdAt));
      return res.json(rows);
    } catch (error) {
      console.error("Error getting laptops:", error);
      return res.status(500).json({ error: "خطأ في جلب اللابتوبات" });
    }
  });

  app.get("/api/battery/laptops/low-stock", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const rows = await db.select().from(laptops).where(and(
        eq(laptops.isActive, 1),
        sql`${laptops.stockQuantity} <= ${laptops.minStockLevel}`
      ));
      return res.json(rows);
    } catch (error) {
      console.error("Error getting low stock laptops:", error);
      return res.status(500).json({ error: "خطأ في جلب اللابتوبات منخفضة المخزون" });
    }
  });

  app.get("/api/battery/laptops/search", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      if (!q) return res.json([]);
      const rows = await db.select().from(laptops).where(eq(laptops.isActive, 1));
      const terms = q.split(/\s+/).filter(Boolean);
      const filtered = rows.filter(l => {
        const s = `${l.serialNumber} ${l.partNumber || ""} ${l.brand} ${l.model || ""} ${l.sizeInch || ""} ${l.cpu || ""} ${l.ram || ""} ${l.storage || ""} ${l.gpu || ""} ${l.barcode || ""}`.toLowerCase();
        return terms.every(t => s.includes(t));
      });
      return res.json(filtered);
    } catch (error) {
      console.error("Error searching laptops:", error);
      return res.status(500).json({ error: "خطأ في البحث" });
    }
  });

  app.post("/api/battery/laptops", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const { serialNumber, brand, ...rest } = req.body;
      if (!brand) return res.status(400).json({ error: "الماركة مطلوبة" });
      let finalSerial = (serialNumber || "").trim();
      if (!finalSerial) {
        const rows = await db.select({ serialNumber: laptops.serialNumber }).from(laptops);
        const used = new Set(rows.map(r => (r.serialNumber || "").trim().toUpperCase()));
        let max = 0;
        for (const r of rows) {
          const m = (r.serialNumber || "").match(/^LAP-(\d+)$/i);
          if (m) max = Math.max(max, parseInt(m[1], 10));
        }
        let next = max + 1;
        do {
          finalSerial = `LAP-${String(next).padStart(4, "0")}`;
          next++;
        } while (used.has(finalSerial.toUpperCase()));
      }
      const existing = await db.select().from(laptops).where(eq(laptops.serialNumber, finalSerial)).limit(1);
      if (existing.length) return res.status(400).json({ error: "الرقم التسلسلي موجود مسبقاً" });
      const normalizedBarcode = (typeof rest.barcode === "string" && rest.barcode.trim().length > 0)
        ? rest.barcode.trim()
        : finalSerial;
      const cleanValues = {
        serialNumber: finalSerial,
        brand,
        partNumber: typeof rest.partNumber === "string" && rest.partNumber.trim() ? rest.partNumber.trim() : null,
        barcode: normalizedBarcode,
        model: typeof rest.model === "string" && rest.model.trim() ? rest.model.trim() : null,
        sizeInch: rest.sizeInch === "" || rest.sizeInch === undefined ? null : rest.sizeInch,
        cpu: typeof rest.cpu === "string" && rest.cpu.trim() ? rest.cpu.trim() : null,
        ram: typeof rest.ram === "string" && rest.ram.trim() ? rest.ram.trim() : null,
        storage: typeof rest.storage === "string" && rest.storage.trim() ? rest.storage.trim() : null,
        gpu: typeof rest.gpu === "string" && rest.gpu.trim() ? rest.gpu.trim() : null,
        stockQuantity: typeof rest.stockQuantity === "number" ? rest.stockQuantity : parseInt(rest.stockQuantity, 10) || 0,
        minStockLevel: typeof rest.minStockLevel === "number" ? rest.minStockLevel : parseInt(rest.minStockLevel, 10) || 2,
        purchasePrice: rest.purchasePrice || null,
        sellingPrice: rest.sellingPrice || null,
        wholesalePrice: rest.wholesalePrice || null,
        supplier: typeof rest.supplier === "string" && rest.supplier.trim() ? rest.supplier.trim() : null,
        location: typeof rest.location === "string" && rest.location.trim() ? rest.location.trim() : null,
        notes: typeof rest.notes === "string" && rest.notes.trim() ? rest.notes.trim() : null,
      };
      const [row] = await db.insert(laptops).values(cleanValues).returning();
      return res.status(201).json(row);
    } catch (error) {
      console.error("Error creating laptop:", error);
      return res.status(500).json({ error: "خطأ في إضافة لابتوب" });
    }
  });

  app.put("/api/battery/laptops/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const updateData = { ...req.body };
      if (updateData.serialNumber && !updateData.barcode) {
        updateData.barcode = updateData.serialNumber;
      }
      const [row] = await db.update(laptops).set({ ...updateData, updatedAt: new Date() }).where(eq(laptops.id, req.params.id)).returning();
      if (!row) return res.status(404).json({ error: "اللابتوب غير موجود" });
      return res.json(row);
    } catch (error) {
      console.error("Error updating laptop:", error);
      return res.status(500).json({ error: "خطأ في تحديث اللابتوب" });
    }
  });

  app.delete("/api/battery/laptops/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      await db.update(laptops).set({ isActive: 0, updatedAt: new Date() }).where(eq(laptops.id, req.params.id));
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting laptop:", error);
      return res.status(500).json({ error: "خطأ في حذف اللابتوب" });
    }
  });

  // Desktop Routes
  app.get("/api/battery/desktops", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      const salesUserId = (req.session as any).salesUserId;
      if (!batteryUserId && !salesUserId) return res.status(401).json({ error: "غير مصرح" });
      const locationId = req.query.locationId != null
        ? parseInt(String(req.query.locationId), 10)
        : (salesUserId ? resolveRequestLocationId(req) : null);
      const rows = locationId && !Number.isNaN(locationId)
        ? await db.select().from(desktops).where(and(eq(desktops.isActive, 1), eq(desktops.salesLocationId, locationId))).orderBy(desc(desktops.createdAt))
        : await db.select().from(desktops).where(eq(desktops.isActive, 1)).orderBy(desc(desktops.createdAt));
      return res.json(rows);
    } catch (error) {
      console.error("Error getting desktops:", error);
      return res.status(500).json({ error: "خطأ في جلب أجهزة الديسكتوب" });
    }
  });

  app.get("/api/battery/desktops/low-stock", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const rows = await db.select().from(desktops).where(and(
        eq(desktops.isActive, 1),
        sql`${desktops.stockQuantity} <= ${desktops.minStockLevel}`
      ));
      return res.json(rows);
    } catch (error) {
      console.error("Error getting low stock desktops:", error);
      return res.status(500).json({ error: "خطأ في جلب أجهزة الديسكتوب منخفضة المخزون" });
    }
  });

  app.get("/api/battery/desktops/search", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      if (!q) return res.json([]);
      const rows = await db.select().from(desktops).where(eq(desktops.isActive, 1));
      const terms = q.split(/\s+/).filter(Boolean);
      const filtered = rows.filter(d => {
        const s = `${d.serialNumber} ${d.partNumber || ""} ${d.brand} ${d.model || ""} ${d.cpu || ""} ${d.ram || ""} ${d.storage || ""} ${d.gpu || ""} ${d.barcode || ""}`.toLowerCase();
        return terms.every(t => s.includes(t));
      });
      return res.json(filtered);
    } catch (error) {
      console.error("Error searching desktops:", error);
      return res.status(500).json({ error: "خطأ في البحث" });
    }
  });

  app.post("/api/battery/desktops", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const { serialNumber, brand, ...rest } = req.body;
      if (!brand) return res.status(400).json({ error: "الماركة مطلوبة" });
      let finalSerial = (serialNumber || "").trim();
      if (!finalSerial) {
        const rows = await db.select({ serialNumber: desktops.serialNumber }).from(desktops);
        const used = new Set(rows.map(r => (r.serialNumber || "").trim().toUpperCase()));
        let max = 0;
        for (const r of rows) {
          const m = (r.serialNumber || "").match(/^DES-(\d+)$/i);
          if (m) max = Math.max(max, parseInt(m[1], 10));
        }
        let next = max + 1;
        do {
          finalSerial = `DES-${String(next).padStart(4, "0")}`;
          next++;
        } while (used.has(finalSerial.toUpperCase()));
      }
      const existing = await db.select().from(desktops).where(eq(desktops.serialNumber, finalSerial)).limit(1);
      if (existing.length) return res.status(400).json({ error: "الرقم التسلسلي موجود مسبقاً" });
      const normalizedBarcode = (typeof rest.barcode === "string" && rest.barcode.trim().length > 0)
        ? rest.barcode.trim()
        : finalSerial;
      const cleanValues = {
        serialNumber: finalSerial,
        brand,
        partNumber: typeof rest.partNumber === "string" && rest.partNumber.trim() ? rest.partNumber.trim() : null,
        barcode: normalizedBarcode,
        model: typeof rest.model === "string" && rest.model.trim() ? rest.model.trim() : null,
        cpu: typeof rest.cpu === "string" && rest.cpu.trim() ? rest.cpu.trim() : null,
        ram: typeof rest.ram === "string" && rest.ram.trim() ? rest.ram.trim() : null,
        storage: typeof rest.storage === "string" && rest.storage.trim() ? rest.storage.trim() : null,
        gpu: typeof rest.gpu === "string" && rest.gpu.trim() ? rest.gpu.trim() : null,
        stockQuantity: typeof rest.stockQuantity === "number" ? rest.stockQuantity : parseInt(rest.stockQuantity, 10) || 0,
        minStockLevel: typeof rest.minStockLevel === "number" ? rest.minStockLevel : parseInt(rest.minStockLevel, 10) || 2,
        purchasePrice: rest.purchasePrice || null,
        sellingPrice: rest.sellingPrice || null,
        wholesalePrice: rest.wholesalePrice || null,
        supplier: typeof rest.supplier === "string" && rest.supplier.trim() ? rest.supplier.trim() : null,
        location: typeof rest.location === "string" && rest.location.trim() ? rest.location.trim() : null,
        notes: typeof rest.notes === "string" && rest.notes.trim() ? rest.notes.trim() : null,
      };
      const [row] = await db.insert(desktops).values(cleanValues).returning();
      return res.status(201).json(row);
    } catch (error) {
      console.error("Error creating desktop:", error);
      return res.status(500).json({ error: "خطأ في إضافة ديسكتوب" });
    }
  });

  app.put("/api/battery/desktops/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      const updateData = { ...req.body };
      if (updateData.serialNumber && !updateData.barcode) {
        updateData.barcode = updateData.serialNumber;
      }
      const [row] = await db.update(desktops).set({ ...updateData, updatedAt: new Date() }).where(eq(desktops.id, req.params.id)).returning();
      if (!row) return res.status(404).json({ error: "الديسكتوب غير موجود" });
      return res.json(row);
    } catch (error) {
      console.error("Error updating desktop:", error);
      return res.status(500).json({ error: "خطأ في تحديث الديسكتوب" });
    }
  });

  app.delete("/api/battery/desktops/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) return res.status(401).json({ error: "غير مصرح" });
      await db.update(desktops).set({ isActive: 0, updatedAt: new Date() }).where(eq(desktops.id, req.params.id));
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting desktop:", error);
      return res.status(500).json({ error: "خطأ في حذف الديسكتوب" });
    }
  });
  
  // Battery users management (admin only)
  app.get("/api/battery/users", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const currentUser = await storage.getBatteryUser(batteryUserId);
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ error: "غير مسموح" });
      }
      
      const users = await storage.getBatteryUsers();
      return res.json(users.map(u => ({ ...u, password: undefined })));
    } catch (error) {
      console.error("Error getting battery users:", error);
      return res.status(500).json({ error: "خطأ في جلب المستخدمين" });
    }
  });
  
  app.post("/api/battery/users", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const currentUser = await storage.getBatteryUser(batteryUserId);
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ error: "غير مسموح" });
      }
      
      const { username, password, name, role } = req.body;
      
      if (!username || !password || !name) {
        return res.status(400).json({ error: "جميع الحقول مطلوبة" });
      }
      
      const existing = await storage.getBatteryUserByUsername(username);
      if (existing) {
        return res.status(400).json({ error: "اسم المستخدم موجود مسبقاً" });
      }
      
      const user = await storage.createBatteryUser({
        username,
        password,
        name,
        role: role || 'staff',
        isActive: 1
      });
      
      return res.json({ ...user, password: undefined });
    } catch (error) {
      console.error("Error creating battery user:", error);
      return res.status(500).json({ error: "خطأ في إنشاء المستخدم" });
    }
  });

  // Battery POS Routes
  app.get("/api/battery/pos/sales", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const sales = await storage.getBatterySales();
      // Include items for each sale (batteries, adapters, keyboards, LCDs)
      const salesWithItems = await Promise.all(
        sales.map(async (sale) => {
          const items = await storage.getBatterySaleItems(sale.id);
          const adapterItems = await storage.getAdapterSaleItems(sale.id);
          const keyboardItems = await db.select().from(keyboardSaleItems).where(eq(keyboardSaleItems.saleId, sale.id));
          const lcdItems = await db.select().from(lcdSaleItems).where(eq(lcdSaleItems.saleId, sale.id));
          const laptopItems = await db.select().from(laptopSaleItems).where(eq(laptopSaleItems.saleId, sale.id));
          const desktopItems = await db.select().from(desktopSaleItems).where(eq(desktopSaleItems.saleId, sale.id));
          return { ...sale, items, adapterItems, keyboardItems, lcdItems, laptopItems, desktopItems };
        })
      );
      return res.json(salesWithItems);
    } catch (error) {
      console.error("Error getting battery sales:", error);
      return res.status(500).json({ error: "خطأ في جلب المبيعات" });
    }
  });

  app.get("/api/battery/pos/sales/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const sale = await storage.getBatterySale(req.params.id);
      if (!sale) {
        return res.status(404).json({ error: "لم يتم العثور على عملية البيع" });
      }
      
      const items = await storage.getBatterySaleItems(sale.id);
      const adapterItems = await storage.getAdapterSaleItems(sale.id);
      const keyboardItems = await db.select().from(keyboardSaleItems).where(eq(keyboardSaleItems.saleId, sale.id));
      const lcdItems = await db.select().from(lcdSaleItems).where(eq(lcdSaleItems.saleId, sale.id));
      const laptopItems = await db.select().from(laptopSaleItems).where(eq(laptopSaleItems.saleId, sale.id));
      const desktopItems = await db.select().from(desktopSaleItems).where(eq(desktopSaleItems.saleId, sale.id));
      return res.json({ ...sale, items, adapterItems, keyboardItems, lcdItems, laptopItems, desktopItems });
    } catch (error) {
      console.error("Error getting battery sale:", error);
      return res.status(500).json({ error: "خطأ في جلب عملية البيع" });
    }
  });

  app.patch("/api/battery/pos/sales/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { id } = req.params;
      
      // Validate editable fields only
      const editSchema = z.object({
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
        paymentMethod: z.enum(['cash', 'card', 'zaincash']).optional(),
        discount: z.number().min(0).optional(),
      });
      
      const validationResult = editSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: validationResult.error.errors });
      }
      
      const { customerName, customerPhone, paymentMethod, discount } = validationResult.data;
      
      const existingSale = await storage.getBatterySale(id);
      if (!existingSale) {
        return res.status(404).json({ error: "لم يتم العثور على عملية البيع" });
      }
      
      // Build update data - only allowed fields
      const updateData: any = {};
      if (customerName !== undefined) updateData.customerName = customerName;
      if (customerPhone !== undefined) updateData.customerPhone = customerPhone;
      if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
      
      // Recalculate total server-side if discount is provided
      if (discount !== undefined) {
        const subtotal = parseFloat(existingSale.subtotal || '0');
        
        // Validate discount doesn't exceed subtotal
        if (discount > subtotal) {
          return res.status(400).json({ error: "الخصم لا يمكن أن يتجاوز المجموع الفرعي" });
        }
        
        updateData.discount = discount.toString();
        updateData.total = (subtotal - discount).toString();
      }
      
      const updatedSale = await storage.updateBatterySale(id, updateData);
      if (!updatedSale) {
        return res.status(500).json({ error: "فشل في تحديث عملية البيع" });
      }
      
      const items = await storage.getBatterySaleItems(updatedSale.id);
      return res.json({ ...updatedSale, items });
    } catch (error) {
      console.error("Error updating battery sale:", error);
      return res.status(500).json({ error: "خطأ في تحديث عملية البيع" });
    }
  });

  // Delete a battery sale
  app.delete("/api/battery/pos/sales/:id", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { id } = req.params;
      
      const existingSale = await storage.getBatterySale(id);
      if (!existingSale) {
        return res.status(404).json({ error: "لم يتم العثور على عملية البيع" });
      }
      
      const deleted = await storage.deleteBatterySale(id);
      if (!deleted) {
        return res.status(500).json({ error: "فشل في حذف عملية البيع" });
      }
      
      return res.json({ success: true, message: "تم حذف عملية البيع بنجاح" });
    } catch (error) {
      console.error("Error deleting battery sale:", error);
      return res.status(500).json({ error: "خطأ في حذف عملية البيع" });
    }
  });

  app.post("/api/battery/pos/sales", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { customerName, customerPhone, items, adapterItems, keyboardItems, lcdItems, laptopItems, desktopItems, subtotal, discount, total, paymentMethod, notes } = req.body;
      
      // Must have at least one item
      const hasItems = (items && items.length > 0) ||
        (adapterItems && adapterItems.length > 0) ||
        (keyboardItems && keyboardItems.length > 0) ||
        (lcdItems && lcdItems.length > 0) ||
        (laptopItems && laptopItems.length > 0) ||
        (desktopItems && desktopItems.length > 0);
      if (!hasItems) {
        return res.status(400).json({ error: "يجب إضافة منتجات للطلب" });
      }
      
      // Validate stock for battery items
      if (items && items.length > 0) {
        for (const item of items) {
          const battery = await storage.getLaptopBattery(item.batteryId);
          if (!battery) {
            return res.status(400).json({ error: `البطارية غير موجودة: ${item.batteryId}` });
          }
          if (battery.stockQuantity < item.quantity) {
            return res.status(400).json({ 
              error: `المخزون غير كافي للبطارية ${battery.serialNumber}. المتاح: ${battery.stockQuantity}` 
            });
          }
        }
      }
      
      // Validate stock for adapter items
      if (adapterItems && adapterItems.length > 0) {
        for (const item of adapterItems) {
          const adapter = await storage.getAcAdapter(item.adapterId);
          if (!adapter) {
            return res.status(400).json({ error: `الشاحن غير موجود: ${item.adapterId}` });
          }
          if (adapter.stockQuantity < item.quantity) {
            return res.status(400).json({ 
              error: `المخزون غير كافي للشاحن ${adapter.serialNumber}. المتاح: ${adapter.stockQuantity}` 
            });
          }
        }
      }

      // Validate stock for keyboard items
      if (keyboardItems && keyboardItems.length > 0) {
        for (const item of keyboardItems) {
          const [keyboard] = await db.select().from(keyboards).where(eq(keyboards.id, item.keyboardId)).limit(1);
          if (!keyboard) {
            return res.status(400).json({ error: `لوحة المفاتيح غير موجودة: ${item.keyboardId}` });
          }
          if (keyboard.stockQuantity < item.quantity) {
            return res.status(400).json({
              error: `المخزون غير كافي للوحة المفاتيح ${keyboard.serialNumber}. المتاح: ${keyboard.stockQuantity}`
            });
          }
        }
      }

      // Validate stock for LCD items
      if (lcdItems && lcdItems.length > 0) {
        for (const item of lcdItems) {
          const [lcd] = await db.select().from(lcds).where(eq(lcds.id, item.lcdId)).limit(1);
          if (!lcd) {
            return res.status(400).json({ error: `شاشة LCD غير موجودة: ${item.lcdId}` });
          }
          if (lcd.stockQuantity < item.quantity) {
            return res.status(400).json({
              error: `المخزون غير كافي لشاشة LCD ${lcd.serialNumber}. المتاح: ${lcd.stockQuantity}`
            });
          }
        }
      }

      // Validate stock for laptop items
      if (laptopItems && laptopItems.length > 0) {
        for (const item of laptopItems) {
          const [laptop] = await db.select().from(laptops).where(eq(laptops.id, item.laptopId)).limit(1);
          if (!laptop) {
            return res.status(400).json({ error: `اللابتوب غير موجود: ${item.laptopId}` });
          }
          if (laptop.stockQuantity < item.quantity) {
            return res.status(400).json({
              error: `المخزون غير كافي للابتوب ${laptop.serialNumber}. المتاح: ${laptop.stockQuantity}`
            });
          }
        }
      }

      // Validate stock for desktop items
      if (desktopItems && desktopItems.length > 0) {
        for (const item of desktopItems) {
          const [desktop] = await db.select().from(desktops).where(eq(desktops.id, item.desktopId)).limit(1);
          if (!desktop) {
            return res.status(400).json({ error: `الديسكتوب غير موجود: ${item.desktopId}` });
          }
          if (desktop.stockQuantity < item.quantity) {
            return res.status(400).json({
              error: `المخزون غير كافي للديسكتوب ${desktop.serialNumber}. المتاح: ${desktop.stockQuantity}`
            });
          }
        }
      }
      
      // Generate sale number
      const saleNumber = await storage.generateBatterySaleNumber();
      
      // Create the sale
      const saleData = {
        saleNumber,
        customerName: customerName || 'زبون متجر',
        customerPhone: customerPhone || '',
        subtotal: subtotal.toString(),
        discount: (discount || 0).toString(),
        total: total.toString(),
        paymentMethod: paymentMethod || 'cash',
        paymentStatus: 'success',
        status: 'completed',
        notes: notes || null,
        batteryUserId: batteryUserId,
      };
      
      // Build sale items with battery info
      const saleItems = [];
      if (items && items.length > 0) {
        for (const item of items) {
          const battery = await storage.getLaptopBattery(item.batteryId);
          saleItems.push({
            batteryId: item.batteryId,
            serialNumber: battery?.serialNumber || 'N/A',
            brand: battery?.brand || 'Unknown',
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            lineTotal: (item.unitPrice * item.quantity).toString(),
          });
        }
      }
      
      // Build adapter sale items
      const adapterSaleItems = [];
      if (adapterItems && adapterItems.length > 0) {
        for (const item of adapterItems) {
          const adapter = await storage.getAcAdapter(item.adapterId);
          adapterSaleItems.push({
            adapterId: item.adapterId,
            serialNumber: adapter?.serialNumber || 'N/A',
            brand: adapter?.brand || 'Unknown',
            wattage: adapter?.wattage || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            lineTotal: (item.unitPrice * item.quantity).toString(),
          });
        }
      }

      // Build keyboard sale items
      const keyboardItemsToInsert: Array<{
        keyboardId: string;
        serialNumber: string;
        brand: string;
        quantity: number;
        unitPrice: string;
        lineTotal: string;
      }> = [];
      if (keyboardItems && keyboardItems.length > 0) {
        for (const item of keyboardItems) {
          const [keyboard] = await db.select().from(keyboards).where(eq(keyboards.id, item.keyboardId)).limit(1);
          keyboardItemsToInsert.push({
            keyboardId: item.keyboardId,
            serialNumber: keyboard?.serialNumber || 'N/A',
            brand: keyboard?.brand || 'Unknown',
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            lineTotal: (item.unitPrice * item.quantity).toString(),
          });
        }
      }

      // Build LCD sale items
      const lcdItemsToInsert: Array<{
        lcdId: string;
        serialNumber: string;
        brand: string;
        quantity: number;
        unitPrice: string;
        lineTotal: string;
      }> = [];
      if (lcdItems && lcdItems.length > 0) {
        for (const item of lcdItems) {
          const [lcd] = await db.select().from(lcds).where(eq(lcds.id, item.lcdId)).limit(1);
          lcdItemsToInsert.push({
            lcdId: item.lcdId,
            serialNumber: lcd?.serialNumber || 'N/A',
            brand: lcd?.brand || 'Unknown',
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            lineTotal: (item.unitPrice * item.quantity).toString(),
          });
        }
      }

      // Build laptop sale items
      const laptopItemsToInsert: Array<{
        laptopId: string;
        serialNumber: string;
        brand: string;
        model: string | null;
        quantity: number;
        unitPrice: string;
        lineTotal: string;
      }> = [];
      if (laptopItems && laptopItems.length > 0) {
        for (const item of laptopItems) {
          const [laptop] = await db.select().from(laptops).where(eq(laptops.id, item.laptopId)).limit(1);
          laptopItemsToInsert.push({
            laptopId: item.laptopId,
            serialNumber: laptop?.serialNumber || 'N/A',
            brand: laptop?.brand || 'Unknown',
            model: laptop?.model || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            lineTotal: (item.unitPrice * item.quantity).toString(),
          });
        }
      }

      // Build desktop sale items
      const desktopItemsToInsert: Array<{
        desktopId: string;
        serialNumber: string;
        brand: string;
        model: string | null;
        quantity: number;
        unitPrice: string;
        lineTotal: string;
      }> = [];
      if (desktopItems && desktopItems.length > 0) {
        for (const item of desktopItems) {
          const [desktop] = await db.select().from(desktops).where(eq(desktops.id, item.desktopId)).limit(1);
          desktopItemsToInsert.push({
            desktopId: item.desktopId,
            serialNumber: desktop?.serialNumber || 'N/A',
            brand: desktop?.brand || 'Unknown',
            model: desktop?.model || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            lineTotal: (item.unitPrice * item.quantity).toString(),
          });
        }
      }
      
      const sale = await storage.createBatterySale(saleData, saleItems, adapterSaleItems);

      // Insert extra item families and decrement stock
      for (const item of keyboardItemsToInsert) {
        await db.insert(keyboardSaleItems).values({ ...item, saleId: sale.id });
        await db.update(keyboards)
          .set({ stockQuantity: sql`${keyboards.stockQuantity} - ${item.quantity}` })
          .where(eq(keyboards.id, item.keyboardId));
      }
      for (const item of lcdItemsToInsert) {
        await db.insert(lcdSaleItems).values({ ...item, saleId: sale.id });
        await db.update(lcds)
          .set({ stockQuantity: sql`${lcds.stockQuantity} - ${item.quantity}` })
          .where(eq(lcds.id, item.lcdId));
      }
      for (const item of laptopItemsToInsert) {
        await db.insert(laptopSaleItems).values({ ...item, saleId: sale.id });
        await db.update(laptops)
          .set({ stockQuantity: sql`${laptops.stockQuantity} - ${item.quantity}` })
          .where(eq(laptops.id, item.laptopId));
      }
      for (const item of desktopItemsToInsert) {
        await db.insert(desktopSaleItems).values({ ...item, saleId: sale.id });
        await db.update(desktops)
          .set({ stockQuantity: sql`${desktops.stockQuantity} - ${item.quantity}` })
          .where(eq(desktops.id, item.desktopId));
      }
      
      return res.json({
        success: true,
        saleNumber: sale.saleNumber,
        saleId: sale.id,
      });
    } catch (error) {
      console.error("Error creating battery sale:", error);
      return res.status(500).json({ error: "خطأ في إنشاء عملية البيع" });
    }
  });

  app.get("/api/battery/pos/generate-number", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const saleNumber = await storage.generateBatterySaleNumber();
      return res.json({ saleNumber });
    } catch (error) {
      console.error("Error generating sale number:", error);
      return res.status(500).json({ error: "خطأ في إنشاء رقم البيع" });
    }
  });

  app.delete("/api/battery/pos/sales/clear-all", async (req, res) => {
    try {
      const batteryUserId = (req.session as any).batteryUserId;
      if (!batteryUserId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      await storage.clearAllBatterySales();
      return res.json({ success: true, message: "تم مسح جميع المبيعات بنجاح" });
    } catch (error) {
      console.error("Error clearing battery sales:", error);
      return res.status(500).json({ error: "خطأ في مسح المبيعات" });
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

  // ========================================
  // PRODUCT REVIEWS ROUTES
  // ========================================
  
  // Get approved reviews for a product (public)
  app.get("/api/products/:productId/reviews", async (req, res) => {
    try {
      const reviews = await storage.getApprovedProductReviews(req.params.productId);
      return res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      return res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });
  
  // Submit a review (public)
  app.post("/api/products/:productId/reviews", async (req, res) => {
    try {
      const result = insertProductReviewSchema.safeParse({
        ...req.body,
        productId: req.params.productId,
      });
      
      if (!result.success) {
        return res.status(400).json({ error: result.error.message });
      }
      
      const review = await storage.createProductReview(result.data);
      return res.status(201).json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      return res.status(500).json({ error: "Failed to create review" });
    }
  });
  
  // Get all reviews (admin only)
  app.get("/api/admin/reviews", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      const reviews = await storage.getAllReviews();
      return res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      return res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });
  
  // Approve a review (admin only)
  app.post("/api/admin/reviews/:id/approve", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      const review = await storage.approveProductReview(req.params.id);
      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }
      return res.json(review);
    } catch (error) {
      console.error("Error approving review:", error);
      return res.status(500).json({ error: "Failed to approve review" });
    }
  });
  
  // Delete a review (admin only)
  app.delete("/api/admin/reviews/:id", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      await storage.deleteProductReview(req.params.id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting review:", error);
      return res.status(500).json({ error: "Failed to delete review" });
    }
  });
  
  // ========================================
  // DISCOUNT CODES ROUTES
  // ========================================
  
  // Get all discount codes (admin only)
  app.get("/api/admin/discount-codes", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      const codes = await storage.getDiscountCodes();
      return res.json(codes);
    } catch (error) {
      console.error("Error fetching discount codes:", error);
      return res.status(500).json({ error: "Failed to fetch discount codes" });
    }
  });
  
  // Create a discount code (admin only)
  app.post("/api/admin/discount-codes", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      console.log("Creating discount code with data:", JSON.stringify(req.body, null, 2));
      
      // Transform incoming data to proper types
      const transformedData = {
        ...req.body,
        maxUses: req.body.maxUses ? parseInt(req.body.maxUses) : null,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      };
      
      const result = insertDiscountCodeSchema.safeParse(transformedData);
      if (!result.success) {
        console.log("Validation errors:", JSON.stringify(result.error.errors, null, 2));
        return res.status(400).json({ error: result.error.message });
      }
      
      const code = await storage.createDiscountCode(result.data);
      return res.status(201).json(code);
    } catch (error) {
      console.error("Error creating discount code:", error);
      return res.status(500).json({ error: "Failed to create discount code" });
    }
  });
  
  // Update a discount code (admin only)
  app.patch("/api/admin/discount-codes/:id", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      const code = await storage.updateDiscountCode(req.params.id, req.body);
      if (!code) {
        return res.status(404).json({ error: "Discount code not found" });
      }
      return res.json(code);
    } catch (error) {
      console.error("Error updating discount code:", error);
      return res.status(500).json({ error: "Failed to update discount code" });
    }
  });
  
  // Delete a discount code (admin only)
  app.delete("/api/admin/discount-codes/:id", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      await storage.deleteDiscountCode(req.params.id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting discount code:", error);
      return res.status(500).json({ error: "Failed to delete discount code" });
    }
  });
  
  // Validate and apply a discount code (public)
  app.post("/api/discount-codes/validate", async (req, res) => {
    try {
      const { code, orderTotal } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: "Code is required" });
      }
      
      const discountCode = await storage.getDiscountCodeByCode(code.toUpperCase());
      
      if (!discountCode) {
        return res.status(404).json({ error: "كود الخصم غير موجود" });
      }
      
      if (discountCode.isActive !== 1) {
        return res.status(400).json({ error: "كود الخصم غير فعال" });
      }
      
      if (discountCode.expiresAt && new Date(discountCode.expiresAt) < new Date()) {
        return res.status(400).json({ error: "كود الخصم منتهي الصلاحية" });
      }
      
      if (discountCode.maxUses && discountCode.usedCount >= discountCode.maxUses) {
        return res.status(400).json({ error: "تم استخدام الحد الأقصى لهذا الكود" });
      }
      
      if (discountCode.minOrderAmount && orderTotal < parseFloat(discountCode.minOrderAmount)) {
        return res.status(400).json({ 
          error: `الحد الأدنى للطلب ${discountCode.minOrderAmount} د.ع` 
        });
      }
      
      // Calculate discount
      let discountAmount = 0;
      if (discountCode.discountType === 'percentage') {
        discountAmount = (orderTotal * parseFloat(discountCode.discountValue)) / 100;
      } else {
        discountAmount = parseFloat(discountCode.discountValue);
      }
      
      return res.json({
        valid: true,
        discountCode: discountCode,
        discountAmount,
        discountType: discountCode.discountType,
        discountValue: discountCode.discountValue,
      });
    } catch (error) {
      console.error("Error validating discount code:", error);
      return res.status(500).json({ error: "Failed to validate discount code" });
    }
  });

  // ============ VISITOR ANALYTICS ROUTES ============
  
  // Start a new visitor session (public)
  app.post("/api/analytics/session", async (req, res) => {
    try {
      const { sessionId, landingPage, referrer, userAgent } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID required" });
      }
      
      // Parse user agent for device/browser info
      const ua = userAgent || req.headers['user-agent'] || '';
      let device = 'desktop';
      if (/mobile/i.test(ua)) device = 'mobile';
      else if (/tablet|ipad/i.test(ua)) device = 'tablet';
      
      let browser = 'unknown';
      if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
      else if (/firefox/i.test(ua)) browser = 'Firefox';
      else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
      else if (/edg/i.test(ua)) browser = 'Edge';
      else if (/opera|opr/i.test(ua)) browser = 'Opera';
      
      let os = 'unknown';
      if (/windows/i.test(ua)) os = 'Windows';
      else if (/mac/i.test(ua)) os = 'macOS';
      else if (/linux/i.test(ua)) os = 'Linux';
      else if (/android/i.test(ua)) os = 'Android';
      else if (/iphone|ipad/i.test(ua)) os = 'iOS';
      
      // Get IP address
      const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] || 
                        req.socket.remoteAddress || 'unknown';
      
      // Try to get country from IP using free API
      let country = 'Unknown';
      let countryCode = 'XX';
      let city = '';
      
      try {
        if (ipAddress && ipAddress !== 'unknown' && !ipAddress.startsWith('127.') && !ipAddress.startsWith('::1')) {
          const geoResponse = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,country,countryCode,city`);
          const geoData = await geoResponse.json();
          if (geoData.status === 'success') {
            country = geoData.country || 'Unknown';
            countryCode = geoData.countryCode || 'XX';
            city = geoData.city || '';
          }
        }
      } catch (geoError) {
        // Silently fail, use defaults
      }
      
      // Check if session already exists
      const existing = await db.select().from(visitorSessions)
        .where(eq(visitorSessions.sessionId, sessionId)).limit(1);
      
      if (existing.length > 0) {
        // Update last activity
        await db.update(visitorSessions)
          .set({ 
            lastActivity: new Date(),
            pagesViewed: sql`${visitorSessions.pagesViewed} + 1`
          })
          .where(eq(visitorSessions.sessionId, sessionId));
        return res.json({ success: true, existing: true });
      }
      
      // Create new session
      await db.insert(visitorSessions).values({
        sessionId,
        ipAddress,
        country,
        countryCode,
        city,
        userAgent: ua,
        device,
        browser,
        os,
        referrer: referrer || '',
        landingPage: landingPage || '/',
        pagesViewed: 1,
        isActive: 1,
      });
      
      return res.json({ success: true, country, countryCode });
    } catch (error) {
      console.error("Error creating visitor session:", error);
      return res.status(500).json({ error: "Failed to track session" });
    }
  });
  
  // Update session activity (heartbeat)
  app.post("/api/analytics/heartbeat", async (req, res) => {
    try {
      const { sessionId, duration } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID required" });
      }
      
      await db.update(visitorSessions)
        .set({ 
          lastActivity: new Date(),
          duration: duration || 0,
        })
        .where(eq(visitorSessions.sessionId, sessionId));
      
      return res.json({ success: true });
    } catch (error) {
      console.error("Error updating heartbeat:", error);
      return res.status(500).json({ error: "Failed to update heartbeat" });
    }
  });
  
  // End session
  app.post("/api/analytics/end-session", async (req, res) => {
    try {
      const { sessionId, duration } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID required" });
      }
      
      await db.update(visitorSessions)
        .set({ 
          endTime: new Date(),
          duration: duration || 0,
          isActive: 0,
        })
        .where(eq(visitorSessions.sessionId, sessionId));
      
      return res.json({ success: true });
    } catch (error) {
      console.error("Error ending session:", error);
      return res.status(500).json({ error: "Failed to end session" });
    }
  });
  
  // Record page view
  app.post("/api/analytics/pageview", async (req, res) => {
    try {
      const { sessionId, pagePath, pageTitle, timeOnPage } = req.body;
      
      if (!sessionId || !pagePath) {
        return res.status(400).json({ error: "Session ID and page path required" });
      }
      
      await db.insert(pageViews).values({
        sessionId,
        pagePath,
        pageTitle: pageTitle || '',
        timeOnPage: timeOnPage || 0,
      });
      
      // Update session page count
      await db.update(visitorSessions)
        .set({ 
          lastActivity: new Date(),
          pagesViewed: sql`${visitorSessions.pagesViewed} + 1`
        })
        .where(eq(visitorSessions.sessionId, sessionId));
      
      return res.json({ success: true });
    } catch (error) {
      console.error("Error recording page view:", error);
      return res.status(500).json({ error: "Failed to record page view" });
    }
  });
  
  // Get analytics data (admin only)
  app.get("/api/admin/analytics", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      const { period = '7d' } = req.query;
      
      // Calculate date range
      let startDate = new Date();
      switch(period) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }
      
      // Get sessions in date range
      const sessions = await db.select().from(visitorSessions)
        .where(gte(visitorSessions.startTime, startDate))
        .orderBy(desc(visitorSessions.startTime));
      
      // Calculate statistics
      const totalVisitors = sessions.length;
      const activeNow = sessions.filter(s => s.isActive === 1).length;
      
      // Average duration
      const completedSessions = sessions.filter(s => s.duration && s.duration > 0);
      const avgDuration = completedSessions.length > 0 
        ? Math.round(completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / completedSessions.length)
        : 0;
      
      // Average pages per session
      const avgPages = totalVisitors > 0 
        ? Math.round(sessions.reduce((sum, s) => sum + s.pagesViewed, 0) / totalVisitors * 10) / 10
        : 0;
      
      // Country breakdown
      const countryStats: Record<string, number> = {};
      sessions.forEach(s => {
        const country = s.country || 'Unknown';
        countryStats[country] = (countryStats[country] || 0) + 1;
      });
      const countries = Object.entries(countryStats)
        .map(([country, count]) => ({ country, count, percentage: Math.round(count / totalVisitors * 100) }))
        .sort((a, b) => b.count - a.count);
      
      // Device breakdown
      const deviceStats: Record<string, number> = {};
      sessions.forEach(s => {
        const device = s.device || 'unknown';
        deviceStats[device] = (deviceStats[device] || 0) + 1;
      });
      const devices = Object.entries(deviceStats)
        .map(([device, count]) => ({ device, count, percentage: Math.round(count / totalVisitors * 100) }))
        .sort((a, b) => b.count - a.count);
      
      // Browser breakdown
      const browserStats: Record<string, number> = {};
      sessions.forEach(s => {
        const browser = s.browser || 'unknown';
        browserStats[browser] = (browserStats[browser] || 0) + 1;
      });
      const browsers = Object.entries(browserStats)
        .map(([browser, count]) => ({ browser, count, percentage: Math.round(count / totalVisitors * 100) }))
        .sort((a, b) => b.count - a.count);
      
      // Daily visitors
      const dailyStats: Record<string, number> = {};
      sessions.forEach(s => {
        const date = new Date(s.startTime).toISOString().split('T')[0];
        dailyStats[date] = (dailyStats[date] || 0) + 1;
      });
      const dailyVisitors = Object.entries(dailyStats)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      // Recent sessions (last 20)
      const recentSessions = sessions.slice(0, 20).map(s => ({
        id: s.id,
        ipAddress: s.ipAddress,
        country: s.country,
        countryCode: s.countryCode,
        city: s.city,
        device: s.device,
        browser: s.browser,
        os: s.os,
        pagesViewed: s.pagesViewed,
        duration: s.duration,
        startTime: s.startTime,
        isActive: s.isActive,
        landingPage: s.landingPage,
      }));
      
      // Get top pages
      const allPageViews = await db.select().from(pageViews)
        .where(gte(pageViews.timestamp, startDate));
      
      const pageStats: Record<string, number> = {};
      allPageViews.forEach(pv => {
        pageStats[pv.pagePath] = (pageStats[pv.pagePath] || 0) + 1;
      });
      const topPages = Object.entries(pageStats)
        .map(([page, views]) => ({ page, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);
      
      return res.json({
        summary: {
          totalVisitors,
          activeNow,
          avgDuration,
          avgPages,
          totalPageViews: allPageViews.length,
        },
        countries,
        devices,
        browsers,
        dailyVisitors,
        topPages,
        recentSessions,
      });
    } catch (error) {
      console.error("Error getting analytics:", error);
      return res.status(500).json({ error: "Failed to get analytics" });
    }
  });

  // ============ BLOCKED IPs ROUTES ============
  
  // Check if IP is blocked (public - used by middleware)
  app.get("/api/check-blocked", async (req, res) => {
    try {
      const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] || 
                        req.socket.remoteAddress || '';
      
      if (!ipAddress) {
        return res.json({ blocked: false });
      }
      
      const now = new Date();
      const blockedEntry = await db.select().from(blockedIps)
        .where(and(
          eq(blockedIps.ipAddress, ipAddress),
          eq(blockedIps.isActive, 1),
          or(
            isNull(blockedIps.expiresAt),
            gte(blockedIps.expiresAt, now)
          )
        ))
        .limit(1);
      
      if (blockedEntry.length > 0) {
        return res.status(403).json({ 
          blocked: true, 
          reason: blockedEntry[0].reason || 'Access denied'
        });
      }
      
      return res.json({ blocked: false });
    } catch (error) {
      console.error("Error checking blocked IP:", error);
      return res.json({ blocked: false });
    }
  });
  
  // Get all blocked IPs (admin only)
  app.get("/api/admin/blocked-ips", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      const blocked = await db.select().from(blockedIps)
        .orderBy(desc(blockedIps.blockedAt));
      return res.json(blocked);
    } catch (error) {
      console.error("Error getting blocked IPs:", error);
      return res.status(500).json({ error: "Failed to get blocked IPs" });
    }
  });
  
  // Block an IP (admin only)
  app.post("/api/admin/blocked-ips", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      const { ipAddress, reason, expiresAt } = req.body;
      
      if (!ipAddress) {
        return res.status(400).json({ error: "IP address required" });
      }
      
      // Check if already blocked
      const existing = await db.select().from(blockedIps)
        .where(eq(blockedIps.ipAddress, ipAddress))
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing entry
        await db.update(blockedIps)
          .set({ 
            isActive: 1,
            reason: reason || null,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            blockedBy: adminId,
            blockedAt: new Date(),
          })
          .where(eq(blockedIps.ipAddress, ipAddress));
        return res.json({ success: true, message: "IP block updated" });
      }
      
      // Create new entry
      await db.insert(blockedIps).values({
        ipAddress,
        reason: reason || null,
        blockedBy: adminId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
      
      return res.json({ success: true, message: "IP blocked" });
    } catch (error) {
      console.error("Error blocking IP:", error);
      return res.status(500).json({ error: "Failed to block IP" });
    }
  });
  
  // Unblock an IP (admin only)
  app.delete("/api/admin/blocked-ips/:ipAddress", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      const { ipAddress } = req.params;
      
      await db.update(blockedIps)
        .set({ isActive: 0 })
        .where(eq(blockedIps.ipAddress, decodeURIComponent(ipAddress)));
      
      return res.json({ success: true, message: "IP unblocked" });
    } catch (error) {
      console.error("Error unblocking IP:", error);
      return res.status(500).json({ error: "Failed to unblock IP" });
    }
  });

  // Clear all visitor sessions (admin only)
  app.delete("/api/admin/analytics/clear-visitors", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      // Delete all page views first (foreign key dependency)
      await db.delete(pageViews);
      
      // Delete all visitor sessions
      await db.delete(visitorSessions);
      
      return res.json({ success: true, message: "All visitor data cleared" });
    } catch (error) {
      console.error("Error clearing visitors:", error);
      return res.status(500).json({ error: "Failed to clear visitor data" });
    }
  });

  app.get("/api/admin/price-sync/status", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.json(getSyncStatus());
  });

  app.post("/api/admin/price-sync/run", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const result = await syncPrices();
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  startPriceSync();

  app.get("/api/admin/desktop-sync/status", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ error: "Unauthorized" });
    return res.json(getDesktopSyncStatus());
  });

  app.post("/api/admin/desktop-sync/run", async (req, res) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const result = await syncDesktopPrices();
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  startDesktopPriceSync();

  // ─── Recycle Bin Routes ───────────────────────────────────────────────────

  app.get("/api/admin/recycle-bin", async (req: any, res) => {
    if (!(req.session as any).adminId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const items = await storage.getRecycleBin();
      return res.json(items);
    } catch (error) {
      console.error("Error fetching recycle bin:", error);
      return res.status(500).json({ error: "Failed to fetch recycle bin" });
    }
  });

  app.post("/api/admin/recycle-bin/:id/restore", async (req: any, res) => {
    if (!(req.session as any).adminId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const id = parseInt(req.params.id);
      const result = await storage.restoreRecycleBinItem(id);
      if (!result.success) {
        return res.status(404).json({ error: "Item not found or could not be restored" });
      }
      return res.json({ success: true, itemType: result.itemType });
    } catch (error) {
      console.error("Error restoring recycle bin item:", error);
      return res.status(500).json({ error: "Failed to restore item" });
    }
  });

  app.delete("/api/admin/recycle-bin/all", async (req: any, res) => {
    if (!(req.session as any).adminId) return res.status(401).json({ error: "Unauthorized" });
    try {
      await storage.clearRecycleBin();
      return res.json({ success: true });
    } catch (error) {
      console.error("Error clearing recycle bin:", error);
      return res.status(500).json({ error: "Failed to clear recycle bin" });
    }
  });

  app.delete("/api/admin/recycle-bin/:id", async (req: any, res) => {
    if (!(req.session as any).adminId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const id = parseInt(req.params.id);
      await storage.deleteFromRecycleBin(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting recycle bin item:", error);
      return res.status(500).json({ error: "Failed to delete item" });
    }
  });

  // ─── SaaS Platform Routes ────────────────────────────────────────────────

  const requireSaasAuth = (req: any, res: any, next: any) => {
    if (!req.session?.saasShopId) return res.status(401).json({ error: 'Unauthorized' });
    next();
  };

  const requirePlatformAdmin = (req: any, res: any, next: any) => {
    if (!req.session?.adminId && !req.session?.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    next();
  };

  // SaaS Auth
  app.post('/api/saas/auth/login', async (req: any, res: any) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
    try {
      const shop = await storage.getSaasShopByUsername(username);
      if (!shop) return res.status(401).json({ error: 'Invalid credentials' });
      const valid = await bcrypt.compare(password, shop.password);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
      if (!storage.isSaasShopActive(shop)) {
        return res.status(403).json({
          error: 'subscription_inactive',
          status: shop.subscriptionStatus,
          messageAr: shop.subscriptionStatus === 'suspended' ? 'تم إيقاف حساب متجرك. تواصل مع الدعم.' : 'انتهت صلاحية اشتراك متجرك. تواصل مع الدعم لتجديد الاشتراك.',
          messageEn: shop.subscriptionStatus === 'suspended' ? 'Your shop account has been suspended. Contact support.' : 'Your shop subscription has expired. Contact support to renew.',
        });
      }

      if (shop.email) {
        const otp = generateOTP();
        storeOTP(`saas:${username}`, otp);
        try {
          await sendOTPEmail(shop.email, otp, "بوابة المتجر");
        } catch (emailErr) {
          console.error("Failed to send saas OTP email:", emailErr);
          return res.status(500).json({ error: "فشل إرسال رمز التحقق" });
        }
        return res.json({ step: "otp", maskedEmail: shop.email.replace(/(.{2}).+(@.+)/, "$1***$2") });
      }

      req.session.saasShopId = shop.id;
      req.session.saasShopName = shop.shopName;
      req.session.saasUsername = shop.username;
      req.session.saasIsOwner = true;
      await req.session.save();
      const { password: _pw, ...safeShop } = shop;
      return res.json({ shop: safeShop });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/saas/auth/verify-otp', async (req: any, res: any) => {
    try {
      const { username, otp } = req.body;
      if (!username || !otp) return res.status(400).json({ error: 'البيانات غير مكتملة' });

      if (!verifyOTP(`saas:${username}`, otp)) {
        return res.status(401).json({ error: 'رمز التحقق غير صحيح أو منتهي الصلاحية' });
      }

      const shop = await storage.getSaasShopByUsername(username);
      if (!shop) return res.status(401).json({ error: 'الحساب غير موجود' });

      req.session.saasShopId = shop.id;
      req.session.saasShopName = shop.shopName;
      req.session.saasUsername = shop.username;
      req.session.saasIsOwner = true;
      await req.session.save();
      const { password: _pw, ...safeShop } = shop;
      return res.json({ shop: safeShop });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/saas/auth/logout', (req: any, res: any) => {
    delete req.session.saasShopId;
    delete req.session.saasShopName;
    delete req.session.saasUsername;
    delete req.session.saasIsOwner;
    req.session.save(() => res.json({ ok: true }));
  });

  app.get('/api/saas/auth/me', requireSaasAuth, async (req: any, res: any) => {
    try {
      const shop = await storage.getSaasShopById(req.session.saasShopId);
      if (!shop) return res.status(401).json({ error: 'Not found' });
      const { password: _pw, ...safeShop } = shop;
      return res.json({ shop: safeShop, isActive: storage.isSaasShopActive(shop), isOwner: req.session.saasIsOwner === true || req.session.saasIsOwner === 1 });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // SaaS Stats
  app.get('/api/saas/stats', requireSaasAuth, async (req: any, res: any) => {
    try {
      const raw = await storage.getSaasStats(req.session.saasShopId);
      return res.json({
        pending: raw.pending,
        inProgress: raw.inProgress,
        completedToday: raw.completed,
        revenue: raw.totalRevenue,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // SaaS Tickets
  app.get('/api/saas/tickets', requireSaasAuth, async (req: any, res: any) => {
    try {
      const { status, search, archived } = req.query;
      const tickets = await storage.getSaasTicketsByShop(req.session.saasShopId, {
        status: status as string,
        search: search as string,
        archived: archived === 'true',
      });
      return res.json(tickets);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/saas/tickets', requireSaasAuth, async (req: any, res: any) => {
    const shopId = req.session.saasShopId;
    try {
      const { customerName, customerPhone, customerEmail, deviceType, deviceBrand, deviceModel, issueDescriptionAr, issueDescriptionEn, priority } = req.body;
      if (!customerName || !customerPhone || !deviceType || !deviceBrand || !deviceModel || !issueDescriptionAr) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const customer = await storage.getOrCreateSaasCustomer(shopId, customerPhone, customerName, customerEmail);
      const ticket = await storage.createSaasTicket({
        shopId,
        repairCustomerId: customer.id,
        customerName,
        customerPhone,
        customerEmail: customerEmail || null,
        deviceType,
        deviceBrand,
        deviceModel,
        issueDescriptionAr,
        issueDescriptionEn: issueDescriptionEn || null,
        priority: priority || 'normal',
        status: 'pending',
        isArchived: 0,
      });
      return res.json({ ticket, customer });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/saas/tickets/:id', requireSaasAuth, async (req: any, res: any) => {
    try {
      const ticket = await storage.getSaasTicketById(parseInt(req.params.id), req.session.saasShopId);
      if (!ticket) return res.status(404).json({ error: 'Not found' });
      return res.json(ticket);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/saas/tickets/:id', requireSaasAuth, async (req: any, res: any) => {
    try {
      const ticket = await storage.updateSaasTicket(parseInt(req.params.id), req.session.saasShopId, req.body);
      if (!ticket) return res.status(404).json({ error: 'Not found' });
      return res.json(ticket);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/saas/tickets/:id/archive', requireSaasAuth, async (req: any, res: any) => {
    try {
      await storage.archiveSaasTicket(parseInt(req.params.id), req.session.saasShopId, req.body.archived !== false);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // SaaS Customers
  app.get('/api/saas/customers/:id/active-tickets', requireSaasAuth, async (req: any, res: any) => {
    try {
      const tickets = await storage.getActiveSaasTicketsByCustomer(parseInt(req.params.id), req.session.saasShopId);
      return res.json(tickets);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/saas/customers/:id', requireSaasAuth, async (req: any, res: any) => {
    try {
      const customer = await storage.getSaasCustomerById(parseInt(req.params.id));
      if (!customer || customer.shopId !== req.session.saasShopId) return res.status(404).json({ error: 'Not found' });
      const tickets = await storage.getSaasTicketsByShop(req.session.saasShopId);
      const customerTickets = tickets.filter(t => t.repairCustomerId === customer.id);
      return res.json({ customer, tickets: customerTickets });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Platform Admin — manage all shops
  app.get('/api/platform/stats', requirePlatformAdmin, async (_req: any, res: any) => {
    try {
      const shops = await storage.getSaasShops();
      const now = new Date();
      const active = shops.filter(s => s.subscriptionStatus === 'active' && s.isActive).length;
      const trial = shops.filter(s => s.subscriptionStatus === 'trial' && s.trialEndsAt > now && s.isActive).length;
      const expired = shops.filter(s => s.subscriptionStatus === 'expired' || (s.subscriptionStatus === 'trial' && s.trialEndsAt <= now)).length;
      const suspended = shops.filter(s => s.subscriptionStatus === 'suspended').length;
      return res.json({ total: shops.length, active, trial, expired, suspended });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/platform/shops', requirePlatformAdmin, async (_req: any, res: any) => {
    try {
      const shops = await storage.getSaasShops();
      return res.json(shops.map(s => { const { password: _pw, ...safe } = s; return safe; }));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/platform/shops', requirePlatformAdmin, async (req: any, res: any) => {
    const { shopName, ownerName, phone, city, username, password, subscriptionStatus, subscriptionExpiresAt, maxTechnicians, notes } = req.body;
    if (!shopName || !ownerName || !phone || !username || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
      const existing = await storage.getSaasShopByUsername(username);
      if (existing) return res.status(409).json({ error: 'Username already taken' });
      const hashedPassword = await bcrypt.hash(password, 10);
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const shop = await storage.createSaasShop({
        shopName,
        ownerName,
        phone,
        city: city || '',
        username,
        password: hashedPassword,
        isActive: 1,
        subscriptionStatus: subscriptionStatus || 'trial',
        subscriptionExpiresAt: subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null,
        trialEndsAt,
        maxTechnicians: maxTechnicians || 3,
        notes: notes || null,
      });
      await storage.createSaasUser({
        shopId: shop.id,
        username,
        password: hashedPassword,
        displayName: ownerName,
        isOwner: 1,
        isActive: 1,
        permissions: [],
      });
      const { password: _pw, ...safeShop } = shop;
      return res.json(safeShop);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/platform/shops/:id', requirePlatformAdmin, async (req: any, res: any) => {
    try {
      const updates: any = {};
      const allowed = ['shopName', 'ownerName', 'phone', 'city', 'isActive', 'subscriptionStatus', 'subscriptionExpiresAt', 'maxTechnicians', 'notes'];
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          updates[key] = key === 'subscriptionExpiresAt' && req.body[key] ? new Date(req.body[key]) : req.body[key];
        }
      }
      if (req.body.password) {
        updates.password = await bcrypt.hash(req.body.password, 10);
      }
      const shop = await storage.updateSaasShop(parseInt(req.params.id), updates);
      if (!shop) return res.status(404).json({ error: 'Not found' });
      const { password: _pw, ...safeShop } = shop;
      return res.json(safeShop);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/platform/shops/:id', requirePlatformAdmin, async (req: any, res: any) => {
    try {
      await storage.deleteSaasShop(parseInt(req.params.id));
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ============ WHATSAPP MARKETING ROUTES ============

  // Aggregated customers endpoint for WhatsApp bulk send
  // Merges: registered users + repair customers + order customers (deduped by phone)
  app.get('/api/admin/whatsapp/customers', async (req: any, res: any) => {
    if (!req.session.adminId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const phoneMap = new Map<string, { id: string; name: string; phone: string; email?: string; source: string }>();

      // 1. Registered website accounts
      const users = await storage.getUsers();
      for (const u of users) {
        if (u.phone && u.phone.trim()) {
          const phone = u.phone.trim();
          phoneMap.set(phone, { id: u.id, name: u.name || u.email, phone, email: u.email, source: 'account' });
        }
      }

      // 2. Repair customers (largest source)
      const repairCustomers = await storage.listRepairCustomers();
      for (const c of repairCustomers) {
        if (c.phone && c.phone.trim()) {
          const phone = c.phone.trim();
          if (!phoneMap.has(phone)) {
            phoneMap.set(phone, { id: c.id, name: c.name, phone, source: 'repair' });
          }
        }
      }

      // 3. Order customers (guest checkouts with phone)
      const orders = await storage.getOrders();
      for (const o of orders) {
        if (o.customerPhone && o.customerPhone.trim()) {
          const phone = o.customerPhone.trim();
          if (!phoneMap.has(phone)) {
            phoneMap.set(phone, {
              id: `order-${o.id}`,
              name: o.customerName || phone,
              phone,
              email: o.customerEmail || undefined,
              source: 'order',
            });
          }
        }
      }

      return res.json(Array.from(phoneMap.values()));
    } catch (err: any) {
      console.error('Error fetching WhatsApp customers:', err);
      return res.status(500).json({ error: 'Failed to fetch customers' });
    }
  });

  app.get('/api/admin/whatsapp/templates', async (req: any, res: any) => {
    if (!req.session.adminId) return res.status(401).json({ error: 'Unauthorized' });
    const dbSettings = await storage.getStoreSettings();
    const wabaId = (dbSettings?.whatsappWabaId && dbSettings.whatsappWabaId.trim()) ? dbSettings.whatsappWabaId.trim() : process.env.WHATSAPP_WABA_ID;
    const token = (dbSettings?.whatsappAccessToken && dbSettings.whatsappAccessToken.trim()) ? dbSettings.whatsappAccessToken.trim() : process.env.WHATSAPP_ACCESS_TOKEN;
    if (!wabaId || !token) return res.status(500).json({ error: 'WhatsApp not configured' });
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${wabaId}/message_templates?fields=name,status,language,components&access_token=${token}`
      );
      const data = await response.json() as any;
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/whatsapp/test', async (req: any, res: any) => {
    if (!req.session.adminId) return res.status(401).json({ error: 'Unauthorized' });
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'Phone number required' });

    try {
      // Use the exact same path as repair status notifications for realistic diagnostics.
      const result = await sendTicketUpdatedMessage(
        to,
        'عميل اختبار',
        'TEST-00000',
        'completed',
        'رسالة اختبار من النظام',
        null,
        null
      );

      return res.json({
        ok: result.success,
        source: 'repair_status_update_pipeline',
        messageId: result.messageId,
        error: result.error,
        errorCode: result.errorCode,
        errorData: result.errorData,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/whatsapp/send', async (req: any, res: any) => {
    if (!req.session.adminId) return res.status(401).json({ error: 'Unauthorized' });
    const { to, templateName, language, params } = req.body;
    if (!to || !templateName) return res.status(400).json({ error: 'Missing required fields' });

    try {
      let parsedParams = Array.isArray(params)
        ? params.map((p: any) => String(p ?? ''))
        : [];

      // Admin "Send Message" UI may not provide params input.
      // Provide sensible defaults for known repair templates so manual testing works.
      if (parsedParams.length === 0) {
        if (templateName === 'repair_ticket_created') {
          parsedParams = ['عميل', 'TKT-TEST', 'Laptop - HP'];
        } else if (templateName === 'repair_status_update') {
          parsedParams = ['عميل', 'TKT-TEST', 'جاري العمل عليه', 'سيتم الانتهاء قريباً'];
        }
      }

      const result = await sendWhatsAppTemplate(
        String(to),
        String(templateName),
        String(language || 'ar'),
        parsedParams,
      );

      if (!result.success) {
        return res.status(400).json({
          error: result.error || 'Send failed',
          errorCode: result.errorCode,
          errorData: result.errorData,
        });
      }

      return res.json({ success: true, messageId: result.messageId });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ============ WHATSAPP INCOMING WEBHOOK ============

  // Meta verification handshake (GET)
  app.get('/api/whatsapp/webhook', (req: any, res: any) => {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'alaintoken';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('WhatsApp webhook verified');
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Forbidden' });
  });

  // Incoming message handler (POST) — auto-reply to any customer message
  app.post('/api/whatsapp/webhook', async (req: any, res: any) => {
    // Always respond 200 immediately so Meta doesn't retry
    res.status(200).send('EVENT_RECEIVED');

    try {
      const body = req.body;
      console.log('WhatsApp webhook POST received:', {
        hasBody: !!body,
        object: body?.object,
        entryCount: Array.isArray(body?.entry) ? body.entry.length : 0,
      });
      if (body?.object !== 'whatsapp_business_account') return;

      const entries = body.entry || [];
      for (const entry of entries) {
        for (const change of (entry.changes || [])) {
          const value = change.value;
          const statuses = value?.statuses || [];

          // Delivery receipts for our outbound messages
          for (const st of statuses) {
            const msgId = st?.id;
            const status = st?.status;
            const ts = st?.timestamp;
            const recipientId = st?.recipient_id;
            const errors = st?.errors;
            console.log("WhatsApp status update:", {
              id: msgId,
              status,
              timestamp: ts,
              recipient_id: recipientId,
              errors,
            });
          }

          const messages = value?.messages || [];

          for (const msg of messages) {
            // Skip status updates (delivered/read receipts), only handle real incoming messages
            if (!msg.from || !msg.type) continue;
            // Avoid replying to our own outgoing messages echoed back
            if (msg.type === 'reaction') continue;

            const from = msg.from; // phone in international format e.g. 9647850006977

            const autoReply =
              'عذراً، هذا الخط مخصص للرسائل الصادرة فقط. للتواصل معنا يرجى الاتصال على: 07850006977. ' +
              'Sorry, this line is for outgoing messages only. To contact us please call: 07850006977.';

            const sendResult = await sendWhatsAppMessage(from, autoReply);
            if (sendResult.success) {
              console.log(`WhatsApp auto-reply sent to ${from} (msgId=${sendResult.messageId || 'n/a'})`);
            } else {
              console.warn(
                `WhatsApp auto-reply failed for ${from} (code=${(sendResult as any).errorCode ?? 'n/a'}): ${sendResult.error || 'unknown'}`
              );
            }
          }
        }
      }
    } catch (err) {
      console.error('WhatsApp webhook handler error:', err);
    }
  });

  // Daily Report API - combines in-store sales + repair ticket payments for a given date
  // ─── Cash Withdrawals ────────────────────────────────────────────────────────
  app.get("/api/instore/withdrawals", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });
      if (!adminId && !(await salesUserCanViewWithdrawals(req))) {
        return res.status(403).json({ error: "ليس لديك صلاحية عرض السحوبات" });
      }

      const { db } = await import("./db");
      const { cashWithdrawals } = await import("../shared/schema");
      const { gte, lte, and, desc } = await import("drizzle-orm");

      const rawDate = (req.query.date as string) || "";
      const baghdadDateStr2 = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? rawDate
        : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });

      // Calendar day in Asia/Baghdad (avoids server-local timestamp mismatch with naive timestamps)
      const locationId = req.query.locationId != null
        ? parseInt(String(req.query.locationId), 10)
        : (salesUserId ? resolveRequestLocationId(req) : null);

      const dateClause = sql`(${cashWithdrawals.createdAt} AT TIME ZONE 'Asia/Baghdad')::date = ${baghdadDateStr2}::date`;
      const locClause = locationId && !Number.isNaN(locationId)
        ? eq(cashWithdrawals.salesLocationId, locationId)
        : undefined;

      const rows = await db
        .select()
        .from(cashWithdrawals)
        .where(locClause ? and(dateClause, locClause) : dateClause)
        .orderBy(desc(cashWithdrawals.createdAt));
      res.json(rows);
    } catch (err) {
      console.error("Withdrawals fetch error:", err);
      res.status(500).json({ error: "خطأ في جلب السحوبات" });
    }
  });

  app.post("/api/instore/withdrawals", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });
      if (!adminId && !(await salesUserCanViewWithdrawals(req))) {
        return res.status(403).json({ error: "ليس لديك صلاحية إدارة السحوبات" });
      }

      // Do not require an open shift to save a withdrawal. Shift matching was fragile
      // (supervisor vs cashier, session role casing, concurrent shifts) and blocked valid saves.

      const { cashWithdrawals, insertCashWithdrawalSchema } = await import("../shared/schema");
      const b = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const normalized = {
        amount: b.amount != null && b.amount !== "" ? String(b.amount) : "",
        employeeName:
          typeof b.employeeName === "string"
            ? b.employeeName.trim()
            : String(b.employeeName ?? "").trim(),
        reason:
          b.reason == null || String(b.reason).trim() === ""
            ? null
            : String(b.reason).trim(),
      };
      const parsed = insertCashWithdrawalSchema.safeParse(normalized);
      if (!parsed.success) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: parsed.error.flatten() });
      }

      const salesLocationId = b.salesLocationId != null
        ? parseInt(String(b.salesLocationId), 10)
        : resolveRequestLocationId(req);

      const [row] = await db
        .insert(cashWithdrawals)
        .values({
          amount: parsed.data.amount,
          employeeName: parsed.data.employeeName,
          reason: parsed.data.reason,
          salesLocationId: Number.isNaN(salesLocationId) ? LOCATION_MAIN_ID : salesLocationId,
          createdAt: new Date(),
        })
        .returning();
      res.json(row);
    } catch (err: any) {
      console.error("Withdrawal create error:", err);
      const hint =
        typeof err?.message === "string" && /does not exist|relation/i.test(err.message)
          ? " Run db:push (cash_withdrawals table)."
          : "";
      res.status(500).json({
        error: "خطأ في إضافة السحب",
        message: (String(err?.message ?? err) + hint).slice(0, 500),
      });
    }
  });

  app.patch("/api/instore/withdrawals/:id", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });
      if (!adminId && !(await salesUserCanViewWithdrawals(req))) {
        return res.status(403).json({ error: "ليس لديك صلاحية تعديل السحوبات" });
      }

      const recordId = parseInt(req.params.id);
      const [record] = await db.select().from(cashWithdrawals).where(eq(cashWithdrawals.id, recordId)).limit(1);
      if (!record) return res.status(404).json({ error: "السجل غير موجود" });

      const recordTime = new Date(record.createdAt);
      if (await isCashWithdrawalEditBlocked(recordTime)) {
        return res.status(403).json({ error: "الوردية مغلقة، لا يمكن التعديل" });
      }

      const { amount, reason, employeeName } = req.body;
      const updates: Record<string, unknown> = {};
      if (amount !== undefined) updates.amount = amount;
      if (reason !== undefined) updates.reason = reason;
      if (employeeName !== undefined) updates.employeeName = employeeName;
      await db.update(cashWithdrawals).set(updates).where(eq(cashWithdrawals.id, recordId));
      res.json({ success: true });
    } catch (err) {
      console.error("Withdrawal update error:", err);
      res.status(500).json({ error: "خطأ في تعديل السحب" });
    }
  });

  app.delete("/api/instore/withdrawals/:id", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });
      if (!adminId && !(await salesUserCanViewWithdrawals(req))) {
        return res.status(403).json({ error: "ليس لديك صلاحية حذف السحوبات" });
      }

      const recordId = parseInt(req.params.id);
      // Fetch record to get its timestamp
      const [record] = await db.select().from(cashWithdrawals).where(eq(cashWithdrawals.id, recordId)).limit(1);
      if (!record) return res.status(404).json({ error: "السجل غير موجود" });

      const recordTime = new Date(record.createdAt);
      if (await isCashWithdrawalEditBlocked(recordTime)) {
        return res.status(403).json({ error: "الوردية مغلقة، لا يمكن التعديل" });
      }

      await db.delete(cashWithdrawals).where(eq(cashWithdrawals.id, recordId));
      res.json({ success: true });
    } catch (err) {
      console.error("Withdrawal delete error:", err);
      res.status(500).json({ error: "خطأ في حذف السحب" });
    }
  });

  // ─── Staff Advances ──────────────────────────────────────────────────────────
  app.get("/api/instore/staff-advances", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });

      const dateParam = req.query.date as string;
      const baghdadDateStr = dateParam || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Baghdad' });
      const startOfDay = new Date(`${baghdadDateStr}T00:00:00+03:00`);
      const endOfDay = new Date(`${baghdadDateStr}T23:59:59.999+03:00`);

      const rows = await db.select().from(staffAdvances)
        .where(and(gte(staffAdvances.createdAt, startOfDay), lte(staffAdvances.createdAt, endOfDay)))
        .orderBy(desc(staffAdvances.createdAt));
      res.json(rows);
    } catch (err) {
      console.error("Staff advances fetch error:", err);
      res.status(500).json({ error: "خطأ في جلب السلف" });
    }
  });

  app.get("/api/instore/monthly-cashflow", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });

      const monthParam = typeof req.query.month === "string" ? req.query.month.trim() : "";
      const fromParam = typeof req.query.from === "string" ? req.query.from.trim() : "";
      const toParam = typeof req.query.to === "string" ? req.query.to.trim() : "";
      const currentBaghdadMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" }).slice(0, 7);
      const month = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentBaghdadMonth;
      const hasRange = /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam);
      const locationId = req.query.locationId != null
        ? parseInt(String(req.query.locationId), 10)
        : resolveRequestLocationId(req);

      let startDate = "";
      let endDate = "";
      if (hasRange) {
        if (fromParam <= toParam) {
          startDate = fromParam;
          endDate = toParam;
        } else {
          startDate = toParam;
          endDate = fromParam;
        }
      } else {
        const [year, monthNum] = month.split("-").map((v) => parseInt(v, 10));
        const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
        startDate = `${month}-01`;
        endDate = `${month}-${String(lastDay).padStart(2, "0")}`;
      }

      const withdrawalsRows = await db
        .select()
        .from(cashWithdrawals)
        .where(
          and(
            eq(cashWithdrawals.salesLocationId, Number.isNaN(locationId) ? LOCATION_MAIN_ID : locationId),
            sql`(${cashWithdrawals.createdAt} AT TIME ZONE 'Asia/Baghdad')::date >= ${startDate}::date`,
            sql`(${cashWithdrawals.createdAt} AT TIME ZONE 'Asia/Baghdad')::date <= ${endDate}::date`,
          ),
        )
        .orderBy(desc(cashWithdrawals.createdAt));

      const advancesRows = await db
        .select()
        .from(staffAdvances)
        .where(
          and(
            eq(staffAdvances.salesLocationId, Number.isNaN(locationId) ? LOCATION_MAIN_ID : locationId),
            sql`(${staffAdvances.createdAt} AT TIME ZONE 'Asia/Baghdad')::date >= ${startDate}::date`,
            sql`(${staffAdvances.createdAt} AT TIME ZONE 'Asia/Baghdad')::date <= ${endDate}::date`,
          ),
        )
        .orderBy(desc(staffAdvances.createdAt));

      const dailyMap = new Map<string, {
        date: string;
        withdrawalsCount: number;
        withdrawalsTotal: number;
        advancesCount: number;
        advancesTotal: number;
        net: number;
      }>();

      const ensureDay = (date: string) => {
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            withdrawalsCount: 0,
            withdrawalsTotal: 0,
            advancesCount: 0,
            advancesTotal: 0,
            net: 0,
          });
        }
        return dailyMap.get(date)!;
      };

      for (const row of withdrawalsRows) {
        const date = new Date(row.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
        const amount = parseFloat(String(row.amount || "0")) || 0;
        const day = ensureDay(date);
        day.withdrawalsCount += 1;
        day.withdrawalsTotal += amount;
      }

      for (const row of advancesRows) {
        const date = new Date(row.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
        const amount = parseFloat(String(row.amount || "0")) || 0;
        const day = ensureDay(date);
        day.advancesCount += 1;
        day.advancesTotal += amount;
      }

      const daily = Array.from(dailyMap.values())
        .map((d) => ({ ...d, net: d.advancesTotal - d.withdrawalsTotal }))
        .sort((a, b) => b.date.localeCompare(a.date));

      const totals = {
        withdrawalsCount: withdrawalsRows.length,
        withdrawalsTotal: withdrawalsRows.reduce((sum, r) => sum + (parseFloat(String(r.amount || "0")) || 0), 0),
        advancesCount: advancesRows.length,
        advancesTotal: advancesRows.reduce((sum, r) => sum + (parseFloat(String(r.amount || "0")) || 0), 0),
      };

      return res.json({
        month,
        from: startDate,
        to: endDate,
        mode: hasRange ? "range" : "month",
        daily,
        withdrawals: withdrawalsRows,
        advances: advancesRows,
        totals: {
          ...totals,
          net: totals.advancesTotal - totals.withdrawalsTotal,
        },
      });
    } catch (err) {
      console.error("Monthly cashflow fetch error:", err);
      return res.status(500).json({ error: "خطأ في جلب تقرير الشهر" });
    }
  });

  app.post("/api/instore/staff-advances", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });

      const parsed = insertStaffAdvanceSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة", details: parsed.error });

      const [row] = await db.insert(staffAdvances).values(parsed.data).returning();
      res.json(row);
    } catch (err) {
      console.error("Staff advance create error:", err);
      res.status(500).json({ error: "خطأ في إضافة السلفة" });
    }
  });

  app.delete("/api/instore/staff-advances/:id", async (req, res) => {
    try {
      const salesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!salesUserId && !adminId) return res.status(401).json({ error: "غير مصرح" });

      const recordId = parseInt(req.params.id);
      // Fetch record to get its timestamp
      const [record] = await db.select().from(staffAdvances).where(eq(staffAdvances.id, recordId)).limit(1);
      if (!record) return res.status(404).json({ error: "السجل غير موجود" });

      // Check if record belongs to a closed shift window (applies to everyone including admin)
      const recordTime = new Date(record.createdAt);
      const [containingShift] = await db.select().from(salesShifts)
        .where(and(
          lte(salesShifts.startTime, recordTime),
          or(isNull(salesShifts.endTime), gte(salesShifts.endTime, recordTime))
        ))
        .orderBy(desc(salesShifts.startTime))
        .limit(1);
      if (containingShift && containingShift.status === 'closed') {
        return res.status(403).json({ error: "الوردية مغلقة، لا يمكن التعديل" });
      }

      await db.delete(staffAdvances).where(eq(staffAdvances.id, recordId));
      res.json({ success: true });
    } catch (err) {
      console.error("Staff advance delete error:", err);
      res.status(500).json({ error: "خطأ في حذف السلفة" });
    }
  });

  app.get("/api/daily-report", async (req, res) => {
    try {
      const sessionSalesUserId = (req.session as any).salesUserId;
      const adminId = (req.session as any).adminId;
      if (!sessionSalesUserId && !adminId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      const dateParam = req.query.date as string;
      // Parse as Baghdad timezone (UTC+3) so dates match the Iraq calendar day
      const baghdadDateStr = dateParam || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Baghdad' });
      const startOfDay = new Date(`${baghdadDateStr}T00:00:00+03:00`);
      const endOfDay = new Date(`${baghdadDateStr}T23:59:59.999+03:00`);

      const { db } = await import("./db");
      const { orders, repairTickets, cashWithdrawals, salesShifts } = await import("../shared/schema");
      const { and, or, gte, lte, inArray, eq, isNotNull, isNull, desc } = await import("drizzle-orm");
      const requestedLocationId = req.query.locationId != null
        ? parseInt(String(req.query.locationId), 10)
        : resolveRequestLocationId(req);
      const salesLocationId = Number.isNaN(requestedLocationId) ? LOCATION_MAIN_ID : requestedLocationId;

      // ── Shift-aware day boundary ──────────────────────────────────────────────
      // Find all shifts that STARTED on the requested calendar date (Baghdad TZ).
      // Sales made after midnight but still within a shift that started on this date
      // should be counted for this date, not the next one.
      const shiftsOnDate = await db.select().from(salesShifts)
        .where(and(
          eq(salesShifts.salesLocationId, salesLocationId),
          gte(salesShifts.startTime, startOfDay),
          lte(salesShifts.startTime, endOfDay),
        ))
        .orderBy(desc(salesShifts.startTime));

      // Compute the effective end: extend past midnight if any shift ran past midnight
      const now = new Date();
      const effectiveEnd = shiftsOnDate.length > 0
        ? new Date(Math.max(endOfDay.getTime(), ...shiftsOnDate.map(s => (s.endTime || now).getTime())))
        : endOfDay;

      // ── In-store orders (shift-scoped) ────────────────────────────────────────
      // For each shift, collect orders within that shift's actual time window
      // so post-midnight sales are tied to the shift start date, not the clock date.
      const allInStoreOrders: any[] = [];
      const seenOrderIds = new Set<string>();

      if (shiftsOnDate.length > 0) {
        for (const shift of shiftsOnDate) {
          const shiftEnd = shift.endTime || now;
          const shiftOrders = await db.select().from(orders).where(and(
            inArray(orders.orderType, ['walk-in', 'in-store']),
            eq(orders.salesLocationId, salesLocationId),
            eq(orders.salespersonId, shift.salesUserId),
            gte(orders.createdAt, shift.startTime),
            lte(orders.createdAt, shiftEnd),
          ));
          for (const o of shiftOrders) {
            if (!seenOrderIds.has(o.id)) {
              seenOrderIds.add(o.id);
              allInStoreOrders.push(o);
            }
          }
        }
        // Also include orders with no salesperson (direct admin) within calendar day
        const adminOrders = await db.select().from(orders).where(and(
          inArray(orders.orderType, ['walk-in', 'in-store']),
          eq(orders.salesLocationId, salesLocationId),
          isNull(orders.salespersonId),
          gte(orders.createdAt, startOfDay),
          lte(orders.createdAt, effectiveEnd),
        ));
        for (const o of adminOrders) {
          if (!seenOrderIds.has(o.id)) {
            seenOrderIds.add(o.id);
            allInStoreOrders.push(o);
          }
        }
        // Admin POS tags salespersonId with admin_users.id (not sales_users.id) — include once per day
        const adminTaggedRows = await db
          .select({ o: orders })
          .from(orders)
          .innerJoin(adminUsers, eq(orders.salespersonId, adminUsers.id))
          .where(and(
            inArray(orders.orderType, ['walk-in', 'in-store']),
            eq(orders.salesLocationId, salesLocationId),
            gte(orders.createdAt, startOfDay),
            lte(orders.createdAt, effectiveEnd),
          ));
        for (const row of adminTaggedRows) {
          const o = row.o;
          if (!seenOrderIds.has(o.id)) {
            seenOrderIds.add(o.id);
            allInStoreOrders.push(o);
          }
        }
      } else {
        // No shifts started on this date — fall back to plain calendar day window
        const calOrders = await db.select().from(orders).where(and(
          inArray(orders.orderType, ['walk-in', 'in-store']),
          eq(orders.salesLocationId, salesLocationId),
          gte(orders.createdAt, startOfDay),
          lte(orders.createdAt, endOfDay),
        ));
        for (const o of calOrders) { allInStoreOrders.push(o); }
      }

      const inStoreOrders = allInStoreOrders;

      // ── Repair ticket payments ────────────────────────────────────────────────
      // Use the extended end so repairs settled after midnight during an open shift
      // are also captured for this date.
      const paidRepairTickets = salesLocationId === LOCATION_MAIN_ID ? await db.select().from(repairTickets).where(
        or(
          and(
            eq(repairTickets.paymentStatus, 'paid'),
            gte(repairTickets.updatedAt, startOfDay),
            lte(repairTickets.updatedAt, effectiveEnd)
          ),
          and(
            eq(repairTickets.status, 'delivered'),
            isNotNull(repairTickets.deliveredAt),
            gte(repairTickets.deliveredAt, startOfDay),
            lte(repairTickets.deliveredAt, effectiveEnd)
          )
        )
      ) : [];

      const inStoreTotalCash = inStoreOrders
        .filter(o => isInStoreCash(o))
        .reduce((sum, o) => sum + parseFloat(o.total), 0);
      const inStoreTotalCard = inStoreOrders
        .filter(o => isInStoreCard(o))
        .reduce((sum, o) => sum + parseFloat(o.total), 0);
      const inStoreTotalZain = inStoreOrders
        .filter(o => isInStoreZainCash(o))
        .reduce((sum, o) => sum + parseFloat(o.total), 0);
      const inStoreTotalQi = inStoreOrders
        .filter(o => isInStoreQiCard(o))
        .reduce((sum, o) => sum + parseFloat(o.total), 0);
      const inStoreTotalDeferred = inStoreOrders
        .filter(o => isOrderDeferred(o))
        .reduce((sum, o) => sum + parseFloat(o.total), 0);
      const inStoreTotal = inStoreOrders
        .filter(o => !isOrderDeferred(o))
        .reduce((sum, o) => sum + parseFloat(o.total), 0);

      // Withdrawals — use the effective (extended) window
      const dailyWithdrawals = await db.select().from(cashWithdrawals)
        .where(and(
          eq(cashWithdrawals.salesLocationId, salesLocationId),
          gte(cashWithdrawals.createdAt, startOfDay),
          lte(cashWithdrawals.createdAt, effectiveEnd),
        ))
        .orderBy(desc(cashWithdrawals.createdAt));
      const totalWithdrawals = dailyWithdrawals.reduce((sum, w) => sum + parseFloat(w.amount), 0);

      // Repair totals — deferred (آجل) are excluded from revenue
      const repairTotalDeferred = paidRepairTickets
        .filter(t => t.paymentStatus === 'deferred')
        .reduce((sum, t) => sum + parseFloat(t.finalCost || t.costEstimate || '0'), 0);
      const repairTotal = paidRepairTickets
        .filter(t => t.paymentStatus !== 'deferred')
        .reduce((sum, t) => sum + parseFloat(t.finalCost || t.costEstimate || '0'), 0);
      const repairTotalCash = paidRepairTickets
        .filter(t => t.paymentStatus !== 'deferred' && (t.paymentMethod === 'cash' || !t.paymentMethod))
        .reduce((sum, t) => sum + parseFloat(t.finalCost || t.costEstimate || '0'), 0);
      const repairTotalCard = paidRepairTickets
        .filter(t => t.paymentStatus !== 'deferred' && t.paymentMethod === 'card')
        .reduce((sum, t) => sum + parseFloat(t.finalCost || t.costEstimate || '0'), 0);
      const repairTotalZain = 0;
      const repairTotalQi = 0;

      res.set('Cache-Control', 'no-store');
      res.json({
        date: startOfDay.toISOString(),
        inStoreSales: inStoreOrders,
        repairSales: paidRepairTickets,
        withdrawals: dailyWithdrawals,
        summary: {
          inStoreCount: inStoreOrders.length,
          inStoreTotal,
          inStoreTotalCash,
          inStoreTotalCard,
          inStoreTotalZain,
          inStoreTotalQi,
          inStoreTotalDeferred,
          repairCount: paidRepairTickets.filter(t => t.paymentStatus !== 'deferred').length,
          repairTotal,
          repairTotalDeferred,
          repairTotalCash,
          repairTotalCard,
          repairTotalZain,
          repairTotalQi,
          totalWithdrawals,
          withdrawalCount: dailyWithdrawals.length,
          grandTotal: inStoreTotal + repairTotal,
          grandTotalCash: inStoreTotalCash + repairTotalCash,
          grandTotalCard: inStoreTotalCard + repairTotalCard,
          grandTotalZain: inStoreTotalZain + repairTotalZain,
          grandTotalQi: inStoreTotalQi + repairTotalQi,
          netTotal: (inStoreTotal + repairTotal) - totalWithdrawals,
        }
      });
    } catch (err) {
      console.error('Daily report error:', err);
      res.status(500).json({ error: "خطأ في جلب التقرير اليومي" });
    }
  });

  return httpServer;
}
