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
  permalinkUrl?: string;
  isPublished?: boolean;
  error?: string;
  errorData?: unknown;
  warning?: string;
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

const LRI = "\u2066";
const PDI = "\u2069";
const RLM = "\u200F";

function isolateLtr(segment: string): string {
  return `${LRI}${segment}${PDI}`;
}

const DEFAULT_ADDRESS_AR = "كربلاء، العراق";

function getStoreAddressAr(settings: StoreSettings): string {
  return settings.addressAr?.trim() || DEFAULT_ADDRESS_AR;
}

function getCityHashtag(settings: StoreSettings): string {
  const city = getStoreAddressAr(settings).split(/[،,]/)[0]?.trim() || "كربلاء";
  return city.replace(/\s+/g, "_");
}

/** Normalize Iraqi mobile for display: 07850006977 */
function formatPhoneForPost(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("964") && digits.length >= 12) {
    return `0${digits.slice(3, 13)}`;
  }
  if (digits.startsWith("07") && digits.length >= 11) {
    return digits.slice(0, 11);
  }
  if (digits.startsWith("7") && digits.length === 10) {
    return `0${digits}`;
  }
  return raw.trim();
}

function isPhoneOnlyLine(line: string): boolean {
  const digits = line.trim().replace(/\D/g, "");
  return /^(?:964)?7\d{9}$/.test(digits) || /^07\d{9}$/.test(digits);
}

function pushWhatsAppLines(lines: string[], whatsapp: string | undefined) {
  if (!whatsapp?.trim()) return;
  lines.push("📲 واتساب:");
  lines.push(formatPhoneForPost(whatsapp));
}

function pushPhoneLines(lines: string[], phone: string | undefined) {
  if (!phone?.trim()) return;
  lines.push("📞 هاتف:");
  lines.push(formatPhoneForPost(phone));
}

