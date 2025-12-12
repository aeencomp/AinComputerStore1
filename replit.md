# Overview

This project is an Arabic e-commerce platform named "العين لتجارة الحاسبات" (Al-Ain Computer Trading), specializing in computers and accessories. It's a full-stack web application with a React frontend and an Express.js backend, designed for right-to-left (RTL) Arabic language support. The platform allows customers to browse products, manage a shopping cart, complete orders, and receive email confirmations. Administrators can manage orders through a dedicated dashboard. The design is inspired by popular Arabic e-commerce sites, emphasizing clean product presentation and user-friendly navigation.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend

The frontend uses React 18 with TypeScript and Vite. It's a Single Page Application (SPA) with client-side routing via Wouter. Styling is handled by Tailwind CSS with a custom RTL configuration, built upon Shadcn/ui and Radix UI components. State management primarily uses TanStack Query for server state and caching, avoiding global state libraries. A key design principle is an RTL-first layout, Arabic-first content with Arabic numerals, and mobile responsiveness.

## Backend

The backend is built with Express.js and TypeScript, operating in dual-mode for development and production. It exposes a RESTful API with endpoints for products, categories, cart management, and user orders.

## Database Strategy

A PostgreSQL database, utilizing Neon serverless, provides full data persistence. Drizzle ORM is used for schema definition and database operations, with a schema that includes `products`, `cart_items`, `users`, `orders`, `store_settings`, and `repair_tickets` tables. Session-based authentication is implemented with a PostgreSQL session store, and user-specific shopping carts are stored in the database.

## Authentication & Authorization

The platform features separate session-based authentication systems for customers and administrators, both utilizing bcrypt for password hashing and PostgreSQL for session storage. Customer authentication enables user registration, login, protected checkout, and order history. Admin authentication provides access to a protected dashboard for managing orders and other administrative tasks, including user management.

## Real-Time Admin Notifications

A WebSocket-based system provides real-time new order notifications to the admin dashboard, including a notification bell and popover with order details.

## Email Notifications

Automated order confirmation emails are sent via Gmail SMTP after each successful order. These emails are in Arabic, RTL formatted, and include complete order details.

## Design System

The design system prioritizes an RTL-first approach, using the Cairo font for Arabic typography. It employs a consistent spacing system based on Tailwind units and a custom HSL-based color system, optimized for light mode.

## Internationalization (i18n)

A `LanguageContext` provides translation functionality for all UI text, supporting template interpolation. Store settings store bilingual content (Arabic/English), and a language toggle allows users to switch between Arabic and English, automatically adjusting RTL/LTR direction.

## Admin Settings System

A comprehensive admin settings system allows customization across six categories: Store information, Theme, SEO, Homepage content, Footer content (including dynamic link groups), and Shipping rules. These settings dynamically influence the frontend display.

## Iraqi Market Features

Specific features for the Iraqi market include a dropdown selector for 18 Iraqi governorates, local payment methods (Cash on Delivery, ZainCash, QiCard), an address format replacing postal codes with Neighborhood/Area fields, WhatsApp integration, and the use of Iraqi Dinar (IQD) currency with Arabic-Indic numerals. Dynamic shipping costs and free shipping thresholds are also configurable.

## Zain Cash Payment Integration

Full integration with ZainCash payment gateway for Iraqi Dinar (IQD) transactions:

**Backend Implementation (`server/zaincash.ts`):**
- JWT-based transaction initialization with ZainCash API
- Supports both test and production environments
- Transaction verification via callback tokens
- Status checking for pending transactions

**API Routes:**
- `GET /api/zaincash/config` - Check if ZainCash is configured
- `POST /api/zaincash/init` - Initialize payment for an order
- `GET /api/zaincash/callback` - Handle ZainCash redirect after payment
- `GET /api/zaincash/status/:orderNumber` - Check payment status

**Frontend Flow:**
1. Customer selects ZainCash at checkout
2. Order is created with status "awaiting_payment"
3. Customer is redirected to ZainCash payment page
4. After payment, callback redirects to `/payment/zaincash/callback`
5. Order status updated based on payment result

**Required Environment Variables:**
- `ZAINCASH_MERCHANT_ID` - Merchant ID from ZainCash
- `ZAINCASH_MSISDN` - Wallet phone number (format: 9647XXXXXXXXX)
- `ZAINCASH_SECRET` - Secret key for JWT encoding
- `ZAINCASH_TEST_MODE` - Set to "true" for test environment

**Database Fields:**
- `orders.paymentStatus` - Payment status (pending, success, failed)
- `orders.zaincashTransactionId` - ZainCash transaction ID

## QiCard Payment Integration

Full integration with QiCard payment gateway for card payments in Iraqi Dinar (IQD):

**Backend Implementation (`server/qicard.ts`):**
- REST API-based payment initialization
- Supports both test and production environments
- Payment verification via transaction ID
- Webhook support for real-time payment notifications

**API Routes:**
- `GET /api/qicard/config` - Check if QiCard is configured
- `POST /api/qicard/init` - Initialize payment for an order
- `GET /api/qicard/callback` - Handle QiCard redirect after payment
- `POST /api/qicard/webhook` - Receive server-to-server payment notifications
- `GET /api/qicard/status/:orderNumber` - Check payment status

