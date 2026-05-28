import { codesMatch, normalizeScannedBarcode } from "@/lib/barcodeKeyboard";

export type InventoryCodeSource = {
  barcode?: string | null;
  serialNumber?: string | null;
  partNumber?: string | null;
  scanCode?: string | null;
};

/** Same rule as server sales-locations: prefer stored barcode, else internal serial. */
export function getInventoryScanCode(item: InventoryCodeSource): string {
  const fromApi = (item.scanCode ?? "").trim();
  if (fromApi) return fromApi;
  const barcode = (item.barcode ?? "").trim();
  if (barcode) return barcode;
  return (item.serialNumber ?? "").trim();
}

/** Count how many rows share the same scan code (per location list). */
export function countDuplicateInventoryScanCodes(
  rows: InventoryCodeSource[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const code = getInventoryScanCode(row).toUpperCase();
    if (!code) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  return counts;
}

/**
 * When multiple units share one barcode at a location, use serial for POS scan
 * until the server repair assigns unique barcodes.
 */
export function resolveUniquePosScanCode(
  item: InventoryCodeSource,
  duplicateCounts: Map<string, number>,
): string {
  const scanCode = getInventoryScanCode(item);
  const serial = (item.serialNumber ?? "").trim();
  if (serial && (duplicateCounts.get(scanCode.toUpperCase()) || 0) > 1) {
    return serial;
  }
  return scanCode;
}

/** Loose key: LAP-0008, lap-008, lap 0008 → same letters+digits only. */
export function normalizeInventoryCodeKey(code: string): string {
  return normalizeScannedBarcode(code).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** LAP-0008 / lap-008 / lap008 → { prefix: "lap", num: 8 } */
export function parseInventorySerialToken(code: string): { prefix: string; num: number } | null {
  const raw = normalizeScannedBarcode(code).trim();
  const labeled = raw.match(/^(LAP|DES|ADP|BAT)[\s._-]*(\d+)$/i);
  if (labeled) {
    const num = parseInt(labeled[2], 10);
    if (!Number.isNaN(num)) {
      return { prefix: labeled[1].toLowerCase(), num };
    }
  }

  const compact = normalizeInventoryCodeKey(code);
  const compactMatch = compact.match(/^(lap|des|adp|bat)(\d+)$/);
  if (compactMatch) {
    const num = parseInt(compactMatch[2], 10);
    if (!Number.isNaN(num)) {
      return { prefix: compactMatch[1], num };
    }
  }

  return null;
}

export function inventoryCodesMatch(
  stored: string | null | undefined,
  scanned: string,
): boolean {
  if (!stored?.trim() || !scanned.trim()) return false;
  if (codesMatch(stored, scanned)) return true;

  const a = normalizeInventoryCodeKey(stored);
  const b = normalizeInventoryCodeKey(scanned);
  if (a && b && a === b) return true;

  const storedToken = parseInventorySerialToken(stored);
  const scannedToken = parseInventorySerialToken(scanned);
  if (
    storedToken &&
    scannedToken &&
    storedToken.prefix === scannedToken.prefix &&
    storedToken.num === scannedToken.num
  ) {
    return true;
  }

  return false;
}

/** Match one serialized laptop/desktop unit (supports LAP-0081 vs lap81). */
export function serializedUnitMatchesScan(
  item: InventoryCodeSource,
  scanned: string,
  extraCodes: string[] = [],
): boolean {
  const fields = [
    item.serialNumber,
    item.barcode,
    item.scanCode,
    item.partNumber,
    ...extraCodes,
  ];
  return fields.some((f) => {
    const v = (f ?? "").trim();
    return v.length > 0 && inventoryCodesMatch(v, scanned);
  });
}

export function inventoryItemMatchesScan(
  item: InventoryCodeSource,
  scanned: string,
): boolean {
  const scanCode = getInventoryScanCode(item);
  if (inventoryCodesMatch(scanCode, scanned)) return true;
  const serial = (item.serialNumber ?? "").trim();
  if (serial && inventoryCodesMatch(serial, scanned)) return true;
  const part = (item.partNumber ?? "").trim();
  if (part && inventoryCodesMatch(part, scanned)) return true;
  const barcode = (item.barcode ?? "").trim();
  if (barcode && inventoryCodesMatch(barcode, scanned)) return true;
  return false;
}
