import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  imageFileTooLarge,
  imageMaxSizeLabel,
  imageUploadLimits,
  isAllowedImageFile,
  isHeicFile,
  uploadProductImage,
} from "@/lib/imageUpload";

interface MultiImageUploadProps {
  values: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  maxImages?: number;
}

export function MultiImageUpload({ values, onChange, label, maxImages = 10 }: MultiImageUploadProps) {
  const { language } = useLanguage();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    const newImages: string[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      if (values.length + newImages.length >= maxImages) {
        errors.push(
          language === "ar"
            ? `الحد الأقصى ${maxImages} صور`
            : `Maximum ${maxImages} images`,
        );
        break;
      }

      if (isHeicFile(file)) {
        errors.push(
          language === "ar"
            ? `${file.name}: صيغة HEIC غير مدعومة — حوّل الصورة إلى JPG`
            : `${file.name}: HEIC not supported — save as JPG first`,
        );
        continue;
      }

      if (!isAllowedImageFile(file)) {
        errors.push(
          language === "ar"
            ? `${file.name}: نوع غير مدعوم`
            : `${file.name}: unsupported type`,
        );
        continue;
      }

      if (imageFileTooLarge(file)) {
        errors.push(
          language === "ar"
            ? `${file.name}: أكبر من ${imageMaxSizeLabel("ar")}`
            : `${file.name}: larger than ${imageMaxSizeLabel("en")}`,
        );
        continue;
      }

      try {
        const url = await uploadProductImage(file);
        newImages.push(url);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Upload failed";
        errors.push(`${file.name}: ${msg}`);
      }
    }

    if (newImages.length > 0) {
      onChange([...values, ...newImages].slice(0, maxImages));
    }

    if (errors.length > 0) {
      setUploadError(errors.join(" · "));
    } else if (newImages.length === 0) {
      setUploadError(
        language === "ar" ? "لم يتم رفع أي صورة" : "No images were uploaded",
      );
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddUrl = () => {
    if (urlInput.trim() && values.length < maxImages) {
      onChange([...values, urlInput.trim()]);
      setUrlInput("");
    }
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      {label && <Label>{label}</Label>}

      {values.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {values.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Image ${index + 1}`}
                className="w-full h-20 object-cover rounded-lg border"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.png";
                }}
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemove(index)}
                data-testid={`button-remove-image-${index}`}
              >
                <X className="w-3 h-3" />
              </Button>
              {index === 0 && (
                <span className="absolute bottom-1 left-1 text-xs bg-primary text-primary-foreground px-1 rounded">
                  {language === "ar" ? "رئيسية" : "Main"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {values.length < maxImages && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={language === "ar" ? "أدخل رابط الصورة" : "Enter image URL"}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddUrl())}
              data-testid="input-image-url"
            />
            <Button type="button" onClick={handleAddUrl} disabled={!urlInput.trim()} data-testid="button-add-url">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={imageUploadLimits.accept}
            multiple
            onChange={handleFileChange}
            className="hidden"
            data-testid="input-file-upload"
          />

          <div
            className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover-elevate transition-colors"
            onClick={handleBrowseClick}
            data-testid="dropzone-upload"
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "جاري الرفع..." : "Uploading..."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <p className="text-sm">
                  {language === "ar" ? "اضغط لرفع صور متعددة" : "Click to upload multiple images"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === "ar"
                    ? `JPG, PNG, GIF, WebP — حتى ${imageMaxSizeLabel("ar")} · ${values.length}/${maxImages}`
                    : `JPG, PNG, GIF, WebP — up to ${imageMaxSizeLabel("en")} · ${values.length}/${maxImages}`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {uploadError && (
        <p className="text-sm text-destructive" data-testid="text-upload-error">
          {uploadError}
        </p>
      )}
    </div>
  );
}
