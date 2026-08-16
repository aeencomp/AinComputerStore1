import { db } from "./db";
import { products } from "@shared/schema";
import { eq, or, inArray, like } from "drizzle-orm";

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SYNC_STALE_MS = 15 * 60 * 1000;
const MARKUP_PERCENTAGE = 0;
const GLOBALIRAQ_API = "https://globaliraq.iq/products.json?limit=250";
const MAX_PAGES = 50;

const LAPTOP_CATEGORIES = [
  "laptops",
  "gaming-laptops",
  "business-laptops",
  "student-laptops",
  "workstation-laptops",
  "ultrabooks",
  "2-in-1-laptops",
];

interface ShopifyVariant {
  price: string;
  compare_at_price: string | null;
  sku?: string | null;
}

interface ShopifyProduct {
  title: string;
  handle: string;
  variants: ShopifyVariant[];
}

interface SyncLog {
  lastSync: Date | null;
  nextSync: Date | null;
  updatedCount: number;
  totalMatched: number;
  fetchedCount: number;
  errors: string[];
  status: "idle" | "running" | "success" | "error";
}

let syncLog: SyncLog = {
  lastSync: null,
  nextSync: null,
  updatedCount: 0,
  totalMatched: 0,
  fetchedCount: 0,
  errors: [],
  status: "idle",
};

let isRunning = false;
let syncStartedAt: number | null = null;
let syncInterval: NodeJS.Timeout | null = null;
let initialTimeout: NodeJS.Timeout | null = null;
let schedulerStarted = false;

async function fetchJSON(url: string, retries = 3): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AinComputerStore/1.0)",
          Accept: "application/json",
        },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }

      return await res.json();
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

async function fetchAllGlobalIraqProducts(): Promise<ShopifyProduct[]> {
  const allProducts: ShopifyProduct[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const url = `${GLOBALIRAQ_API}&page=${page}`;
    const data = await fetchJSON(url);
    const pageProducts: ShopifyProduct[] = data.products || [];

    if (pageProducts.length === 0) break;
    allProducts.push(...pageProducts);
    page++;

    if (pageProducts.length < 250) break;
  }

  return allProducts;
}

function buildGlobalSkuIndex(globalProducts: ShopifyProduct[]): Map<string, ShopifyProduct> {
  const index = new Map<string, ShopifyProduct>();
  for (const product of globalProducts) {
    for (const variant of product.variants || []) {
      const sku = variant.sku?.trim().toLowerCase();
      if (sku) index.set(sku, product);
    }
  }
  return index;
}

function globalPriceToStorePrice(rawPrice: string): number | null {
  const globalPrice = parseFloat(rawPrice);
  if (isNaN(globalPrice) || globalPrice <= 0) return null;
  const priceInThousands = Math.round((globalPrice / 1000) * 100) / 100;
  return Math.round(priceInThousands * (1 + MARKUP_PERCENTAGE) * 100) / 100;
}

function extractFullModelCode(name: string): string | null {
  const patterns = [
    /\b(FX\d{3}[A-Z]{1,4}[-][A-Z]{2}\d{3}[A-Z]*)\b/i,
    /\b([A-Z]{2,3}\d{3,4}[A-Z]{0,4}[-][A-Z]{1,3}\d{2,4}[A-Z]*)\b/i,
    /\b(\d{2}-[A-Z]{2}\d{4}[A-Z]*)\b/i,
    /\b([A-Z]{2,}\d{3,}[-]\w{3,})\b/i,
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match && match[1].length >= 8) {
      return match[1].toLowerCase();
    }
  }

  return null;
}

function extractParenCode(name: string): string | null {
  const match = name.match(/\(([A-Z0-9]{3,8})\)/i);
  return match ? match[1].toLowerCase() : null;
}

function extractProductLine(name: string): string | null {
  const match = name.match(/\b(\d{2}[A-Z]{2,4}\d{1,2}[A-Z]?)\b/i);
  return match ? match[1].toLowerCase() : null;
}

