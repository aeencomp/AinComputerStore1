export type { InventoryCodeSource } from "@shared/inventoryScanCode";
export {
  extractLeadingInventorySerial,
  getInventoryScanCode,
  inventoryCodesMatch,
  inventoryItemMatchesScan,
  normalizeInventoryCodeKey,
  parseInventorySerialToken,
} from "@shared/inventoryScanCode";

import {
  getInventoryScanCode,
  inventoryCodesMatch,
  type InventoryCodeSource,
} from "@shared/inventoryScanCode";

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
