import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  acAdapters,
  desktops,
  inStoreProducts,
  keyboards,
  laptopBatteries,
  laptops,
  lcds,
  type AcAdapter,
  type Desktop,
  type InStoreProduct,
  type InsertInStoreProduct,
  type Keyboard,
  type Laptop,
  type LaptopBattery,
  type Lcd,
} from "@shared/schema";
import {
  categoryForProductType,
  defaultUnifiedNameAr,
  isInStoreProductType,
  legacySourceForProductType,
  type InStoreProductSpecs,
  type InStoreProductType,
  unifiedInStorePrimaryScanCode,
} from "@shared/inStoreProductTypes";
import { canonicalAdpSerial } from "@shared/inventoryScanCode";
import { LOCATION_MAIN_ID } from "./sales-locations";
import {
  SYNC_ADAPTER_SKU_PREFIX,
  SYNC_BATTERY_SKU_PREFIX,
  deactivateSyncedAdapterInStore,
  deactivateSyncedBatteryInStore,
} from "./battery-instore-sync";

export type UnifiedMigrationStats = {
  created: number;
  updated: number;
  skipped: number;
  deactivatedSyncRows: number;
};

function asSpecs(value: unknown): InStoreProductSpecs {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as InStoreProductSpecs;
  }
  return {};
}

async function findUnifiedByLegacy(
  legacySource: string,
  legacyId: string,
  salesLocationId: number,
): Promise<InStoreProduct | undefined> {
  const [row] = await db
    .select()
    .from(inStoreProducts)
    .where(
      and(
        eq(inStoreProducts.legacySource, legacySource),
        eq(inStoreProducts.legacyId, legacyId),
        eq(inStoreProducts.salesLocationId, salesLocationId),
      ),
    )
    .limit(1);
  return row;
}

function basePayloadFromLegacy(
  type: InStoreProductType,
  specs: InStoreProductSpecs,
  row: {
    id: string;
    stockQuantity?: number | null;
    minStockLevel?: number | null;
    purchasePrice?: string | null;
    sellingPrice?: string | null;
    wholesalePrice?: string | null;
    isActive?: number | null;
    salesLocationId?: number | null;
  },
  salesLocationId: number,
  scanSku: string,
  scanBarcode: string,
): InsertInStoreProduct {
  const nameAr = defaultUnifiedNameAr(type, specs);
  return {
    nameAr,
    nameEn: nameAr,
    sku: scanSku,
    barcode: scanBarcode,
    price: String(row.sellingPrice ?? row.purchasePrice ?? "0"),
    wholesalePrice: row.wholesalePrice ?? null,
    costPrice: row.purchasePrice ?? null,
    category: categoryForProductType(type),
    description: Array.isArray(specs.compatibleLaptops)
      ? (specs.compatibleLaptops as string[]).join(", ")
      : null,
    stockQuantity: row.stockQuantity ?? 0,
    lowStockThreshold: row.minStockLevel ?? 2,
    isActive: row.isActive ?? 1,
    salesLocationId,
    productType: type,
    specs,
    legacySource: legacySourceForProductType(type),
    legacyId: row.id,
  };
}

function adapterSpecs(a: AcAdapter): InStoreProductSpecs {
  const canonical =
    canonicalAdpSerial(a.serialNumber, a.barcode) || (a.serialNumber || "").trim();
  return {
    serialNumber: canonical,
    partNumber: a.partNumber,
    barcode: a.barcode || canonical,
    brand: a.brand,
    compatibleLaptops: a.compatibleLaptops || [],
    inputVoltage: a.inputVoltage,
    outputVoltage: a.outputVoltage != null ? String(a.outputVoltage) : null,
    amperage: a.amperage != null ? String(a.amperage) : null,
    wattage: a.wattage,
    connectorType: a.connectorType,
    tipSize: a.tipSize,
    plugType: a.plugType,
    supplier: a.supplier,
    location: a.location,
    notes: a.notes,
    minStockLevel: a.minStockLevel,
  };
}

function batterySpecs(b: LaptopBattery): InStoreProductSpecs {
  return {
    serialNumber: b.serialNumber,
    partNumber: b.partNumber,
    barcode: b.barcode || b.serialNumber,
    brand: b.brand,
    compatibleLaptops: b.compatibleLaptops || [],
    voltage: b.voltage != null ? String(b.voltage) : null,
    capacity: b.capacity,
    cells: b.cells,
    supplier: b.supplier,
    location: b.location,
    notes: b.notes,
    minStockLevel: b.minStockLevel,
  };
}

