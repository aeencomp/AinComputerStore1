declare global {
  interface Window {
    fbq?: {
      (...args: unknown[]): void;
      callMethod?: (...args: unknown[]) => void;
      queue: unknown[][];
      loaded?: boolean;
      version?: string;
      push?: unknown;
    };
    _fbq?: Window["fbq"];
  }
}

let pixelInitialized = false;

export function resolveMetaPixelId(settingsPixelId?: string | null): string {
  const fromSettings = settingsPixelId?.trim() || "";
  const fromEnv = (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim() || "";
  return fromSettings || fromEnv;
}

export function initMetaPixel(pixelId: string): boolean {
  const id = pixelId.trim();
  if (!id || pixelInitialized) return false;
  if (typeof window.fbq === "function" && window.fbq.loaded) {
    pixelInitialized = true;
    return true;
  }

  const f = window;
  if (!f.fbq) {
    const n = function (...args: unknown[]) {
      if (n.callMethod) {
        n.callMethod(...args);
      } else {
        n.queue.push(args);
      }
    } as Window["fbq"] & { callMethod?: (...args: unknown[]) => void; queue: unknown[][] };
    n.queue = [];
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    f.fbq = n;
    if (!f._fbq) f._fbq = n;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  window.fbq!("init", id);
  window.fbq!("track", "PageView");

  pixelInitialized = true;
  return true;
}

export function trackMetaPageView() {
  window.fbq?.("track", "PageView");
}

export function trackMetaEvent(
  event: string,
  params?: Record<string, string | number | boolean>,
) {
  if (params) {
    window.fbq?.("track", event, params);
  } else {
    window.fbq?.("track", event);
  }
}
