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
  acAdapters,
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

export type TransferProductSource = "instore" | "laptop" | "desktop" | "adapter";

export type TransferInventoryHit = {
  productSource: TransferProductSource;
  productId: string;
  label: string;
  stockQuantity: number;
  barcode?: string | null;
};

function isSalesAdminRole(role: string | null | undefined): boolean {
  return String(role ?? "").trim().toLowerCase() === "sales_admin";
}

export function canSearchInventoryForTransfer(
  role: string,
  locationId: number,
  perms: { canInventory?: number; canTransferToLoc1?: number },
): boolean {
  if (isSalesAdminRole(role)) return true;
  if (locationId === LOCATION_MAIN_ID) return perms.canInventory === 1;
  if (locationId === LOCATION_SHOP2_ID) return perms.canTransferToLoc1 === 1;
  return false;
}

export function canTransferStockBetween(
  role: string,
  fromLocationId: number,
  toLocationId: number,
  perms: {
    canInventory?: number;
    canTransferToLoc1?: number;
  },
): boolean {
  if (isSalesAdminRole(role)) return true;
  if (fromLocationId === LOCATION_MAIN_ID && toLocationId === LOCATION_SHOP2_ID) {
    return perms.canInventory === 1;
  }
  if (fromLocationId === LOCATION_SHOP2_ID && toLocationId === LOCATION_MAIN_ID) {
    return perms.canTransferToLoc1 === 1;
  }
  return false;
}

export async function searchInventoryAtLocation(
  locationId: number,
  q: string,
): Promise<TransferInventoryHit[]> {
  const query = q.trim().toLowerCase();
  if (!query) return [];

  const [instore, laps, desks, adapterRows] = await Promise.all([
    db.select().from(inStoreProducts).where(eq(inStoreProducts.salesLocationId, locationId)),
    db
      .select()
      .from(laptops)
      .where(and(eq(laptops.salesLocationId, locationId), eq(laptops.isActive, 1))),
    db
      .select()
      .from(desktops)
      .where(and(eq(desktops.salesLocationId, locationId), eq(desktops.isActive, 1))),
    db
      .select()
      .from(acAdapters)
      .where(and(eq(acAdapters.salesLocationId, locationId), eq(acAdapters.isActive, 1))),
  ]);

  const results: TransferInventoryHit[] = [];

  for (const p of instore) {
    const qty = p.stockQuantity || 0;
    if (qty < 1) continue;
    const label = `${p.nameAr} ${p.sku || ""} ${p.barcode || ""}`.toLowerCase();
    if (label.includes(query) || (p.barcode && p.barcode.toLowerCase() === query)) {
      results.push({
        productSource: "instore",
        productId: String(p.id),
        label: p.nameAr,
        stockQuantity: qty,
        barcode: p.barcode,
      });
    }
  }
  for (const l of laps) {
    const qty = l.stockQuantity || 0;
    if (qty < 1) continue;
    const label = `${l.brand} ${l.model || ""} ${l.serialNumber} ${l.barcode || ""}`.toLowerCase();
    if (label.includes(query) || l.serialNumber.toLowerCase() === query) {
      results.push({
        productSource: "laptop",
        productId: l.id,
        label: `${l.brand} ${l.model || ""} — ${l.serialNumber}`,
        stockQuantity: qty,
        barcode: l.barcode,
      });
    }
  }
  for (const d of desks) {
    const qty = d.stockQuantity || 0;
    if (qty < 1) continue;
    const label = `${d.brand} ${d.model || ""} ${d.serialNumber} ${d.barcode || ""}`.toLowerCase();
    if (label.includes(query) || d.serialNumber.toLowerCase() === query) {
      results.push({
        productSource: "desktop",
        productId: d.id,
        label: `${d.brand} ${d.model || ""} — ${d.serialNumber}`,
        stockQuantity: qty,
        barcode: d.barcode,
      });
    }
  }
  for (const a of adapterRows) {
    const qty = a.stockQuantity || 0;
    if (qty < 1) continue;
    const watt = a.wattage != null ? `${a.wattage}w` : "";
    const label = `${a.brand} ${watt} ${a.serialNumber} ${a.barcode || ""} ${a.partNumber || ""}`.toLowerCase();
    if (
      label.includes(query) ||
      a.serialNumber.toLowerCase() === query ||
      (a.barcode && a.barcode.toLowerCase() === query)
    ) {
      results.push({
        productSource: "adapter",
        productId: a.id,
        label: `${a.brand}${watt ? ` ${watt}` : ""} — ${a.serialNumber}`,
        stockQuantity: qty,
        barcode: a.barcode,
      });
    }
  }

  return results.slice(0, 40);
}

async function nextInventorySerial(
  prefix: string,
  table: typeof laptops | typeof desktops | typeof acAdapters,
): Promise<string> {
  const rows = await db.select({ serialNumber: table.serialNumber }).from(table);
  const used = new Set(rows.map((r) => (r.serialNumber || "").trim().toUpperCase()));
  let max = 0;
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, "i");
  for (const r of rows) {
    const m = (r.serialNumber || "").match(pattern);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  let next = max + 1;
  let candidate: string;
  do {
    candidate = `${prefix}-${String(next).padStart(4, "0")}`;
    next++;
  } while (used.has(candidate.toUpperCase()));
  return candidate;
}