function laptopSpecs(l: Laptop): InStoreProductSpecs {
  return {
    serialNumber: l.serialNumber,
    partNumber: l.partNumber,
    barcode: l.barcode,
    brand: l.brand,
    model: l.model,
    sizeInch: l.sizeInch != null ? String(l.sizeInch) : null,
    cpu: l.cpu,
    ram: l.ram,
    storage: l.storage,
    gpu: l.gpu,
    supplier: l.supplier,
    location: l.location,
    notes: l.notes,
    minStockLevel: l.minStockLevel,
  };
}

function desktopSpecs(d: Desktop): InStoreProductSpecs {
  return {
    serialNumber: d.serialNumber,
    partNumber: d.partNumber,
    barcode: d.barcode,
    brand: d.brand,
    model: d.model,
    cpu: d.cpu,
    ram: d.ram,
    storage: d.storage,
    gpu: d.gpu,
    supplier: d.supplier,
    location: d.location,
    notes: d.notes,
    minStockLevel: d.minStockLevel,
  };
}

function keyboardSpecs(k: Keyboard): InStoreProductSpecs {
  return {
    serialNumber: k.serialNumber,
    partNumber: k.partNumber,
    barcode: k.barcode,
    brand: k.brand,
    layout: k.layout,
    keyboardType: k.keyboardType,
    backlight: k.backlight,
    supplier: k.supplier,
    location: k.location,
    notes: k.notes,
    minStockLevel: k.minStockLevel,
  };
}

function lcdSpecs(l: Lcd): InStoreProductSpecs {
  return {
    serialNumber: l.serialNumber,
    partNumber: l.partNumber,
    barcode: l.barcode,
    brand: l.brand,
    sizeInch: l.sizeInch != null ? String(l.sizeInch) : null,
    brightnessNits: l.brightnessNits,
    refreshRateHz: l.refreshRateHz,
    resolution: l.resolution,
    connectorType: l.connectorType,
    panelType: l.panelType,
    supplier: l.supplier,
    location: l.location,
    notes: l.notes,
    minStockLevel: l.minStockLevel,
  };
}

async function upsertUnifiedFromLegacy(
  type: InStoreProductType,
  specs: InStoreProductSpecs,
  legacyRow: Parameters<typeof basePayloadFromLegacy>[2],
  salesLocationId: number,
  scanSku: string,
  scanBarcode: string,
  stats: UnifiedMigrationStats,
): Promise<InStoreProduct> {
  const legacySource = legacySourceForProductType(type)!;
  const existing = await findUnifiedByLegacy(legacySource, legacyRow.id, salesLocationId);
  const payload = basePayloadFromLegacy(type, specs, legacyRow, salesLocationId, scanSku, scanBarcode);

  if (existing) {
    const updated = await storage.updateInStoreProduct(existing.id, {
      ...payload,
      updatedAt: new Date(),
    } as Partial<InsertInStoreProduct>);
    stats.updated++;
    return updated!;
  }

  const created = await storage.createInStoreProduct(payload);
  stats.created++;
  return created;
}

async function deactivateSyncMirrorForType(
  type: "battery" | "adapter",
  legacyId: string,
): Promise<void> {
  if (type === "battery") await deactivateSyncedBatteryInStore(legacyId);
  else await deactivateSyncedAdapterInStore(legacyId);
}