**Frontend Flow:**
1. Customer selects QiCard at checkout
2. Order is created with status "awaiting_payment"
3. Customer is redirected to QiCard payment page
4. After payment, callback redirects to `/payment/qicard/callback`
5. Order status updated based on payment result

**Required Environment Variables:**
- `QICARD_MERCHANT_ID` - Merchant ID from QiCard
- `QICARD_API_KEY` - API key for authentication
- `QICARD_SECRET_KEY` - Secret key for API requests
- `QICARD_TEST_MODE` - Set to "false" for production (default is test mode)

**Database Fields:**
- `orders.paymentStatus` - Payment status (pending, success, failed)
- `orders.qicardTransactionId` - QiCard transaction ID

## PC Builder Feature

A step-by-step PC builder allows users to select components (CPU, Motherboard, RAM, GPU, Storage, PSU, Case, Cooler) with real-time compatibility checking. A sidebar displays a live-updating build summary, including total power consumption, recommended PSU wattage, and total price.

## Market Analysis Feature

A market price tracking system for RAM, SSD, and M.2 storage components with daily price updates and trend analysis:

**Public View (`/market-analysis`):**
- Tab-based navigation for RAM, SSD, and M.2 component types
- Price cards showing brand, model, capacity, and current price
- Price change indicators (green up arrow, red down arrow, neutral dash)
- Last updated timestamps for each price entry
- Full bilingual support (Arabic/English) with RTL layout

**Admin Management (`/admin/market-prices`):**
- Form to add new price entries with component type, brand, model, capacity, current/previous prices
- Table view of all prices with edit and delete actions
- Automatic previous price tracking when updating current prices
- Protected by admin session authentication

**API Routes:**
- `GET /api/market-prices` - Get all prices (optional `type` filter for ram/ssd/m2)
- `POST /api/market-prices` - Add new price (admin only)
- `PUT /api/market-prices/:id` - Update price (admin only)
- `DELETE /api/market-prices/:id` - Delete price (admin only)

**Database Schema (`market_prices` table):**
- `id` - Serial primary key
- `componentType` - Enum: "ram", "ssd", "m2"
- `brand` - Brand name (e.g., "Kingston", "Samsung")
- `model` - Model name (e.g., "Fury Beast DDR4")
- `capacity` - Storage capacity (e.g., "16GB", "1TB")
- `currentPrice` - Current price in IQD
- `previousPrice` - Previous price for trend calculation
- `priceDate` - Date of latest price update
- `nameAr` / `nameEn` - Bilingual display names

## Progressive Web App (PWA)

The application is a fully-featured PWA that can be installed on mobile devices:

**Features:**
- Installable on Android/iOS home screens
- Offline support via service worker
- Push notification support
- App-like experience with standalone display mode
- Custom app icons (72x72 to 512x512)
- Splash screen with theme color

**Files:**
- `client/public/manifest.json` - Web app manifest
- `client/public/sw.js` - Service worker for caching
- `client/public/icons/` - App icons in various sizes
- `client/src/components/PWAInstallPrompt.tsx` - Install prompt component

**Service Worker Caching Strategy:**
- Static assets: Cache first
- API calls: Network first with fallback
- Images: Cache first with network fallback

## Android App (Capacitor)

The app can be packaged as a native Android APK using Capacitor:

**Configuration:**
- `capacitor.config.ts` - Capacitor configuration
- Package ID: `com.alain.computers`
- Target SDK: 34 (Android 14)
- Min SDK: 22 (Android 5.1)

**Build Instructions:**
See `android/README.md` for detailed build instructions.

**Quick Build Steps:**
1. `npm run build` - Build web app
2. `npx cap add android` - Initialize Android project
3. `npx cap copy android` - Copy web assets
4. `npx cap sync android` - Sync plugins
5. `npx cap open android` - Open in Android Studio
6. Build APK in Android Studio

**Plugins:**
- `@capacitor/splash-screen` - Custom splash screen
- `@capacitor/status-bar` - Status bar styling
- `@capacitor/app` - App lifecycle management

# External Dependencies

## Database & ORM

-   **Drizzle ORM v0.39.1**: Type-safe ORM for PostgreSQL.
-   **@neondatabase/serverless v0.10.4**: Neon PostgreSQL serverless driver.
-   **drizzle-zod v0.7.0**: Zod schema generation from Drizzle schemas.

## UI Component Libraries

-   **@radix-ui/**: Headless accessible UI primitives.
-   **class-variance-authority**: Component variant management.
-   **tailwindcss**: Utility-first CSS framework.
-   **lucide-react**: Icon library.

## State Management & Data Fetching

-   **@tanstack/react-query v5.60.5**: Async state management and caching.

## Form Management

-   **react-hook-form**: Form state management.
-   **zod**: Schema validation.

## Routing

-   **wouter**: Lightweight client-side routing.

## Session Management

-   **express-session**: Session middleware.
-   **connect-pg-simple**: PostgreSQL session store.

## Email

-   **nodemailer**: For sending email notifications.

## Replit-Specific Integrations

-   **@replit/vite-plugin-runtime-error-modal**
-   **@replit/vite-plugin-cartographer**
-   **@replit/vite-plugin-dev-banner**