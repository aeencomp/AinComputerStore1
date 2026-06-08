import { db } from "./db";
import {
  facebookPostLog,
  products,
  type Product,
  type StoreSettings,
} from "@shared/schema";
import { and, desc, eq, gt } from "drizzle-orm";
import { baghdadDateString } from "./daily-revenue-report";

const GRAPH_API = "https://graph.facebook.com/v21.0";
const DEFAULT_SITE_URL = "https://aeen-iq.com";

export type SocialPostType = "product" | "sale" | "repair" | "announcement";

export type GeneratedSocialPost = {
  postType: SocialPostType;
  productId?: string;
  message: string;
  imageUrl: string | null;
  linkUrl: string | null;
};

export type FacebookPublishResult = {
  success: boolean;
  facebookPostId?: string;
  error?: string;
  errorData?: unknown;
};

function formatIqd(price: string | number): string {
  const n = typeof price === "string" ? parseFloat(price) : price;
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("en-US");
}

export function getPublicSiteUrl(settings: StoreSettings | null | undefined): string {
  const raw = settings?.publicSiteUrl?.trim() || process.env.PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, "");
}

export function resolvePublicAssetUrl(image: string, siteUrl: string): string | null {
  if (!image?.trim()) return null;
  const trimmed = image.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("/objects/")) {
    return `${siteUrl}${trimmed}`;
  }
  return null;
}

export function productPageUrl(siteUrl: string, productId: string): string {
  return `${siteUrl}/product/${productId}`;
}

function pickSpecsLine(product: Product, max = 3): string | null {
  const specs = product.specs?.filter(Boolean) ?? [];
  if (specs.length === 0) return null;
  return specs.slice(0, max).join(" · ");
}

export function generateProductPost(
  product: Product,
  settings: StoreSettings,
  siteUrl: string,
  extras?: { discountCode?: string; customIntro?: string },
): GeneratedSocialPost {
  const storeName = settings.storeNameAr || "العين لتجارة الحاسبات";
  const price = formatIqd(product.price);
  const oldPrice = product.oldPrice ? formatIqd(product.oldPrice) : null;
  const currency = settings.currencySymbolAr || "د.ع";
  const link = productPageUrl(siteUrl, product.id);
  const image = resolvePublicAssetUrl(product.image, siteUrl);
  const specsLine = pickSpecsLine(product);
  const whatsapp = settings.whatsappNumber?.trim();
  const intro = extras?.customIntro?.trim() || (product.badge ? `🔥 ${product.badge}` : "🔥 عرض من متجرنا");

  const lines = [
    intro,
    "",
    `💻 ${product.nameAr}`,
    oldPrice ? `💰 السعر: ${price} ${currency} (كان ${oldPrice})` : `💰 السعر: ${price} ${currency}`,
  ];
  if (specsLine) lines.push(`⚙️ ${specsLine}`);
  if (product.inStock === 0) lines.push("⏳ الكمية محدودة");
  if (extras?.discountCode) lines.push(`🎁 كود خصم: ${extras.discountCode}`);
  lines.push("", "🛒 اطلب الآن:", link);
  if (whatsapp) lines.push(`📲 واتساب: ${whatsapp}`);
  lines.push("", `#${storeName.replace(/\s+/g, "_")} #كمبيوتر #لابتوب #بغداد`);

  return {
    postType: extras?.discountCode || (oldPrice && parseFloat(String(product.oldPrice)) > parseFloat(String(product.price))) ? "sale" : "product",
    productId: product.id,
    message: lines.join("\n"),
    imageUrl: image,
    linkUrl: link,
  };
}

export function generateRepairPost(settings: StoreSettings, siteUrl: string): GeneratedSocialPost {
  const storeName = settings.storeNameAr || "العين لتجارة الحاسبات";
  const whatsapp = settings.whatsappNumber?.trim();
  const phone = settings.phone?.trim();
  const address = settings.addressAr?.trim() || "بغداد، العراق";
  const hours = settings.hoursAr?.trim();
  const repairLink = `${siteUrl}/repair-request`;

  const lines = [
    "🔧 خدمة صيانة الحواسيب",
    "",
    `✅ ${storeName}`,
    "💻 صيانة لابتوب وكمبيوتر مكتبي",
    "🔍 تشخيص وفحص الجهاز",
    "⚡ قطع أصلية وبدائل بأسعار مناسبة",
    "",
    `📍 ${address}`,
  ];
  if (hours) lines.push(`🕐 ${hours}`);
  lines.push("", "📋 اطلب صيانة أونلاين:", repairLink);
  if (whatsapp) lines.push(`📲 واتساب: ${whatsapp}`);
  else if (phone) lines.push(`📞 ${phone}`);
  lines.push("", "#صيانة_لابتوب #صيانة_كمبيوتر #بغداد");

  return {
    postType: "repair",
    message: lines.join("\n"),
    imageUrl: settings.logoUrl ? resolvePublicAssetUrl(settings.logoUrl, siteUrl) : null,
    linkUrl: repairLink,
  };
}

