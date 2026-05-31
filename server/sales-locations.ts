import type { Request } from "express";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { syncAcAdapterById } from "./battery-instore-sync";
import {
  salesLocations,
  salesUserLocations,
  stockTransfers,
  inStoreProducts,
  laptops,
  desktops,
  acAdapters,
  laptopBatteries,
  keyboards,
  lcds,
} from "@shared/schema";
import {
  getInventoryScanCode,
  inventoryItemMatchesScan,
  normalizeScannedBarcode,
  type InventoryCodeSource,
} from "@shared/inventoryScanCode";
import {
  SYNC_ADAPTER_SKU_PREFIX,
  SYNC_BATTERY_SKU_PREFIX,
} from "./battery-instore-sync";

export { getInventoryScanCode } from "@shared/inventoryScanCode";

export const LOCATION_MAIN_ID = 1;
export const LOCATION_SHOP2_ID = 2;

/** Parse API/body sales location id (only loc 1 or 2). */
export function normalizeSalesLocationId(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = parseInt(String(value), 10);
  if (n === LOCATION_MAIN_ID || n === LOCATION_SHOP2_ID) return n;
  return null;
}

/**
 * Older laptop/desktop rows used the free-text `location` shelf field while
 * `sales_location_id` stayed at default 1. Map common "location 2" labels.
 */
export function inferSalesLocationIdFromLegacyLocationText(
  location: string | null | undefined,
): number | null {
  const t = (location || "").trim().toLowerCase();
  if (!t) return null;

  const exactLoc2 = new Set([
    "2",
    "loc2",
    "location2",
    "location 2",
    "shop2",
    "shop 2",
    "store2",
    "store 2",
    "site2",
    "site 2",
    "الموقع 2",
    "موقع 2",
    "موقع٢",
    "فرع 2",
    "محل 2",
    "مخزن 2",
    "main 2",
    "pos 2",
    "pos2",
  ]);
  if (exactLoc2.has(t)) return LOCATION_SHOP2_ID;

  if (
    /^loc(ation)?\s*2$/i.test(t)
    || /^shop\s*2$/i.test(t)
    || /^موقع\s*2$/i.test(t)
    || t.includes("location 2")
    || t.includes("loc 2")
    || t.includes("موقع 2")
    || t.includes("فرع 2")
  ) {
    return LOCATION_SHOP2_ID;
  }

  return null;
}

/** Shelf label or internal notes that indicate shop 2 (pre–sales_location_id). */
export function inferInventorySalesLocationHint(row: {
  location?: string | null;
  notes?: string | null;
}): number | null {
  return (
    inferSalesLocationIdFromLegacyLocationText(row.location)
    ?? inferSalesLocationIdFromLegacyLocationText(row.notes)
  );
}

export function resolveInventorySalesLocationId(options: {
  salesLocationId?: unknown;
  location?: string | null;
}): number {
  return (
    normalizeSalesLocationId(options.salesLocationId)
    ?? inferSalesLocationIdFromLegacyLocationText(options.location)
    ?? LOCATION_MAIN_ID
  );
}

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

/** @deprecated Use getInventoryScanCode */
function getStableBarcode(row: { barcode?: string | null; serialNumber: string }): string {
  return getInventoryScanCode(row);
}

export type PosScanResolvedProduct = {
  productSource: "instore" | "battery" | "adapter" | "keyboard" | "lcd" | "laptop" | "desktop";
  id: string;
  sourceId?: string;
  nameAr: string;
  nameEn: string | null;
  price: string;
  wholesalePrice: string | null;
  stockQuantity: number;
  sku: string | null;
  barcode: string | null;
  scanCode: string | null;
  serialNumber: string | null;
  partNumber: string | null;
  category: string | null;
};

function inventoryRowMatchesScan(row: InventoryCodeSource, code: string): boolean {
  return inventoryItemMatchesScan(row, code);
}

function mapAdapterToPosScan(a: typeof acAdapters.$inferSelect): PosScanResolvedProduct {
  const scanCode = getInventoryScanCode(a);
  const watt = a.wattage != null ? ` ${a.wattage}W` : "";
  const name = `${a.brand} ${a.serialNumber}${watt}`;
  return {
    productSource: "adapter",
    id: `ada-${a.id}`,
    sourceId: a.id,
    nameAr: name,
    nameEn: name,
    price: String(a.sellingPrice || "0"),
    wholesalePrice: a.wholesalePrice ? String(a.wholesalePrice) : null,
    stockQuantity: a.stockQuantity ?? 0,
    sku: scanCode,
    barcode: scanCode,
    scanCode,
    serialNumber: a.serialNumber,
    partNumber: a.partNumber ?? null,
    category: "شواحن",
  };
}

