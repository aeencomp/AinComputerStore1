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

/** Loose key for LAP-0008 vs "lap 0008" vs "LAP0008". */
export function normalizeInventoryCodeKey(code: string): string {
  return normalizeScannedBarcode(code).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function inventoryCodesMatch(
  stored: string | null | undefined,
  scanned: string,
): boolean {
  if (!stored?.trim() || !scanned.trim()) return false;
  if (codesMatch(stored, scanned)) return true;
  const a = normalizeInventoryCodeKey(stored);
  const b = normalizeInventoryCodeKey(scanned);
  return !!a && !!b && a === b;
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