export async function migrateBatteryInventoryToUnified(
  locationId?: number,
): Promise<UnifiedMigrationStats> {
  const stats: UnifiedMigrationStats = {
    created: 0,
    updated: 0,
    skipped: 0,
    deactivatedSyncRows: 0,
  };

  const adapters = locationId != null
    ? await db.select().from(acAdapters).where(eq(acAdapters.salesLocationId, locationId))
    : await db.select().from(acAdapters);

  for (const a of adapters) {
    if ((a.isActive ?? 1) === 0 && (a.stockQuantity ?? 0) <= 0) {
      stats.skipped++;
      continue;
    }
    const specs = adapterSpecs(a);
    const scan =
      unifiedInStorePrimaryScanCode({
        id: 0,
        nameAr: "",
        price: "0",
        stockQuantity: 0,
        productType: "adapter",
        specs,
        sku: a.serialNumber,
        barcode: a.barcode,
      }) || a.serialNumber;
    const loc = a.salesLocationId ?? LOCATION_MAIN_ID;
    if (locationId != null && loc !== locationId) continue;
    await upsertUnifiedFromLegacy("adapter", specs, a, loc, scan, scan, stats);
    await deactivateSyncMirrorForType("adapter", a.id);
    stats.deactivatedSyncRows++;
  }

  const batteries = await db.select().from(laptopBatteries);
  for (const b of batteries) {
    if ((b.isActive ?? 1) === 0 && (b.stockQuantity ?? 0) <= 0) {
      stats.skipped++;
      continue;
    }
    const specs = batterySpecs(b);
    const scan = (b.barcode || b.serialNumber || "").trim();
    const loc = LOCATION_MAIN_ID;
    if (locationId != null && loc !== locationId) continue;
    await upsertUnifiedFromLegacy("battery", specs, b, loc, scan, scan, stats);
    await deactivateSyncMirrorForType("battery", b.id);
    stats.deactivatedSyncRows++;
  }

  const laptopRows = locationId != null
    ? await db.select().from(laptops).where(eq(laptops.salesLocationId, locationId))
    : await db.select().from(laptops);
  for (const l of laptopRows) {
    const specs = laptopSpecs(l);
    const scan = (l.barcode || l.serialNumber || "").trim();
    const loc = l.salesLocationId ?? LOCATION_MAIN_ID;
    await upsertUnifiedFromLegacy("laptop", specs, l, loc, scan, scan, stats);
  }

  const desktopRows = locationId != null
    ? await db.select().from(desktops).where(eq(desktops.salesLocationId, locationId))
    : await db.select().from(desktops);
  for (const d of desktopRows) {
    const specs = desktopSpecs(d);
    const scan = (d.barcode || d.serialNumber || "").trim();
    const loc = d.salesLocationId ?? LOCATION_MAIN_ID;
    await upsertUnifiedFromLegacy("desktop", specs, d, loc, scan, scan, stats);
  }

  const keyboardRows = await db.select().from(keyboards);
  for (const k of keyboardRows) {
    const specs = keyboardSpecs(k);
    const scan = (k.barcode || k.serialNumber || "").trim();
    await upsertUnifiedFromLegacy("keyboard", specs, k, LOCATION_MAIN_ID, scan, scan, stats);
  }

  const lcdRows = await db.select().from(lcds);
  for (const l of lcdRows) {
    const specs = lcdSpecs(l);
    const scan = (l.barcode || l.serialNumber || "").trim();
    await upsertUnifiedFromLegacy("lcd", specs, l, LOCATION_MAIN_ID, scan, scan, stats);
  }

  return stats;
}

/** Keep legacy battery tables in sync while POS still reads them. */
export async function syncLegacyFromUnifiedProduct(product: InStoreProduct): Promise<void> {
  const type = isInStoreProductType(product.productType) ? product.productType : "generic";
  if (type === "generic") return;

  const specs = asSpecs(product.specs);
  const stock = product.stockQuantity ?? 0;
  const minStock = product.lowStockThreshold ?? 2;
  const purchasePrice = product.costPrice ?? null;
  const sellingPrice = product.price;
  const wholesalePrice = product.wholesalePrice ?? null;

  if (type === "adapter") {
    const serialNumber =
      canonicalAdpSerial(
        specString(specs, "serialNumber"),
        specString(specs, "barcode") || product.barcode || product.sku,
      ) || specString(specs, "serialNumber");
    const payload = {
      serialNumber,
      partNumber: specString(specs, "partNumber") || null,
      barcode: specString(specs, "barcode") || product.barcode || serialNumber,
      brand: specString(specs, "brand") || "Unknown",
      compatibleLaptops: Array.isArray(specs.compatibleLaptops)
        ? (specs.compatibleLaptops as string[])
        : [],
      inputVoltage: specString(specs, "inputVoltage") || null,
      outputVoltage: specNumber(specs, "outputVoltage"),
      amperage: specNumber(specs, "amperage"),
      wattage: specInt(specs, "wattage"),
      connectorType: specString(specs, "connectorType") || null,
      tipSize: specString(specs, "tipSize") || null,
      plugType: specString(specs, "plugType") || null,
      stockQuantity: stock,
      minStockLevel: minStock,
      purchasePrice,
      sellingPrice,
      wholesalePrice,
      supplier: specString(specs, "supplier") || null,
      location: specString(specs, "location") || null,
      notes: specString(specs, "notes") || null,
      isActive: product.isActive ?? 1,
      salesLocationId: product.salesLocationId ?? LOCATION_MAIN_ID,
    };

    if (product.legacyId) {
      await storage.updateAcAdapter(product.legacyId, payload);
      return;
    }
    const created = await storage.createAcAdapter(payload);
    await storage.updateInStoreProduct(product.id, {
      legacySource: "adapter",
      legacyId: created.id,
    });
    return;
  }

  if (type === "battery") {
    const payload = {
      serialNumber: specString(specs, "serialNumber"),
      partNumber: specString(specs, "partNumber") || null,
      barcode: specString(specs, "barcode") || product.barcode || null,
      brand: specString(specs, "brand") || "Unknown",
      compatibleLaptops: Array.isArray(specs.compatibleLaptops)
        ? (specs.compatibleLaptops as string[])
        : [],
      voltage: specString(specs, "voltage") || null,
      capacity: specInt(specs, "capacity"),
      cells: specInt(specs, "cells"),
      stockQuantity: stock,
      minStockLevel: minStock,
      purchasePrice,
      sellingPrice,
      wholesalePrice,
      supplier: specString(specs, "supplier") || null,
      location: specString(specs, "location") || null,
      notes: specString(specs, "notes") || null,
      isActive: product.isActive ?? 1,
    };

    if (product.legacyId) {
      await storage.updateLaptopBattery(product.legacyId, payload);
      return;
    }
    const created = await storage.createLaptopBattery(payload);
    await storage.updateInStoreProduct(product.id, {
      legacySource: "battery",
      legacyId: created.id,
    });
  }
}