async function transferLaptopOrDesktopQuantity(params: {
  table: typeof laptops | typeof desktops;
  serialPrefix: "LAP" | "DES";
  row: typeof laptops.$inferSelect | typeof desktops.$inferSelect;
  productId: string;
  fromLocationId: number;
  toLocationId: number;
  quantity: number;
}): Promise<string | null> {
  const { table, serialPrefix, row, productId, fromLocationId, toLocationId, quantity } = params;
  const available = row.stockQuantity || 0;
  if (available < quantity) {
    throw new Error("لا يوجد مخزون كافٍ");
  }

  const matchClause = row.barcode
    ? eq(table.barcode, row.barcode)
    : row.partNumber
      ? and(eq(table.brand, row.brand), eq(table.partNumber, row.partNumber))
      : row.model
        ? and(eq(table.brand, row.brand), eq(table.model, row.model))
        : eq(table.brand, row.brand);

  if (quantity === available) {
    await db
      .update(table)
      .set({ salesLocationId: toLocationId, updatedAt: new Date() })
      .where(eq(table.id, productId));
    return row.serialNumber;
  }

  await db
    .update(table)
    .set({ stockQuantity: available - quantity, updatedAt: new Date() })
    .where(eq(table.id, productId));

  const [existingAtDest] = await db
    .select()
    .from(table)
    .where(
      and(
        eq(table.salesLocationId, toLocationId),
        eq(table.isActive, 1),
        matchClause,
      ),
    )
    .limit(1);

  if (existingAtDest) {
    await db
      .update(table)
      .set({
        stockQuantity: (existingAtDest.stockQuantity || 0) + quantity,
        updatedAt: new Date(),
      })
      .where(eq(table.id, existingAtDest.id));
    return existingAtDest.serialNumber;
  }

  const newSerial = await nextInventorySerial(serialPrefix, table);
  const { id: _id, createdAt: _c, updatedAt: _u, serialNumber: _s, stockQuantity: _q, salesLocationId: _loc, ...rest } = row;
  await db.insert(table).values({
    ...rest,
    serialNumber: newSerial,
    stockQuantity: quantity,
    salesLocationId: toLocationId,
    isActive: 1,
  });
  return newSerial;
}

async function transferAdapterQuantity(params: {
  row: typeof acAdapters.$inferSelect;
  productId: string;
  fromLocationId: number;
  toLocationId: number;
  quantity: number;
}): Promise<string | null> {
  const { row, productId, fromLocationId, toLocationId, quantity } = params;
  const available = row.stockQuantity || 0;
  if (available < quantity) {
    throw new Error("لا يوجد مخزون كافٍ");
  }

  const matchClause = row.barcode
    ? eq(acAdapters.barcode, row.barcode)
    : row.partNumber
      ? and(eq(acAdapters.brand, row.brand), eq(acAdapters.partNumber, row.partNumber))
      : row.wattage != null
        ? and(eq(acAdapters.brand, row.brand), eq(acAdapters.wattage, row.wattage))
        : eq(acAdapters.brand, row.brand);

  if (quantity === available) {
    await db
      .update(acAdapters)
      .set({ salesLocationId: toLocationId, updatedAt: new Date() })
      .where(eq(acAdapters.id, productId));
    return row.serialNumber;
  }

  await db
    .update(acAdapters)
    .set({ stockQuantity: available - quantity, updatedAt: new Date() })
    .where(eq(acAdapters.id, productId));

  const [existingAtDest] = await db
    .select()
    .from(acAdapters)
    .where(
      and(
        eq(acAdapters.salesLocationId, toLocationId),
        eq(acAdapters.isActive, 1),
        matchClause,
      ),
    )
    .limit(1);

  if (existingAtDest) {
    await db
      .update(acAdapters)
      .set({
        stockQuantity: (existingAtDest.stockQuantity || 0) + quantity,
        updatedAt: new Date(),
      })
      .where(eq(acAdapters.id, existingAtDest.id));
    return existingAtDest.serialNumber;
  }

  const newSerial = await nextInventorySerial("ADP", acAdapters);
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    serialNumber: _s,
    stockQuantity: _q,
    salesLocationId: _loc,
    ...rest
  } = row;
  await db.insert(acAdapters).values({
    ...rest,
    serialNumber: newSerial,
    barcode: row.barcode || newSerial,
    stockQuantity: quantity,
    salesLocationId: toLocationId,
    isActive: 1,
  });
  return newSerial;
}

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
    serialNumber = await transferLaptopOrDesktopQuantity({
      table: laptops,
      serialPrefix: "LAP",
      row,
      productId,
      fromLocationId,
      toLocationId,
      quantity,
    });
  } else if (productSource === "desktop") {
    const [row] = await db.select().from(desktops).where(eq(desktops.id, productId));
    if (!row) throw new Error("الديسكتوب غير موجود");
    if (row.salesLocationId !== fromLocationId) {
      throw new Error("المنتج ليس في المخزون المصدر");
    }
    serialNumber = await transferLaptopOrDesktopQuantity({
      table: desktops,
      serialPrefix: "DES",
      row,
      productId,
      fromLocationId,
      toLocationId,
      quantity,
    });
  } else if (productSource === "adapter") {
    const [row] = await db.select().from(acAdapters).where(eq(acAdapters.id, productId));
    if (!row) throw new Error("الشاحن غير موجود");
    if (row.salesLocationId !== fromLocationId) {
      throw new Error("المنتج ليس في المخزون المصدر");
    }
    serialNumber = await transferAdapterQuantity({
      row,
      productId,
      fromLocationId,
      toLocationId,
      quantity,
    });
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
      quantity,
      serialNumber,
      notes: notes || null,
      createdBy: createdBy || null,
      createdByName: createdByName || null,
    })
    .returning();

  return { transferId: transfer.id };
}