export function generateAnnouncementPost(settings: StoreSettings, siteUrl: string): GeneratedSocialPost {
  const text = settings.announcementTextAr?.trim() || settings.descriptionAr?.trim() || "";
  const storeName = settings.storeNameAr || "العين لتجارة الحاسبات";
  const whatsapp = settings.whatsappNumber?.trim();

  const lines = [
    `📢 ${storeName}`,
    "",
    text || "تفضل بزيارة متجرنا لأحدث العروض!",
    "",
    `🌐 ${siteUrl}`,
  ];
  if (whatsapp) lines.push(`📲 واتساب: ${whatsapp}`);

  return {
    postType: "announcement",
    message: lines.join("\n"),
    imageUrl: settings.heroImageUrl
      ? resolvePublicAssetUrl(settings.heroImageUrl, siteUrl)
      : settings.logoUrl
        ? resolvePublicAssetUrl(settings.logoUrl, siteUrl)
        : null,
    linkUrl: siteUrl,
  };
}

export function isSaleProduct(product: Product): boolean {
  if (!product.oldPrice) return false;
  const oldP = parseFloat(String(product.oldPrice));
  const newP = parseFloat(String(product.price));
  return Number.isFinite(oldP) && Number.isFinite(newP) && oldP > newP;
}

export async function pickProductForAutoPost(
  mode: string,
  cursor: number,
): Promise<{ product: Product | null; nextCursor: number }> {
  const all = await db
    .select()
    .from(products)
    .where(and(eq(products.inStock, 1), gt(products.stockQuantity, 0)))
    .orderBy(products.nameAr);

  if (all.length === 0) {
    const fallback = await db.select().from(products).where(eq(products.inStock, 1)).orderBy(products.nameAr);
    if (fallback.length === 0) return { product: null, nextCursor: 0 };
    const idx = cursor % fallback.length;
    return { product: fallback[idx], nextCursor: (idx + 1) % fallback.length };
  }

  let pool = all;
  if (mode === "sale") {
    const sales = all.filter(isSaleProduct);
    if (sales.length > 0) pool = sales;
  }

  const idx = cursor % pool.length;
  return { product: pool[idx], nextCursor: (idx + 1) % pool.length };
}

export function getFacebookCredentials(settings: StoreSettings | null | undefined) {
  const pageId = settings?.facebookPageId?.trim() || process.env.FACEBOOK_PAGE_ID?.trim() || "";
  const accessToken =
    settings?.facebookPageAccessToken?.trim() || process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() || "";
  return { pageId, accessToken };
}

