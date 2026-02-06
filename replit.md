# Overview

This project is an Arabic e-commerce platform named "العين لتجارة الحاسبات" (Al-Ain Computer Trading), specializing in computers and accessories. It's a full-stack web application designed for the Iraqi market, supporting right-to-left (RTL) Arabic. The platform enables customers to browse products, manage a shopping cart, complete orders with local payment methods, and receive email confirmations. Administrators can manage orders, upload product images, customize store settings, and utilize a comprehensive POS system. Key features include a PC builder with compatibility checks, a market analysis tool for component prices, and PWA/Android app capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions

The design prioritizes an RTL-first layout with Arabic-first content and Arabic numerals. It uses the Cairo font, a consistent spacing system, and a custom HSL-based color system optimized for light mode. The application is mobile-responsive and built upon Shadcn/ui and Radix UI components with Tailwind CSS.

## Technical Implementations

-   **Frontend**: React 18 with TypeScript and Vite, using Wouter for client-side routing. TanStack Query manages server state and caching.
-   **Backend**: Express.js with TypeScript, providing a RESTful API for products, categories, cart, and orders.
-   **Database**: PostgreSQL (Neon serverless) with Drizzle ORM for schema definition and operations.
-   **Authentication**: Session-based authentication for customers and administrators, using bcrypt for password hashing and PostgreSQL for session storage.
-   **Real-time Notifications**: WebSocket-based system for new order notifications to the admin dashboard.
-   **Email Notifications**: Automated, Arabic-formatted order confirmation emails via Gmail SMTP.
-   **Internationalization (i18n)**: `LanguageContext` for UI text translation, supporting Arabic and English with dynamic RTL/LTR adjustment. Language switcher button available on all pages including admin portal (via AdminNav), battery portal (dashboard, manage, POS, reports), and sales portal.
-   **Image Upload**: Admin functionality to upload product images directly to the server.
-   **Price Sync**: Automatic price synchronization with globaliraq.iq every 6 hours. Fetches prices via Shopify products.json API, matches by model codes, applies 5% markup, and updates database. Products tagged with badge 'جديد' are synced. Admin dashboard shows sync status with manual trigger button. Module: `server/price-sync.ts`.
-   **PWA**: Installable on mobile, offline support via service worker, push notifications, and custom app icons.
-   **Android App**: Packaged as a native Android APK using Capacitor.

## Feature Specifications

-   **Admin Settings System**: Customizable store information, theme, SEO, homepage/footer content, and shipping rules across six categories.
-   **Iraqi Market Features**: Dropdown for 18 Iraqi governorates, local payment methods (Cash on Delivery, ZainCash, QiCard), address format without postal codes, WhatsApp integration, and Iraqi Dinar (IQD) currency with Arabic-Indic numerals. Dynamic shipping costs and free shipping thresholds.
-   **Point of Sale (POS) System**: Admin page for walk-in customers with product search, cart management, customer info capture, multiple payment methods, discount application, receipt generation, and real-time stock validation.
-   **Sales Portal**: Separate authenticated system for sales staff with POS, inventory view, user management, and reporting capabilities. Features role-based permissions and separate session management.
-   **Sales Dashboard**: Unified reporting for online and walk-in orders with date range, order type, and payment method filtering, plus summary statistics.
-   **PC Builder**: Step-by-step component selection with real-time compatibility checks, power consumption, and price summary.
-   **Market Analysis Feature**: Public and admin views for tracking and updating prices of RAM, SSD, and M.2 components with trend indicators.
-   **Laptop Battery & AC Adapter Compatibility System**: Separate authenticated portal (/battery) for managing laptop batteries and AC adapters inventory with:
    - Separate authentication system (battery_users table, default: battery/battery123)
    - Two-way search: find products by serial number OR find compatible products by laptop model
    - Stock tracking with low-stock alerts (configurable thresholds)
    - **Battery Management**: Full CRUD for battery inventory with compatible laptops list, voltage, capacity, cells, three-tier pricing
    - **AC Adapter Management**: Full CRUD for AC adapters with:
      - Power specifications: input voltage, output voltage, amperage, wattage
      - Connector specifications: connector type, tip size, plug type
      - Compatible laptops list, stock tracking, three-tier pricing
      - Barcode generation with ADP- prefix
    - **Unified POS System**: Point-of-sale supporting both batteries and adapters with:
      - Product type toggle (Batteries/Adapters)
      - Mixed cart support (batteries + adapters in same sale)
      - Three-tier pricing (purchase, wholesale, selling)
      - Quantity controls with real-time stock validation
      - Percentage discount application
      - Multiple payment methods (Cash, Card, ZainCash)
      - Customer info capture (optional)
      - Receipt generation with sale number
      - Automatic stock deduction for both product types
    - **Sales Reports**: Analytics page with:
      - Period filters (Today, Last 7 Days, This Month, Custom date range)
      - Product type filter (All, Batteries, Adapters)
      - Separate statistics for battery sales and adapter sales
      - Daily breakdown with revenue per day
      - Payment methods breakdown
      - Full sales log table with filtering
    - **Backup/Restore**: JSON export/import for inventory data
      - Schema version 1.1 includes both batteries and adapters
      - Backward compatible with version 1.0 (batteries only)
      - Merge mode updates existing records by serial number
    - Routes: /battery/login, /battery (dashboard), /battery/manage, /battery/pos, /battery/reports
    - Dashboard displays stats for both batteries and adapters (types, units, low stock)

# External Dependencies

-   **Database & ORM**: Drizzle ORM (v0.39.1), @neondatabase/serverless (v0.10.4), drizzle-zod (v0.7.0).
-   **UI Component Libraries**: @radix-ui/, class-variance-authority, tailwindcss, lucide-react.
-   **State Management & Data Fetching**: @tanstack/react-query (v5.60.5).
-   **Form Management**: react-hook-form, zod.
-   **Routing**: wouter.
-   **Session Management**: express-session, connect-pg-simple.
-   **Email**: nodemailer.
-   **Payment Gateways**: ZainCash, QiCard.
-   **Replit-Specific Integrations**: @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner.