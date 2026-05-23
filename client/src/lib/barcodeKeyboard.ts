/**
 * Barcode scanners emulate a keyboard. With Windows set to Arabic, `event.key` is often
 * wrong (Arabic letters instead of digits). `event.code` reflects the physical key and
 * stays correct regardless of OS keyboard layout.
 */

export const SCAN_KEY_GAP_MS = 100;
export const SCAN_BURST_MAX_MS = 800;

export type ScanBufferState = {
  buffer: string;
  firstKeyAt: number;
  lastKeyAt: number;
};

export const emptyScanBuffer = (): ScanBufferState => ({
  buffer: "",
  firstKeyAt: 0,
  lastKeyAt: 0,
});

/** Map KeyboardEvent.code → ASCII character (layout-independent). */
export function charFromKeyboardEvent(e: KeyboardEvent): string | null {
  if (e.isComposing) return null;
  if (e.ctrlKey || e.altKey || e.metaKey) return null;

  const { code, shiftKey } = e;

  if (/^Digit\d$/.test(code)) {
    return code.slice(5);
  }
  if (/^Numpad\d$/.test(code)) {
    return code.slice(6);
  }
  if (/^Key[A-Z]$/.test(code)) {
    const letter = code.slice(3);
    return shiftKey ? letter : letter.toLowerCase();
  }

  const shifted: Record<string, [string, string]> = {
    Minus: ["-", "_"],
    Equal: ["=", "+"],
    BracketLeft: ["[", "{"],
    BracketRight: ["]", "}"],
    Backslash: ["\\", "|"],
    Semicolon: [";", ":"],
    Quote: ["'", '"'],
    Comma: [",", "<"],
    Period: [".", ">"],
    Slash: ["/", "?"],
    Space: [" ", " "],
  };
  const pair = shifted[code];
  if (pair) return shiftKey ? pair[1] : pair[0];

  return null;
}

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** Normalize barcode text from input or scanner buffer. */
export function normalizeScannedBarcode(raw: string): string {
  let s = raw.trim();
  s = s.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "");
  s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)));
  s = s.replace(/[۰-۹]/g, (d) => String(PERSIAN_INDIC.indexOf(d)));
  return s;
}

export function appendScanKeystroke(
  state: ScanBufferState,
  e: KeyboardEvent,
  now = Date.now(),
): ScanBufferState {
  const ch = charFromKeyboardEvent(e);
  if (!ch) return state;

  let { buffer, firstKeyAt, lastKeyAt } = state;
  if (buffer && now - lastKeyAt > SCAN_KEY_GAP_MS) {
    buffer = "";
    firstKeyAt = 0;
  }
  if (!buffer) firstKeyAt = now;
  buffer += ch;
  return { buffer, firstKeyAt, lastKeyAt: now };
}

/** Prefer fast code buffer (scanner); fall back to typed search box. */
export function resolveScannedCode(
  state: ScanBufferState,
  fallbackInput: string,
  now = Date.now(),
): string {
  const { buffer, firstKeyAt, lastKeyAt } = state;
  if (!buffer) {
    return normalizeScannedBarcode(fallbackInput);
  }
  const duration = lastKeyAt - firstKeyAt;
  const looksLikeScanner =
    buffer.length >= 3 &&
    (duration <= SCAN_BURST_MAX_MS || buffer.length >= 6);
  const raw = looksLikeScanner ? buffer : fallbackInput;
  return normalizeScannedBarcode(raw);
}

/** Hide garbled Arabic layout characters while a scanner burst is in progress. */
export function shouldSuppressScanInput(state: ScanBufferState, now = Date.now()): boolean {
  if (!state.buffer) return false;
  return now - state.firstKeyAt <= SCAN_BURST_MAX_MS;
}

export function codesMatch(
  stored: string | null | undefined,
  scanned: string,
): boolean {
  const a = normalizeScannedBarcode(stored || "").toLowerCase();
  const b = normalizeScannedBarcode(scanned).toLowerCase();
  return !!a && a === b;
}
