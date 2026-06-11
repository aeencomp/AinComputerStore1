import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StoreSettings } from "@shared/schema";
import { initMetaPixel, resolveMetaPixelId, trackMetaPageView } from "@/lib/metaPixel";

/** Loads Meta Pixel from store settings (or VITE_META_PIXEL_ID) and tracks SPA page views. */
export function MetaPixel() {
  const [location] = useLocation();
  const initialized = useRef(false);
  const lastPath = useRef<string | null>(null);

  const { data: settings } = useQuery<StoreSettings>({
    queryKey: ["/api/store-settings"],
  });

  const pixelId = resolveMetaPixelId(settings?.metaPixelId);

  useEffect(() => {
    if (!pixelId || initialized.current) return;
    if (initMetaPixel(pixelId)) {
      initialized.current = true;
    }
  }, [pixelId]);

  useEffect(() => {
    if (!pixelId || !initialized.current) return;
    if (lastPath.current === location) return;
    lastPath.current = location;
    trackMetaPageView();
  }, [location, pixelId]);

  return null;
}
