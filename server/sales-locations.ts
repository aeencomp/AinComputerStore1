import type { Request } from "express";
import { and, eq, or, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  salesLocations,
  salesUserLocations,
  stockTransfers,
  inStoreProducts,
  laptops,
  desktops,
} from "@shared/schema";

export const LOCATION_MAIN_ID = 1;
export const LOCATION_SHOP2_ID = 2;

export async function seedSalesLocations(): Promise<void> {
  await db
    .insert(salesLocations)
    .values([
      { id: LOCATION_MAIN_ID, code: "loc1", nameAr: "الموقع 1 - المتجر الرئيسي", nameEn: "Location 1 - Main" },
      { id: LOCATION_SHOP2_ID, code: "loc2", nameAr: "الموقع 2", nameEn: "Location 2" },
    ])
    .onConflictDoNothing();
}

export function getSessionLocationId(req: Request): number | null {
  const id = (req.session as any).activeSalesLocationId;
  return typeof id === "number" ? id : id ? parseInt(String(id), 10) : null;
}

export function resolveRequestLocationId(req: Request): number {
  const fromQuery = req.query.locationId;
  if (fromQuery != null && fromQuery !== "") {
    const n = parseInt(String(fromQuery), 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  const fromSession = getSessionLocationId(req);
  if (fromSession && fromSession > 0) return fromSession;
  return LOCATION_MAIN_ID;
}

export async function getAllowedLocationIdsForUser(
  salesUserId: string,
  role: string,
): Promise<number[]> {
  if (role === "sales_admin") {
    const rows = await db
      .select({ id: salesLocations.id })
      .from(salesLocations)
      .where(eq(salesLocations.isActive, 1));
    return rows.map((r) => r.id);
  }

  const assigned = await db
    .select({ id: salesUserLocations.salesLocationId })
    .from(salesUserLocations)
    .where(eq(salesUserLocations.salesUserId, salesUserId));

  if (assigned.length > 0) {
    return assigned.map((r) => r.id);
  }

  return [LOCATION_MAIN_ID];
}

export async function userCanAccessLocation(
  salesUserId: string,
  role: string,
  locationId: number,
): Promise<boolean> {
  const allowed = await getAllowedLocationIdsForUser(salesUserId, role);
  return allowed.includes(locationId);
}

export async function setUserLocationAssignments(
  salesUserId: string,
  locationIds: number[],
): Promise<void> {
  await db.delete(salesUserLocations).where(eq(salesUserLocations.salesUserId, salesUserId));
  const unique = [...new Set(locationIds.filter((id) => id > 0))];
  if (unique.length === 0) {
    await db.insert(salesUserLocations).values({
      salesUserId,
      salesLocationId: LOCATION_MAIN_ID,
    });
    return;
  }
  for (const salesLocationId of unique) {
    await db.insert(salesUserLocations).values({ salesUserId, salesLocationId });
  }
}

export type TransferProductSource = "instore" | "laptop" | "desktop";

export async function executeStockTransfer(params: {
  fromLocationId: number;
  toLocationId: number;
  productSource: TransferProductSource;
  productId: string;
  quantity: number;
  notes?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
}): Promise<{ transferId: number }> {
  const {
    fromLocationId,
    toLocationId,
    productSource,
    productId,
    quantity,
    notes,
    createdBy,
    createdByName,
  } = params;

  if (fromLocationId === toLocationId) {
    throw new Error("لا يمكن النقل لنفس الموقع");
  }
  if (quantity < 1) {
    throw new Error("الكمية يجب أن تكون 1 على الأقل");
  }

  let serialNumber: string | null = null;

  if (productSource === "laptop") {
    const [row] = await db.select().from(laptops).where(eq(laptops.id, productId));
    if (!row) throw new Error("اللابتوب غير موجود");
    if (row.salesLocationId !== fromLocationId) {
      throw new Error("المنتج ليس في المخزون المصدر");
    }
    if ((row.stockQuantity || 0) < 1) throw new Error("لا يوجد مخزون كافٍ");
    serialNumber = row.serialNumber;
    await db
      .update(laptops)
      .set({ salesLocationId: toLocationId, updatedAt: new Date() })
      .where(eq(laptops.id, productId));
  } else if (productSource === "desktop") {
    const [row] = await db.select().from(desktops).where(eq(desktops.id, productId));
    if (!row) throw new Error("الديسكتوب غير موجود");
    if (row.salesLocationId !== fromLocationId) {
      throw new Error("المنتج ليس في المخزون المصدر");
    }
    if ((row.stockQuantity || 0) < 1) throw new Error("لا يوجد مخزون كافٍ");
    serialNumber = row.serialNumber;
    await db
      .update(desktops)
      .set({ salesLocationId: toLocationId, updatedAt: new Date() })
      .where(eq(desktops.id, productId));
  } else if (productSource === "instore") {
    const id = parseInt(productId, 10);
    const fromProduct = await storage.getInStoreProductById(id);
    if (!fromProduct) throw new Error("المنتج غير موجود");
    if (fromProduct.salesLocationId !== fromLocationId) {
      throw new Error("المنتج ليس في المخزون المصدر");
    }
    if ((fromProduct.stockQuantity || 0) < quantity) {
      throw new Error("لا يوجد مخزون كافٍ");
    }

    const matchClause = fromProduct.barcode
      ? or(
          eq(inStoreProducts.barcode, fromProduct.barcode),
          fromProduct.sku ? eq(inStoreProducts.sku, fromProduct.sku) : sql`false`,
        )
      : fromProduct.sku
        ? eq(inStoreProducts.sku, fromProduct.sku)
        : sql`false`;

    const [existingAtDest] = await db
      .select()
      .from(inStoreProducts)
      .where(and(eq(inStoreProducts.salesLocationId, toLocationId), matchClause))
      .limit(1);

    if (existingAtDest) {
      await db
        .update(inStoreProducts)
        .set({
          stockQuantity: (existingAtDest.stockQuantity || 0) + quantity,
          updatedAt: new Date(),
        })
        .where(eq(inStoreProducts.id, existingAtDest.id));
    } else {
      const { id: _omit, createdAt: _c, updatedAt: _u, ...rest } = fromProduct;
      await db.insert(inStoreProducts).values({
        ...rest,
        stockQuantity: quantity,
        salesLocationId: toLocationId,
      });
    }

    const newFromQty = (fromProduct.stockQuantity || 0) - quantity;
    await db
      .update(inStoreProducts)
      .set({ stockQuantity: newFromQty, updatedAt: new Date() })
      .where(eq(inStoreProducts.id, id));
  } else {
    throw new Error("نوع منتج غير مدعوم للنقل");
  }

  const [transfer] = await db
    .insert(stockTransfers)
    .values({
      fromLocationId,
      toLocationId,
      productSource,
      productId,
      quantity: productSource === "instore" ? quantity : 1,
      serialNumber,
      notes: notes || null,
      createdBy: createdBy || null,
      createdByName: createdByName || null,
    })
    .returning();

  return { transferId: transfer.id };
}