function extractProductFamily(name: string): string | null {
  const families = [
    /\b(Legion\s+(?:Pro\s+)?[57])\b/i,
    /\b(Legion\s+\d+)\b/i,
    /\b(ThinkPad\s+[A-Z]\d+)\b/i,
    /\b(ThinkBook\s+\d+)\b/i,
    /\b(IdeaPad\s+(?:Flex\s+)?\d+)\b/i,
    /\b(LOQ\s+\d+)\b/i,
    /\b(TUF\s+Gaming\s+[A-Z]\d+)\b/i,
    /\b(ROG\s+Strix\s+[A-Z]\d+)\b/i,
    /\b(Vivobook\s+\d+)\b/i,
    /\b(Victus\s+\d+)\b/i,
    /\b(OmniBook\s+\w+\s*\d*)\b/i,
    /\b(Nitro\s+(?:V|Lite)?\s*\d*)\b/i,
    /\b(Predator\s+Helios\s+(?:Neo\s+)?\d+)\b/i,
    /\b(Cyborg\s+\d+)\b/i,
    /\b(Thin\s+\d+)\b/i,
    /\b(MacBook\s+Pro)\b/i,
    /\b(Surface\s+Pro\s+\d+)\b/i,
    /\b(Dell\s+Pro\s+\d+)\b/i,
  ];

  for (const pattern of families) {
    const match = name.match(pattern);
    if (match) return match[1].toLowerCase().replace(/\s+/g, " ");
  }
  return null;
}

function matchProducts(
  ourName: string,
  globalProducts: ShopifyProduct[]
): ShopifyProduct | null {
  const ourFullCode = extractFullModelCode(ourName);
  if (ourFullCode) {
    for (const gp of globalProducts) {
      const gpFullCode = extractFullModelCode(gp.title);
      if (gpFullCode && ourFullCode === gpFullCode) {
        return gp;
      }
    }
  }

  const ourParenCode = extractParenCode(ourName);
  const ourProductLine = extractProductLine(ourName);
  const ourFamily = extractProductFamily(ourName);

  if (ourParenCode) {
    for (const gp of globalProducts) {
      const gpParenCode = extractParenCode(gp.title);
      if (gpParenCode && ourParenCode === gpParenCode) {
        const gpProductLine = extractProductLine(gp.title);
        if (!ourProductLine || !gpProductLine || ourProductLine === gpProductLine) {
          return gp;
        }
      }
    }
  }

  if (ourProductLine && ourFamily) {
    const candidates: ShopifyProduct[] = [];
    for (const gp of globalProducts) {
      const gpProductLine = extractProductLine(gp.title);
      const gpFamily = extractProductFamily(gp.title);
      if (gpProductLine && gpFamily && ourProductLine === gpProductLine && ourFamily === gpFamily) {
        const gpParenCode = extractParenCode(gp.title);
        if (ourParenCode && gpParenCode && ourParenCode !== gpParenCode) {
          continue;
        }
        candidates.push(gp);
      }
    }
    if (candidates.length === 1) {
      return candidates[0];
    }
  }

  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/[–—]/g, "-")
      .replace(/[^\w\s\-\.]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const ourNorm = normalize(ourName);
  const ourWords = ourNorm.split(/[\s,]+/).filter((w) => w.length > 2);

  const genericWords = new Set([
    "intel", "core", "ultra", "ram", "ssd", "nvidia", "rtx", "geforce",
    "inch", "ips", "oled", "wqxga", "wuxga", "fhd", "black", "gray", "grey",
    "white", "silver", "eclipse", "mecha", "amd", "ryzen", "graphics",
    "chip", "lenovo", "asus", "acer", "msi", "dell", "apple", "microsoft",
    "gaming", "pro", "laptop",
  ]);

  let bestMatch: ShopifyProduct | null = null;
  let bestScore = 0;

  for (const gp of globalProducts) {
    const gpNorm = normalize(gp.title);
    const gpWords = gpNorm.split(/[\s,]+/).filter((w) => w.length > 2);

    const matchingWords = ourWords.filter((w) => gpWords.includes(w));
    const specificMatches = matchingWords.filter((w) => !genericWords.has(w));
    const matchRatio = matchingWords.length / Math.max(ourWords.length, 1);

    if (matchRatio >= 0.75 && matchingWords.length >= 8 && specificMatches.length >= 3 && matchingWords.length > bestScore) {
      const gpFamily = extractProductFamily(gp.title);
      if (ourFamily && gpFamily && ourFamily !== gpFamily) {
        continue;
      }
      const gpParenCode = extractParenCode(gp.title);
      if (ourParenCode && gpParenCode && ourParenCode !== gpParenCode) {
        continue;
      }
      bestScore = matchingWords.length;
      bestMatch = gp;
    }
  }

  return bestMatch;
}