/** Fix mixed Arabic + numbers/URLs/Latin for correct RTL on Facebook and admin preview. */
export function formatArabicRtlMessage(message: string): string {
  const lines = message.split("\n").map((line) => {
    if (!line.trim()) return line;

    const trimmed = line.trim();
    if (/^https?:\/\//i.test(trimmed)) return isolateLtr(trimmed);
    if (isPhoneOnlyLine(trimmed)) return isolateLtr(formatPhoneForPost(trimmed));

    let out = line;
    out = out.replace(/https?:\/\/\S+/gi, (url) => isolateLtr(url));
    out = out.replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, (num) => isolateLtr(num));
    out = out.replace(/كود خصم:\s*([A-Za-z0-9_-]+)/g, (_, code) => `كود خصم: ${isolateLtr(code)}`);
    out = out.replace(/#([A-Za-z][A-Za-z0-9_]*)/g, (tag) => isolateLtr(tag));
    out = out.replace(/\(كان\s+(\d{1,3}(?:,\d{3})*)\)/g, (_, num) => `(كان ${isolateLtr(num)})`);

    return out;
  });

  const body = lines.join("\n").trim();
  return body.startsWith(RLM) ? body : `${RLM}${body}`;
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
  const cityTag = getCityHashtag(settings);
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
  pushWhatsAppLines(lines, whatsapp);
  lines.push("", `#${storeName.replace(/\s+/g, "_")} #كمبيوتر #لابتوب #${cityTag}`);

  return {
    postType: extras?.discountCode || (oldPrice && parseFloat(String(product.oldPrice)) > parseFloat(String(product.price))) ? "sale" : "product",
    productId: product.id,
    message: formatArabicRtlMessage(lines.join("\n")),
    imageUrl: image,
    linkUrl: link,
  };
}

export function generateRepairPost(settings: StoreSettings, siteUrl: string): GeneratedSocialPost {
  const storeName = settings.storeNameAr || "العين لتجارة الحاسبات";
  const whatsapp = settings.whatsappNumber?.trim();
  const phone = settings.phone?.trim();
  const address = getStoreAddressAr(settings);
  const cityTag = getCityHashtag(settings);
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
  if (whatsapp) pushWhatsAppLines(lines, whatsapp);
  else pushPhoneLines(lines, phone);
  lines.push("", `#صيانة_لابتوب #صيانة_كمبيوتر #${cityTag}`);

  return {
    postType: "repair",
    message: formatArabicRtlMessage(lines.join("\n")),
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
  pushWhatsAppLines(lines, whatsapp);

  return {
    postType: "announcement",
    message: formatArabicRtlMessage(lines.join("\n")),
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

  if (mode === "random" || mode === "mixed") {
    const idx = Math.floor(Math.random() * pool.length);
    return { product: pool[idx], nextCursor: cursor };
  }

  const idx = cursor % pool.length;
  return { product: pool[idx], nextCursor: (idx + 1) % pool.length };
}

export async function countFacebookAutoPostsToday(): Promise<number> {
  const today = baghdadDateString();
  const rows = await db
    .select({ createdAt: facebookPostLog.createdAt })
    .from(facebookPostLog)
    .where(and(eq(facebookPostLog.source, "cron"), eq(facebookPostLog.success, 1)));

  return rows.filter(
    (r) => r.createdAt.toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" }) === today,
  ).length;
}

async function pickMixedAutoPost(
  settings: StoreSettings,
  siteUrl: string,
): Promise<GeneratedSocialPost> {
  const roll = Math.random();
  if (roll < 0.15) {
    return generateAnnouncementPost(settings, siteUrl);
  }
  if (roll < 0.35) {
    return generateRepairPost(settings, siteUrl);
  }
  const { product } = await pickProductForAutoPost("random", 0);
  if (!product) {
    return generateRepairPost(settings, siteUrl);
  }
  return generateProductPost(product, settings, siteUrl);
}

export async function exchangeUserTokenForPageToken(
  userAccessToken: string,
  pageId: string,
): Promise<{
  success: boolean;
  pageToken?: string;
  pageName?: string;
  error?: string;
  availablePages?: { id: string; name: string }[];
}> {
  const token = userAccessToken.trim();
  const targetId = pageId.trim();
  if (!token || !targetId) {
    return { success: false, error: "User token and Page ID required" };
  }

  try {
    const url = `${GRAPH_API}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      data?: { id: string; name: string; access_token: string }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return { success: false, error: data.error?.message || "Failed to read /me/accounts" };
    }

    const accounts = data.data || [];
    const availablePages = accounts.map((a) => ({ id: a.id, name: a.name }));
    const match = accounts.find((a) => a.id === targetId);
    if (!match?.access_token) {
      const names = availablePages.map((p) => `${p.name} (${p.id})`).join(", ");
      return {
        success: false,
        error: `Page ID ${targetId} not found in your accounts. Available: ${names || "none"}`,
        availablePages,
      };
    }

    return {
      success: true,
      pageToken: match.access_token,
      pageName: match.name,
      availablePages,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
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

  const requiredPermissions = ["pages_manage_posts", "pages_read_engagement"];

  try {
    // id+name only — "tasks" is not available on all Page token types (#100).
    const url = `${GRAPH_API}/${pageId}?fields=id,name&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const fbError = data.error as { message?: string; code?: number } | undefined;
      const hint =
        fbError?.code === 100
          ? "Use the Page access_token from GET /me/accounts (not a User token). Page ID must match that token."
          : undefined;
      return {
        configured: true,
        pageId,
        hasToken: true,
        siteUrl,
        error: fbError?.message || "Facebook API error",
        errorData: data.error,
        hint,
        requiredPermissions,
      };
    }

    const verifiedId = String(data.id || "");
    const idMatches = !verifiedId || verifiedId === pageId;

    return {
      configured: true,
      pageId,
      hasToken: true,
      siteUrl,
      pageName: data.name,
      pageIdVerified: verifiedId || pageId,
      canPublish: idMatches,
      requiredPermissions,
      note: idMatches
        ? "Connection OK. Use «نشر على فيسبوك» or «نشر تلقائي الآن» to verify posting."
        : "Token works but Page ID may be wrong — use id from GET /me/accounts.",
      warning: idMatches
        ? undefined
        : `Saved Page ID (${pageId}) does not match token page (${verifiedId}).`,
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
  if (message?.includes("posted to a page as the page itself")) {
    return "Use Page token: Explorer → User or Page → select العين لتجارة الحاسبات → Generate Access Token → paste that token here.";
  }
  if (code === 200 || message?.includes("permission to post") || message?.includes("pages_manage_posts")) {
    return "Regenerate token: Graph API Explorer → check pages_manage_posts AND pages_read_engagement → select Page (not User Token) → paste token here. You must be Page Admin.";
  }
  if (code === 190) {
    return "Token expired or invalid — generate a new Page token in Graph API Explorer.";
  }
  return undefined;
}

async function fetchFacebookPostMeta(
  postId: string,
  accessToken: string,
): Promise<{ isPublished?: boolean; permalinkUrl?: string }> {
  try {
    const url = `${GRAPH_API}/${postId}?fields=is_published,permalink_url&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = (await res.json()) as { is_published?: boolean; permalink_url?: string };
    if (!res.ok) return {};
    return {
      isPublished: data.is_published,
      permalinkUrl: data.permalink_url,
    };
  } catch {
    return {};
  }
}

async function postToFacebookEndpoint(
  endpoint: string,
  body: Record<string, string>,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value != null && value !== "") form.set(key, value);
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, data };
}

/** Minimal publish test — real post (Facebook rejects unpublished drafts without strict Page token). */
export async function testFacebookPublish(
  pageId: string,
  accessToken: string,
): Promise<FacebookPublishResult> {
  const body: Record<string, string> = {
    message: formatArabicRtlMessage("اختبار نشر من نظام العين — يمكن حذف هذا المنشور"),
    access_token: accessToken,
    published: "true",
  };
  const result = await postToFacebookEndpoint(`${GRAPH_API}/${pageId}/feed`, body);
  if (result.ok) {
    const facebookPostId = String(result.data.id || "") || undefined;
    const meta = facebookPostId ? await fetchFacebookPostMeta(facebookPostId, accessToken) : {};
    return {
      success: true,
      facebookPostId,
      permalinkUrl: meta.permalinkUrl,
      isPublished: meta.isPublished ?? true,
      warning:
        meta.isPublished === false
          ? "Post saved but not public yet — check Page → Posts → Published in Meta Business Suite."
          : undefined,
    };
  }
  const err = result.data.error as { message?: string; code?: number } | undefined;
  const hint = facebookErrorHint(err?.code, err?.message);
  return {
    success: false,
    error: hint ? `${err?.message || "Failed"} — ${hint}` : err?.message,
    errorData: result.data.error,
  };
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
      message: formatArabicRtlMessage(post.message),
      access_token: accessToken,
      published: "true",
    };

    const buildPublishResult = async (rawPostId: string): Promise<FacebookPublishResult> => {
      const facebookPostId = rawPostId || undefined;
      const meta = facebookPostId ? await fetchFacebookPostMeta(facebookPostId, accessToken) : {};
      const permalinkUrl = meta.permalinkUrl || (facebookPostId ? `https://www.facebook.com/${facebookPostId}` : undefined);
      const isPublished = meta.isPublished ?? true;
      return {
        success: true,
        facebookPostId,
        permalinkUrl,
        isPublished,
        warning: isPublished === false
          ? "Post is not public — visitors cannot see it. Open Meta Business Suite → Page → Posts and publish it."
          : undefined,
      };
    };

    const tryImage = !!post.imageUrl && !options?.skipImage;
    if (tryImage) {
      const feedWithPicture: Record<string, string> = { ...baseBody, picture: post.imageUrl! };
      if (post.linkUrl) feedWithPicture.link = post.linkUrl;

      const pictureResult = await postToFacebookEndpoint(`${GRAPH_API}/${pageId}/feed`, feedWithPicture);
      if (pictureResult.ok) {
        const postId = String(pictureResult.data.id || pictureResult.data.post_id || "");
        return buildPublishResult(postId);
      }

      const photoBody: Record<string, string> = { ...baseBody, url: post.imageUrl! };
      if (post.linkUrl) photoBody.link = post.linkUrl;

      const photoResult = await postToFacebookEndpoint(`${GRAPH_API}/${pageId}/photos`, photoBody);
      if (photoResult.ok) {
        const postId = String(photoResult.data.post_id || photoResult.data.id || "");
        return buildPublishResult(postId);
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
    }

    const feedBody = { ...baseBody };
    if (post.linkUrl) feedBody.link = post.linkUrl;

    const feedResult = await postToFacebookEndpoint(`${GRAPH_API}/${pageId}/feed`, feedBody);
    if (feedResult.ok) {
      const postId = String(feedResult.data.id || feedResult.data.post_id || "");
      return buildPublishResult(postId);
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
  options?: { force?: boolean; manualTest?: boolean },
): Promise<{ skipped?: boolean; reason?: string; post?: GeneratedSocialPost; result?: FacebookPublishResult }> {
  if (!options?.manualTest && !settings.facebookAutoPostEnabled) {
    return { skipped: true, reason: "Auto-post disabled" };
  }

  const { pageId, accessToken } = getFacebookCredentials(settings);
  if (!pageId || !accessToken) {
    return { skipped: true, reason: "Facebook not configured" };
  }

  const dailyLimit = Math.min(5, Math.max(1, settings.facebookAutoPostsPerDay ?? 1));
  const postsToday = await countFacebookAutoPostsToday();
  if (!options?.force && postsToday >= dailyLimit) {
    return {
      skipped: true,
      reason: `Daily limit reached (${postsToday}/${dailyLimit})`,
    };
  }

  const siteUrl = getPublicSiteUrl(settings);
  const mode = settings.facebookAutoPostMode || "rotate";
  let post: GeneratedSocialPost;

  if (mode === "repair") {
    post = generateRepairPost(settings, siteUrl);
  } else if (mode === "announcement") {
    post = generateAnnouncementPost(settings, siteUrl);
  } else if (mode === "mixed") {
    post = await pickMixedAutoPost(settings, siteUrl);
  } else {
    const pickMode = mode === "sale" ? "sale" : mode === "random" ? "random" : "rotate";
    const cursor = settings.facebookAutoPostCursor ?? 0;
    const { product, nextCursor } = await pickProductForAutoPost(pickMode, cursor);
    if (!product) {
      return { skipped: true, reason: "No in-stock products" };
    }
    post = generateProductPost(product, settings, siteUrl);
    if (pickMode === "rotate" || pickMode === "sale") {
      await updateSettings({
        facebookAutoPostCursor: nextCursor,
      } as Partial<StoreSettings>);
    }
  }

  const result = await publishToFacebook(settings, post);
  await logFacebookPost({
    postType: post.postType,
    productId: post.productId,
    message: post.message,
    imageUrl: post.imageUrl,
    linkUrl: post.linkUrl,
    facebookPostId: result.facebookPostId,
    source: options?.manualTest ? "manual" : "cron",
    success: result.success,
    error: result.error,
  });

  if (result.success && !options?.manualTest) {
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
