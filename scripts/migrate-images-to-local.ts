import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { products, inStoreProducts, storeSettings } from "../shared/schema";

const uploadDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

type MaybeString = string | null | undefined;

function sha1(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

function normalizeBaseUrl(base: string) {
  return base.replace(/\/+$/, "");
}

function toRemoteUrl(assetBaseUrl: string, value: string): string | null {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/uploads/") || value.startsWith("/objects/")) {
    return `${assetBaseUrl}${value}`;
  }
  // Unknown format (e.g. mapped asset key in repo)
  return null;
}

function pickExtensionFromUrl(url: string) {
  try {
    const u = new URL(url);
    const ext = path.extname(u.pathname);
    if (ext && ext.length <= 8) return ext;
  } catch {}
  return "";
}

async function downloadToUploads(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const ext =
    pickExtensionFromUrl(url) ||
    (() => {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("image/jpeg")) return ".jpg";
      if (ct.includes("image/png")) return ".png";
      if (ct.includes("image/webp")) return ".webp";
      if (ct.includes("image/gif")) return ".gif";
      return "";
    })();

  const filename = `${sha1(url)}${ext || ""}`;
  const fullPath = path.join(uploadDir, filename);

  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, buf);
  }

  return `/uploads/${filename}`;
}

async function migrateOne(value: MaybeString, assetBaseUrl: string): Promise<string | null> {
  if (!value) return null;

  // Already local
  if (value.startsWith("/uploads/")) return value;

  // Remote object storage or absolute URL
  const remoteUrl = toRemoteUrl(assetBaseUrl, value);
  if (!remoteUrl) return value;

  try {
    return await downloadToUploads(remoteUrl);
  } catch (e) {
    console.error("[migrate] failed:", value, "->", remoteUrl, "-", (e as Error).message);
    return value;
  }
}

async function main() {
  const rawBase = process.env.ASSET_BASE_URL;
  if (!rawBase) {
    console.error("Missing ASSET_BASE_URL. Example: ASSET_BASE_URL=https://your-live-domain.com");
    process.exit(1);
  }
  const assetBaseUrl = normalizeBaseUrl(rawBase);

  console.log("[migrate] using ASSET_BASE_URL:", assetBaseUrl);
  console.log("[migrate] downloads folder:", uploadDir);

  // Products
  const allProducts = await db.select().from(products);
  console.log("[migrate] products:", allProducts.length);

  for (const p of allProducts) {
    const nextImage = await migrateOne(p.image, assetBaseUrl);
    const nextImages = Array.isArray(p.images)
      ? await Promise.all(p.images.map((img) => migrateOne(img, assetBaseUrl)))
      : [];

    const compactImages = nextImages.filter(Boolean) as string[];
    const changed =
      nextImage !== p.image ||
      JSON.stringify(compactImages) !== JSON.stringify(p.images || []);

    if (changed) {
      await db
        .update(products)
        .set({
          image: nextImage ?? p.image,
          images: compactImages,
        })
        .where(eq(products.id, p.id));
    }
  }

  // In-store products
  const allInStore = await db.select().from(inStoreProducts);
  console.log("[migrate] in_store_products:", allInStore.length);
  for (const p of allInStore) {
    if (!p.image) continue;
    const next = await migrateOne(p.image, assetBaseUrl);
    if (next !== p.image) {
      await db
        .update(inStoreProducts)
        .set({ image: next })
        .where(eq(inStoreProducts.id, p.id));
    }
  }

  // Store settings (logo / hero)
  const allSettings = await db.select().from(storeSettings);
  console.log("[migrate] store_settings:", allSettings.length);
  for (const s of allSettings) {
    const nextLogo = await migrateOne(s.logoUrl, assetBaseUrl);
    const nextHero = await migrateOne(s.heroImageUrl, assetBaseUrl);

    if (nextLogo !== s.logoUrl || nextHero !== s.heroImageUrl) {
      await db
        .update(storeSettings)
        .set({
          logoUrl: nextLogo ?? s.logoUrl,
          heroImageUrl: nextHero ?? s.heroImageUrl,
        })
        .where(eq(storeSettings.id, s.id));
    }
  }

  console.log("[migrate] done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

