import fs from "fs";
import path from "path";
import { db } from "./db";
import { products } from "@shared/schema";
import { eq } from "drizzle-orm";

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** No progress heartbeat for this long → treat sync as stuck (UI can reset). */
const SYNC_PROGRESS_STALE_MS = 4 * 60 * 1000;
/** Absolute max wall time for one catalog sync run. */
const SYNC_WALL_CLOCK_MS = 50 * 60 * 1000;
const MARKUP_PERCENTAGE = 0;
const GLOBALIRAQ_API = "https://globaliraq.iq/products.json?limit=250";
const GLOBALIRAQ_SOFTWARE_COLLECTION =
  "https://globaliraq.iq/collections/software/products.json?limit=250";
const MAX_PAGES = 50;
const PAGE_DELAY_MS = 4500;
const GLOBAL_PRODUCTS_CACHE_MS = 15 * 60 * 1000;
/** Do not hit the live API again if cache is newer than this (force refresh). */
const FORCE_REFRESH_MIN_AGE_MS = 8 * 60 * 1000;
const GLOBALIRAQ_COOLDOWN_MS = 60_000;
const FETCH_MAX_RETRIES = 10;
const CATALOG_CACHE_REL = path.join("data", "globaliraq-catalog-cache.json");

function resolveCatalogCacheFilePath(): string {
  const candidates = [
    path.join(process.cwd(), CATALOG_CACHE_REL),
    path.join(process.cwd(), "globaliraq-catalog-cache.json"),
    "/home/deploy/AinComputerStore/data/globaliraq-catalog-cache.json",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

let cachedGlobalProducts: { fetchedAt: number; products: ShopifyProduct[] } | null =
  null;
let globalProductsFetchPromise: Promise<ShopifyProduct[]> | null = null;
let lastGlobalIraqRateLimitAt = 0;
/** Handles from globaliraq.iq/collections/software — always mapped to `programs`. */
let softwareCollectionHandles = new Set<string>();

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
  inventory_quantity?: number | null;
  inventory_policy?: string | null;
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

const GLOBAL_DESKTOP_TYPES = [
  "All in One",
  "all in one",
  "Desktop System",
  "Desktop Computers",
  "Barebone Computers",
];

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
  /** Human-readable step while status is running */
  progress?: string;
  startedAt?: string;
  processedCount?: number;
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
let lastProgressAt: number | null = null;
let syncRunId = 0;
let syncInterval: NodeJS.Timeout | null = null;
let initialTimeout: NodeJS.Timeout | null = null;
let schedulerStarted = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rateLimitBackoffMs(attempt: number, retryAfterHeader: string | null): number {
  const retryAfterSec = parseInt(retryAfterHeader || "", 10);
  if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
    return Math.max(retryAfterSec * 1000, GLOBALIRAQ_COOLDOWN_MS);
  }
  return Math.min(300_000, 15_000 * Math.pow(2, attempt - 1));
}

/** VPS is rate-limited by Global Iraq — catalog is fetched on GitHub Actions and copied to `data/`. */
function shouldUseLiveGlobalIraqFetch(): boolean {
  return process.env.GLOBALIRAQ_LIVE_FETCH === "1";
}

/** Drop in-memory cache so the next sync reads the latest file from disk (daily GitHub upload). */
export function reloadGlobalCatalogCacheFromDisk(): void {
  cachedGlobalProducts = null;
  loadGlobalCatalogCacheFromDisk();
}

export function loadGlobalCatalogCacheFromDisk(): void {
  try {
    const cachePath = resolveCatalogCacheFilePath();
    if (!fs.existsSync(cachePath)) return;
    const raw = JSON.parse(fs.readFileSync(cachePath, "utf8")) as {
      fetchedAt?: number;
      products?: ShopifyProduct[];
      softwareHandles?: string[];
    };
    if (!raw.products?.length) return;
    if (raw.softwareHandles?.length) {
      softwareCollectionHandles = new Set(raw.softwareHandles);
    }
    cachedGlobalProducts = {
      fetchedAt: raw.fetchedAt ?? 0,
      products: raw.products,
    };
    console.log(
      `[Price Sync] Loaded ${raw.products.length} Global Iraq products from disk cache`,
    );
  } catch (err: any) {
    console.warn("[Price Sync] Could not load disk catalog cache:", err.message);
  }
}

function saveGlobalCatalogCacheToDisk(): void {
  if (!cachedGlobalProducts?.products.length) return;
  try {
    const cachePath = resolveCatalogCacheFilePath();
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(
      cachePath,
      JSON.stringify({
        fetchedAt: cachedGlobalProducts.fetchedAt,
        products: cachedGlobalProducts.products,
      }),
    );
  } catch (err: any) {
    console.warn("[Price Sync] Could not save disk catalog cache:", err.message);
  }
}

function cachedGlobalCatalogProducts(): ShopifyProduct[] | null {
  const n = cachedGlobalProducts?.products.length ?? 0;
  return n > 0 ? cachedGlobalProducts!.products : null;
}

async function fetchJSON(url: string, retries = FETCH_MAX_RETRIES): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const sinceLimit = Date.now() - lastGlobalIraqRateLimitAt;
      if (sinceLimit < GLOBALIRAQ_COOLDOWN_MS) {
        const waitSec = Math.ceil((GLOBALIRAQ_COOLDOWN_MS - sinceLimit) / 1000);
        setSyncProgress(
          `Global Iraq rate limit — waiting ${waitSec}s before next request…`,
        );
        await sleep(GLOBALIRAQ_COOLDOWN_MS - sinceLimit);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
      });
      clearTimeout(timeout);

      if (res.status === 429) {
        lastGlobalIraqRateLimitAt = Date.now();
        const waitMs = rateLimitBackoffMs(attempt, res.headers.get("retry-after"));
        setSyncProgress(
          `Global Iraq 429 — retry in ${Math.round(waitMs / 1000)}s (${attempt}/${retries})…`,
        );
        console.warn(
          `[Price Sync] GlobalIraq rate limit (429), waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${retries})`,
        );
        if (attempt < retries) {
          await sleep(waitMs);
          continue;
        }
        throw new Error(`HTTP 429 for ${url}`);
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }

      const text = await res.text();
      if (text.includes("local_rate_limited") || text.includes("rate_limit")) {
        lastGlobalIraqRateLimitAt = Date.now();
        const waitMs = rateLimitBackoffMs(attempt, null);
        console.warn(
          `[Price Sync] GlobalIraq rate limit body, waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${retries})`,
        );
        if (attempt < retries) {
          await sleep(waitMs);
          continue;
        }
        throw new Error("Rate limited by globaliraq.iq");
      }

      return JSON.parse(text);
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const is429 =
        lastError.message.includes("429") ||
        lastError.message.includes("Rate limit");
      if (attempt < retries) {
        const waitMs = is429
          ? rateLimitBackoffMs(attempt, null)
          : 2000 * attempt;
        await sleep(waitMs);
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

async function fetchAllGlobalIraqProductsFromApi(): Promise<ShopifyProduct[]> {
  const allProducts: ShopifyProduct[] = [];
  let page = 1;

  try {
    if (!cachedGlobalCatalogProducts()) {
      const warmSec = 10 + Math.floor(Math.random() * 10);
      setSyncProgress(
        `No local catalog cache — waiting ${warmSec}s before Global Iraq (reduces 429)…`,
      );
      await sleep(warmSec * 1000);
    }
    while (page <= MAX_PAGES) {
      setSyncProgress(`Fetching Global Iraq catalog (page ${page})…`);
      const url = `${GLOBALIRAQ_API}&page=${page}`;
      const data = await fetchJSON(url);
      const pageProducts: ShopifyProduct[] = data.products || [];

      if (pageProducts.length === 0) break;
      allProducts.push(...pageProducts);
      setSyncProgress(
        `Fetched ${allProducts.length} products from Global Iraq (page ${page})…`,
      );
      page++;

      if (pageProducts.length < 250) break;
      const jitter = Math.floor(Math.random() * 1200);
      await sleep(PAGE_DELAY_MS + jitter);
    }

    if (allProducts.length === 0) {
      throw new Error("Global Iraq returned an empty catalog");
    }

    cachedGlobalProducts = { fetchedAt: Date.now(), products: allProducts };
    saveGlobalCatalogCacheToDisk();
    return allProducts;
  } catch (err: any) {
    if (allProducts.length > 0) {
      cachedGlobalProducts = { fetchedAt: Date.now(), products: allProducts };
      saveGlobalCatalogCacheToDisk();
      syncLog.errors.push(
        `Partial catalog saved (${allProducts.length} products): ${err.message}`,
      );
      return allProducts;
    }
    throw err;
  }
}

/** One fetch at a time; reuse cache for 15 minutes (avoids 429 when laptop + desktop + catalog sync overlap). */
async function fetchAllGlobalIraqProducts(
  forceRefresh = false,
): Promise<ShopifyProduct[]> {
  if (!cachedGlobalProducts) {
    loadGlobalCatalogCacheFromDisk();
  }

  if (!shouldUseLiveGlobalIraqFetch()) {
    const cached = cachedGlobalCatalogProducts();
    if (cached) {
      return cached;
    }
    throw new Error(
      "ملف كتalog المنتجات غير موجود على الخادم. ادفع التحديث إلى GitHub وانتظر Deploy (التحميل من Global Iraq يتم عبر GitHub وليس VPS).",
    );
  }

  if (
    !forceRefresh &&
    cachedGlobalProducts &&
    Date.now() - cachedGlobalProducts.fetchedAt < GLOBAL_PRODUCTS_CACHE_MS
  ) {
    console.log(
      `[Price Sync] Using cached GlobalIraq catalog (${cachedGlobalProducts.products.length} products)`,
    );
    return cachedGlobalProducts.products;
  }

  if (
    forceRefresh &&
    cachedGlobalProducts &&
    Date.now() - cachedGlobalProducts.fetchedAt < FORCE_REFRESH_MIN_AGE_MS
  ) {
    console.log(
      `[Price Sync] Force refresh skipped — cache is only ${Math.round((Date.now() - cachedGlobalProducts.fetchedAt) / 1000)}s old`,
    );
    return cachedGlobalProducts.products;
  }

  if (globalProductsFetchPromise) {
    await globalProductsFetchPromise.catch(() => undefined);
    if (
      cachedGlobalProducts &&
      (!forceRefresh ||
        Date.now() - cachedGlobalProducts.fetchedAt < FORCE_REFRESH_MIN_AGE_MS)
    ) {
      const cached = cachedGlobalCatalogProducts();
      if (cached) return cached;
    }
  }

  const runFetch = async (): Promise<ShopifyProduct[]> => {
    try {
      return await fetchAllGlobalIraqProductsFromApi();
    } catch (err: any) {
      const stale = cachedGlobalCatalogProducts();
      if (stale) {
        const ageMin = cachedGlobalProducts
          ? Math.round((Date.now() - cachedGlobalProducts.fetchedAt) / 60_000)
          : 0;
        syncLog.errors.push(
          `Global Iraq blocked (${err.message}) — using cached catalog (${stale.length} products, ~${ageMin} min old). Prices updated from cache; retry later for live fetch.`,
        );
        console.warn(
          `[Price Sync] Live fetch failed; using ${stale.length} cached products`,
        );
        return stale;
      }
      throw err;
    }
  };

  globalProductsFetchPromise = runFetch().finally(() => {
    globalProductsFetchPromise = null;
  });

  return globalProductsFetchPromise;
}

async function fetchSoftwareCollectionProducts(): Promise<ShopifyProduct[]> {
  if (!shouldUseLiveGlobalIraqFetch()) {
    const cached = cachedGlobalCatalogProducts();
    if (!cached) return [];
    return cached.filter(
      (p) => p.handle && softwareCollectionHandles.has(p.handle),
    );
  }
  const collectionProducts: ShopifyProduct[] = [];
  try {
    for (let page = 1; page <= 10; page++) {
      setSyncProgress(`Fetching software collection (page ${page})…`);
      const url = `${GLOBALIRAQ_SOFTWARE_COLLECTION}&page=${page}`;
      const data = await fetchJSON(url);
      const pageProducts: ShopifyProduct[] = data.products || [];
      if (pageProducts.length === 0) break;
      collectionProducts.push(...pageProducts);
      if (pageProducts.length < 250) break;
      const jitter = Math.floor(Math.random() * 800);
      await sleep(PAGE_DELAY_MS + jitter);
    }
    softwareCollectionHandles = new Set(
      collectionProducts.map((p) => p.handle).filter(Boolean),
    );
    console.log(
      `[Catalog Sync] Software collection: ${collectionProducts.length} products (${softwareCollectionHandles.size} handles)`,
    );
  } catch (err: any) {
    console.warn(
      `[Catalog Sync] Software collection fetch failed: ${err.message}`,
    );
  }
  return collectionProducts;
}

function mergeGlobalProductLists(
  catalog: ShopifyProduct[],
  softwareCollection: ShopifyProduct[],
): ShopifyProduct[] {
  const byHandle = new Map<string, ShopifyProduct>();
  for (const p of catalog) {
    if (p.handle) byHandle.set(p.handle, p);
  }
  for (const p of softwareCollection) {
    if (p.handle) byHandle.set(p.handle, p);
  }
  return [...byHandle.values()];
}

/** All licensable programs on Global Iraq (collection + product_type Software / Operating Systems). */
function collectGlobalProgramsCatalogProducts(
  catalogProducts: ShopifyProduct[],
  softwareCollectionProducts: ShopifyProduct[],
): ShopifyProduct[] {
  const programTypes = new Set(["Software", "Operating Systems"]);
  const fromCatalog = catalogProducts.filter((p) =>
    programTypes.has((p.product_type || "").trim()),
  );
  return mergeGlobalProductLists(fromCatalog, softwareCollectionProducts);
}

function isGlobalSoftwareProduct(product: ShopifyProduct): boolean {
  if (product.handle && softwareCollectionHandles.has(product.handle)) {
    return true;
  }
  const type = (product.product_type || "").trim();
  return type === "Software" || type === "Operating Systems";
}

/** Digital licenses on Global Iraq are sellable; Shopify often marks `available: false` with no inventory tracking. */
function globalVariantInStock(
  variant: ShopifyVariant,
  product?: ShopifyProduct,
): boolean {
  if (product && isGlobalSoftwareProduct(product)) {
    if (
      variant.available === false &&
      variant.inventory_policy === "deny" &&
      (variant.inventory_quantity ?? 0) <= 0
    ) {
      return false;
    }
    return true;
  }
  if (variant.available === true) return true;
  if (variant.available === false) {
    if (variant.inventory_policy === "continue") return true;
    if ((variant.inventory_quantity ?? 0) > 0) return true;
    return false;
  }
  return true;
}

function findOurProductForSoftwareGlobal(
  globalProduct: ShopifyProduct,
  ourProducts: { id: string; nameEn: string; sku: string | null; category?: string }[],
  ourSkuIndex: Map<string, (typeof ourProducts)[number]>,
): (typeof ourProducts)[number] | null {
  const handle = globalProduct.handle?.trim().toLowerCase();
  if (handle) {
    const byHandleSku = ourSkuIndex.get(handle);
    if (byHandleSku && byHandleSku.category === "programs") {
      return byHandleSku;
    }
    const programPool = ourProducts.filter((p) => p.category === "programs");
    const byHandle = programPool.find(
      (p) => p.sku?.trim().toLowerCase() === handle,
    );
    if (byHandle) return byHandle;
  }

  const variant = getPrimaryVariant(globalProduct);
  const variantSku = variant?.sku?.trim().toLowerCase();
  if (variantSku) {
    const byVariantSku = ourSkuIndex.get(variantSku);
    if (byVariantSku?.category === "programs") return byVariantSku;
  }

  const titleKey = globalProduct.title.trim().toLowerCase().slice(0, 80);
  const byTitle = ourProducts.find(
    (p) =>
      p.category === "programs" &&
      p.nameEn.trim().toLowerCase().slice(0, 80) === titleKey,
  );
  if (byTitle) return byTitle;

  const existing = findOurProductForGlobal(
    globalProduct,
    ourProducts.filter((p) => p.category === "programs"),
    ourSkuIndex,
    matchGenericProducts,
  );
  if (!existing) return null;
  if (
    isLaptopCategory(existing.category || "") ||
    isDesktopCategory(existing.category || "")
  ) {
    return null;
  }
  return existing;
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

type ProductMatcher = (
  ourName: string,
  globalProducts: ShopifyProduct[],
) => ShopifyProduct | null;

function mapGlobalProductToCategory(product: ShopifyProduct): string {
  const type = (product.product_type || "").trim();
  const titleL = product.title.toLowerCase();
  const typeL = type.toLowerCase();

  if (isGlobalIraqLaptop(product)) {
    return globalLaptopCategory(type);
  }
  if (
    isGlobalIraqDesktop(product) ||
    /desktop system|desktop computers|barebone computers|server/i.test(typeL)
  ) {
    return globalDesktopCategory(product);
  }

  const typeRules: Array<[RegExp, string]> = [
    [/gaming monitors/i, "gaming-monitors"],
    [/office monitors|auxiliary monitors/i, "office-monitors"],
    [/designer monitors|extender monitor/i, "monitors"],
    [/gaming laptop/i, "gaming-laptops"],
    [/office laptop/i, "business-laptops"],
    [/inkjet printer/i, "inkjet-printers"],
    [/laser printer/i, "laser-printers"],
    [/^printer$/i, "printers"],
    [/mechanical keyboard|office keyboard|magnetic keyboard|keyboards/i, "keyboards"],
    [/gaming mouse|wireless mouse|wired mouse|wireless office mouse|wired office mouse/i, "mice"],
    [/wireless headset|wired headset|airpods|speakers/i, "headphones"],
    [/microphones|neck microphones/i, "headphones"],
    [/webcams?|security camera|dash cam|camera$/i, "webcams"],
    [/backpack|bag/i, "bags"],
    [/charger|power bank|adapters|adapter/i, "chargers"],
    [/cables|ethernet cable|hub switch|wi-fi/i, "cables"],
    [/nvme|external ssd|ssd sata/i, "ssd"],
    [/internal hdd|external hdd/i, "hdd"],
    [/desktop memory|laptop memory|^memory$/i, "ram"],
    [/liquid coolers|air coolers|water coolers|fan kit|coolers|thermal paste|thermal pad|gas coolers/i, "cooling"],
    [/mid-tower|full-tower|m-atx|atx/i, "cases"],
    [/graphics cards|geforce|^5070|^5080|^5090|^5060|^5050|^3050|quadro|9070/i, "gpu"],
    [/ryzen|intel \d|processors|^cpu/i, "processors"],
    [/motherboards|^z890|^b760|^b860|^x870|^h610|^b650|^b550|^b450|^z790|^z490|^trx40/i, "motherboards"],
    [/850w|1000w|1200w|650w|750w|1100w|1250w|psu|power supply|power strip/i, "psu"],
    [/printing filament|3d printers/i, "miscellaneous"],
    [/toner|cartridge|drum|ink/i, "printer-accessories"],
    [/scanner|signature pad|paper shredder/i, "printers"],
    [/tablet|television|tv box|ipad keyboard/i, "miscellaneous"],
    [/ups|battery|nano dc ups/i, "miscellaneous"],
    [/software|operating systems/i, "programs"],
  ];
  for (const [re, cat] of typeRules) {
    if (re.test(type) || re.test(typeL)) return cat;
  }

  if (/monitor|display|شاش/i.test(typeL)) return "monitors";
  if (/printer|طاب/i.test(typeL)) return "printers";
  if (/toner|cartridge|drum|ink/i.test(`${typeL} ${titleL}`)) {
    return "printer-accessories";
  }
  if (/cable|hub|موزع|كابل/i.test(typeL)) return "cables";
  if (/keyboard/i.test(typeL)) return "keyboards";
  if (/mouse|mice/i.test(typeL)) return "mice";
  if (/headset|headphone|earphone|سماع/i.test(typeL)) return "headphones";
  if (/webcam|camera/i.test(typeL)) return "webcams";
  if (/bag|backpack|حقيب/i.test(typeL)) return "bags";
  if (/charger|adapter|شاحن/i.test(typeL)) return "chargers";

  if (
    /^\d{4}$/.test(type) ||
    /geforce|rtx|radeon|graphics|gpu/i.test(typeL) ||
    /geforce rtx|radeon rx|graphics card/i.test(titleL)
  ) {
    return "gpu";
  }
  if (/ram|memory|ddr/i.test(typeL) && !/laptop|thinkpad|ideapad|macbook/i.test(titleL)) {
    return "ram";
  }
  if (/ssd|nvme|solid state/i.test(typeL)) return "ssd";
  if (/hdd|hard disk|hard drive/i.test(typeL)) return "hdd";
  if (/motherboard|mainboard/i.test(typeL)) return "motherboards";
  if (/psu|power supply/i.test(typeL)) return "psu";
  if (/processor|cpu/i.test(typeL)) return "processors";
  if (/case|chassis|cooling|fan/i.test(typeL)) return "pc-components";

  if (isGlobalSoftwareProduct(product)) {
    return "programs";
  }
  if (
    /^(software|operating systems)$/i.test(type) ||
    (/license key|activation code|antivirus|microsoft office|adobe |autodesk|windows 11|windows 10|macos/i.test(
      titleL,
    ) &&
      !/laptop|keyboard|mouse|monitor|printer|headset/i.test(titleL))
  ) {
    return "programs";
  }

  if (/monitor/i.test(titleL) && /\d{2}[\s-]*inch/i.test(titleL)) return "monitors";
  if (/toner|cartridge|drum/i.test(titleL)) return "printer-accessories";

  return "miscellaneous";
}

function resolveMatcherForCategory(category: string): ProductMatcher {
  if (isLaptopCategory(category)) return matchProducts;
  if (isDesktopCategory(category)) return matchDesktopProducts;
  return matchGenericProducts;
}

function compositeMatcherForOurProduct(
  ourName: string,
  globalProducts: ShopifyProduct[],
  category: string,
): ShopifyProduct | null {
  const primary = resolveMatcherForCategory(category)(ourName, globalProducts);
  if (primary) return primary;
  if (!isLaptopCategory(category) && !isDesktopCategory(category)) {
    return matchProducts(ourName, globalProducts) || matchDesktopProducts(ourName, globalProducts);
  }
  return matchGenericProducts(ourName, globalProducts);
}

function normalizeGenericTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^\w\s\-\.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchGenericProducts(
  ourName: string,
  globalProducts: ShopifyProduct[],
): ShopifyProduct | null {
  const ourNorm = normalizeGenericTitle(ourName);
  if (ourNorm.length < 4) return null;

  for (const gp of globalProducts) {
    if (normalizeGenericTitle(gp.title) === ourNorm) return gp;
  }

  const ourWords = ourNorm.split(/\s+/).filter((w) => w.length > 2);
  let bestMatch: ShopifyProduct | null = null;
  let bestScore = 0;

  for (const gp of globalProducts) {
    const gpNorm = normalizeGenericTitle(gp.title);
    if (gpNorm.includes(ourNorm) || ourNorm.includes(gpNorm)) {
      const score = Math.min(gpNorm.length, ourNorm.length);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = gp;
      }
      continue;
    }

    const gpWords = gpNorm.split(/\s+/).filter((w) => w.length > 2);
    const matchingWords = ourWords.filter((w) => gpWords.includes(w));
    const matchRatio =
      matchingWords.length / Math.max(ourWords.length, gpWords.length, 1);

    if (matchRatio >= 0.55 && matchingWords.length >= 3 && matchingWords.length > bestScore) {
      bestScore = matchingWords.length;
      bestMatch = gp;
    }
  }

  return bestMatch;
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

/** Global Iraq PC build spec-sheet collages — not product photos. */
export function isGlobalIraqBuildCollageUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes("global-iraq-build") || u.includes("globaliraqpcbuildbundle")
  );
}

