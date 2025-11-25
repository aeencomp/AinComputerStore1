# Overview

This is an Arabic e-commerce platform called "العين لتجارة الحاسبات" (Al-Ain Computer Trading) - a computer and accessories store. The application is a full-stack web application built with React on the frontend and Express.js on the backend, designed specifically for right-to-left (RTL) Arabic language support.

The platform enables customers to browse computer products (laptops, desktops, monitors, gaming accessories), add items to a shopping cart, complete checkout with customer information, and receive order confirmations via email. Administrators can manage orders through a password-protected dashboard. The design follows modern Arabic e-commerce patterns inspired by platforms like Noon and Souq, with a focus on clean product presentation and user-friendly navigation.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type safety
- Vite as the build tool and development server
- Single Page Application (SPA) with client-side routing using Wouter

**UI Component System**
- Shadcn/ui component library (New York style variant) with Radix UI primitives
- Tailwind CSS for styling with custom RTL configuration
- Custom design system with Arabic typography using Cairo font from Google Fonts
- Component-based architecture with reusable UI elements in `/client/src/components/ui/`

**State Management**
- TanStack Query (React Query) for server state management and caching
- Local React state for UI-specific state
- No global state management library (Redux/Zustand) - relying on React Query's cache

**Key Frontend Design Decisions**
- RTL-first layout: All components flow right-to-left with Tailwind's direction configuration
- Arabic-first content with Arabic numerals for prices
- Mobile-responsive design with breakpoints at 768px and 1024px
- Accessibility-focused with semantic HTML and ARIA attributes

## Backend Architecture

**Server Framework**
- Express.js with TypeScript
- Dual-mode setup: development (with Vite middleware) and production (static file serving)
- RESTful API design with `/api` prefix for all endpoints

**API Structure**
- `GET /api/products` - Retrieve all products or filter by category
- `GET /api/products/:id` - Retrieve single product details
- `GET /api/categories` - Retrieve available product categories
- `GET /api/cart` - Retrieve user's cart items (requires authentication, returns [] if not logged in)
- `POST /api/cart` - Add item to cart (requires authentication)
- `PATCH /api/cart/:id` - Update cart item quantity (requires authentication)
- `DELETE /api/cart/:id` - Remove item from cart (requires authentication)
- `DELETE /api/cart` - Clear entire cart (requires authentication)

**Data Layer**
- PostgreSQL database with Neon serverless driver for full persistence
- DrizzleStorage class implements the IStorage interface for all database operations
- Data models defined using Drizzle ORM schema in `/shared/schema.ts`

## Database Strategy

**Schema Design (Drizzle ORM)**
- `products` table: Stores product information with Arabic text fields, pricing, categories, images, specifications, and inventory
- `cart_items` table: Stores shopping cart state with userId, productId, and quantity - each user has their own cart
- `users` table: Stores user accounts with hashed passwords for authentication
- `orders` table: Stores completed orders linked to user accounts
- `store_settings` table: Stores configurable store information (name, contact, social links)
- `repair_tickets` table: Stores repair service tickets with customer info, device details, and status tracking

**Current State**
- PostgreSQL database (Neon serverless) with full data persistence
- DrizzleStorage class handles all database operations
- Session-based authentication with PostgreSQL session store
- User-specific shopping carts stored in database with userId foreign key
- Drizzle Kit configured for schema migrations via `npm run db:push`

## External Dependencies

**Database & ORM**
- Drizzle ORM v0.39.1 - Type-safe ORM with PostgreSQL dialect
- @neondatabase/serverless v0.10.4 - Neon PostgreSQL serverless driver
- drizzle-zod v0.7.0 - Zod schema generation from Drizzle schemas

**UI Component Libraries**
- @radix-ui/* (multiple packages) - Headless accessible UI primitives
- class-variance-authority - Component variant management
- tailwindcss - Utility-first CSS framework
- lucide-react - Icon library

**State Management & Data Fetching**
- @tanstack/react-query v5.60.5 - Async state management and caching

**Form Management**
- react-hook-form - Form state management (via @hookform/resolvers)
- zod - Schema validation

**Development Tools**
- Vite - Build tool and dev server
- TypeScript - Type safety
- tsx - TypeScript execution for Node.js
- esbuild - JavaScript bundler for production builds

**Routing**
- wouter - Lightweight client-side routing

**Session Management**
- express-session - Session middleware (prepared for future authentication)
- connect-pg-simple - PostgreSQL session store

**Image Assets**
- Local image storage in `/attached_assets/generated_images/`
- Product images referenced by filename in database schema

**Replit-Specific Integrations**
- @replit/vite-plugin-runtime-error-modal - Development error overlay
- @replit/vite-plugin-cartographer - Code navigation
- @replit/vite-plugin-dev-banner - Development banner (disabled in production)

## Authentication & Authorization

**Customer Authentication (Session-Based)**
- Full user registration and login system with bcrypt password hashing
- Required fields: name, email, phone number, password
- Session-based authentication using express-session with PostgreSQL store
- 30-day session cookie expiry, httpOnly cookies for security
- Authentication routes: POST /api/auth/register, /api/auth/login, /api/auth/logout, GET /api/auth/me
- Frontend pages: /login and /register with Arabic RTL forms
- Protected checkout: requires user authentication before placing orders
- User profile dropdown in header showing name and email when logged in
- Auto-fill customer information in checkout from authenticated user account
- Orders linked to user accounts via userId foreign key

**Admin Authentication**
- Password-protected admin panel (password: "admin123")
- Client-side authentication using localStorage
- Admin routes: /admin/login and /admin/dashboard
- Separate from customer authentication system

## Email Notifications

Order confirmation emails via Gmail SMTP:
- Automated emails sent after each successful order
- Arabic RTL HTML email template with complete order details
- Includes: order number, customer info, item list with IQD pricing, payment method
- Non-blocking: email failures are logged but don't break order creation
- Configured with nodemailer using GMAIL_USER and GMAIL_APP_PASSWORD secrets

## Design System Principles

**RTL-First Approach**
- All layouts, navigation, and text flow from right to left
- Shopping cart positioned in top-left (opposite of LTR conventions)
- Product grids read right-to-left

**Typography Hierarchy**
- Arabic font: Cairo (weights 400, 500, 600, 700)
- Arabic-Indic numerals for prices and quantities
- Scale: Hero (5xl-6xl), Sections (3xl-4xl), Products (xl-2xl), Body (base), Captions (sm)

**Spacing System**
- Tailwind units: 2, 3, 4, 6, 8, 12, 16
- Consistent padding and gaps across components
- Max-width container: 7xl (1280px)

**Color System**
- Custom HSL-based color tokens defined in CSS variables
- Light mode optimized (dark mode tokens present but not actively used)
- Primary color: Blue (199° 89% 55%)
- Neutral grays for backgrounds and borders