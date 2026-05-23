import { and, eq } from "drizzle-orm";
import { db } from "./db";
import {
  acAdapters,
  inStoreProducts,
  laptopBatteries,
  type AcAdapter,
  type LaptopBattery,
} from "@shared/schema";
import { LOCATION_MAIN_ID } from "./sales-locations";

export const SYNC_BATTERY_SKU_PREFIX = "SYNC-BAT:";
export const SYNC_ADAPTER_SKU_PREFIX = "SYNC-ADP:";

function batterySku(batteryId: string): string {
  return `${SYNC_BATTERY_SKU_PREFIX}${batteryId}`;
}

function adapterSku(adapterId: string): string {
  return `${SYNC_ADAPTER_SKU_PREFIX}${adapterId}`;
}

function batteryDisplayName(battery: LaptopBattery): string {
  const compat = (battery.compatibleLaptops || []).slice(0, 2).join(", ");
  const suffix = compat ? ` — ${compat}` : "";
  return `${battery.brand} ${battery.serialNumber}${suffix}`;
}

function adapterDisplayName(adapter: AcAdapter): string {
  const watt = adapter.wattage != null ? ` ${adapter.wattage}W` : "";
  return `${adapter.brand}${watt} — ${adapter.serialNumber}`;
}

async function findSyncedInStoreBySku(
  sku: string,
  salesLocationId: number,
): Promise<typeof inStoreProducts.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(inStoreProducts)
    .where(
      and(eq(inStoreProducts.sku, sku), eq(inStoreProducts.salesLocationId, salesLocationId)),
    )
    .limit(1);
  return row;
}

/** Mirror a laptop battery into in_store_products for in-store POS (location 1). */
export async function syncLaptopBatteryToInStore(
  battery: LaptopBattery,
  salesLocationId: number = LOCATION_MAIN_ID,
): Promise<void> {
  const sku = batterySku(battery.id);
  const barcode = battery.barcode || battery.serialNumber;
  const nameAr = batteryDisplayName(battery);
  const price = String(battery.sellingPrice ?? battery.purchasePrice ?? "0");
  const existing = await findSyncedInStoreBySku(sku, salesLocationId);

  const payload = {
    nameAr,
    nameEn: nameAr,
    sku,
    barcode,
    price,
    wholesalePrice: battery.wholesalePrice ?? null,
    costPrice: battery.purchasePrice ?? null,
    category: "بطاريات",
    description: (battery.compatibleLaptops || []).join(", ") || null,
    stockQuantity: battery.stockQuantity ?? 0,
    lowStockThreshold: battery.minStockLevel ?? 2,
    isActive: battery.isActive ?? 1,
    salesLocationId,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(inStoreProducts).set(payload).where(eq(inStoreProducts.id, existing.id));
  } else if ((battery.isActive ?? 1) === 1) {
    await db.insert(inStoreProducts).values(payload);
  }
}

/** Mirror an AC adapter into in_store_products at its sales location. */
export async function syncAcAdapterToInStore(adapter: AcAdapter): Promise<void> {
  const salesLocationId = adapter.salesLocationId ?? LOCATION_MAIN_ID;
  const sku = adapterSku(adapter.id);
  const barcode = adapter.barcode || adapter.serialNumber;
  const nameAr = adapterDisplayName(adapter);
  const price = String(adapter.sellingPrice ?? adapter.purchasePrice ?? "0");
  const existing = await findSyncedInStoreBySku(sku, salesLocationId);

  const payload = {
    nameAr,
    nameEn: nameAr,
    sku,
    barcode,
    price,
    wholesalePrice: adapter.wholesalePrice ?? null,
    costPrice: adapter.purchasePrice ?? null,
    category: "شواحن",
    description: (adapter.compatibleLaptops || []).join(", ") || null,
    stockQuantity: adapter.stockQuantity ?? 0,
    lowStockThreshold: adapter.minStockLevel ?? 2,
    isActive: adapter.isActive ?? 1,
    salesLocationId,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(inStoreProducts).set(payload).where(eq(inStoreProducts.id, existing.id));
  } else if ((adapter.isActive ?? 1) === 1) {
    await db.insert(inStoreProducts).values(payload);
  }
}

export async function deactivateSyncedBatteryInStore(batteryId: string): Promise<void> {
  const sku = batterySku(batteryId);
  await db
    .update(inStoreProducts)
    .set({ isActive: 0, updatedAt: new Date() })
    .where(eq(inStoreProducts.sku, sku));
}

export async function deactivateSyncedAdapterInStore(adapterId: string): Promise<void> {
  const sku = adapterSku(adapterId);
  await db
    .update(inStoreProducts)
    .set({ isActive: 0, updatedAt: new Date() })
    .where(eq(inStoreProducts.sku, sku));
}

export async function syncLaptopBatteryById(batteryId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(laptopBatteries)
    .where(eq(laptopBatteries.id, batteryId))
    .limit(1);
  if (row) await syncLaptopBatteryToInStore(row);
}

export async function syncAcAdapterById(adapterId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(acAdapters)
    .where(eq(acAdapters.id, adapterId))
    .limit(1);
  if (row) await syncAcAdapterToInStore(row);
}
