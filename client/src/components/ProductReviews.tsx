import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Star, Loader2, MessageSquare } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ProductReview } from "@shared/schema";

interface ProductReviewsProps {
  productId: string;
}

const reviewSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

export function ProductReviews({ productId }: ProductReviewsProps) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      customerName: "",
      rating: 0,
      comment: "",
    },
  });

  const selectedRating = form.watch("rating");

  const { data: reviews = [], isLoading } = useQuery<ProductReview[]>({
    queryKey: ['/api/products', productId, 'reviews'],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/reviews`);
      return res.json();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: ReviewFormData) => {
      return apiRequest('POST', `/api/products/${productId}/reviews`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products', productId, 'reviews'] });
      toast({
        title: language === 'ar' ? "شكراً لك!" : "Thank you!",
        description: language === 'ar' 
          ? "تم إرسال تقييمك وسيتم نشره بعد الموافقة"
          : "Your review has been submitted and will be published after approval",
      });
      setShowForm(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل في إرسال التقييم" : "Failed to submit review",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ReviewFormData) => {
    if (data.rating < 1) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "يرجى اختيار تقييم" : "Please select a rating",
        variant: "destructive",
      });
      return;
    }
    submitMutation.mutate(data);
  };

  const renderStars = (rating: number, interactive = false) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            className={interactive ? "cursor-pointer" : "cursor-default"}
            onClick={() => interactive && form.setValue("rating", star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            data-testid={interactive ? `button-star-${star}` : undefined}
          >
            <Star
              className={`w-6 h-6 transition-colors ${
                star <= (interactive ? (hoverRating || selectedRating) : rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <section className="mt-12 border-t pt-8" data-testid="section-reviews">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="text-reviews-title">
            <MessageSquare className="h-6 w-6" />
            {language === 'ar' ? 'تقييمات العملاء' : 'Customer Reviews'}
          </h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              {renderStars(Math.round(averageRating))}
              <span className="text-muted-foreground">
                ({reviews.length} {language === 'ar' ? 'تقييم' : 'reviews'})
              </span>
            </div>
          )}
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} data-testid="button-write-review">
            {language === 'ar' ? 'اكتب تقييمك' : 'Write a Review'}
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'اكتب تقييمك' : 'Write Your Review'}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'الاسم' : 'Name'}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder={language === 'ar' ? 'اسمك' : 'Your name'}
                          data-testid="input-review-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rating"
                  render={() => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'التقييم' : 'Rating'}</FormLabel>
                      <FormControl>
                        {renderStars(selectedRating, true)}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'تعليقك (اختياري)' : 'Comment (optional)'}</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder={language === 'ar' ? 'شاركنا تجربتك...' : 'Share your experience...'}
                          rows={4}
                          data-testid="input-review-comment"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button type="submit" disabled={submitMutation.isPending} data-testid="button-submit-review">
                    {submitMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                    {language === 'ar' ? 'إرسال التقييم' : 'Submit Review'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowForm(false);
                      form.reset();
                    }}
                    data-testid="button-cancel-review"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {language === 'ar' 
            ? 'لا توجد تقييمات حتى الآن. كن أول من يقيم هذا المنتج!'
            : 'No reviews yet. Be the first to review this product!'}
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id} data-testid={`card-review-${review.id}`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{review.customerName}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                    {renderStars(review.rating)}
                  </div>
                </div>
                {review.comment && (
                  <p className="mt-3 text-muted-foreground">{review.comment}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