function mapBatteryToPosScan(b: typeof laptopBatteries.$inferSelect): PosScanResolvedProduct {
  const scanCode = getInventoryScanCode(b);
  const name = `${b.brand} ${b.serialNumber}`;
  return {
    productSource: "battery",
    id: `bat-${b.id}`,
    sourceId: b.id,
    nameAr: name,
    nameEn: name,
    price: String(b.sellingPrice || "0"),
    wholesalePrice: b.wholesalePrice ? String(b.wholesalePrice) : null,
    stockQuantity: b.stockQuantity ?? 0,
    sku: scanCode,
    barcode: scanCode,
    scanCode,
    serialNumber: b.serialNumber,
    partNumber: b.partNumber ?? null,
    category: "بطاريات",
  };
}

function mapInstoreToPosScan(p: typeof inStoreProducts.$inferSelect): PosScanResolvedProduct {
  const scanCode = (p.barcode || p.sku || "").trim() || null;
  return {
    productSource: "instore",
    id: String(p.id),
    nameAr: p.nameAr,
    nameEn: p.nameEn ?? null,
    price: String(p.price),
    wholesalePrice: p.wholesalePrice ? String(p.wholesalePrice) : null,
    stockQuantity: p.stockQuantity ?? 0,
    sku: p.sku ?? null,
    barcode: p.barcode ?? null,
    scanCode,
    serialNumber: null,
    partNumber: null,
    category: p.category ?? null,
  };
}

/** Resolve a barcode/serial scan to a POS line item at a sales location (DB lookup). */
export async function resolvePosScanAtLocation(
  locationId: number,
  scanned: string,
): Promise<PosScanResolvedProduct | null> {
  const code = normalizeScannedBarcode(scanned);
  if (!code) return null;

  const instoreRows = await db
    .select()
    .from(inStoreProducts)
    .where(and(eq(inStoreProducts.salesLocationId, locationId), eq(inStoreProducts.isActive, 1)));

  for (const p of instoreRows) {
    const instoreCodes: InventoryCodeSource = {
      barcode: p.barcode,
      serialNumber: p.sku,
      scanCode: p.barcode,
    };
    if (!inventoryRowMatchesScan(instoreCodes, code)) continue;

    if (p.sku?.startsWith(SYNC_ADAPTER_SKU_PREFIX)) {
      const adapterId = p.sku.slice(SYNC_ADAPTER_SKU_PREFIX.length);
      const [a] = await db
        .select()
        .from(acAdapters)
        .where(eq(acAdapters.id, adapterId))
        .limit(1);
      if (a) return mapAdapterToPosScan(a);
    }
    if (p.sku?.startsWith(SYNC_BATTERY_SKU_PREFIX)) {
      const batteryId = p.sku.slice(SYNC_BATTERY_SKU_PREFIX.length);
      const [b] = await db
        .select()
        .from(laptopBatteries)
        .where(eq(laptopBatteries.id, batteryId))
        .limit(1);
      if (b) return mapBatteryToPosScan(b);
    }

    return mapInstoreToPosScan(p);
  }

  const locActive = and(eq(acAdapters.salesLocationId, locationId), eq(acAdapters.isActive, 1));

  const adapterRows = await db.select().from(acAdapters).where(locActive);
  for (const a of adapterRows) {
    if (inventoryRowMatchesScan(a, code)) return mapAdapterToPosScan(a);
  }

  const batteryRows = await db
    .select()
    .from(laptopBatteries)
    .where(and(eq(laptopBatteries.salesLocationId, locationId), eq(laptopBatteries.isActive, 1)));
  for (const b of batteryRows) {
    if (inventoryRowMatchesScan(b, code)) return mapBatteryToPosScan(b);
  }

  const laptopRows = await db
    .select()
    .from(laptops)
    .where(and(eq(laptops.salesLocationId, locationId), eq(laptops.isActive, 1)));
  for (const l of laptopRows) {
    if (inventoryRowMatchesScan(l, code)) {
      const scanCode = getInventoryScanCode(l);
      const name = `${l.brand} ${l.model || ""} — ${l.serialNumber}`.trim();
      return {
        productSource: "laptop",
        id: `lap-${l.id}`,
        sourceId: l.id,
        nameAr: name,
        nameEn: name,
        price: String(l.sellingPrice || "0"),
        wholesalePrice: l.wholesalePrice ? String(l.wholesalePrice) : null,
        stockQuantity: l.stockQuantity ?? 0,
        sku: scanCode,
        barcode: l.barcode ?? scanCode,
        scanCode: l.serialNumber || scanCode,
        serialNumber: l.serialNumber,
        partNumber: l.partNumber ?? null,
        category: "لابتوبات",
      };
    }
  }

  const desktopRows = await db
    .select()
    .from(desktops)
    .where(and(eq(desktops.salesLocationId, locationId), eq(desktops.isActive, 1)));
  for (const d of desktopRows) {
    if (inventoryRowMatchesScan(d, code)) {
      const scanCode = getInventoryScanCode(d);
      const name = `${d.brand} ${d.model || ""} — ${d.serialNumber}`.trim();
      return {
        productSource: "desktop",
        id: `des-${d.id}`,
        sourceId: d.id,
        nameAr: name,
        nameEn: name,
        price: String(d.sellingPrice || "0"),
        wholesalePrice: d.wholesalePrice ? String(d.wholesalePrice) : null,
        stockQuantity: d.stockQuantity ?? 0,
        sku: scanCode,
        barcode: d.barcode ?? scanCode,
        scanCode: d.serialNumber || scanCode,
        serialNumber: d.serialNumber,
        partNumber: d.partNumber ?? null,
        category: "Desktop",
      };
    }
  }

  const keyboardRows = await db
    .select()
    .from(keyboards)
    .where(and(eq(keyboards.salesLocationId, locationId), eq(keyboards.isActive, 1)));
  for (const k of keyboardRows) {
    if (inventoryRowMatchesScan(k, code)) {
      const scanCode = getInventoryScanCode(k);
      const name = `${k.brand} ${k.serialNumber}`;
      return {
        productSource: "keyboard",
        id: `kbd-${k.id}`,
        sourceId: k.id,
        nameAr: name,
        nameEn: name,
        price: String(k.sellingPrice || "0"),
        wholesalePrice: k.wholesalePrice ? String(k.wholesalePrice) : null,
        stockQuantity: k.stockQuantity ?? 0,
        sku: scanCode,
        barcode: scanCode,
        scanCode,
        serialNumber: k.serialNumber,
        partNumber: k.partNumber ?? null,
        category: "كيبورد",
      };
    }
  }

  const lcdRows = await db
    .select()
    .from(lcds)
    .where(and(eq(lcds.salesLocationId, locationId), eq(lcds.isActive, 1)));
  for (const l of lcdRows) {
    if (inventoryRowMatchesScan(l, code)) {
      const scanCode = getInventoryScanCode(l);
      const name = `${l.brand} ${l.serialNumber}`;
      return {
        productSource: "lcd",
        id: `lcd-${l.id}`,
        sourceId: l.id,
        nameAr: name,
        nameEn: name,
        price: String(l.sellingPrice || "0"),
        wholesalePrice: l.wholesalePrice ? String(l.wholesalePrice) : null,
        stockQuantity: l.stockQuantity ?? 0,
        sku: scanCode,
        barcode: scanCode,
        scanCode,
        serialNumber: l.serialNumber,
        partNumber: l.partNumber ?? null,
        category: "شاشات LCD",
      };
    }
  }

  return null;
}