function filterGlobalIraqProductImages(urls: string[]): string[] {
  return urls.filter((u) => u && !isGlobalIraqBuildCollageUrl(u));
}

const PC_BUILD_PLACEHOLDER_IMAGE = "desktop_pc_tower_photo.png";

function resolveGlobalIraqProductImages(globalProduct: ShopifyProduct): {
  primary: string | null;
  rest: string[];
} {
  const raw =
    globalProduct.images?.map((img) => img.src).filter(Boolean) ?? [];
  const filtered = filterGlobalIraqProductImages(raw);
  if (filtered.length > 0) {
    return { primary: filtered[0], rest: filtered.slice(1) };
  }
  if (/pc build/i.test(globalProduct.title || "")) {
    return { primary: PC_BUILD_PLACEHOLDER_IMAGE, rest: [] };
  }
  return { primary: raw[0] ?? null, rest: raw.slice(1) };
}

/** Strip build collages from stored products (one-time / each sync). */
export async function cleanupStoredBuildCollageImages(): Promise<number> {
  const all = await db.select().from(products);
  let fixed = 0;
  for (const p of all) {
    const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    const primaryBad = !!p.image && isGlobalIraqBuildCollageUrl(p.image);
    const extraBad = imgs.some(isGlobalIraqBuildCollageUrl);
    if (!primaryBad && !extraBad) continue;

    const filtered = filterGlobalIraqProductImages(imgs);
    let nextPrimary = p.image ?? "";
    if (primaryBad) {
      nextPrimary =
        filtered[0] ??
        (/pc build/i.test(p.nameEn || p.nameAr || "")
          ? PC_BUILD_PLACEHOLDER_IMAGE
          : nextPrimary);
    }
    const nextExtras = filterGlobalIraqProductImages(
      filtered.filter((u) => u !== nextPrimary),
    );

    await db
      .update(products)
      .set({ image: nextPrimary, images: nextExtras })
      .where(eq(products.id, p.id));
    fixed++;
  }
  return fixed;
}

