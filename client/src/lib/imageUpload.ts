const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/gif",
  "image/webp",
  "image/avif",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function imageExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function isAllowedImageFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  const ext = imageExtension(file.name);
  if (mime && ALLOWED_MIME_TYPES.has(mime)) return true;
  if (ext && ALLOWED_EXTENSIONS.has(ext)) return true;
  return false;
}

export function isHeicFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  const ext = imageExtension(file.name);
  return mime.includes("heic") || mime.includes("heif") || ext === ".heic" || ext === ".heif";
}

export function imageFileTooLarge(file: File): boolean {
  return file.size > MAX_IMAGE_BYTES;
}

export async function uploadProductImage(
  file: File,
  endpoint: "/api/upload/image" | "/api/sales/upload/image" = "/api/upload/image",
): Promise<string> {
  const fd = new FormData();
  fd.append("image", file);

  const res = await fetch(endpoint, {
    method: "POST",
    body: fd,
    credentials: "include",
  });

  if (!res.ok) {
    let message = "Upload failed";
    try {
      const data = await res.json();
      message = data?.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await res.json();
  if (!data?.url) {
    throw new Error("Upload failed: no URL returned");
  }
  return data.url as string;
}

export const imageUploadLimits = {
  maxBytes: MAX_IMAGE_BYTES,
  accept: "image/jpeg,image/png,image/gif,image/webp,image/avif,.jpg,.jpeg,.png,.gif,.webp,.avif",
};
