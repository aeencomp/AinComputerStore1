import { db } from "./db";
import { products } from "@shared/schema";
import { eq, or, inArray } from "drizzle-orm";
import https from "https";

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MARKUP_PERCENTAGE = 0;
const GLOBALIRAQ_API = "https://globaliraq.iq/products.json?limit=250";

interface ShopifyProduct {
  title: string;
  handle: string;
  variants: Array<{ price: string; compare_at_price: string | null }>;
}

interface SyncLog {
  lastSync: Date | null;
  nextSync: Date | null;
  updatedCount: number;
  totalMatched: number;
  errors: string[];
  status: "idle" | "running" | "success" | "error";
}

let syncLog: SyncLog = {
  lastSync: null,
  nextSync: null,
  updatedCount: 0,
  totalMatched: 0,
  errors: [],
  status: "idle",
};

let isRunning = false;
let syncInterval: NodeJS.Timeout | null = null;
let initialTimeout: NodeJS.Timeout | null = null;
let schedulerStarted = false;

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()));
        } catch (e) {
          reject(new Error("Failed to parse JSON"));
        }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function fetchAllGlobalIraqProducts(): Promise<ShopifyProduct[]> {
  const allProducts: ShopifyProduct[] = [];
  let page = 1;

  while (true) {
    const url = `${GLOBALIRAQ_API}&page=${page}`;
    const data = await fetchJSON(url);
    const pageProducts = data.products || [];

    if (pageProducts.length === 0) break;
    allProducts.push(...pageProducts);
    page++;

    if (pageProducts.length < 250) break;
    if (page > 10) break;
  }

  return allProducts;
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
    if (match) return match[1].toLowerCase().replace(/\s+/g, ' ');
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
    "gaming", "pro", "laptop"
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

export async function syncPrices(): Promise<SyncLog> {
  if (isRunning) {
    return syncLog;
  }

  isRunning = true;
  syncLog = {
    lastSync: new Date(),
    nextSync: new Date(Date.now() + SYNC_INTERVAL_MS),
    updatedCount: 0,
    totalMatched: 0,
    errors: [],
    status: "running",
  };

  try {
    console.log("[Price Sync] Starting price sync from globaliraq.iq...");

    const globalProducts = await fetchAllGlobalIraqProducts();
    console.log(
      `[Price Sync] Fetched ${globalProducts.length} products from globaliraq.iq`
    );

    const ourProducts = await db
      .select()
      .from(products)
      .where(eq(products.badge, "جديد"));

    console.log(
      `[Price Sync] Found ${ourProducts.length} synced products in our database`
    );

    let updated = 0;
    let matched = 0;

    for (const ourProduct of ourProducts) {
      try {
        const match = matchProducts(ourProduct.nameEn, globalProducts);
        if (!match) {
          continue;
        }

        matched++;

        const globalPrice = parseFloat(match.variants[0].price);
        if (isNaN(globalPrice) || globalPrice <= 0) {
          syncLog.errors.push(
            `Invalid price for ${ourProduct.nameEn}: ${match.variants[0].price}`
          );
          continue;
        }

        const priceInThousands = Math.round((globalPrice / 1000) * 100) / 100;
        const markedUpPrice =
          Math.round(priceInThousands * (1 + MARKUP_PERCENTAGE) * 100) / 100;

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
          `[Price Sync] Updated ${ourProduct.nameEn.substring(0, 50)}: ${currentPrice} → ${markedUpPrice}`
        );
        updated++;
      } catch (err: any) {
        syncLog.errors.push(
          `Error updating ${ourProduct.nameEn}: ${err.message}`
        );
      }
    }

    syncLog.updatedCount = updated;
    syncLog.totalMatched = matched;
    syncLog.status = "success";
    console.log(
      `[Price Sync] Complete. Matched: ${matched}, Updated: ${updated}, Errors: ${syncLog.errors.length}`
    );
  } catch (err: any) {
    syncLog.status = "error";
    syncLog.errors.push(`Sync failed: ${err.message}`);
    console.error("[Price Sync] Failed:", err.message);
  } finally {
    isRunning = false;
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
  errors: [],
  status: "idle",
};

let isDesktopRunning = false;
let desktopSyncInterval: NodeJS.Timeout | null = null;
let desktopInitialTimeout: NodeJS.Timeout | null = null;
let desktopSchedulerStarted = false;

function extractDesktopModelCode(name: string): string | null {
  // AIO HP model e.g. "24-CR0323NH", "27-CR0156NH"
  const hpAio = name.match(/\b(\d{2}-[A-Z]{2}\d{4}[A-Z0-9]*)\b/i);
  if (hpAio) return hpAio[1].toLowerCase();

  // Lenovo IdeaCentre paren code e.g. "(LAAX)", "(MCAK)", "(0WGR)"
  const parenCode = extractParenCode(name);
  if (parenCode) return parenCode;

  // General model code fallback
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

  // Fallback: word-overlap matching (same as laptop sync but with desktop-adjusted thresholds)
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

export async function syncDesktopPrices(): Promise<SyncLog> {
  if (isDesktopRunning) return desktopSyncLog;

  isDesktopRunning = true;
  desktopSyncLog = {
    lastSync: new Date(),
    nextSync: new Date(Date.now() + SYNC_INTERVAL_MS),
    updatedCount: 0,
    totalMatched: 0,
    errors: [],
    status: "running",
  };

  try {
    console.log("[Desktop Sync] Starting price sync for desktops & AIOs...");

    const globalProducts = await fetchAllGlobalIraqProducts();
    console.log(`[Desktop Sync] Fetched ${globalProducts.length} products from globaliraq.iq`);

    const ourProducts = await db
      .select()
      .from(products)
      .where(inArray(products.category, DESKTOP_CATEGORIES));

    console.log(`[Desktop Sync] Found ${ourProducts.length} desktop/AIO products in our database`);

    let updated = 0;
    let matched = 0;

    for (const ourProduct of ourProducts) {
      if (!ourProduct.nameEn) continue;
      try {
        const match = matchDesktopProducts(ourProduct.nameEn, globalProducts);
        if (!match) continue;

        matched++;

        const globalPrice = parseFloat(match.variants[0].price);
        if (isNaN(globalPrice) || globalPrice <= 0) {
          desktopSyncLog.errors.push(`Invalid price for ${ourProduct.nameEn}: ${match.variants[0].price}`);
          continue;
        }

        const priceInThousands = Math.round((globalPrice / 1000) * 100) / 100;

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
    isDesktopRunning = false;
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