async function applyGlobalPriceToExisting(
  existing: {
    id: string;
    nameEn: string;
    sku: string | null;
    category: string;
    price: string | null;
    oldPrice?: string | null;
    inStock?: number | null;
    stockQuantity?: number | null;
  },
  globalProduct: ShopifyProduct,
  variant: ShopifyVariant,
  markedUpPrice: number,
  log: SyncLog,
  options?: { category?: string; stableSku?: string },
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
  const nextInStock = globalVariantInStock(variant, globalProduct) ? 1 : 0;
  const currentInStock = existing.inStock === 0 ? 0 : 1;
  const needsStockUpdate = currentInStock !== nextInStock;
  const currentQty = existing.stockQuantity ?? 0;
  const nextQty = nextInStock ? Math.max(1, currentQty) : 0;
  const needsStockQtyUpdate =
    nextInStock === 1 ? currentQty < 1 : currentQty !== 0;
  const nextCategory = options?.category;
  const needsCategoryUpdate =
    !!nextCategory && nextCategory !== existing.category;
  const stableSku = options?.stableSku;
  const needsStableSku =
    !!stableSku &&
    existing.sku?.trim().toLowerCase() !== stableSku.toLowerCase();

  if (
    needsPriceUpdate ||
    needsSku ||
    needsOldPriceUpdate ||
    needsStockUpdate ||
    needsStockQtyUpdate ||
    needsCategoryUpdate ||
    needsStableSku
  ) {
    await db
      .update(products)
      .set({
        price: markedUpPrice.toString(),
        oldPrice: nextOldPrice,
        inStock: nextInStock,
        stockQuantity: nextQty,
        ...(needsCategoryUpdate && { category: nextCategory }),
        ...((needsStableSku || needsSku) &&
          stableSku && { sku: stableSku }),
      })
      .where(eq(products.id, existing.id));

    if (
      needsPriceUpdate ||
      needsOldPriceUpdate ||
      needsStockUpdate ||
      needsStockQtyUpdate ||
      needsCategoryUpdate ||
      needsStableSku
    ) {
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

function globalIraqStableSku(
  globalProduct: ShopifyProduct,
  variant: ShopifyVariant | null,
): string {
  const variantSku = variant?.sku?.trim();
  if (variantSku) return variantSku;
  if (globalProduct.handle?.trim()) {
    return `globaliraq:${globalProduct.handle.trim()}`;
  }
  return `globaliraq:title-${normalizeGenericTitle(globalProduct.title).slice(0, 80)}`;
}

function findOurProductForGlobal(
  globalProduct: ShopifyProduct,
  ourProducts: { id: string; nameEn: string; sku: string | null; category?: string; price?: string | null }[],
  ourSkuIndex: Map<string, (typeof ourProducts)[number]>,
  _matcher: (ourName: string, globals: ShopifyProduct[]) => ShopifyProduct | null = matchProducts,
): (typeof ourProducts)[number] | null {
  const variant = getPrimaryVariant(globalProduct);
  const stableSku = globalIraqStableSku(globalProduct, variant).toLowerCase();
  const byStable = ourSkuIndex.get(stableSku);
  if (byStable) return byStable;

  if (globalProduct.handle) {
    const handle = globalProduct.handle.trim().toLowerCase();
    const byHandle = ourSkuIndex.get(handle);
    if (byHandle) return byHandle;
    const byGiq = ourSkuIndex.get(`globaliraq:${handle}`);
    if (byGiq) return byGiq;
  }

  const variantSku = variant?.sku?.trim().toLowerCase();
  if (variantSku) {
    const byVariant = ourSkuIndex.get(variantSku);
    if (byVariant) return byVariant;
  }

  const titleKey = normalizeGenericTitle(globalProduct.title);
  for (const ourProduct of ourProducts) {
    if (ourProduct.nameEn && normalizeGenericTitle(ourProduct.nameEn) === titleKey) {
      return ourProduct;
    }
  }

  return null;
}

function sameGlobalListing(
  existing: { sku: string | null },
  globalProduct: ShopifyProduct,
  variant: ShopifyVariant | null,
): boolean {
  const stable = globalIraqStableSku(globalProduct, variant).toLowerCase();
  const existingSku = existing.sku?.trim().toLowerCase() || "";
  if (existingSku === stable) return true;
  if (globalProduct.handle) {
    const h = globalProduct.handle.trim().toLowerCase();
    if (existingSku === h || existingSku === `globaliraq:${h}`) return true;
  }
  return false;
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

function setSyncProgress(message: string) {
  if (syncLog.status === "running") {
    syncLog.progress = message;
  }
  lastProgressAt = Date.now();
}

function isSyncProgressStale(): boolean {
  if (!isRunning) return false;
  const t = lastProgressAt ?? syncStartedAt;
  if (!t) return false;
  if (Date.now() - t > SYNC_PROGRESS_STALE_MS) return true;
  if (syncStartedAt && Date.now() - syncStartedAt > SYNC_WALL_CLOCK_MS) {
    return true;
  }
  return false;
}

function reconcileStaleSync() {
  const orphanedRunning = syncLog.status === "running" && !isRunning;
  if (isRunning && isSyncProgressStale()) {
    console.warn("[Catalog Sync] Sync stalled — clearing lock so a new run can start");
    syncLog.status = "error";
    syncLog.errors = [
      ...syncLog.errors,
      "توقفت المزامنة (مهلة أو بطء Global Iraq). اضغط «إعادة تعيين» ثم «مزامنة الآن».",
    ];
    syncLog.progress = undefined;
    isRunning = false;
    syncStartedAt = null;
    lastProgressAt = null;
    syncRunId += 1;
    return;
  }
  if (orphanedRunning) {
    syncLog.status = "error";
    syncLog.errors = [
      ...syncLog.errors,
      "انقطعت المزامنة السابقة. يمكنك المزامنة مرة أخرى.",
    ];
    syncLog.progress = undefined;
  }
}

function beginSync(log: SyncLog): number | null {
  reconcileStaleSync();
  if (isRunning) {
    return null;
  }

  syncRunId += 1;
  const runId = syncRunId;
  isRunning = true;
  syncStartedAt = Date.now();
  lastProgressAt = Date.now();
  syncLog = {
    ...log,
    startedAt: new Date().toISOString(),
    progress: "Starting catalog sync…",
    processedCount: 0,
  };
  return runId;
}

function finishSyncRun(runId: number) {
  if (runId !== syncRunId) return;
  isRunning = false;
  syncStartedAt = null;
  lastProgressAt = null;
  if (syncLog.status === "running") {
    syncLog.progress = undefined;
  }
}

export async function syncPrices(): Promise<SyncLog> {
  const runId = beginSync({
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
  });
  if (!runId) {
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

        const { primary: primaryImage, rest: extraImages } =
          resolveGlobalIraqProductImages(globalProduct);
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
            images: extraImages,
            specs: specsFromTitle(globalProduct.title),
            badge: "جديد",
            sku,
            inStock: globalVariantInStock(variant, globalProduct) ? 1 : 0,
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
    finishSyncRun(runId);
  }

  return syncLog;
}

/** Ensure every item from Global Iraq /collections/software exists under `programs` and is in stock. */
async function syncSoftwareCollectionPrograms(
  softwareProducts: ShopifyProduct[],
  syncLog: SyncLog,
): Promise<{ created: number; updated: number; matched: number }> {
  let created = 0;
  let updated = 0;
  let matched = 0;
  if (softwareProducts.length === 0) {
    return { created, updated, matched };
  }

  const allOurProducts = await db.select().from(products);
  const ourPool = [...allOurProducts];
  const ourSkuIndex = buildOurSkuIndex(ourPool);

  for (const globalProduct of softwareProducts) {
    try {
      const variant = getPrimaryVariant(globalProduct);
      if (!variant) continue;

      const markedUpPrice = globalPriceToStorePrice(variant.price || "");
      if (markedUpPrice == null) continue;

      const comparePrice = variant.compare_at_price
        ? globalPriceToStorePrice(variant.compare_at_price)
        : null;
      const oldPrice =
        comparePrice != null && comparePrice > markedUpPrice
          ? comparePrice.toString()
          : null;

      const { primary: primaryImage, rest: extraImages } =
        resolveGlobalIraqProductImages(globalProduct);
      if (!primaryImage) {
        syncLog.errors.push(`Software: no image for ${globalProduct.title}`);
        continue;
      }

      const description =
        stripHtml(globalProduct.body_html || "") || globalProduct.title;
      const sku =
        variant.sku?.trim() ||
        globalProduct.handle?.trim() ||
        null;
      const inStock = globalVariantInStock(variant, globalProduct) ? 1 : 0;

      const existing = findOurProductForSoftwareGlobal(
        globalProduct,
        ourPool,
        ourSkuIndex,
      );

      if (existing) {
        matched++;
        await db
          .update(products)
          .set({
            nameEn: globalProduct.title,
            nameAr: globalProduct.title,
            descriptionEn: description.slice(0, 2000),
            descriptionAr: description.slice(0, 2000),
            price: markedUpPrice.toString(),
            oldPrice,
            category: "programs",
            image: primaryImage,
            images: extraImages,
            sku: sku ?? existing.sku,
            inStock,
            stockQuantity: inStock ? 999 : 0,
          })
          .where(eq(products.id, existing.id));

        syncLog.updatedProducts.push(
          toSyncProductEntry(
            {
              id: existing.id,
              nameEn: globalProduct.title,
              sku: sku ?? existing.sku,
              category: "programs",
              price: markedUpPrice.toString(),
            },
            normalizeOurStoredPrice(existing.price),
          ),
        );
        updated++;
        continue;
      }

      const [inserted] = await db
        .insert(products)
        .values({
          nameEn: globalProduct.title,
          nameAr: globalProduct.title,
          descriptionEn: description.slice(0, 2000),
          descriptionAr: description.slice(0, 2000),
          price: markedUpPrice.toString(),
          oldPrice,
          category: "programs",
          image: primaryImage,
          images: extraImages,
          specs: specsFromTitle(globalProduct.title),
          badge: "جديد",
          sku,
          inStock,
          stockQuantity: inStock ? 999 : 0,
        })
        .returning();

      ourPool.push(inserted);
      if (sku) ourSkuIndex.set(sku.toLowerCase(), inserted);
      if (globalProduct.handle) {
        ourSkuIndex.set(globalProduct.handle.toLowerCase(), inserted);
      }
      syncLog.createdProducts.push(toSyncProductEntry(inserted));
      created++;
      console.log(
        `[Catalog Sync] Software added: ${globalProduct.title.substring(0, 50)}`,
      );
    } catch (err: any) {
      syncLog.errors.push(
        `Software ${globalProduct.title}: ${err.message}`,
      );
    }
  }

  console.log(
    `[Catalog Sync] Software collection: ${matched} matched, ${created} added, ${updated} refreshed`,
  );
  return { created, updated, matched };
}

export function isCatalogSyncRunning(): boolean {
  reconcileStaleSync();
  return isRunning;
}

/** Clear a stuck "running" state so the admin can start sync again. */
export function resetCatalogSyncState(): SyncLog {
  syncRunId += 1;
  isRunning = false;
  syncStartedAt = null;
  lastProgressAt = null;
  syncLog.progress = undefined;
  if (syncLog.status === "running") {
    syncLog.status = "idle";
  }
  return getSyncStatus();
}

/** Start catalog sync without blocking HTTP (admin UI polls /status). */
export function startCatalogSyncBackground(options?: {
  forceRefresh?: boolean;
}): boolean {
  reconcileStaleSync();
  if (isRunning) {
    return false;
  }
  void syncAllCatalogPrices(options);
  return true;
}

/** Full GlobalIraq catalog: update prices for all matched items and add missing products. */
export async function syncAllCatalogPrices(options?: {
  forceRefresh?: boolean;
}): Promise<SyncLog> {
  const runId = beginSync({
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
  });
  if (!runId) {
    return syncLog;
  }

  try {
    console.log("[Catalog Sync] Starting catalog sync…");
    const collageRemoved = await cleanupStoredBuildCollageImages();
    if (collageRemoved > 0) {
      console.log(
        `[Catalog Sync] Removed Global Iraq build collage images from ${collageRemoved} products`,
      );
    }
    reloadGlobalCatalogCacheFromDisk();

    const catalogProducts = await fetchAllGlobalIraqProducts(
      options?.forceRefresh === true,
    );
    const softwareProducts = await fetchSoftwareCollectionProducts();
    const allGlobalProducts = shouldUseLiveGlobalIraqFetch()
      ? mergeGlobalProductLists(catalogProducts, softwareProducts)
      : catalogProducts;
    const syncableGlobal = allGlobalProducts.filter((product) => {
      if (
        product.handle &&
        softwareCollectionHandles.has(product.handle)
      ) {
        return false;
      }
      const variant = getPrimaryVariant(product);
      if (!variant) return false;
      return globalPriceToStorePrice(variant.price || "") != null;
    });

    syncLog.fetchedCount = allGlobalProducts.filter((product) => {
      const variant = getPrimaryVariant(product);
      return variant && globalPriceToStorePrice(variant.price || "") != null;
    }).length;
    console.log(
      `[Catalog Sync] Importing ${syncableGlobal.length} catalog rows (+ software/programs pass) from ${allGlobalProducts.length} Global Iraq products`,
    );

    if (syncableGlobal.length === 0) {
      throw new Error("No products with valid prices returned from globaliraq.iq");
    }

    const allOurProducts = await db.select().from(products);
    const ourSkuIndex = buildOurSkuIndex(allOurProducts);
    const ourPool = [...allOurProducts];
    const globalSkuIndex = buildGlobalSkuIndex(syncableGlobal);
    const matchedOurIds = new Set<string>();

    let updated = 0;
    let matched = 0;
    let created = 0;

    setSyncProgress(`Updating database (0/${syncableGlobal.length} Global Iraq items)…`);

    for (let gi = 0; gi < syncableGlobal.length; gi++) {
      const globalProduct = syncableGlobal[gi];
      if (gi % 20 === 0) {
        syncLog.processedCount = gi;
        syncLog.updatedCount = updated;
        syncLog.createdCount = created;
        syncLog.totalMatched = matched;
        setSyncProgress(
          `Updating database (${gi + 1}/${syncableGlobal.length}) — ${matched} matched, ${updated} price updates…`,
        );
      }
      try {
        const variant = getPrimaryVariant(globalProduct);
        if (!variant) {
          syncLog.errors.push(`No variant for ${globalProduct.title}`);
          continue;
        }

        const markedUpPrice = globalPriceToStorePrice(variant.price || "");
        if (markedUpPrice == null) continue;

        const comparePrice = variant.compare_at_price
          ? globalPriceToStorePrice(variant.compare_at_price)
          : null;
        const oldPrice =
          comparePrice != null && comparePrice > markedUpPrice
            ? comparePrice.toString()
            : null;

        const categoryForNew = mapGlobalProductToCategory(globalProduct);
        const matcher = resolveMatcherForCategory(categoryForNew);
        const stableSku = globalIraqStableSku(globalProduct, variant);
        let existing = findOurProductForGlobal(
          globalProduct,
          ourPool,
          ourSkuIndex,
          matcher,
        );

        if (existing) {
          if (matchedOurIds.has(existing.id)) {
            if (sameGlobalListing(existing, globalProduct, variant)) {
              continue;
            }
            existing = null;
          }
        }

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
              inStock: existing.inStock,
              stockQuantity: existing.stockQuantity,
            },
            globalProduct,
            variant,
            markedUpPrice,
            syncLog,
            { category: categoryForNew, stableSku },
          );
          if (result === "updated") updated++;
          continue;
        }

        const { primary: primaryImage, rest: extraImages } =
          resolveGlobalIraqProductImages(globalProduct);
        if (!primaryImage) {
          syncLog.errors.push(`No image for ${globalProduct.title}`);
          continue;
        }

        const description =
          stripHtml(globalProduct.body_html || "") || globalProduct.title;
        const inStockVal = globalVariantInStock(variant, globalProduct) ? 1 : 0;

        const [inserted] = await db
          .insert(products)
          .values({
            nameEn: globalProduct.title,
            nameAr: globalProduct.title,
            descriptionEn: description.slice(0, 2000),
            descriptionAr: description.slice(0, 2000),
            price: markedUpPrice.toString(),
            oldPrice,
            category: categoryForNew,
            image: primaryImage,
            images: extraImages,
            specs: specsFromTitle(globalProduct.title),
            badge: "جديد",
            sku: stableSku,
            inStock: inStockVal,
            stockQuantity: inStockVal ? 1 : 0,
          })
          .returning();

        ourPool.push(inserted);
        ourSkuIndex.set(stableSku.toLowerCase(), inserted);
        if (globalProduct.handle) {
          ourSkuIndex.set(globalProduct.handle.toLowerCase(), inserted);
        }

        syncLog.createdProducts.push(toSyncProductEntry(inserted));
        console.log(
          `[Catalog Sync] Added ${globalProduct.title.substring(0, 50)} @ ${markedUpPrice}`,
        );
        created++;
      } catch (err: any) {
        syncLog.errors.push(
          `Error processing ${globalProduct.title}: ${err.message}`,
        );
      }
    }

    const reverseCandidates = allOurProducts.filter((p) => !matchedOurIds.has(p.id));
    console.log(
      `[Catalog Sync] Reverse pass for ${reverseCandidates.length} local products...`,
    );
    setSyncProgress(
      `Second pass: matching ${reverseCandidates.length} local products…`,
    );

    for (const ourProduct of reverseCandidates) {
      try {
        const globalMatch = findGlobalProductForOur(
          ourProduct,
          syncableGlobal,
          globalSkuIndex,
          (name, globals) =>
            compositeMatcherForOurProduct(name, globals, ourProduct.category),
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

    setSyncProgress("Syncing software / programs collection…");
    const programsToSync = collectGlobalProgramsCatalogProducts(
      catalogProducts,
      softwareProducts,
    );
    console.log(
      `[Catalog Sync] Global Iraq programs to sync: ${programsToSync.length} (software collection on globaliraq.iq is 8 items)`,
    );
    const softwareStats = await syncSoftwareCollectionPrograms(
      programsToSync,
      syncLog,
    );
    created += softwareStats.created;
    updated += softwareStats.updated;
    matched += softwareStats.matched;

    if (runId === syncRunId) {
      syncLog.updatedCount = updated;
      syncLog.createdCount = created;
      syncLog.totalMatched = matched;
      syncLog.status = "success";
      syncLog.progress = undefined;
      syncLog.processedCount = syncableGlobal.length;
      syncLog.lastSync = new Date();
      syncLog.nextSync = new Date(Date.now() + SYNC_INTERVAL_MS);
      console.log(
        `[Catalog Sync] Complete. Added: ${created}, Matched: ${matched}, Updated: ${updated}, Errors: ${syncLog.errors.length}`,
      );
    } else {
      console.log("[Catalog Sync] Run superseded — discarding result");
    }
  } catch (err: any) {
    if (runId === syncRunId) {
      syncLog.status = "error";
      syncLog.errors.push(`Sync failed: ${err.message}`);
      syncLog.progress = undefined;
      console.error("[Catalog Sync] Failed:", err.message);
    }
  } finally {
    finishSyncRun(runId);
  }

  return syncLog;
}

export function getSyncStatus(): SyncLog {
  reconcileStaleSync();
  return syncLog;
}

export function startPriceSync() {
  if (schedulerStarted) {
    return;
  }
  if (process.env.PRICE_SYNC_SCHEDULER === "0") {
    console.log(
      "[Price Sync] Automatic scheduler disabled (PRICE_SYNC_SCHEDULER=0)",
    );
    return;
  }
  schedulerStarted = true;
  loadGlobalCatalogCacheFromDisk();
  resetCatalogSyncState();

  setInterval(() => {
    reconcileStaleSync();
  }, 30_000);

  console.log(
    `[Price Sync] Automatic sync every 24h — all Global Iraq items, prices + in-stock (cache refreshed daily via GitHub Actions)`,
  );

  void cleanupStoredBuildCollageImages().then((n) => {
    if (n > 0) {
      console.log(
        `[Price Sync] Removed Global Iraq build collage images from ${n} products`,
      );
    }
  });

  syncLog.nextSync = new Date(Date.now() + SYNC_INTERVAL_MS);

  const runScheduledSync = async (label: string) => {
    console.log(`[Price Sync] ${label} — full catalog (prices + availability)`);
    try {
      await syncAllCatalogPrices({ forceRefresh: false });
    } catch (err) {
      console.error(`[Price Sync] ${label} error:`, err);
    }
  };

  syncInterval = setInterval(() => {
    void runScheduledSync("Scheduled 24h sync");
  }, SYNC_INTERVAL_MS);

  initialTimeout = setTimeout(() => {
    void runScheduledSync("Initial sync (~30 min after server start)");
  }, 30 * 60 * 1000);
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
    const stale =
      !desktopSyncStartedAt ||
      Date.now() - desktopSyncStartedAt > SYNC_PROGRESS_STALE_MS;
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

        const { primary: primaryImage, rest: extraImages } =
          resolveGlobalIraqProductImages(globalProduct);
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
            images: extraImages,
            specs: specsFromTitle(globalProduct.title),
            badge: "جديد",
            sku,
            inStock: globalVariantInStock(variant, globalProduct) ? 1 : 0,
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
  console.log(
    "[Desktop Sync] Desktops/AIOs are included in the full catalog sync (no separate scheduler)",
  );
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
