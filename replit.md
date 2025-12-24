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
-   **Internationalization (i18n)**: `LanguageContext` for UI text translation, supporting Arabic and English with dynamic RTL/LTR adjustment.
-   **Image Upload**: Admin functionality to upload product images directly to the server.
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
-   **Laptop Battery Compatibility System**: Separate authenticated portal (/battery) for managing laptop batteries inventory with:
    - Separate authentication system (battery_users table, default: battery/battery123)
    - Two-way search: find batteries by serial number OR find compatible batteries by laptop model
    - Stock tracking with low-stock alerts (configurable thresholds)
    - Full CRUD for battery inventory with compatible laptops list, voltage, capacity, pricing
    - **Battery POS System**: Dedicated point-of-sale for walk-in battery sales with:
      - Product search and quick add to cart
      - Three-tier pricing (purchase, wholesale, selling)
      - Quantity controls with real-time stock validation
      - Percentage discount application
      - Multiple payment methods (Cash, Card, ZainCash)
      - Customer info capture (optional)
      - Receipt generation with sale number
      - Automatic stock deduction on sale completion
    - Routes: /battery/login, /battery (dashboard), /battery/manage, /battery/pos

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