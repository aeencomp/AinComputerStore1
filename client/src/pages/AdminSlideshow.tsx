import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, Trash2, Save, Image, ArrowLeft, Eye, EyeOff, GripVertical, Upload } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AdminNav } from "@/components/AdminNav";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SlideshowSlide, AdminUser } from "@shared/schema";

interface SlideFormData {
  image: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  ctaTextAr: string;
  ctaTextEn: string;
  ctaLink: string;
  sortOrder: number;
  isActive: number;
}

const defaultSlide: SlideFormData = {
  image: "",
  titleAr: "",
  titleEn: "",
  subtitleAr: "",
  subtitleEn: "",
  ctaTextAr: "اطلب الآن",
  ctaTextEn: "Order Now",
  ctaLink: "/",
  sortOrder: 0,
  isActive: 1,
};

export default function AdminSlideshow() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<SlideshowSlide | null>(null);
  const [formData, setFormData] = useState<SlideFormData>(defaultSlide);
  const [uploading, setUploading] = useState(false);

  const { data: currentAdmin, isLoading: adminLoading } = useQuery<AdminUser>({
    queryKey: ["/api/admin/auth/me"],
  });

  const { data: slides = [], isLoading } = useQuery<SlideshowSlide[]>({
    queryKey: ["/api/admin/slideshow-slides"],
    enabled: !!currentAdmin,
  });

  const createMutation = useMutation({
    mutationFn: async (data: SlideFormData) => {
      return await apiRequest("POST", "/api/admin/slideshow-slides", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/slideshow-slides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/slideshow-slides"] });
      toast({ title: language === "ar" ? "تم إضافة الشريحة بنجاح" : "Slide added successfully" });
      setIsDialogOpen(false);
      setFormData(defaultSlide);
    },
    onError: () => {
      toast({ title: language === "ar" ? "حدث خطأ" : "Error occurred", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SlideFormData> }) => {
      return await apiRequest("PUT", `/api/admin/slideshow-slides/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/slideshow-slides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/slideshow-slides"] });
      toast({ title: language === "ar" ? "تم تحديث الشريحة بنجاح" : "Slide updated successfully" });
      setIsDialogOpen(false);
      setEditingSlide(null);
      setFormData(defaultSlide);
    },
    onError: () => {
      toast({ title: language === "ar" ? "حدث خطأ" : "Error occurred", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/slideshow-slides/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/slideshow-slides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/slideshow-slides"] });
      toast({ title: language === "ar" ? "تم حذف الشريحة" : "Slide deleted" });
    },
    onError: () => {
      toast({ title: language === "ar" ? "حدث خطأ" : "Error occurred", variant: "destructive" });
    },
  });

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">{language === "ar" ? "جاري التحميل..." : "Loading..."}</div>
      </div>
    );
  }

  if (!currentAdmin) {
    setLocation("/admin/login");
    return null;
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const uploadFormData = new FormData();
    uploadFormData.append("image", file);

    try {
      const response = await fetch("/api/upload/image", {
        method: "POST",
        body: uploadFormData,
        credentials: "include",
      });
      
      if (response.ok) {
        const result = await response.json();
        setFormData({ ...formData, image: result.url });
        toast({ title: language === "ar" ? "تم رفع الصورة" : "Image uploaded" });
      } else {
        toast({ title: language === "ar" ? "فشل رفع الصورة" : "Upload failed", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: language === "ar" ? "خطأ في الرفع" : "Upload error", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.image || !formData.titleAr || !formData.titleEn) {
      toast({
        title: language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields",
        variant: "destructive",
      });
      return;
    }

    if (editingSlide) {
      updateMutation.mutate({ id: editingSlide.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditDialog = (slide: SlideshowSlide) => {
    setEditingSlide(slide);
    setFormData({
      image: slide.image,
      titleAr: slide.titleAr,
      titleEn: slide.titleEn,
      subtitleAr: slide.subtitleAr || "",
      subtitleEn: slide.subtitleEn || "",
      ctaTextAr: slide.ctaTextAr || "",
      ctaTextEn: slide.ctaTextEn || "",
      ctaLink: slide.ctaLink || "/",
      sortOrder: slide.sortOrder,
      isActive: slide.isActive,
    });
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingSlide(null);
    setFormData({ ...defaultSlide, sortOrder: slides.length });
    setIsDialogOpen(true);
  };

  const toggleActive = (slide: SlideshowSlide) => {
    updateMutation.mutate({ id: slide.id, data: { isActive: slide.isActive === 1 ? 0 : 1 } });
  };

  return (
    <div className="min-h-screen bg-background" dir={language === "ar" ? "rtl" : "ltr"}>
      <AdminNav currentAdmin={currentAdmin} />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">
                {language === "ar" ? "إدارة شرائح العرض" : "Slideshow Management"}
              </h1>
              <p className="text-muted-foreground">
                {language === "ar" ? "أضف وعدّل شرائح العرض في الصفحة الرئيسية" : "Add and edit homepage slideshow slides"}
              </p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog} className="gap-2" data-testid="button-add-slide">
                <Plus className="w-4 h-4" />
                {language === "ar" ? "إضافة شريحة" : "Add Slide"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingSlide
                    ? (language === "ar" ? "تعديل الشريحة" : "Edit Slide")
                    : (language === "ar" ? "إضافة شريحة جديدة" : "Add New Slide")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "صورة الشريحة *" : "Slide Image *"}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.image}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      placeholder={language === "ar" ? "رابط الصورة أو ارفع صورة" : "Image URL or upload"}
                      data-testid="input-slide-image"
                    />
                    <Label className="cursor-pointer">
                      <Button variant="outline" className="gap-2" disabled={uploading} asChild>
                        <span>
                          <Upload className="w-4 h-4" />
                          {uploading ? "..." : (language === "ar" ? "رفع" : "Upload")}
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                        data-testid="input-upload-image"
                      />
                    </Label>
                  </div>
                  {formData.image && (
                    <img src={formData.image} alt="Preview" className="w-full h-40 object-cover rounded-md" />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "العنوان (عربي) *" : "Title (Arabic) *"}</Label>
                    <Input
                      value={formData.titleAr}
                      onChange={(e) => setFormData({ ...formData, titleAr: e.target.value })}
                      dir="rtl"
                      data-testid="input-title-ar"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "العنوان (إنجليزي) *" : "Title (English) *"}</Label>
                    <Input
                      value={formData.titleEn}
                      onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
                      dir="ltr"
                      data-testid="input-title-en"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "النص الفرعي (عربي)" : "Subtitle (Arabic)"}</Label>
                    <Input
                      value={formData.subtitleAr}
                      onChange={(e) => setFormData({ ...formData, subtitleAr: e.target.value })}
                      dir="rtl"
                      data-testid="input-subtitle-ar"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "النص الفرعي (إنجليزي)" : "Subtitle (English)"}</Label>
                    <Input
                      value={formData.subtitleEn}
                      onChange={(e) => setFormData({ ...formData, subtitleEn: e.target.value })}
                      dir="ltr"
                      data-testid="input-subtitle-en"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "نص الزر (عربي)" : "Button Text (Arabic)"}</Label>
                    <Input
                      value={formData.ctaTextAr}
                      onChange={(e) => setFormData({ ...formData, ctaTextAr: e.target.value })}
                      dir="rtl"
                      data-testid="input-cta-ar"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "نص الزر (إنجليزي)" : "Button Text (English)"}</Label>
                    <Input
                      value={formData.ctaTextEn}
                      onChange={(e) => setFormData({ ...formData, ctaTextEn: e.target.value })}
                      dir="ltr"
                      data-testid="input-cta-en"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "رابط الزر" : "Button Link"}</Label>
                    <Input
                      value={formData.ctaLink}
                      onChange={(e) => setFormData({ ...formData, ctaLink: e.target.value })}
                      dir="ltr"
                      placeholder="/"
                      data-testid="input-cta-link"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "الترتيب" : "Sort Order"}</Label>
                    <Input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                      data-testid="input-sort-order"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isActive === 1}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked ? 1 : 0 })}
                    data-testid="switch-active"
                  />
                  <Label>{language === "ar" ? "نشط" : "Active"}</Label>
                </div>

                <Button 
                  onClick={handleSubmit} 
                  className="w-full gap-2"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-slide"
                >
                  <Save className="w-4 h-4" />
                  {language === "ar" ? "حفظ" : "Save"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            {language === "ar" ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : slides.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Image className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {language === "ar" ? "لا توجد شرائح. أضف شريحة جديدة للبدء." : "No slides yet. Add a new slide to get started."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {slides.map((slide) => (
              <Card key={slide.id} className={slide.isActive === 0 ? "opacity-60" : ""} data-testid={`card-slide-${slide.id}`}>
                <CardContent className="p-4">
                  <div className="flex gap-4 items-center">
                    <div className="text-muted-foreground cursor-grab">
                      <GripVertical className="w-5 h-5" />
                    </div>
                    <img
                      src={slide.image}
                      alt={slide.titleAr}
                      className="w-32 h-20 object-cover rounded-md flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{language === "ar" ? slide.titleAr : slide.titleEn}</h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {language === "ar" ? slide.subtitleAr : slide.subtitleEn}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {language === "ar" ? "الترتيب:" : "Order:"} {slide.sortOrder}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleActive(slide)}
                        title={slide.isActive === 1 ? "Deactivate" : "Activate"}
                        data-testid={`button-toggle-${slide.id}`}
                      >
                        {slide.isActive === 1 ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(slide)}
                        data-testid={`button-edit-${slide.id}`}
                      >
                        {language === "ar" ? "تعديل" : "Edit"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => deleteMutation.mutate(slide.id)}
                        data-testid={`button-delete-${slide.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
