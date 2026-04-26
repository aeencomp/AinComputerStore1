import "dotenv/config";

import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { products } from "../shared/schema";

async function main() {
  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.category, "programs"), eq(products.nameEn, "Windows 11")))
    .limit(1);

  if (existing.length > 0) {
    console.log("[seed] Windows 11 already exists:", existing[0].id);
    return;
  }

  const result = await db
    .insert(products)
    .values({
      nameAr: "ويندوز 11",
      nameEn: "Windows 11",
      descriptionAr:
        "نظام تشغيل ويندوز 11. مناسب للأجهزة الداعمة، مع واجهة حديثة وأداء أفضل.",
      descriptionEn:
        "Windows 11 operating system. Modern UI and improved performance for supported PCs.",
      price: "0",
      oldPrice: null,
      category: "programs",
      image: "/icons/icon-192x192.png",
      images: [],
      specs: ["OS", "Windows 11"],
      badge: "New",
      inStock: 1,
      sku: "WIN11",
      stockQuantity: 1,
      lowStockThreshold: 1,
    })
    .returning({ id: products.id });

  console.log("[seed] Created Windows 11:", result[0]?.id);
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});