function findGlobalMatch(
  ourProduct: { nameEn: string | null; sku: string | null },
  globalProducts: ShopifyProduct[],
  skuIndex: Map<string, ShopifyProduct>,
  matcher: (name: string, globals: ShopifyProduct[]) => ShopifyProduct | null,
): ShopifyProduct | null {
  const sku = ourProduct.sku?.trim().toLowerCase();
  if (sku) {
    const skuMatch = skuIndex.get(sku);
    if (skuMatch) return skuMatch;
  }

  if (!ourProduct.nameEn) return null;
  return matcher(ourProduct.nameEn, globalProducts);
}

function beginSync(log: SyncLog): boolean {
  if (isRunning) {
    const stale = !syncStartedAt || Date.now() - syncStartedAt > SYNC_STALE_MS;
    if (!stale) return false;
    console.warn("[Price Sync] Previous sync looked stale — restarting");
  }

  isRunning = true;
  syncStartedAt = Date.now();
  syncLog = log;
  return true;
}

function endSync() {
  isRunning = false;
  syncStartedAt = null;
}

export async function syncPrices(): Promise<SyncLog> {
  if (
    !beginSync({
      lastSync: new Date(),
      nextSync: new Date(Date.now() + SYNC_INTERVAL_MS),
      updatedCount: 0,
      totalMatched: 0,
      fetchedCount: 0,
      errors: [],
      status: "running",
    })
  ) {
    return syncLog;
  }

  try {
    console.log("[Price Sync] Starting price sync from globaliraq.iq...");

    const globalProducts = await fetchAllGlobalIraqProducts();
    syncLog.fetchedCount = globalProducts.length;
    console.log(
      `[Price Sync] Fetched ${globalProducts.length} products from globaliraq.iq`,
    );

    if (globalProducts.length === 0) {
      throw new Error("No products returned from globaliraq.iq");
    }

    const skuIndex = buildGlobalSkuIndex(globalProducts);

    const ourProducts = await db
      .select()
      .from(products)
      .where(
        or(
          eq(products.badge, "جديد"),
          inArray(products.category, LAPTOP_CATEGORIES),
          like(products.category, "%laptop%"),
        )!,
      );

    console.log(
      `[Price Sync] Found ${ourProducts.length} laptop products in our database`,
    );

    let updated = 0;
    let matched = 0;

    for (const ourProduct of ourProducts) {
      try {
        const match = findGlobalMatch(
          ourProduct,
          globalProducts,
          skuIndex,
          matchProducts,
        );
        if (!match) continue;

        matched++;

        const markedUpPrice = globalPriceToStorePrice(match.variants[0]?.price || "");
        if (markedUpPrice == null) {
          syncLog.errors.push(
            `Invalid price for ${ourProduct.nameEn}: ${match.variants[0]?.price}`,
          );
          continue;
        }

        const currentPrice = parseFloat(ourProduct.price?.toString() || "0");
        if (Math.abs(currentPrice - markedUpPrice) < 0.01) {
          continue;
        }

        await db
          .update(products)
          .set({
            price: markedUpPrice.toString(),
            oldPrice: currentPrice > markedUpPrice ? currentPrice.toString() : null,
          })
          .where(eq(products.id, ourProduct.id));

        console.log(
          `[Price Sync] Updated ${ourProduct.nameEn.substring(0, 50)}: ${currentPrice} → ${markedUpPrice}`,
        );
        updated++;
      } catch (err: any) {
        syncLog.errors.push(
          `Error updating ${ourProduct.nameEn}: ${err.message}`,
        );
      }
    }

    syncLog.updatedCount = updated;
    syncLog.totalMatched = matched;
    syncLog.status = "success";
    console.log(
      `[Price Sync] Complete. Matched: ${matched}, Updated: ${updated}, Errors: ${syncLog.errors.length}`,
    );
  } catch (err: any) {
    syncLog.status = "error";
    syncLog.errors.push(`Sync failed: ${err.message}`);
    console.error("[Price Sync] Failed:", err.message);
  } finally {
    endSync();
  }

  return syncLog;
}