/** Keep a stable scan barcode when internal serial changes unless the client sends a new barcode. */
export function resolveInventoryBarcodeUpdate(
  updateData: { serialNumber?: string; barcode?: string | null },
  existing: { serialNumber: string; barcode?: string | null },
  options?: { batteryAutoPrefix?: boolean },
): void {
  const explicit = (updateData.barcode ?? "").trim();
  if (explicit) {
    updateData.barcode = explicit;
    return;
  }

  if (!updateData.serialNumber) return;

  const oldBarcode = (existing.barcode || "").trim();
  const oldSerial = (existing.serialNumber || "").trim();
  if (!oldBarcode || oldBarcode === oldSerial) {
    if (options?.batteryAutoPrefix) {
      updateData.barcode = `BAT-${String(updateData.serialNumber).replace(/[^A-Za-z0-9]/g, "").toUpperCase()}`;
    } else {
      updateData.barcode = String(updateData.serialNumber);
    }
  } else {
    delete updateData.barcode;
  }
}

async function findInventoryRowAtLocation(
  table: typeof laptops | typeof desktops | typeof acAdapters,
  locationId: number,
  row: { barcode?: string | null; serialNumber: string; brand: string; partNumber?: string | null; model?: string | null; wattage?: number | null },
): Promise<(typeof laptops.$inferSelect | typeof desktops.$inferSelect | typeof acAdapters.$inferSelect) | undefined> {
  const stableBarcode = getStableBarcode(row);

  if (stableBarcode) {
    const [byBarcode] = await db
      .select()
      .from(table)
      .where(
        and(
          eq(table.salesLocationId, locationId),
          eq(table.isActive, 1),
          eq(table.barcode, stableBarcode),
        ),
      )
      .limit(1);
    if (byBarcode) return byBarcode;

    const [bySerialAsScanCode] = await db
      .select()
      .from(table)
      .where(
        and(
          eq(table.salesLocationId, locationId),
          eq(table.isActive, 1),
          eq(table.serialNumber, stableBarcode),
        ),
      )
      .limit(1);
    if (bySerialAsScanCode) return bySerialAsScanCode;
  }

  if (table === laptops || table === desktops) {
    const serial = (row.serialNumber || "").trim();
    if (serial) {
      const [bySerial] = await db
        .select()
        .from(table)
        .where(
          and(
            eq(table.salesLocationId, locationId),
            eq(table.isActive, 1),
            eq(table.serialNumber, serial),
          ),
        )
        .limit(1);
      if (bySerial) return bySerial;
    }
    return undefined;
  }

  let identityClause;
  const adapterRow = row as {
    brand: string;
    partNumber?: string | null;
    wattage?: number | null;
  };
  identityClause =
    adapterRow.partNumber != null && adapterRow.partNumber !== ""
      ? and(eq(acAdapters.brand, adapterRow.brand), eq(acAdapters.partNumber, adapterRow.partNumber))
      : adapterRow.wattage != null
        ? and(eq(acAdapters.brand, adapterRow.brand), eq(acAdapters.wattage, adapterRow.wattage))
        : eq(acAdapters.brand, adapterRow.brand);

  const [byIdentity] = await db
    .select()
    .from(acAdapters)
    .where(
      and(
        eq(acAdapters.salesLocationId, locationId),
        eq(acAdapters.isActive, 1),
        identityClause,
      ),
    )
    .limit(1);
  return byIdentity;
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

  const stableBarcode = getStableBarcode(row);

  // One serialized unit (e.g. LAP-0064): move the row instead of merging by model at destination.
  if (quantity === 1 && available === 1 && (row.serialNumber || "").trim()) {
    await db
      .update(table)
      .set({
        salesLocationId: toLocationId,
        ...(row.barcode ? {} : { barcode: stableBarcode }),
        updatedAt: new Date(),
      })
      .where(eq(table.id, productId));
    return row.serialNumber;
  }

  await db
    .update(table)
    .set({
      stockQuantity: available - quantity,
      ...(row.barcode ? {} : { barcode: stableBarcode }),
      updatedAt: new Date(),
    })
    .where(eq(table.id, productId));

  const existingAtDest = await findInventoryRowAtLocation(table, toLocationId, row);

  if (existingAtDest) {
    const sameSku =
      inventoryRowGroupKey(table, existingAtDest as (typeof laptops.$inferSelect)) ===
      inventoryRowGroupKey(table, row as (typeof laptops.$inferSelect));
    if (sameSku) {
      await db
        .update(table)
        .set({
          stockQuantity: (existingAtDest.stockQuantity || 0) + quantity,
          barcode: stableBarcode,
          updatedAt: new Date(),
        })
        .where(eq(table.id, existingAtDest.id));
      return existingAtDest.serialNumber;
    }
  }

  const newSerial = await nextInventorySerial(serialPrefix, table);
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    serialNumber: _s,
    stockQuantity: _q,
    salesLocationId: _loc,
    barcode: _b,
    ...rest
  } = row;
  await db.insert(table).values({
    ...rest,
    serialNumber: newSerial,
    barcode: stableBarcode,
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

  const stableBarcode = getStableBarcode(row);

  await db
    .update(acAdapters)
    .set({
      stockQuantity: available - quantity,
      ...(row.barcode ? {} : { barcode: stableBarcode }),
      updatedAt: new Date(),
    })
    .where(eq(acAdapters.id, productId));

  const existingAtDest = await findInventoryRowAtLocation(acAdapters, toLocationId, row);

  if (existingAtDest) {
    await db
      .update(acAdapters)
      .set({
        stockQuantity: (existingAtDest.stockQuantity || 0) + quantity,
        barcode: stableBarcode,
        updatedAt: new Date(),
      })
      .where(eq(acAdapters.id, existingAtDest.id));
    await syncAcAdapterById(productId);
    await syncAcAdapterById(existingAtDest.id);
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
    barcode: _b,
    ...rest
  } = row;
  const [inserted] = await db
    .insert(acAdapters)
    .values({
      ...rest,
      serialNumber: newSerial,
      barcode: stableBarcode,
      stockQuantity: quantity,
      salesLocationId: toLocationId,
      isActive: 1,
    })
    .returning();
  if (inserted) await syncAcAdapterById(inserted.id);
  await syncAcAdapterById(productId);
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

function laptopInventorySkuKey(row: typeof laptops.$inferSelect): string {
  return [
    row.salesLocationId,
    (row.brand || "").toLowerCase(),
    (row.model || "").toLowerCase(),
    (row.partNumber || "").toLowerCase(),
    (row.cpu || "").toLowerCase(),
    (row.ram || "").toLowerCase(),
    (row.storage || "").toLowerCase(),
    (row.gpu || "").toLowerCase(),
    String(row.sizeInch ?? ""),
  ].join("::");
}

function desktopInventorySkuKey(row: typeof desktops.$inferSelect): string {
  return [
    row.salesLocationId,
    (row.brand || "").toLowerCase(),
    (row.model || "").toLowerCase(),
    (row.partNumber || "").toLowerCase(),
    (row.cpu || "").toLowerCase(),
    (row.ram || "").toLowerCase(),
    (row.storage || "").toLowerCase(),
    (row.gpu || "").toLowerCase(),
  ].join("::");
}

function inventoryRowGroupKey(
  table: typeof laptops | typeof desktops | typeof acAdapters,
  row: (typeof laptops.$inferSelect | typeof desktops.$inferSelect | typeof acAdapters.$inferSelect),
): string {
  if (table === laptops) {
    return laptopInventorySkuKey(row as typeof laptops.$inferSelect);
  }
  if (table === desktops) {
    return desktopInventorySkuKey(row as typeof desktops.$inferSelect);
  }
  const part = (row.partNumber || "").toLowerCase();
  const model = "model" in row ? String(row.model || "").toLowerCase() : "";
  const wattage = "wattage" in row && row.wattage != null ? String(row.wattage) : "";
  return `${row.salesLocationId}::${(row.brand || "").toLowerCase()}::${part}::${model}::${wattage}`;
}

/**
 * Each laptop/desktop row is one physical unit — barcode must equal serial so
 * POS scans do not match every unit that shared a model-level group barcode.
 */
async function repairSerializedUnitBarcodes(
  table: typeof laptops | typeof desktops,
): Promise<number> {
  const rows = await db.select().from(table).where(eq(table.isActive, 1));
  let fixed = 0;

  for (const row of rows) {
    const serial = (row.serialNumber || "").trim();
    if (!serial) continue;
    if ((row.barcode || "").trim() === serial) continue;
    await db
      .update(table)
      .set({ barcode: serial, updatedAt: new Date() })
      .where(eq(table.id, row.id));
    fixed++;
  }

  if (fixed > 0) {
    console.log(
      `[sales-locations] set serial barcodes on ${fixed} ${table === laptops ? "laptop" : "desktop"} unit(s)`,
    );
  }
  return fixed;
}

function alignBarcodeGroupKey(
  table: typeof laptops | typeof desktops | typeof acAdapters,
  row: (typeof laptops.$inferSelect | typeof desktops.$inferSelect | typeof acAdapters.$inferSelect),
): string {
  const base = inventoryRowGroupKey(table, row);
  // Each laptop/desktop unit has its own serial — never share one barcode across units.
  if (table === laptops || table === desktops) {
    const serial = (row.serialNumber || "").trim().toUpperCase();
    return `${base}::${serial || row.id}`;
  }
  return base;
}

async function alignProductGroupBarcodes(
  table: typeof laptops | typeof desktops | typeof acAdapters,
): Promise<void> {
  const rows = await db.select().from(table).where(eq(table.isActive, 1));
  const groups = new Map<string, Array<(typeof rows)[number]>>();

  for (const row of rows) {
    const key = alignBarcodeGroupKey(table, row);
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    let stable: string | null = null;
    for (const row of group) {
      const barcode = (row.barcode || "").trim();
      const serial = (row.serialNumber || "").trim();
      if (barcode && barcode !== serial) {
        stable = barcode;
        break;
      }
    }
    if (!stable) {
      for (const row of group) {
        const barcode = (row.barcode || "").trim();
        if (barcode) {
          stable = barcode;
          break;
        }
      }
    }
    if (!stable) continue;

    for (const row of group) {
      const current = (row.barcode || "").trim();
      if (current === stable) continue;
      const serial = (row.serialNumber || "").trim();
      if (!current || current === serial) {
        await db
          .update(table)
          .set({ barcode: stable, updatedAt: new Date() })
          .where(eq(table.id, row.id));
      }
    }
  }
}

async function mergeDuplicateInventoryRows(
  table: typeof laptops | typeof desktops | typeof acAdapters,
): Promise<number> {
  const rows = await db.select().from(table).where(eq(table.isActive, 1));
  const groups = new Map<string, Array<(typeof rows)[number]>>();

  for (const row of rows) {
    const scanCode = getStableBarcode(row);
    if (!scanCode) continue;
    const skuKey =
      table === laptops || table === desktops
        ? inventoryRowGroupKey(table, row)
        : "";
    const key =
      table === laptops || table === desktops
        ? `${row.salesLocationId}::${scanCode.toUpperCase()}::${skuKey}`
        : `${row.salesLocationId}::${scanCode.toUpperCase()}`;
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }

  let mergedCount = 0;
  for (const [, group] of groups) {
    if (group.length < 2) continue;

    if (table === laptops || table === desktops) {
      const serials = new Set(
        group.map((r) => (r.serialNumber || "").trim().toUpperCase()).filter(Boolean),
      );
      if (serials.size > 1) continue;
    }

    const scanCodeUpper = getStableBarcode(group[0]).toUpperCase();
    group.sort((a, b) => {
      const aMatch = (a.serialNumber || "").trim().toUpperCase() === scanCodeUpper ? 0 : 1;
      const bMatch = (b.serialNumber || "").trim().toUpperCase() === scanCodeUpper ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return (b.stockQuantity || 0) - (a.stockQuantity || 0);
    });

    const keep = group[0];
    const stableBarcode = getStableBarcode(keep);
    let totalQty = 0;
    for (const row of group) totalQty += row.stockQuantity || 0;

    await db
      .update(table)
      .set({ stockQuantity: totalQty, barcode: stableBarcode, updatedAt: new Date() })
      .where(eq(table.id, keep.id));

    for (let i = 1; i < group.length; i++) {
      await db
        .update(table)
        .set({ isActive: 0, stockQuantity: 0, updatedAt: new Date() })
        .where(eq(table.id, group[i].id));
      mergedCount++;
      if (table === acAdapters) {
        await syncAcAdapterById(group[i].id);
      }
    }

    if (table === acAdapters) {
      await syncAcAdapterById(keep.id);
    }
  }

  return mergedCount;
}

async function backfillMissingInventoryBarcodes(
  table: typeof laptops | typeof desktops | typeof acAdapters,
): Promise<number> {
  const rows = await db.select().from(table).where(eq(table.isActive, 1));
  let updated = 0;
  for (const row of rows) {
    const stable = getStableBarcode(row);
    if (!stable || (row.barcode || "").trim()) continue;
    await db
      .update(table)
      .set({ barcode: stable, updatedAt: new Date() })
      .where(eq(table.id, row.id));
    updated++;
  }
  return updated;
}

/** Assign row to a sales location without merging into another unit. */
async function promoteInventoryRowToLocation(
  table: typeof laptops | typeof desktops,
  rowId: string,
  targetLocationId: number,
): Promise<void> {
  await db
    .update(table)
    .set({ salesLocationId: targetLocationId, updatedAt: new Date() })
    .where(eq(table.id, rowId));
}

export async function listActiveLaptopsForSalesLocation(
  locationId: number,
): Promise<Array<typeof laptops.$inferSelect>> {
  if (locationId === LOCATION_SHOP2_ID) {
    await reactivateInactiveUnitsWithStock(laptops, LOCATION_SHOP2_ID);
  }

  const primary = await db
    .select()
    .from(laptops)
    .where(and(eq(laptops.isActive, 1), eq(laptops.salesLocationId, locationId)))
    .orderBy(desc(laptops.createdAt));

  if (locationId !== LOCATION_SHOP2_ID) {
    return primary;
  }

  const atMain = await db
    .select()
    .from(laptops)
    .where(and(eq(laptops.isActive, 1), eq(laptops.salesLocationId, LOCATION_MAIN_ID)));

  const seen = new Set(primary.map((r) => r.id));
  const merged = [...primary];
  for (const row of atMain) {
    if (seen.has(row.id)) continue;
    if (inferInventorySalesLocationHint(row) === LOCATION_SHOP2_ID) {
      merged.push(row);
      seen.add(row.id);
    }
  }
  return merged;
}

export async function listActiveDesktopsForSalesLocation(
  locationId: number,
): Promise<Array<typeof desktops.$inferSelect>> {
  if (locationId === LOCATION_SHOP2_ID) {
    await reactivateInactiveUnitsWithStock(desktops, LOCATION_SHOP2_ID);
  }

  const primary = await db
    .select()
    .from(desktops)
    .where(and(eq(desktops.isActive, 1), eq(desktops.salesLocationId, locationId)))
    .orderBy(desc(desktops.createdAt));

  if (locationId !== LOCATION_SHOP2_ID) {
    return primary;
  }

  const atMain = await db
    .select()
    .from(desktops)
    .where(and(eq(desktops.isActive, 1), eq(desktops.salesLocationId, LOCATION_MAIN_ID)));

  const seen = new Set(primary.map((r) => r.id));
  const merged = [...primary];
  for (const row of atMain) {
    if (seen.has(row.id)) continue;
    if (inferInventorySalesLocationHint(row) === LOCATION_SHOP2_ID) {
      merged.push(row);
      seen.add(row.id);
    }
  }
  return merged;
}

async function reactivateInactiveUnitsWithStock(
  table: typeof laptops | typeof desktops,
  locationId: number,
): Promise<number> {
  const rows = await db
    .select()
    .from(table)
    .where(
      and(
        eq(table.salesLocationId, locationId),
        eq(table.isActive, 0),
        sql`${table.stockQuantity} > 0`,
      ),
    );
  let fixed = 0;
  for (const row of rows) {
    await db
      .update(table)
      .set({ isActive: 1, updatedAt: new Date() })
      .where(eq(table.id, row.id));
    fixed++;
  }
  if (fixed > 0) {
    console.log(
      `[sales-locations] reactivated ${fixed} inactive ${table === laptops ? "laptop" : "desktop"} unit(s) at location ${locationId}`,
    );
  }
  return fixed;
}

async function moveLegacyInventoryRowToLocation(
  table: typeof laptops | typeof desktops,
  row: (typeof laptops.$inferSelect | typeof desktops.$inferSelect) & {
    id: string;
    stockQuantity: number | null;
  },
  targetLocationId: number,
): Promise<void> {
  const qty = row.stockQuantity || 0;
  if (qty < 1) return;

  const existingAtDest = await findInventoryRowAtLocation(table, targetLocationId, row);

  if (existingAtDest && existingAtDest.id !== row.id) {
    const sameSku =
      inventoryRowGroupKey(table, existingAtDest as (typeof laptops.$inferSelect)) ===
      inventoryRowGroupKey(table, row as (typeof laptops.$inferSelect));
    if (!sameSku) {
      await db
        .update(table)
        .set({ salesLocationId: targetLocationId, updatedAt: new Date() })
        .where(eq(table.id, row.id));
      return;
    }
    await db
      .update(table)
      .set({
        stockQuantity: (existingAtDest.stockQuantity || 0) + qty,
        barcode: getInventoryScanCode(row),
        updatedAt: new Date(),
      })
      .where(eq(table.id, existingAtDest.id));
    await db
      .update(table)
      .set({ isActive: 0, stockQuantity: 0, updatedAt: new Date() })
      .where(eq(table.id, row.id));
    return;
  }

  await db
    .update(table)
    .set({ salesLocationId: targetLocationId, updatedAt: new Date() })
    .where(eq(table.id, row.id));
}

/**
 * Assign laptops/desktops that were saved at location 1 but labeled as shop 2
 * in the legacy text `location` field (pre–sales_location_id UI).
 */
export async function repairLegacyInventorySalesLocations(): Promise<{
  laptopsMoved: number;
  desktopsMoved: number;
}> {
  let laptopsMoved = 0;
  let desktopsMoved = 0;

  const laptopRows = await db
    .select()
    .from(laptops)
    .where(
      and(
        eq(laptops.isActive, 1),
        eq(laptops.salesLocationId, LOCATION_MAIN_ID),
        sql`${laptops.stockQuantity} > 0`,
      ),
    );

  for (const row of laptopRows) {
    const inferred = inferInventorySalesLocationHint(row);
    if (inferred !== LOCATION_SHOP2_ID) continue;
    await promoteInventoryRowToLocation(laptops, row.id, LOCATION_SHOP2_ID);
    laptopsMoved++;
  }

  const desktopRows = await db
    .select()
    .from(desktops)
    .where(
      and(
        eq(desktops.isActive, 1),
        eq(desktops.salesLocationId, LOCATION_MAIN_ID),
        sql`${desktops.stockQuantity} > 0`,
      ),
    );

  for (const row of desktopRows) {
    const inferred = inferInventorySalesLocationHint(row);
    if (inferred !== LOCATION_SHOP2_ID) continue;
    await promoteInventoryRowToLocation(desktops, row.id, LOCATION_SHOP2_ID);
    desktopsMoved++;
  }

  if (laptopsMoved > 0 || desktopsMoved > 0) {
    console.log(
      `[sales-locations] legacy location repair: ${laptopsMoved} laptop(s), ${desktopsMoved} desktop(s) → location 2`,
    );
  }

  return { laptopsMoved, desktopsMoved };
}

/** Ensure laptops/desktops recorded on transfers to shop 2 are active at location 2. */
async function repairTransferredUnitsAtShop2(
  table: typeof laptops | typeof desktops,
): Promise<number> {
  const productSource = table === laptops ? "laptop" : "desktop";
  const transfers = await db
    .select()
    .from(stockTransfers)
    .where(
      and(
        eq(stockTransfers.toLocationId, LOCATION_SHOP2_ID),
        eq(stockTransfers.productSource, productSource),
      ),
    );

  let fixed = 0;
  const touched = new Set<string>();

  for (const transfer of transfers) {
    const serial = (transfer.serialNumber || "").trim();
    const candidates: Array<typeof laptops.$inferSelect | typeof desktops.$inferSelect> = [];

    if (transfer.productId) {
      const [byId] = await db
        .select()
        .from(table)
        .where(eq(table.id, transfer.productId))
        .limit(1);
      if (byId) candidates.push(byId);
    }

    if (serial) {
      const [bySerial] = await db
        .select()
        .from(table)
        .where(eq(table.serialNumber, serial))
        .limit(1);
      if (bySerial && !candidates.some((c) => c.id === bySerial.id)) {
        candidates.push(bySerial);
      }
    }

    for (const row of candidates) {
      if (touched.has(row.id)) continue;
      touched.add(row.id);

      const needsLocation = row.salesLocationId !== LOCATION_SHOP2_ID;
      const needsStock = (row.stockQuantity || 0) < 1;
      const needsActive = row.isActive !== 1;
      if (!needsLocation && !needsStock && !needsActive) continue;

      const serialLabel = (row.serialNumber || serial || "").trim();
      await db
        .update(table)
        .set({
          salesLocationId: LOCATION_SHOP2_ID,
          isActive: 1,
          ...(needsStock ? { stockQuantity: 1 } : {}),
          ...(serialLabel ? { barcode: serialLabel } : {}),
          updatedAt: new Date(),
        })
        .where(eq(table.id, row.id));
      fixed++;
    }
  }

  if (fixed > 0) {
    console.log(
      `[sales-locations] transfer destination repair: ${fixed} ${table === laptops ? "laptop" : "desktop"} unit(s) at location 2`,
    );
  }
  return fixed;
}

/** Reactivate / merge loc-2 rows that were deactivated while stock remained on loc-1 rows. */
async function repairStuckInventoryAfterTransfers(
  table: typeof laptops | typeof desktops,
): Promise<number> {
  let fixed = 0;
  const inactiveAtDest = await db
    .select()
    .from(table)
    .where(
      and(
        eq(table.salesLocationId, LOCATION_SHOP2_ID),
        eq(table.isActive, 0),
      ),
    );

  for (const deadRow of inactiveAtDest) {
    const scan = getInventoryScanCode(deadRow);
    if (!scan) continue;

    const [activeAtMain] = await db
      .select()
      .from(table)
      .where(
        and(
          eq(table.salesLocationId, LOCATION_MAIN_ID),
          eq(table.isActive, 1),
          sql`${table.stockQuantity} > 0`,
          or(eq(table.barcode, scan), eq(table.serialNumber, scan)),
        ),
      )
      .limit(1);

    if (!activeAtMain) continue;

    await promoteInventoryRowToLocation(table, activeAtMain.id, LOCATION_SHOP2_ID);
    fixed++;
  }

  return fixed;
}

/**
 * Location 2 (and others): reactivate laptops that were wrongly merged into one
 * brand/model row while a different-SKU unit was deactivated.
 */
async function repairWronglyMergedSerialUnits(
  table: typeof laptops | typeof desktops,
  locationId: number,
): Promise<number> {
  const actives = await db
    .select()
    .from(table)
    .where(and(eq(table.isActive, 1), eq(table.salesLocationId, locationId)));

  const inactives = await db.select().from(table).where(eq(table.isActive, 0));

  let fixed = 0;
  for (const dead of inactives) {
    if ((dead.stockQuantity || 0) > 0) continue;
    const deadSerial = (dead.serialNumber || "").trim();
    if (!deadSerial) continue;

    const mergedInto = actives.find((active) => {
      if (active.id === dead.id) return false;
      const sameScan =
        getInventoryScanCode(active).toUpperCase() === getInventoryScanCode(dead).toUpperCase();
      if (!sameScan) return false;
      return inventoryRowGroupKey(table, active) !== inventoryRowGroupKey(table, dead);
    });

    if (!mergedInto) continue;

    await db
      .update(table)
      .set({
        isActive: 1,
        stockQuantity: 1,
        barcode: deadSerial,
        salesLocationId: locationId,
        updatedAt: new Date(),
      })
      .where(eq(table.id, dead.id));

    const keepSerial = (mergedInto.serialNumber || "").trim();
    if (keepSerial) {
      await db
        .update(table)
        .set({ barcode: keepSerial, updatedAt: new Date() })
        .where(eq(table.id, mergedInto.id));
    }

    actives.push({ ...dead, isActive: 1, stockQuantity: 1, barcode: deadSerial });
    fixed++;
  }

  if (fixed > 0) {
    console.log(
      `[sales-locations] reactivated ${fixed} wrongly merged ${table === laptops ? "laptop" : "desktop"} unit(s) at location ${locationId}`,
    );
  }
  return fixed;
}

/** Merge split transfer rows that share the same scan barcode at one location. */
export async function repairTransferInventoryDuplicates(): Promise<void> {
  for (const table of [acAdapters] as const) {
    await alignProductGroupBarcodes(table);
    await backfillMissingInventoryBarcodes(table);
  }
  for (const table of [laptops, desktops] as const) {
    await backfillMissingInventoryBarcodes(table);
  }
  const adapterMerged = await mergeDuplicateInventoryRows(acAdapters);
  const laptopBarcodes = await repairSerializedUnitBarcodes(laptops);
  const desktopBarcodes = await repairSerializedUnitBarcodes(desktops);
  if (laptopBarcodes > 0 || desktopBarcodes > 0) {
    console.log(
      `[sales-locations] serial unit barcodes: ${laptopBarcodes} laptop(s), ${desktopBarcodes} desktop(s)`,
    );
  }
  if (adapterMerged > 0) {
    console.log(`[sales-locations] merged ${adapterMerged} duplicate adapter row(s) from transfers`);
  }
  await reactivateInactiveUnitsWithStock(laptops, LOCATION_SHOP2_ID);
  await reactivateInactiveUnitsWithStock(desktops, LOCATION_SHOP2_ID);
  const legacy = await repairLegacyInventorySalesLocations();
  const laptopsFromTransfers = await repairTransferredUnitsAtShop2(laptops);
  const desktopsFromTransfers = await repairTransferredUnitsAtShop2(desktops);
  if (laptopsFromTransfers > 0 || desktopsFromTransfers > 0) {
    console.log(
      `[sales-locations] shop-2 transfer rows: ${laptopsFromTransfers} laptop(s), ${desktopsFromTransfers} desktop(s)`,
    );
  }
  const laptopsStuck = await repairStuckInventoryAfterTransfers(laptops);
  const desktopsStuck = await repairStuckInventoryAfterTransfers(desktops);
  if (laptopsStuck > 0 || desktopsStuck > 0) {
    console.log(
      `[sales-locations] transfer stuck repair: ${laptopsStuck} laptop(s), ${desktopsStuck} desktop(s)`,
    );
  }
  await repairWronglyMergedSerialUnits(laptops, LOCATION_SHOP2_ID);
  await repairWronglyMergedSerialUnits(desktops, LOCATION_SHOP2_ID);
  await repairWronglyMergedSerialUnits(laptops, LOCATION_MAIN_ID);
  await repairWronglyMergedSerialUnits(desktops, LOCATION_MAIN_ID);

  const laptopBarcodesFinal = await repairSerializedUnitBarcodes(laptops);
  const desktopBarcodesFinal = await repairSerializedUnitBarcodes(desktops);
  if (laptopBarcodesFinal > 0 || desktopBarcodesFinal > 0) {
    console.log(
      `[sales-locations] final serial unit barcodes: ${laptopBarcodesFinal} laptop(s), ${desktopBarcodesFinal} desktop(s)`,
    );
  }
}
