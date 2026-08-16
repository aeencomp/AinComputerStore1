import { db } from "./db";
import { products } from "@shared/schema";
import { eq } from "drizzle-orm";

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

const DESKTOP_CATEGORIES = [
  "all-in-one",
  "desktops",
  "gaming-pcs",
  "office-pcs",
  "workstations",
  "mini-pcs",
];

interface ShopifyVariant {
  price: string;
  compare_at_price: string | null;
  sku?: string | null;
  available?: boolean;
}

interface ShopifyImage {
  src: string;
}

interface ShopifyProduct {
  title: string;
  handle: string;
  product_type?: string;
  body_html?: string;
  tags?: string[];
  images?: ShopifyImage[];
  variants: ShopifyVariant[];
}

const GLOBAL_LAPTOP_TYPES = ["Gaming Laptop", "Office Laptop"];

const GLOBAL_DESKTOP_TYPES = ["All in One", "all in one", "Desktop System"];

interface SyncLog {
  lastSync: Date | null;
  nextSync: Date | null;
  updatedCount: number;
  createdCount: number;
  totalMatched: number;
  fetchedCount: number;
  errors: string[];
  status: "idle" | "running" | "success" | "error";
}

let syncLog: SyncLog = {
  lastSync: null,
  nextSync: null,
  updatedCount: 0,
  createdCount: 0,
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

function globalPriceToStorePrice(rawPrice: string): number | null {
  const globalPrice = parseFloat(rawPrice);
  if (isNaN(globalPrice) || globalPrice <= 0) return null;
  const priceInThousands = Math.round((globalPrice / 1000) * 100) / 100;
  return Math.round(priceInThousands * (1 + MARKUP_PERCENTAGE) * 100) / 100;
}

function isGlobalIraqLaptop(product: ShopifyProduct): boolean {
  return GLOBAL_LAPTOP_TYPES.includes(product.product_type || "");
}

function isGlobalIraqDesktop(product: ShopifyProduct): boolean {
  return GLOBAL_DESKTOP_TYPES.includes(product.product_type || "");
}

function globalLaptopCategory(productType: string): string {
  return productType === "Gaming Laptop" ? "gaming-laptops" : "business-laptops";
}

function globalDesktopCategory(product: ShopifyProduct): string {
  const type = (product.product_type || "").toLowerCase();
  const title = product.title.toLowerCase();

  if (type.includes("all in one") || title.includes("all in one")) {
    return "all-in-one";
  }
  if (title.includes("mini pc") || title.includes("micro plus")) {
    return "mini-pcs";
  }
  if (/gaming|rog |tuf |predator|omen|victus|nitro/i.test(title)) {
    return "gaming-pcs";
  }
  if (/workstation|precision|thinkstation|z[\d]/i.test(title)) {
    return "workstations";
  }
  if (/optiplex|thinkcentre|ideacentre|office|prodesk|elitedesk|vostro/i.test(title)) {
    return "office-pcs";
  }
  return "desktops";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function specsFromTitle(title: string): string[] {
  return title.split(",").map((part) => part.trim()).filter((part) => part.length > 2);
}

function getPrimaryVariant(product: ShopifyProduct): ShopifyVariant | null {
  return product.variants?.[0] ?? null;
}

function isLaptopCategory(category: string): boolean {
  return (
    LAPTOP_CATEGORIES.includes(category) ||
    category.toLowerCase().includes("laptop")
  );
}

function isDesktopCategory(category: string): boolean {
  return DESKTOP_CATEGORIES.includes(category);
}

function buildOurSkuIndex<T extends { sku: string | null }>(
  ourProducts: T[],
): Map<string, T> {
  const index = new Map<string, T>();
  for (const product of ourProducts) {
    const sku = product.sku?.trim().toLowerCase();
    if (sku) index.set(sku, product);
  }
  return index;
}

function findOurProductForGlobal(
  globalProduct: ShopifyProduct,
  ourProducts: { id: string; nameEn: string; sku: string | null; price?: string | null }[],
  ourSkuIndex: Map<string, (typeof ourProducts)[number]>,
  matcher: (ourName: string, globals: ShopifyProduct[]) => ShopifyProduct | null = matchProducts,
): (typeof ourProducts)[number] | null {
  const variant = getPrimaryVariant(globalProduct);
  const sku = variant?.sku?.trim().toLowerCase();
  if (sku) {
    const bySku = ourSkuIndex.get(sku);
    if (bySku) return bySku;
  }

  for (const ourProduct of ourProducts) {
    if (!ourProduct.nameEn) continue;
    const match = matcher(ourProduct.nameEn, [globalProduct]);
    if (match) return ourProduct;
  }

  return null;
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
      createdCount: 0,
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

    const allGlobalProducts = await fetchAllGlobalIraqProducts();
    const globalLaptops = allGlobalProducts.filter(isGlobalIraqLaptop);
    syncLog.fetchedCount = globalLaptops.length;
    console.log(
      `[Price Sync] Fetched ${allGlobalProducts.length} products (${globalLaptops.length} laptops) from globaliraq.iq`,
    );

    if (globalLaptops.length === 0) {
      throw new Error("No laptop products returned from globaliraq.iq");
    }

    const allOurProducts = await db.select().from(products);
    const ourLaptops = allOurProducts.filter((p) => isLaptopCategory(p.category));
    const ourSkuIndex = buildOurSkuIndex(allOurProducts);

    console.log(
      `[Price Sync] ${ourLaptops.length} laptop products in our database, syncing ${globalLaptops.length} from GlobalIraq`,
    );

    let updated = 0;
    let matched = 0;
    let created = 0;

    for (const globalProduct of globalLaptops) {
      try {
        const variant = getPrimaryVariant(globalProduct);
        if (!variant) {
          syncLog.errors.push(`No variant for ${globalProduct.title}`);
          continue;
        }

        const markedUpPrice = globalPriceToStorePrice(variant.price || "");
        if (markedUpPrice == null) {
          syncLog.errors.push(
            `Invalid price for ${globalProduct.title}: ${variant.price}`,
          );
          continue;
        }

        const comparePrice = variant.compare_at_price
          ? globalPriceToStorePrice(variant.compare_at_price)
          : null;
        const oldPrice =
          comparePrice != null && comparePrice > markedUpPrice
            ? comparePrice.toString()
            : null;

        const existing = findOurProductForGlobal(
          globalProduct,
          ourLaptops,
          ourSkuIndex,
        );

        if (existing) {
          matched++;

          const currentPrice = parseFloat(existing.price?.toString() || "0");
          const sku = variant.sku?.trim() || null;
          const needsPriceUpdate = Math.abs(currentPrice - markedUpPrice) >= 0.01;
          const needsSku = sku && existing.sku !== sku;

          if (needsPriceUpdate || needsSku) {
            await db
              .update(products)
              .set({
                ...(needsPriceUpdate && {
                  price: markedUpPrice.toString(),
                  oldPrice:
                    currentPrice > markedUpPrice
                      ? currentPrice.toString()
                      : oldPrice,
                }),
                ...(needsSku && { sku }),
              })
              .where(eq(products.id, existing.id));

            if (needsPriceUpdate) {
              console.log(
                `[Price Sync] Updated ${existing.nameEn.substring(0, 50)}: ${currentPrice} → ${markedUpPrice}`,
              );
              updated++;
            }
          }
          continue;
        }

        const imageUrls =
          globalProduct.images?.map((img) => img.src).filter(Boolean) ?? [];
        const primaryImage = imageUrls[0];
        if (!primaryImage) {
          syncLog.errors.push(`No image for ${globalProduct.title}`);
          continue;
        }

        const description =
          stripHtml(globalProduct.body_html || "") || globalProduct.title;
        const sku = variant.sku?.trim() || null;

        const [inserted] = await db
          .insert(products)
          .values({
            nameEn: globalProduct.title,
            nameAr: globalProduct.title,
            descriptionEn: description.slice(0, 2000),
            descriptionAr: description.slice(0, 2000),
            price: markedUpPrice.toString(),
            oldPrice,
            category: globalLaptopCategory(globalProduct.product_type || ""),
            image: primaryImage,
            images: imageUrls.slice(1),
            specs: specsFromTitle(globalProduct.title),
            badge: "جديد",
            sku,
            inStock: variant.available !== false ? 1 : 0,
          })
          .returning();

        ourLaptops.push(inserted);
        if (sku) ourSkuIndex.set(sku.toLowerCase(), inserted);

        console.log(
          `[Price Sync] Added ${globalProduct.title.substring(0, 50)} @ ${markedUpPrice}`,
        );
        created++;
      } catch (err: any) {
        syncLog.errors.push(
          `Error processing ${globalProduct.title}: ${err.message}`,
        );
      }
    }

    syncLog.updatedCount = updated;
    syncLog.createdCount = created;
    syncLog.totalMatched = matched;
    syncLog.status = "success";
    console.log(
      `[Price Sync] Complete. Added: ${created}, Matched: ${matched}, Updated: ${updated}, Errors: ${syncLog.errors.length}`,
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

let desktopSyncLog: SyncLog = {
  lastSync: null,
  nextSync: null,
  updatedCount: 0,
  createdCount: 0,
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
      createdCount: 0,
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

    const allGlobalProducts = await fetchAllGlobalIraqProducts();
    const globalDesktops = allGlobalProducts.filter(isGlobalIraqDesktop);
    desktopSyncLog.fetchedCount = globalDesktops.length;
    console.log(
      `[Desktop Sync] Fetched ${allGlobalProducts.length} products (${globalDesktops.length} desktops/AIOs) from globaliraq.iq`,
    );

    if (globalDesktops.length === 0) {
      throw new Error("No desktop/AIO products returned from globaliraq.iq");
    }

    const allOurProducts = await db.select().from(products);
    const ourDesktops = allOurProducts.filter((p) => isDesktopCategory(p.category));
    const ourSkuIndex = buildOurSkuIndex(allOurProducts);

    console.log(
      `[Desktop Sync] ${ourDesktops.length} desktop/AIO products in our database, syncing ${globalDesktops.length} from GlobalIraq`,
    );

    let updated = 0;
    let matched = 0;
    let created = 0;

    for (const globalProduct of globalDesktops) {
      try {
        const variant = getPrimaryVariant(globalProduct);
        if (!variant) {
          desktopSyncLog.errors.push(`No variant for ${globalProduct.title}`);
          continue;
        }

        const markedUpPrice = globalPriceToStorePrice(variant.price || "");
        if (markedUpPrice == null) {
          desktopSyncLog.errors.push(
            `Invalid price for ${globalProduct.title}: ${variant.price}`,
          );
          continue;
        }

        const comparePrice = variant.compare_at_price
          ? globalPriceToStorePrice(variant.compare_at_price)
          : null;
        const oldPrice =
          comparePrice != null && comparePrice > markedUpPrice
            ? comparePrice.toString()
            : null;

        const existing = findOurProductForGlobal(
          globalProduct,
          ourDesktops,
          ourSkuIndex,
          matchDesktopProducts,
        );

        if (existing) {
          matched++;

          const currentPrice = parseFloat(existing.price?.toString() || "0");
          const sku = variant.sku?.trim() || null;
          const needsPriceUpdate = Math.abs(currentPrice - markedUpPrice) >= 0.01;
          const needsSku = sku && existing.sku !== sku;

          if (needsPriceUpdate || needsSku) {
            await db
              .update(products)
              .set({
                ...(needsPriceUpdate && {
                  price: markedUpPrice.toString(),
                  oldPrice:
                    currentPrice > markedUpPrice
                      ? currentPrice.toString()
                      : oldPrice,
                }),
                ...(needsSku && { sku }),
              })
              .where(eq(products.id, existing.id));

            if (needsPriceUpdate) {
              console.log(
                `[Desktop Sync] Updated ${existing.nameEn.substring(0, 50)}: ${currentPrice} → ${markedUpPrice}`,
              );
              updated++;
            }
          }
          continue;
        }

        const imageUrls =
          globalProduct.images?.map((img) => img.src).filter(Boolean) ?? [];
        const primaryImage = imageUrls[0];
        if (!primaryImage) {
          desktopSyncLog.errors.push(`No image for ${globalProduct.title}`);
          continue;
        }

        const description =
          stripHtml(globalProduct.body_html || "") || globalProduct.title;
        const sku = variant.sku?.trim() || null;

        const [inserted] = await db
          .insert(products)
          .values({
            nameEn: globalProduct.title,
            nameAr: globalProduct.title,
            descriptionEn: description.slice(0, 2000),
            descriptionAr: description.slice(0, 2000),
            price: markedUpPrice.toString(),
            oldPrice,
            category: globalDesktopCategory(globalProduct),
            image: primaryImage,
            images: imageUrls.slice(1),
            specs: specsFromTitle(globalProduct.title),
            badge: "جديد",
            sku,
            inStock: variant.available !== false ? 1 : 0,
          })
          .returning();

        ourDesktops.push(inserted);
        if (sku) ourSkuIndex.set(sku.toLowerCase(), inserted);

        console.log(
          `[Desktop Sync] Added ${globalProduct.title.substring(0, 50)} @ ${markedUpPrice}`,
        );
        created++;
      } catch (err: any) {
        desktopSyncLog.errors.push(
          `Error processing ${globalProduct.title}: ${err.message}`,
        );
      }
    }

    desktopSyncLog.updatedCount = updated;
    desktopSyncLog.createdCount = created;
    desktopSyncLog.totalMatched = matched;
    desktopSyncLog.status = "success";
    console.log(
      `[Desktop Sync] Complete. Added: ${created}, Matched: ${matched}, Updated: ${updated}, Errors: ${desktopSyncLog.errors.length}`,
    );
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