export function getSyncStatus(): SyncLog {
  return syncLog;
}

export function startPriceSync() {
  if (schedulerStarted) {
    return;
  }
  schedulerStarted = true;

  console.log("[Price Sync] Scheduling price sync every 6 hours");

  syncLog.nextSync = new Date(Date.now() + SYNC_INTERVAL_MS);

  syncInterval = setInterval(async () => {
    try {
      await syncPrices();
    } catch (err) {
      console.error("[Price Sync] Scheduled sync error:", err);
    }
  }, SYNC_INTERVAL_MS);

  initialTimeout = setTimeout(async () => {
    try {
      await syncPrices();
    } catch (err) {
      console.error("[Price Sync] Initial sync error:", err);
    }
  }, 30000);
}

export function stopPriceSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (initialTimeout) {
    clearTimeout(initialTimeout);
    initialTimeout = null;
  }
  schedulerStarted = false;
}

// ─── Desktop & All-in-One Sync ───────────────────────────────────────────────

const DESKTOP_CATEGORIES = [
  "all-in-one",
  "desktops",
  "gaming-pcs",
  "office-pcs",
  "workstations",
  "mini-pcs",
];

let desktopSyncLog: SyncLog = {
  lastSync: null,
  nextSync: null,
  updatedCount: 0,
  totalMatched: 0,
  fetchedCount: 0,
  errors: [],
  status: "idle",
};

let isDesktopRunning = false;
let desktopSyncStartedAt: number | null = null;
let desktopSyncInterval: NodeJS.Timeout | null = null;
let desktopInitialTimeout: NodeJS.Timeout | null = null;
let desktopSchedulerStarted = false;

function extractDesktopModelCode(name: string): string | null {
  const hpAio = name.match(/\b(\d{2}-[A-Z]{2}\d{4}[A-Z0-9]*)\b/i);
  if (hpAio) return hpAio[1].toLowerCase();

  const parenCode = extractParenCode(name);
  if (parenCode) return parenCode;

  return extractFullModelCode(name);
}

function matchDesktopProducts(
  ourName: string,
  globalProducts: ShopifyProduct[]
): ShopifyProduct | null {
  const ourCode = extractDesktopModelCode(ourName);

  if (ourCode) {
    for (const gp of globalProducts) {
      const gpCode = extractDesktopModelCode(gp.title);
      if (gpCode && ourCode === gpCode) {
        return gp;
      }
    }
  }

  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/[–—]/g, "-")
      .replace(/all[\s-]?in[\s-]?one/gi, "aio")
      .replace(/[^\w\s\-\.]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const ourNorm = normalize(ourName);
  const ourWords = ourNorm.split(/[\s,]+/).filter((w) => w.length > 2);

  const genericWords = new Set([
    "intel", "core", "ultra", "ram", "ssd", "nvidia", "rtx",
    "lenovo", "asus", "acer", "msi", "dell", "hp", "all", "one",
    "ideacentre", "thinkcentre", "desktop", "office", "gaming",
  ]);

  let bestMatch: ShopifyProduct | null = null;
  let bestScore = 0;

  for (const gp of globalProducts) {
    const gpNorm = normalize(gp.title);
    const gpWords = gpNorm.split(/[\s,]+/).filter((w) => w.length > 2);

    const matchingWords = ourWords.filter((w) => gpWords.includes(w));
    const specificMatches = matchingWords.filter((w) => !genericWords.has(w));
    const matchRatio = matchingWords.length / Math.max(ourWords.length, 1);

    if (matchRatio >= 0.7 && matchingWords.length >= 6 && specificMatches.length >= 2 && matchingWords.length > bestScore) {
      bestScore = matchingWords.length;
      bestMatch = gp;
    }
  }

  return bestMatch;
}

function beginDesktopSync(log: SyncLog): boolean {
  if (isDesktopRunning) {
    const stale = !desktopSyncStartedAt || Date.now() - desktopSyncStartedAt > SYNC_STALE_MS;
    if (!stale) return false;
    console.warn("[Desktop Sync] Previous sync looked stale — restarting");
  }

  isDesktopRunning = true;
  desktopSyncStartedAt = Date.now();
  desktopSyncLog = log;
  return true;
}

