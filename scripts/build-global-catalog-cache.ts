/**
 * Fetches Global Iraq catalog on GitHub Actions (not rate-limited like VPS).
 * Output: data/globaliraq-catalog-cache.json (uploaded to VPS on deploy).
 */
import fs from "fs";
import path from "path";

const CATALOG_URL = "https://globaliraq.iq/products.json?limit=250";
const SOFTWARE_URL =
  "https://globaliraq.iq/collections/software/products.json?limit=250";
const MAX_PAGES = 50;
const PAGE_DELAY_MS = 5500;
const OUT = path.join(process.cwd(), "data", "globaliraq-catalog-cache.json");

type ShopifyProduct = {
  title: string;
  handle: string;
  product_type?: string;
  body_html?: string;
  tags?: string[];
  images?: { src: string }[];
  variants: {
    price: string;
    compare_at_price: string | null;
    sku?: string | null;
    available?: boolean;
  }[];
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(url: string, attempt = 1): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; AinComputerStore-catalog/1.0; +https://github.com/aeencomp/AinComputerStore1)",
      },
    });
    clearTimeout(t);
    if (res.status === 429 && attempt <= 12) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "60", 10);
      const wait = Math.min(300_000, Math.max(30_000, retryAfter * 1000));
      console.warn(`429 — wait ${Math.round(wait / 1000)}s (attempt ${attempt})`);
      await sleep(wait);
      return fetchPage(url, attempt + 1);
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const text = await res.text();
    if (text.includes("rate_limit") || text.includes("local_rate_limited")) {
      if (attempt <= 12) {
        await sleep(45_000);
        return fetchPage(url, attempt + 1);
      }
      throw new Error("Rate limited");
    }
    return JSON.parse(text);
  } catch (e) {
    clearTimeout(t);
    if (attempt <= 5) {
      await sleep(5000 * attempt);
      return fetchPage(url, attempt + 1);
    }
    throw e;
  }
}

async function fetchPaged(baseUrl: string, label: string): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    console.log(`[${label}] page ${page}`);
    const data = await fetchPage(`${baseUrl}&page=${page}`);
    const batch: ShopifyProduct[] = data.products || [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 250) break;
    await sleep(PAGE_DELAY_MS + Math.floor(Math.random() * 1000));
  }
  return all;
}

async function main() {
  console.log("==> Fetching Global Iraq catalog (GitHub runner)…");
  const catalog = await fetchPaged(CATALOG_URL, "catalog");
  console.log(`==> Catalog: ${catalog.length} products`);
  await sleep(8000);
  const software = await fetchPaged(SOFTWARE_URL, "software");
  console.log(`==> Software: ${software.length} products`);

  const byHandle = new Map<string, ShopifyProduct>();
  for (const p of catalog) {
    if (p.handle) byHandle.set(p.handle, p);
  }
  const softwareHandles: string[] = [];
  for (const p of software) {
    if (p.handle) {
      byHandle.set(p.handle, p);
      softwareHandles.push(p.handle);
    }
  }
  const products = [...byHandle.values()];
  if (products.length === 0) {
    console.error("No products fetched — not overwriting cache");
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      fetchedAt: Date.now(),
      products,
      softwareHandles,
    }),
  );
  console.log(`==> Wrote ${products.length} products → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