export async function getFacebookDiagnostics(settings: StoreSettings | null | undefined) {
  const { pageId, accessToken } = getFacebookCredentials(settings);
  const siteUrl = getPublicSiteUrl(settings);
  if (!pageId || !accessToken) {
    return {
      configured: false,
      pageId: pageId || null,
      hasToken: !!accessToken,
      siteUrl,
      error: "Facebook Page ID and Page Access Token are required",
    };
  }

  try {
    // Only id+name — fan_count/link need pages_read_engagement (App Review). Posting needs pages_manage_posts only.
    const url = `${GRAPH_API}/${pageId}?fields=id,name&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const fbError = data.error as { message?: string; code?: number } | undefined;
      const hint =
        fbError?.code === 100
          ? "Use the Page Access Token from GET /me/accounts (not a User token). Page ID must match that token."
          : undefined;
      return {
        configured: true,
        pageId,
        hasToken: true,
        siteUrl,
        error: fbError?.message || "Facebook API error",
        errorData: data.error,
        hint,
      };
    }
    return {
      configured: true,
      pageId,
      hasToken: true,
      siteUrl,
      pageName: data.name,
      pageIdVerified: data.id,
      canPublish: true,
      note: "Connection OK. Publishing requires pages_manage_posts on this Page token.",
    };
  } catch (err) {
    return {
      configured: true,
      pageId,
      hasToken: true,
      siteUrl,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function facebookErrorHint(code?: number, message?: string): string | undefined {
  if (code === 200 || message?.includes("permission to post")) {
    return "Use the Page access_token from GET /me/accounts with pages_manage_posts. You must be Page Admin.";
  }
  if (code === 190) {
    return "Token expired or invalid — generate a new Page token in Graph API Explorer.";
  }
  return undefined;
}

async function postToFacebookEndpoint(
  endpoint: string,
  body: Record<string, string>,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, data };
}

export async function publishToFacebook(
  settings: StoreSettings,
  post: GeneratedSocialPost,
  options?: { skipImage?: boolean },
): Promise<FacebookPublishResult> {
  const { pageId, accessToken } = getFacebookCredentials(settings);
  if (!pageId || !accessToken) {
    return { success: false, error: "Facebook not configured (Page ID + Access Token)" };
  }

  try {
    const baseBody: Record<string, string> = {
      message: post.message,
      access_token: accessToken,
    };

    const tryPhoto = !!post.imageUrl && !options?.skipImage;
    if (tryPhoto) {
      const photoBody = { ...baseBody, url: post.imageUrl! };
      if (post.linkUrl) photoBody.link = post.linkUrl;

      const photoResult = await postToFacebookEndpoint(`${GRAPH_API}/${pageId}/photos`, photoBody);
      if (photoResult.ok) {
        const postId = String(photoResult.data.id || photoResult.data.post_id || "");
        return { success: true, facebookPostId: postId || undefined };
      }

      const photoErr = photoResult.data.error as { message?: string; code?: number } | undefined;
      const permDenied =
        photoErr?.code === 200 || photoErr?.message?.toLowerCase().includes("permission");

      if (!permDenied) {
        return {
          success: false,
          error: photoErr?.message || "Facebook photo publish failed",
          errorData: photoResult.data.error,
        };
      }

      // Fall back to text+link post when photo permission missing
    }

    const feedBody = { ...baseBody };
    if (post.linkUrl) feedBody.link = post.linkUrl;

    const feedResult = await postToFacebookEndpoint(`${GRAPH_API}/${pageId}/feed`, feedBody);
    if (feedResult.ok) {
      const postId = String(feedResult.data.id || feedResult.data.post_id || "");
      return { success: true, facebookPostId: postId || undefined };
    }

    const feedErr = feedResult.data.error as { message?: string; code?: number } | undefined;
    const hint = facebookErrorHint(feedErr?.code, feedErr?.message);
    const errorMsg = hint ? `${feedErr?.message || "Facebook publish failed"} — ${hint}` : feedErr?.message;

    return {
      success: false,
      error: errorMsg || "Facebook publish failed",
      errorData: feedResult.data.error,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function logFacebookPost(entry: {
  postType: string;
  productId?: string | null;
  message: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  facebookPostId?: string | null;
  source: "manual" | "cron";
  success: boolean;
  error?: string | null;
}) {
  await db.insert(facebookPostLog).values({
    postType: entry.postType,
    productId: entry.productId ?? null,
    message: entry.message,
    imageUrl: entry.imageUrl ?? null,
    linkUrl: entry.linkUrl ?? null,
    facebookPostId: entry.facebookPostId ?? null,
    source: entry.source,
    success: entry.success ? 1 : 0,
    error: entry.error ?? null,
  });
}

export async function getFacebookPostHistory(limit = 30) {
  return db
    .select()
    .from(facebookPostLog)
    .orderBy(desc(facebookPostLog.createdAt))
    .limit(limit);
}

export async function runAutoFacebookPost(
  settings: StoreSettings,
  updateSettings: (patch: Partial<StoreSettings>) => Promise<StoreSettings>,
  options?: { force?: boolean },
): Promise<{ skipped?: boolean; reason?: string; post?: GeneratedSocialPost; result?: FacebookPublishResult }> {
  if (!settings.facebookAutoPostEnabled) {
    return { skipped: true, reason: "Auto-post disabled" };
  }

  const { pageId, accessToken } = getFacebookCredentials(settings);
  if (!pageId || !accessToken) {
    return { skipped: true, reason: "Facebook not configured" };
  }

  const today = baghdadDateString();
  if (!options?.force && settings.facebookAutoPostLastAt) {
    const lastDay = settings.facebookAutoPostLastAt.toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
    if (lastDay === today) {
      return { skipped: true, reason: "Already posted today" };
    }
  }

  const siteUrl = getPublicSiteUrl(settings);
  const mode = settings.facebookAutoPostMode || "rotate";
  let post: GeneratedSocialPost;

  if (mode === "repair") {
    post = generateRepairPost(settings, siteUrl);
  } else if (mode === "announcement") {
    post = generateAnnouncementPost(settings, siteUrl);
  } else {
    const cursor = settings.facebookAutoPostCursor ?? 0;
    const { product, nextCursor } = await pickProductForAutoPost(mode === "sale" ? "sale" : "rotate", cursor);
    if (!product) {
      return { skipped: true, reason: "No in-stock products" };
    }
    post = generateProductPost(product, settings, siteUrl);
    await updateSettings({
      facebookAutoPostCursor: nextCursor,
    } as Partial<StoreSettings>);
  }

  const result = await publishToFacebook(settings, post);
  await logFacebookPost({
    postType: post.postType,
    productId: post.productId,
    message: post.message,
    imageUrl: post.imageUrl,
    linkUrl: post.linkUrl,
    facebookPostId: result.facebookPostId,
    source: "cron",
    success: result.success,
    error: result.error,
  });

  if (result.success) {
    await updateSettings({
      facebookAutoPostLastAt: new Date(),
    } as Partial<StoreSettings>);
  }

  return { post, result };
}

export function maskToken(token: string): string {
  if (!token) return "";
  if (token.length <= 8) return "••••••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}
