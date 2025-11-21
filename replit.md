# Overview

This is an Arabic e-commerce platform called "العين لتجارة الحاسبات" (Al-Ain Computer Trading) - a computer and accessories store. The application is a full-stack web application built with React on the frontend and Express.js on the backend, designed specifically for right-to-left (RTL) Arabic language support.

The platform enables customers to browse computer products (laptops, desktops, monitors, gaming accessories), add items to a shopping cart, and view product details. The design follows modern Arabic e-commerce patterns inspired by platforms like Noon and Souq, with a focus on clean product presentation and user-friendly navigation.

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
- `GET /api/cart` - Retrieve cart items with product details
- `POST /api/cart` - Add item to cart
- `PATCH /api/cart/:id` - Update cart item quantity
- `DELETE /api/cart/:id` - Remove item from cart
- `DELETE /api/cart` - Clear entire cart

**Data Layer**
- Currently using in-memory storage (`MemStorage` class) for development/prototyping
- Designed with interface-based abstraction (`IStorage`) to enable easy database migration
- Data models defined using Drizzle ORM schema for future PostgreSQL integration

## Database Strategy

**Schema Design (Drizzle ORM)**
- `products` table: Stores product information with Arabic text fields, pricing, categories, images, specifications, and inventory
- `cart_items` table: Stores shopping cart state with product references and quantities

**Current vs. Planned State**
- Current: In-memory storage with seed data for rapid development
- Planned: PostgreSQL database with Neon serverless driver
- Drizzle Kit configured for schema migrations in `/migrations` directory
- Connection ready via `DATABASE_URL` environment variable

**Rationale for In-Memory Storage**
- Enables rapid prototyping without database setup
- Easy to seed with sample data for UI development
- Clean migration path via the `IStorage` interface abstraction

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

Not currently implemented. The application is configured for future session-based authentication with:
- Express session middleware prepared in dependencies
- PostgreSQL session store (connect-pg-simple) ready for use
- No current user authentication or authorization logic

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