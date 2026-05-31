const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_INDIC = "۰۱۲۳۴۵۶۷۸۹";

export type InventoryCodeSource = {
  barcode?: string | null;
  serialNumber?: string | null;
  partNumber?: string | null;
  scanCode?: string | null;
};

/** Normalize barcode text from input or scanner buffer. */
export function normalizeScannedBarcode(raw: string): string {
  let s = raw.trim();
  s = s.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "");
  s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)));
  s = s.replace(/[۰-۹]/g, (d) => String(PERSIAN_INDIC.indexOf(d)));
  return s;
}

export function codesMatch(
  stored: string | null | undefined,
  scanned: string,
): boolean {
  const a = normalizeScannedBarcode(stored || "").toLowerCase();
  const b = normalizeScannedBarcode(scanned).toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  const compact = (s: string) => s.replace(/[^a-z0-9]/g, "");
  return compact(a) === compact(b);
}

/** Same rule as server sales-locations: prefer stored barcode, else internal serial. */
export function getInventoryScanCode(item: InventoryCodeSource): string {
  const fromApi = (item.scanCode ?? "").trim();
  if (fromApi) return fromApi;
  const barcode = (item.barcode ?? "").trim();
  if (barcode) return barcode;
  return (item.serialNumber ?? "").trim();
}

export function normalizeInventoryCodeKey(code: string): string {
  return normalizeScannedBarcode(code).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseInventorySerialToken(code: string): { prefix: string; num: number } | null {
  const raw = normalizeScannedBarcode(code).trim();
  const labeled = raw.match(/^(LAP|DES|ADP|BAT)[\s._-]*(\d+)/i);
  if (labeled) {
    const num = parseInt(labeled[2], 10);
    if (!Number.isNaN(num)) {
      return { prefix: labeled[1].toLowerCase(), num };
    }
  }

  const compact = normalizeInventoryCodeKey(code);
  const compactMatch = compact.match(/^(lap|des|adp|bat)(\d+)/);
  if (compactMatch) {
    const num = parseInt(compactMatch[2], 10);
    if (!Number.isNaN(num)) {
      return { prefix: compactMatch[1], num };
    }
  }

  return null;
}

/** Sticker / scanner text often appends brand after serial (e.g. "ADP-0003 DELL"). */
export function extractLeadingInventorySerial(code: string): string | null {
  const raw = normalizeScannedBarcode(code).trim();
  const m = raw.match(/^((?:LAP|DES|ADP|BAT)[\s._-]*\d+)/i);
  if (!m) return null;
  const token = parseInventorySerialToken(m[1]);
  if (!token) return m[1].trim();
  return `${token.prefix.toUpperCase()}-${String(token.num).padStart(4, "0")}`;
}

/** Optional brand text after serial token (e.g. "ADP-0003 DELL"). */
export function parseBrandSuffixFromScan(code: string): string | null {
  const raw = normalizeScannedBarcode(code).trim();
  const m = raw.match(/^(?:LAP|DES|ADP|BAT)[\s._-]*\d+\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function inventoryCodeMatchVariants(code: string): string[] {
  const trimmed = code.trim();
  const out = new Set<string>([trimmed]);
  const leading = extractLeadingInventorySerial(trimmed);
  if (leading) out.add(leading);
  return [...out];
}

export function inventoryCodesMatch(
  stored: string | null | undefined,
  scanned: string,
): boolean {
  if (!stored?.trim() || !scanned.trim()) return false;

  for (const s of inventoryCodeMatchVariants(stored)) {
    for (const b of inventoryCodeMatchVariants(scanned)) {
      if (codesMatch(s, b)) return true;

      const a = normalizeInventoryCodeKey(s);
      const c = normalizeInventoryCodeKey(b);
      if (a && c && a === c) return true;

      const storedToken = parseInventorySerialToken(s);
      const scannedToken = parseInventorySerialToken(b);
      if (
        storedToken &&
        scannedToken &&
        storedToken.prefix === scannedToken.prefix &&
        storedToken.num === scannedToken.num
      ) {
        return true;
      }
    }
  }

  return false;
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
