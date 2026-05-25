import { codesMatch } from "@/lib/barcodeKeyboard";

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

export function inventoryItemMatchesScan(
  item: InventoryCodeSource,
  scanned: string,
): boolean {
  const scanCode = getInventoryScanCode(item);
  if (codesMatch(scanCode, scanned)) return true;
  const serial = (item.serialNumber ?? "").trim();
  if (serial && codesMatch(serial, scanned)) return true;
  const part = (item.partNumber ?? "").trim();
  if (part && codesMatch(part, scanned)) return true;
  return false;
}
