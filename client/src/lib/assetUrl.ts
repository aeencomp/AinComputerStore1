function getAssetBaseUrl(): string | null {
  const configured = (import.meta as any).env?.VITE_ASSET_BASE_URL as
    | string
    | undefined;
  if (configured && configured.trim()) return configured.trim().replace(/\/+$/, "");

  return null;
}

export function resolveAssetUrl(input: string): string {
  if (!input) return input;
  if (input.startsWith("http://") || input.startsWith("https://")) return input;

  const base = getAssetBaseUrl();
  if (!base) return input;

  if (input.startsWith("/uploads/") || input.startsWith("/objects/")) {
    return `${base}${input}`;
  }

  return input;
}

