# Design Guidelines: العين لتجارة الحاسبات

## Design Approach
**Reference-Based E-commerce Approach** inspired by modern Arabic e-commerce leaders (Noon, Souq) combined with international best practices (Shopify, Amazon). Focus on clean product presentation, effortless navigation, and trust-building elements optimized for RTL (right-to-left) layout.

---

## RTL-Specific Considerations

### Layout Direction
- All layouts flow right-to-left
- Navigation positioned on right side
- Shopping cart icon in top-left corner
- Product grids read right-to-left
- Checkout flow progresses right-to-left

### Typography
- **Primary Font**: Cairo or Tajawal (Google Fonts) - modern, highly legible Arabic fonts
- **Headings**: Bold (700) for category titles and product names
- **Body Text**: Regular (400) for descriptions, Medium (500) for emphasis
- **Price Display**: Large, bold numerals using Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩)

**Type Scale**:
- Hero Headline: text-5xl md:text-6xl
- Section Titles: text-3xl md:text-4xl
- Product Names: text-xl md:text-2xl
- Body Text: text-base
- Captions/Labels: text-sm

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 3, 4, 6, 8, 12, 16**
- Component padding: p-4, p-6, p-8
- Section spacing: py-12, py-16, py-20
- Grid gaps: gap-4, gap-6, gap-8
- Button padding: px-6 py-3, px-8 py-4

**Container Strategy**:
- Max width: max-w-7xl for main content
- Full-width hero and category banners
- Consistent horizontal padding: px-4 md:px-6 lg:px-8

---

## Page Structure & Components

### 1. Header (Sticky)
- **Logo placeholder** (top-right): 120px × 60px rectangular area with border for easy replacement
- **Main Navigation** (horizontal): الرئيسية | أجهزة كمبيوتر | ملحقات | الشاشات | العروض
- **Search Bar** (prominent center): Full-width with icon, placeholder "ابحث عن المنتجات..."
- **Utility Icons** (top-left): Shopping cart with item count badge, user account icon
- **Trust Indicators**: Below navigation - "شحن مجاني" | "ضمان سنتين" | "خدمة العملاء 24/7"

### 2. Hero Section (Full-width banner)
- Height: 60vh on desktop, 50vh on mobile
- **Large Hero Image**: Showcase featured computers/gaming setups
- **Overlay Content** (right-aligned):
  - Headline: text-4xl md:text-6xl bold
  - Subheadline: text-xl md:text-2xl
  - CTA Button with blurred background backdrop: "تسوق الآن" (px-8 py-4)

### 3. Featured Categories (4-column grid)
- Grid: grid-cols-2 md:grid-cols-4, gap-6
- **Category Cards**: Image + title overlay, hover lift effect
- Categories: أجهزة كمبيوتر محمولة | أجهزة مكتبية | ملحقات الألعاب | شاشات

### 4. Product Grid (Main Section)
- **Section Header**: Category title + view all link
- Grid: grid-cols-2 md:grid-cols-3 lg:grid-cols-4, gap-6
- **Product Cards** (each):
  - Product image (square, 1:1 ratio)
  - Brand/Model name (text-lg font-bold)
  - Brief specs (text-sm, 2 lines)
  - Price (text-2xl font-bold) with old price crossed out if on sale
  - "أضف للسلة" button (full-width, px-4 py-3)
  - Wishlist icon (top-left of image)
  - Badge for "جديد" or "خصم ٢٠٪" (top-right of image)

### 5. Shopping Cart (Slide-over Panel)
- Slides from left side (RTL equivalent of right)
- **Header**: "سلة التسوق" with close button
- **Cart Items**: Product thumbnail + name + quantity controls + remove button
- **Summary Section** (bottom):
  - Subtotal, shipping, tax breakdown
  - Total (large, bold)
  - "إتمام الطلب" button (prominent, full-width)
  - "متابعة التسوق" link

### 6. Product Detail Page
- **Breadcrumb Navigation** (right-aligned)
- **Two-column layout**:
  - Right: Image gallery with thumbnails
  - Left: Product details, specs table, add to cart section
- **Specification Tabs**: المواصفات | التقييمات | أسئلة شائعة
- **Related Products** carousel at bottom

### 7. Footer (Comprehensive)
- **Four-column layout**:
  - Column 1: About, contact info, office hours
  - Column 2: روابط سريعة (Quick links)
  - Column 3: خدمة العملاء (Customer service)
  - Column 4: Newsletter signup + social media icons
- **Trust Badges**: Payment methods (Visa, Mastercard, Mada), security seals
- **Copyright**: Bottom strip with legal links

---

## Component Details

### Buttons
- Primary: Rounded corners (rounded-lg), bold text, px-6 py-3
- Secondary: Outline style with same padding
- Icon buttons: Square or rounded-full for cart/wishlist

### Input Fields
- Border: 2px solid, rounded-lg
- Padding: px-4 py-3
- Label: Above input, text-sm font-medium
- Focus: Visible border change, no color mentioned

### Cards
- Border: 1px solid or shadow-md
- Padding: p-4 or p-6
- Rounded: rounded-xl
- Hover: subtle shadow increase (shadow-lg)

### Badges
- Small rounded pills: rounded-full, px-3 py-1, text-xs font-bold
- Position: Absolute positioning on product images

---

## Images

### Hero Image
Large, high-quality banner (1920×800px) showing premium computer setup or gaming environment with products in use.

### Product Images
- Square format (600×600px minimum)
- Clean white backgrounds for consistency
- Multiple angles in gallery view

### Category Banners
Lifestyle images (800×400px) showing products in context - gaming setups, office environments, etc.

### Trust & Brand
Icons for payment methods, delivery trucks, warranty seals (SVG preferred, 48×48px)

---

## Accessibility & UX

- High contrast ratios for text readability
- Touch targets minimum 44×44px for mobile
- Clear focus states for keyboard navigation
- Loading states for cart updates
- Empty cart state with illustration + CTA
- Error messages inline with form fields
- Success confirmations for cart additions (toast notifications)

---

## Mobile Optimization

- Stack product grids to 2 columns
- Hamburger menu for navigation
- Bottom sticky bar with cart access
- Simplified filters (collapsible)
- Swipeable product galleries
- Floating "Add to Cart" button on product pages