function specString(specs: InStoreProductSpecs, key: string): string {
  const v = specs[key];
  return typeof v === "string" ? v.trim() : "";
}

function specNumber(specs: InStoreProductSpecs, key: string): number | null {
  const v = specs[key];
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isNaN(n) ? null : n;
}

function specInt(specs: InStoreProductSpecs, key: string): number | null {
  const n = specNumber(specs, key);
  return n == null ? null : Math.round(n);
}

/** Apply canonical SKU/barcode on unified typed products before save. */
export function normalizeUnifiedProductCodes(
  productType: string,
  specs: InStoreProductSpecs,
  sku?: string | null,
  barcode?: string | null,
): { sku: string | null; barcode: string | null; specs: InStoreProductSpecs } {
  if (productType !== "adapter") {
    const serial = specString(specs, "serialNumber");
    const scan = (barcode || sku || serial || "").trim() || null;
    return {
      sku: (sku || serial || scan || "").trim() || null,
      barcode: (barcode || scan || "").trim() || null,
      specs,
    };
  }
  const serial = specString(specs, "serialNumber");
  const canonical = canonicalAdpSerial(serial, barcode || sku) || serial;
  const nextSpecs = { ...specs, serialNumber: canonical, barcode: barcode || canonical };
  return {
    sku: canonical,
    barcode: canonical,
    specs: nextSpecs,
  };
}

export function isLegacySyncSku(sku?: string | null): boolean {
  const s = (sku || "").trim();
  return s.startsWith(SYNC_BATTERY_SKU_PREFIX) || s.startsWith(SYNC_ADAPTER_SKU_PREFIX);
}

/** After in-store stock changes, mirror quantity to legacy row (reports/history only). */
export async function mirrorLegacyStockFromUnified(product: InStoreProduct): Promise<void> {
  if (!product.legacyId || !product.legacySource) return;
  await syncLegacyFromUnifiedProduct(product);
}

export async function deductInStoreSaleStock(
  productId: number,
  quantity: number,
): Promise<InStoreProduct | undefined> {
  const updated = await storage.adjustInStoreProductStock(productId, -quantity);
  if (updated) await mirrorLegacyStockFromUnified(updated);
  return updated;
}

export async function setInStoreStockQuantity(
  productId: number,
  quantity: number,
): Promise<InStoreProduct | undefined> {
  const updated = await storage.updateInStoreProduct(productId, {
    stockQuantity: quantity,
    updatedAt: new Date(),
  });
  if (updated) await mirrorLegacyStockFromUnified(updated);
  return updated;
}

/** Migrate battery-system inventory into unified in-store rows for all sales locations. */
export async function migrateAllSalesLocationsToUnified(): Promise<
  Record<string, UnifiedMigrationStats>
> {
  const out: Record<string, UnifiedMigrationStats> = {};
  for (const loc of [LOCATION_MAIN_ID, 2]) {
    out[`location_${loc}`] = await migrateBatteryInventoryToUnified(loc);
  }
  return out;
}
