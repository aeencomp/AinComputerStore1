import { db } from "./db";
import { products } from "@shared/schema";
import { eq } from "drizzle-orm";
import https from "https";

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MARKUP_PERCENTAGE = 0.05;
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

function extractModelCodes(name: string): string[] {
  const codes: string[] = [];

  const modelPatterns = [
    /[A-Z]{2,}\d{2,}[-\w]*/g,
    /\b[A-Z]\d{3,}[-\w]*/g,
    /\b(?:PH|NL|FX|ANV|EP|PV|G6)\d{2,}[-\w]*/gi,
    /\b\d{2}-[A-Z]{2}\d{4}[A-Z]*/g,
    /\b[A-Z]{3,}\d+[A-Z]*[-]\w+/g,
  ];

  for (const pattern of modelPatterns) {
    const matches = name.match(pattern);
    if (matches) {
      for (const m of matches) {
        if (m.length >= 5) {
          codes.push(m.toLowerCase());
        }
      }
    }
  }

  return [...new Set(codes)];
}

function matchProducts(
  ourName: string,
  globalProducts: ShopifyProduct[]
): ShopifyProduct | null {
  const ourCodes = extractModelCodes(ourName);

  if (ourCodes.length > 0) {
    for (const gp of globalProducts) {
      const gpCodes = extractModelCodes(gp.title);
      for (const ourCode of ourCodes) {
        for (const gpCode of gpCodes) {
          if (ourCode === gpCode || gpCode.includes(ourCode) || ourCode.includes(gpCode)) {
            if (ourCode.length >= 6 || gpCode.length >= 6) {
              return gp;
            }
          }
        }
      }
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

  let bestMatch: ShopifyProduct | null = null;
  let bestScore = 0;

  for (const gp of globalProducts) {
    const gpNorm = normalize(gp.title);
    const gpWords = gpNorm.split(/[\s,]+/).filter((w) => w.length > 2);
    const matchCount = ourWords.filter((w) => gpWords.includes(w)).length;
    const matchRatio = matchCount / Math.max(ourWords.length, 1);

    if (matchRatio >= 0.65 && matchCount >= 5 && matchCount > bestScore) {
      bestScore = matchCount;
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
