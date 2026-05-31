import {
  canonicalAdpSerial,
  getInventoryScanCode,
  inventoryItemMatchesScan,
  type InventoryCodeSource,
} from "./inventoryScanCode";

/** Unified in-store product kinds (replaces separate battery portal inventory over time). */
export const IN_STORE_PRODUCT_TYPES = [
  "generic",
  "battery",
  "adapter",
  "laptop",
  "desktop",
  "keyboard",
  "lcd",
] as const;

export type InStoreProductType = (typeof IN_STORE_PRODUCT_TYPES)[number];

export function isInStoreProductType(value: unknown): value is InStoreProductType {
  return typeof value === "string" && (IN_STORE_PRODUCT_TYPES as readonly string[]).includes(value);
}

export type InStoreProductSpecs = Record<string, unknown>;

export type InStoreProductRow = {
  id: number;
  nameAr: string;
  nameEn?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price: string;
  wholesalePrice?: string | null;
  costPrice?: string | null;
  stockQuantity: number;
  lowStockThreshold?: number;
  category?: string | null;
  productType?: string | null;
  specs?: InStoreProductSpecs | null;
  legacySource?: string | null;
  legacyId?: string | null;
  salesLocationId?: number;
};

export function categoryForProductType(type: InStoreProductType): string {
  switch (type) {
    case "battery":
      return "بطاريات";
    case "adapter":
      return "شواحن";
    case "laptop":
      return "لابتوبات";
    case "desktop":
      return "ديسكتوب";
    case "keyboard":
      return "كيبورد";
    case "lcd":
      return "شاشات LCD";
    default:
      return "عام";
  }
}

export function productTypeLabel(type: InStoreProductType, language: "ar" | "en"): string {
  const ar: Record<InStoreProductType, string> = {
    generic: "منتج عام",
    battery: "بطارية",
    adapter: "شاحن",
    laptop: "لابتوب",
    desktop: "ديسكتوب",
    keyboard: "كيبورد",
    lcd: "شاشة LCD",
  };
  const en: Record<InStoreProductType, string> = {
    generic: "Generic",
    battery: "Battery",
    adapter: "AC adapter",
    laptop: "Laptop",
    desktop: "Desktop",
    keyboard: "Keyboard",
    lcd: "LCD panel",
  };
  return language === "ar" ? ar[type] : en[type];
}

function specString(specs: InStoreProductSpecs | null | undefined, key: string): string {
  const v = specs?.[key];
  return typeof v === "string" ? v.trim() : "";
}

function specNumber(specs: InStoreProductSpecs | null | undefined, key: string): number | null {
  const v = specs?.[key];
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isNaN(n) ? null : n;
}

/** Build POS / scan codes from a unified in-store row. */
export function unifiedInStoreScanCodes(product: InStoreProductRow): string[] {
  const specs = (product.specs || {}) as InStoreProductSpecs;
  const type = isInStoreProductType(product.productType) ? product.productType : "generic";

  if (type === "generic") {
    return Array.from(
      new Set([product.barcode, product.sku].map((c) => (c || "").trim()).filter(Boolean)),
    );
  }

  const serial = specString(specs, "serialNumber");
  const part = specString(specs, "partNumber");
  const barcode = specString(specs, "barcode") || (product.barcode || "").trim();

  if (type === "adapter") {
    const canonical =
      canonicalAdpSerial(serial, barcode || product.sku || product.barcode) || serial;
    return Array.from(new Set([canonical, barcode, serial, product.sku, product.barcode].filter(Boolean) as string[]));
  }

  const fromSpecs = getInventoryScanCode({ barcode, serialNumber: serial, partNumber: part });
  return Array.from(
    new Set([fromSpecs, barcode, serial, part, product.sku, product.barcode].filter(Boolean) as string[]),
  );
}

export function unifiedInStorePrimaryScanCode(product: InStoreProductRow): string | null {
  const codes = unifiedInStoreScanCodes(product);
  return codes[0] || null;
}

/** Default Arabic display name when nameAr is empty during migration. */
export function defaultUnifiedNameAr(type: InStoreProductType, specs: InStoreProductSpecs): string {
  const brand = specString(specs, "brand");
  const serial = specString(specs, "serialNumber");
  const model = specString(specs, "model");
  const watt = specNumber(specs, "wattage");

  switch (type) {
    case "adapter":
      return `${brand}${watt != null ? ` ${watt}W` : ""} — ${serial}`.trim();
    case "battery":
      return `${brand} ${serial}`.trim();
    case "laptop":
    case "desktop":
      return `${brand} ${model || serial}`.trim();
    case "keyboard":
    case "lcd":
      return `${brand} ${serial}`.trim();
    default:
      return serial || brand || "منتج";
  }
}

export function legacySourceForProductType(type: InStoreProductType): string | null {
  if (type === "generic") return null;
  return type;
}

export function instoreRowToInventoryCodeSource(row: InStoreProductRow): InventoryCodeSource {
  const type = isInStoreProductType(row.productType) ? row.productType : "generic";
  const specs = (row.specs || {}) as InStoreProductSpecs;
  if (type === "generic") {
    return { barcode: row.barcode, serialNumber: row.sku, scanCode: row.barcode ?? row.sku ?? undefined };
  }
  const scan = unifiedInStorePrimaryScanCode(row);
  return {
    barcode: specString(specs, "barcode") || row.barcode,
    serialNumber: specString(specs, "serialNumber") || row.sku,
    partNumber: specString(specs, "partNumber") || null,
    scanCode: scan ?? undefined,
  };
}

export function instoreRowMatchesScan(row: InStoreProductRow, code: string): boolean {
  return inventoryItemMatchesScan(instoreRowToInventoryCodeSource(row), code);
}

/** POS catalog row — always `productSource: instore` (numeric id). */
export type UnifiedPosProduct = {
  id: string;
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
  productSource: "instore";
  productType: InStoreProductType;
};

export function mapInStoreRowToPosProduct(row: InStoreProductRow): UnifiedPosProduct {
  const type = isInStoreProductType(row.productType) ? row.productType : "generic";
  const specs = (row.specs || {}) as InStoreProductSpecs;
  const scanCode = unifiedInStorePrimaryScanCode(row);
  return {
    id: String(row.id),
    nameAr: row.nameAr,
    nameEn: row.nameEn ?? null,
    price: String(row.price),
    wholesalePrice: row.wholesalePrice ? String(row.wholesalePrice) : null,
    stockQuantity: row.stockQuantity ?? 0,
    sku: scanCode ?? row.sku ?? null,
    barcode: scanCode ?? row.barcode ?? null,
    scanCode,
    serialNumber: specString(specs, "serialNumber") || null,
    partNumber: specString(specs, "partNumber") || null,
    category: row.category ?? categoryForProductType(type),
    productSource: "instore",
    productType: type,
  };
}

export const DEPRECATED_SYNC_SKU_PREFIXES = ["SYNC-BAT:", "SYNC-ADP:"] as const;

export function isDeprecatedSyncInStoreSku(sku?: string | null): boolean {
  const s = (sku || "").trim();
  return DEPRECATED_SYNC_SKU_PREFIXES.some((p) => s.startsWith(p));
}
