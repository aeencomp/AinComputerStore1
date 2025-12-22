# Design Guidelines: Laptop Battery Compatibility System

## Design Approach
**Design System Approach** using Material Design principles adapted for data-heavy management dashboards. Inspiration from Linear, Notion, and modern SaaS tools prioritizing clarity, efficiency, and eye comfort for extended use sessions.

---

## Core Design Principles
- **Breathing Room**: Generous whitespace between components
- **Soft Contrast**: Avoid harsh blacks; use soft grays for text and borders
- **Information Hierarchy**: Clear visual separation between primary and secondary data
- **Scannable Layouts**: Grid-based organization for quick data parsing

---

## Typography
**Primary Font**: Inter (Google Fonts) - optimized for screens, excellent readability

**Type Scale**:
- Dashboard Title: text-3xl font-semibold
- Section Headers: text-xl font-medium
- Card Titles: text-lg font-medium
- Body/Data: text-base font-normal
- Labels/Metadata: text-sm
- Captions: text-xs

**Hierarchy**: Use font weight and size variation, not color changes alone.

---

## Layout System
**Spacing Primitives**: Tailwind units of **3, 4, 6, 8, 12, 16, 20**

- Component padding: p-6, p-8
- Card spacing: p-6 for content, p-4 for headers
- Section gaps: gap-6, gap-8
- Page margins: px-6 md:px-8 lg:px-12
- Vertical rhythm: space-y-6, space-y-8

**Grid Structure**:
- Main layout: Sidebar (fixed 280px) + Content area (flex-1)
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3, gap-6
- Data tables: Full-width with max-w-7xl container

---

## Page Structure

### 1. Sidebar Navigation (Fixed Left, 280px)
- Logo area at top (h-16, centered)
- Navigation menu with icons:
  - Dashboard
  - Battery Search
  - Compatibility Check
  - Inventory
  - Reports
- Active state: Subtle background treatment
- User profile at bottom with settings icon

### 2. Top Header Bar (Sticky)
- Breadcrumb navigation (left side)
- Search bar (center, max-w-md): "Search batteries, models..."
- Notification bell + user avatar (right side)
- Height: h-16, subtle bottom border

### 3. Dashboard Main View
**Hero Stats Section**:
- Four-column stat cards (grid-cols-4, gap-6)
- Each card: Large number (text-4xl), label below (text-sm), small trend indicator
- Cards: rounded-xl, p-6, subtle shadow

**Compatibility Checker (Featured Component)**:
- Two-column form layout (lg:grid-cols-2, gap-6)
- Left: Laptop model input with autocomplete dropdown
- Right: Battery specifications display area
- "Check Compatibility" button (px-8 py-3, rounded-lg)
- Results display below in expandable card format

**Recent Searches Table**:
- Clean table with alternating row backgrounds
- Columns: Laptop Model | Battery Type | Compatibility | Date | Actions
- Row height: py-4 for comfortable scanning
- Action buttons: Icon-only (edit, delete) with tooltips

### 4. Battery Search Page
- Filter sidebar (left, 240px): Collapsible filter groups
- Results grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3, gap-6
- Battery cards:
  - Battery image placeholder (16:9 ratio)
  - Model number (text-lg font-medium)
  - Specifications list (text-sm, space-y-2)
  - Compatibility count badge
  - "View Details" button (full-width, outline style)

### 5. Inventory Management
- Data table with inline editing
- Bulk action toolbar (appears on row selection)
- Add new entry button (top-right, primary style)
- Export/Import buttons (secondary style)
- Pagination controls (bottom-center)

---

## Component Library

### Cards
- Border: 1px solid subtle gray
- Padding: p-6
- Rounded: rounded-xl
- Shadow: shadow-sm, hover:shadow-md transition

### Buttons
- Primary: rounded-lg, px-6 py-3, font-medium
- Secondary: Outline style, same padding
- Icon buttons: rounded-lg, p-2

### Form Inputs
- Border: 2px solid, rounded-lg
- Padding: px-4 py-3
- Focus: Border change with subtle glow
- Labels: Above input, text-sm font-medium, mb-2
- Helper text: Below input, text-xs

### Tables
- Header: Sticky, font-medium, text-sm, pb-3
- Rows: py-4 px-6, border-b
- Hover: Subtle background change
- Cell alignment: Left for text, right for numbers

### Badges/Tags
- Rounded: rounded-full
- Padding: px-3 py-1
- Size: text-xs font-medium
- Use for: Compatibility status, battery types, stock levels

### Modals/Dialogs
- Backdrop: Semi-transparent overlay
- Content: max-w-2xl, rounded-xl, p-8
- Header with close button
- Footer with action buttons (right-aligned)

---

## Images

### Logo Area
120px × 48px placeholder in sidebar top - simple rectangular border for easy replacement

### Battery Thumbnails
Product-style images (400×300px) with clean white backgrounds showing battery units clearly

### Empty States
Illustrations for:
- No search results (center of screen, max-w-md)
- Empty inventory table
- First-time user dashboard
Use simple line-art style, not photographs

**Note**: No large hero image needed - this is a data-focused dashboard where immediate utility trumps visual impact.

---

## Data Visualization
- Simple bar charts for battery type distribution
- Line graphs for inventory trends over time
- Use libraries via CDN (Chart.js or similar)
- Maintain soft color palette consistency

---

## Accessibility
- Minimum touch targets: 44×44px
- Clear focus indicators (2px outline)
- Keyboard navigation support for all interactive elements
- Loading skeletons for async data
- Toast notifications for success/error states (top-right position)
- Form validation messages inline below fields

---

## Mobile Optimization
- Sidebar collapses to hamburger menu
- Stat cards stack to single column
- Tables become scrollable horizontally or card-based vertically
- Filter sidebar becomes bottom sheet
- Sticky "Add" FAB button for quick actions