function endDesktopSync() {
  isDesktopRunning = false;
  desktopSyncStartedAt = null;
}

export async function syncDesktopPrices(): Promise<SyncLog> {
  if (
    !beginDesktopSync({
      lastSync: new Date(),
      nextSync: new Date(Date.now() + SYNC_INTERVAL_MS),
      updatedCount: 0,
      totalMatched: 0,
      fetchedCount: 0,
      errors: [],
      status: "running",
    })
  ) {
    return desktopSyncLog;
  }

  try {
    console.log("[Desktop Sync] Starting price sync for desktops & AIOs...");

    const globalProducts = await fetchAllGlobalIraqProducts();
    desktopSyncLog.fetchedCount = globalProducts.length;
    console.log(`[Desktop Sync] Fetched ${globalProducts.length} products from globaliraq.iq`);

    if (globalProducts.length === 0) {
      throw new Error("No products returned from globaliraq.iq");
    }

    const skuIndex = buildGlobalSkuIndex(globalProducts);

    const ourProducts = await db
      .select()
      .from(products)
      .where(inArray(products.category, DESKTOP_CATEGORIES));

    console.log(`[Desktop Sync] Found ${ourProducts.length} desktop/AIO products in our database`);

    let updated = 0;
    let matched = 0;

    for (const ourProduct of ourProducts) {
      try {
        const match = findGlobalMatch(
          ourProduct,
          globalProducts,
          skuIndex,
          matchDesktopProducts,
        );
        if (!match) continue;

        matched++;

        const priceInThousands = globalPriceToStorePrice(match.variants[0]?.price || "");
        if (priceInThousands == null) {
          desktopSyncLog.errors.push(`Invalid price for ${ourProduct.nameEn}: ${match.variants[0]?.price}`);
          continue;
        }

        const currentPrice = parseFloat(ourProduct.price?.toString() || "0");
        if (Math.abs(currentPrice - priceInThousands) < 0.01) continue;

        await db
          .update(products)
          .set({
            price: priceInThousands.toString(),
            oldPrice: currentPrice > priceInThousands ? currentPrice.toString() : null,
          })
          .where(eq(products.id, ourProduct.id));

        console.log(`[Desktop Sync] Updated ${ourProduct.nameEn.substring(0, 50)}: ${currentPrice} → ${priceInThousands}`);
        updated++;
      } catch (err: any) {
        desktopSyncLog.errors.push(`Error updating ${ourProduct.nameEn}: ${err.message}`);
      }
    }

    desktopSyncLog.updatedCount = updated;
    desktopSyncLog.totalMatched = matched;
    desktopSyncLog.status = "success";
    console.log(`[Desktop Sync] Complete. Matched: ${matched}, Updated: ${updated}, Errors: ${desktopSyncLog.errors.length}`);
  } catch (err: any) {
    desktopSyncLog.status = "error";
    desktopSyncLog.errors.push(`Sync failed: ${err.message}`);
    console.error("[Desktop Sync] Failed:", err.message);
  } finally {
    endDesktopSync();
  }

  return desktopSyncLog;
}

export function getDesktopSyncStatus(): SyncLog {
  return desktopSyncLog;
}

export function startDesktopPriceSync() {
  if (desktopSchedulerStarted) return;
  desktopSchedulerStarted = true;

  console.log("[Desktop Sync] Scheduling desktop/AIO price sync every 6 hours");
  desktopSyncLog.nextSync = new Date(Date.now() + SYNC_INTERVAL_MS);

  desktopSyncInterval = setInterval(async () => {
    try {
      await syncDesktopPrices();
    } catch (err) {
      console.error("[Desktop Sync] Scheduled sync error:", err);
    }
  }, SYNC_INTERVAL_MS);

  desktopInitialTimeout = setTimeout(async () => {
    try {
      await syncDesktopPrices();
    } catch (err) {
      console.error("[Desktop Sync] Initial sync error:", err);
    }
  }, 60000);
}

export function stopDesktopPriceSync() {
  if (desktopSyncInterval) {
    clearInterval(desktopSyncInterval);
    desktopSyncInterval = null;
  }
  if (desktopInitialTimeout) {
    clearTimeout(desktopInitialTimeout);
    desktopInitialTimeout = null;
  }
  desktopSchedulerStarted = false;
}
