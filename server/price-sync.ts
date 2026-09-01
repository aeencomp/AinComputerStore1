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

export interface SyncProductEntry {
  id: string;
  nameEn: string;
  sku: string | null;
  category: string;
  price: string;
  previousPrice?: string | null;
}

interface SyncLog {
  lastSync: Date | null;
  nextSync: Date | null;
  updatedCount: number;
  createdCount: number;
  totalMatched: number;
  fetchedCount: number;
  createdProducts: SyncProductEntry[];
  updatedProducts: SyncProductEntry[];
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
  createdProducts: [],
  updatedProducts: [],
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

function buildGlobalSkuIndex(
  globalProducts: ShopifyProduct[],
): Map<string, ShopifyProduct> {
  const index = new Map<string, ShopifyProduct>();
  for (const product of globalProducts) {
    for (const variant of product.variants || []) {
      const sku = variant.sku?.trim().toLowerCase();
      if (sku) index.set(sku, product);
    }
  }
  return index;
}

/** Legacy rows may store full IQD (1850000) instead of thousands (1850). */
function normalizeOurStoredPrice(rawPrice: string | null | undefined): number {
  const price = parseFloat(rawPrice?.toString() || "0");
  if (!Number.isFinite(price) || price <= 0) return 0;
  if (price >= 10000) return Math.round((price / 1000) * 100) / 100;
  return price;
}

function findGlobalProductForOur(
  ourProduct: { nameEn: string | null; nameAr?: string | null; sku: string | null },
  globalProducts: ShopifyProduct[],
  globalSkuIndex: Map<string, ShopifyProduct>,
  matcher: (ourName: string, globals: ShopifyProduct[]) => ShopifyProduct | null,
): ShopifyProduct | null {
  const sku = ourProduct.sku?.trim().toLowerCase();
  if (sku) {
    const bySku = globalSkuIndex.get(sku);
    if (bySku) return bySku;
  }

  if (ourProduct.nameEn) {
    const byNameEn = matcher(ourProduct.nameEn, globalProducts);
    if (byNameEn) return byNameEn;
  }

  if (ourProduct.nameAr && ourProduct.nameAr !== ourProduct.nameEn) {
    const byNameAr = matcher(ourProduct.nameAr, globalProducts);
    if (byNameAr) return byNameAr;
  }

  return null;
}

function resolveOldPrice(
  markedUpPrice: number,
  comparePrice: number | null,
  previousStoredPrice: number,
): string | null {
  if (comparePrice != null && comparePrice > markedUpPrice) {
    return comparePrice.toString();
  }
  if (previousStoredPrice > markedUpPrice) {
    return previousStoredPrice.toString();
  }
  return null;
}

async function applyGlobalPriceToExisting(
  existing: {
    id: string;
    nameEn: string;
    sku: string | null;
    category: string;
    price: string | null;
    oldPrice?: string | null;
  },
  globalProduct: ShopifyProduct,
  variant: ShopifyVariant,
  markedUpPrice: number,
  log: SyncLog,
): Promise<"updated" | "matched"> {
  const rawStoredPrice = parseFloat(existing.price?.toString() || "0");
  const currentPrice = normalizeOurStoredPrice(existing.price);
  const sku = variant.sku?.trim() || null;
  const comparePrice = variant.compare_at_price
    ? globalPriceToStorePrice(variant.compare_at_price)
    : null;
  const nextOldPrice = resolveOldPrice(markedUpPrice, comparePrice, currentPrice);
  const currentOldPrice = normalizeOurStoredPrice(existing.oldPrice);

  const needsPriceUpdate =
    Math.abs(currentPrice - markedUpPrice) >= 0.01 || rawStoredPrice >= 10000;
  const needsSku = !!sku && existing.sku !== sku;
  const nextOldPriceNum = nextOldPrice != null ? parseFloat(nextOldPrice) : null;
  const needsOldPriceUpdate =
    nextOldPriceNum !== (currentOldPrice > 0 ? currentOldPrice : null);

  if (needsPriceUpdate || needsSku || needsOldPriceUpdate) {
    await db
      .update(products)
      .set({
        price: markedUpPrice.toString(),
        oldPrice: nextOldPrice,
        ...(needsSku && { sku }),
      })
      .where(eq(products.id, existing.id));

    if (needsPriceUpdate || needsOldPriceUpdate) {
      log.updatedProducts.push(
        toSyncProductEntry(
          {
            id: existing.id,
            nameEn: existing.nameEn,
            sku: sku ?? existing.sku,
            category: existing.category,
            price: markedUpPrice.toString(),
          },
          currentPrice,
        ),
      );
      console.log(
        `[Price Sync] Updated ${existing.nameEn.substring(0, 50)}: ${currentPrice} → ${markedUpPrice}`,
      );
      return "updated";
    }
  }

  return "matched";
}

function toSyncProductEntry(
  product: {
    id: string;
    nameEn: string;
    sku: string | null;
    category: string;
    price: string | null;
  },
  previousPrice?: number | null,
): SyncProductEntry {
  return {
    id: product.id,
    nameEn: product.nameEn,
    sku: product.sku,
    category: product.category,
    price: product.price?.toString() ?? "0",
    ...(previousPrice != null && { previousPrice: previousPrice.toString() }),
  };
}

function findOurProductForGlobal(
  globalProduct: ShopifyProduct,
  ourProducts: { id: string; nameEn: string; sku: string | null; category?: string; price?: string | null }[],
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
      createdProducts: [],
      updatedProducts: [],
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
    const globalSkuIndex = buildGlobalSkuIndex(globalLaptops);
    const matchedOurIds = new Set<string>();

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
          matchedOurIds.add(existing.id);
          matched++;
          const result = await applyGlobalPriceToExisting(
            {
              id: existing.id,
              nameEn: existing.nameEn,
              sku: existing.sku,
              category: existing.category,
              price: existing.price,
              oldPrice: existing.oldPrice,
            },
            globalProduct,
            variant,
            markedUpPrice,
            syncLog,
          );
          if (result === "updated") updated++;
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

        syncLog.createdProducts.push(toSyncProductEntry(inserted));

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

    // Reverse pass: update existing site products that weren't matched in forward pass
    const reverseCandidates = allOurProducts.filter(
      (p) =>
        !matchedOurIds.has(p.id) &&
        (isLaptopCategory(p.category) ||
          (!!p.sku && globalSkuIndex.has(p.sku.trim().toLowerCase()))),
    );
    console.log(`[Price Sync] Reverse pass for ${reverseCandidates.length} unmatched local products...`);
    for (const ourProduct of reverseCandidates) {
      if (matchedOurIds.has(ourProduct.id)) continue;

      try {
        const globalMatch = findGlobalProductForOur(
          ourProduct,
          globalLaptops,
          globalSkuIndex,
          matchProducts,
        );
        if (!globalMatch) continue;

        const variant = getPrimaryVariant(globalMatch);
        if (!variant) continue;

        const markedUpPrice = globalPriceToStorePrice(variant.price || "");
        if (markedUpPrice == null) continue;

        matchedOurIds.add(ourProduct.id);
        matched++;
        const result = await applyGlobalPriceToExisting(
          {
            id: ourProduct.id,
            nameEn: ourProduct.nameEn,
            sku: ourProduct.sku,
            category: ourProduct.category,
            price: ourProduct.price,
            oldPrice: ourProduct.oldPrice,
          },
          globalMatch,
          variant,
          markedUpPrice,
          syncLog,
        );
        if (result === "updated") updated++;
      } catch (err: any) {
        syncLog.errors.push(
          `Error updating existing ${ourProduct.nameEn}: ${err.message}`,
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
  createdProducts: [],
  updatedProducts: [],
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
      createdProducts: [],
      updatedProducts: [],
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
    const globalSkuIndex = buildGlobalSkuIndex(globalDesktops);
    const matchedOurIds = new Set<string>();

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
          matchedOurIds.add(existing.id);
          matched++;
          const result = await applyGlobalPriceToExisting(
            {
              id: existing.id,
              nameEn: existing.nameEn,
              sku: existing.sku,
              category: existing.category,
              price: existing.price,
              oldPrice: existing.oldPrice,
            },
            globalProduct,
            variant,
            markedUpPrice,
            desktopSyncLog,
          );
          if (result === "updated") updated++;
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

        desktopSyncLog.createdProducts.push(toSyncProductEntry(inserted));

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

    const reverseCandidates = allOurProducts.filter(
      (p) =>
        !matchedOurIds.has(p.id) &&
        (isDesktopCategory(p.category) ||
          (!!p.sku && globalSkuIndex.has(p.sku.trim().toLowerCase()))),
    );
    console.log(
      `[Desktop Sync] Reverse pass for ${reverseCandidates.length} unmatched local products...`,
    );
    for (const ourProduct of reverseCandidates) {
      if (matchedOurIds.has(ourProduct.id)) continue;

      try {
        const globalMatch = findGlobalProductForOur(
          ourProduct,
          globalDesktops,
          globalSkuIndex,
          matchDesktopProducts,
        );
        if (!globalMatch) continue;

        const variant = getPrimaryVariant(globalMatch);
        if (!variant) continue;

        const markedUpPrice = globalPriceToStorePrice(variant.price || "");
        if (markedUpPrice == null) continue;

        matchedOurIds.add(ourProduct.id);
        matched++;
        const result = await applyGlobalPriceToExisting(
          {
            id: ourProduct.id,
            nameEn: ourProduct.nameEn,
            sku: ourProduct.sku,
            category: ourProduct.category,
            price: ourProduct.price,
            oldPrice: ourProduct.oldPrice,
          },
          globalMatch,
          variant,
          markedUpPrice,
          desktopSyncLog,
        );
        if (result === "updated") updated++;
      } catch (err: any) {
        desktopSyncLog.errors.push(
          `Error updating existing ${ourProduct.nameEn}: ${err.message}`,
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
