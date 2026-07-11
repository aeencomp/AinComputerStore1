import { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Link as LinkIcon, Loader2, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  imageFileTooLarge,
  imageUploadLimits,
  isAllowedImageFile,
  isHeicFile,
  uploadProductImage,
} from "@/lib/imageUpload";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export function ImageUpload({ value, onChange, placeholder, label, required }: ImageUploadProps) {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>("url");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isHeicFile(file)) {
      setUploadError(
        language === "ar"
          ? "صيغة HEIC غير مدعومة. احفظ الصورة كـ JPG من الهاتف ثم ارفعها"
          : "HEIC is not supported. Save the photo as JPG on your phone, then upload",
      );
      return;
    }

    if (!isAllowedImageFile(file)) {
      setUploadError(
        language === "ar"
          ? "نوع الملف غير مدعوم. يرجى استخدام JPG, PNG, GIF, أو WebP"
          : "Unsupported file type. Please use JPG, PNG, GIF, or WebP",
      );
      return;
    }

    if (imageFileTooLarge(file)) {
      setUploadError(
        language === "ar"
          ? "حجم الملف كبير جداً. الحد الأقصى 5 ميغابايت"
          : "File too large. Maximum size is 5MB",
      );
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const url = await uploadProductImage(file);
      onChange(url);
      setActiveTab("url");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage.includes("Unauthorized")) {
        setUploadError(
          language === "ar"
            ? "غير مصرح. يرجى تسجيل الدخول مجدداً"
            : "Unauthorized. Please log in again",
        );
      } else if (errorMessage.includes("File too large")) {
        setUploadError(
          language === "ar"
            ? "حجم الملف كبير جداً. الحد الأقصى 5 ميغابايت"
            : "File too large. Maximum size is 5MB",
        );
      } else if (errorMessage.includes("Invalid file type")) {
        setUploadError(
          language === "ar"
            ? "نوع الملف غير مدعوم. يرجى استخدام JPG, PNG, GIF, أو WebP"
            : "Invalid file type. Use JPG, PNG, GIF, or WebP",
        );
      } else {
        setUploadError(errorMessage || (language === "ar" ? "فشل رفع الصورة. حاول مرة أخرى" : "Failed to upload image. Please try again"));
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const clearImage = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="url" className="flex items-center gap-2" data-testid="tab-image-url">
            <LinkIcon className="w-4 h-4" />
            {language === 'ar' ? 'رابط' : 'URL'}
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2" data-testid="tab-image-upload">
            <Upload className="w-4 h-4" />
            {language === 'ar' ? 'رفع' : 'Upload'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="mt-2">
          <div className="flex gap-2">
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder || (language === 'ar' ? 'أدخل رابط الصورة' : 'Enter image URL')}
              required={required}
              data-testid="input-image-url"
            />
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearImage}
                data-testid="button-clear-image"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-2">
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={imageUploadLimits.accept}
              onChange={handleFileChange}
              onClick={(e) => e.stopPropagation()}
              className="hidden"
              data-testid="input-file-upload"
            />
            
            <div 
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover-elevate transition-colors"
              onClick={handleBrowseClick}
              data-testid="dropzone-upload"
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'جاري الرفع...' : 'Uploading...'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {language === 'ar' ? 'اضغط لاختيار صورة' : 'Click to select image'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'JPG, PNG, GIF, WebP - حتى 5 ميغابايت' : 'JPG, PNG, GIF, WebP - up to 5MB'}
                  </p>
                </div>
              )}
            </div>

            {uploadError && (
              <p className="text-sm text-destructive" data-testid="text-upload-error">
                {uploadError}
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {value && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-2">
            {language === 'ar' ? 'معاينة:' : 'Preview:'}
          </p>
          <img 
            src={value} 
            alt="Preview" 
            className="w-24 h-24 object-cover rounded-lg border"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
            data-testid="img-preview"
          />
        </div>
      )}
    </div>
  );
}
