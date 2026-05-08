# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Production domain: `https://store.advize.in`

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 + Fastify-logger (pino)
- **Database**: Firebase Firestore (via Firebase Admin SDK)
- **Storage**: Firebase Storage (product images, logos)
- **Auth**: Firebase Auth (email/password) + email OTP signup verification via SMTP
- **Build**: esbuild

## Artifacts

### Shop (artifacts/shop) — previewPath: /
Merchant dashboard + public storefront. Mobile-first, fully responsive (desktop-optimized since May 2026).

**Architecture:**
- React + Vite + Wouter (routing)
- Tailwind CSS + shadcn/ui
- Firebase client SDK for auth
- All data fetched from API server (`/api/*`)

**Routing:**
- `/` — Landing page
- `/login` — Sign in (2-column desktop layout)
- `/signup` — Sign up with OTP email verification (2-column desktop layout)
- `/onboarding` — 3-step store setup wizard
- `/dashboard` — Merchant dashboard (sidebar nav on desktop, bottom tabs on mobile)
- `/store/:slug` — Public storefront (customer-facing)
- `/cart/:slug` — Cart / order checkout
- `/terms` — Terms & Conditions

**Dashboard panels (DashboardPage.tsx):**
- HomePanel — stats cards, order summary, quick share
- MyStorePanel — store settings, branding, WhatsApp
- ListingsPanel — product CRUD
- PluginsPanel — Razorpay integration

**Storefront features:**
- Product grid (2 cols mobile → 4 cols desktop)
- Trending auto-scroll section
- Category filter pills
- Price sort
- Search
- Customer reviews
- WhatsApp order → CartPage

### API Server (artifacts/api-server) — port: 8080
Express REST API with Firebase Admin SDK.

**Routes:**
- `GET/POST /api/stores` — store CRUD
- `GET /api/products` — products for a store
- `GET /api/analytics/:store_id` — analytics events
- `GET /api/reviews` — product reviews
- `POST /api/orders` — create order (fires WhatsApp redirect)
- `GET /api/orders/store/:store_id` — orders for a store (auth required)
- `PATCH /api/orders/:id/status` — update order status (auth required)
- `POST /api/otp/send`, `POST /api/otp/verify` — email OTP via SMTP

**Middleware:**
- `verifyToken` — validates Firebase ID token from Authorization header

## Store URL Format
`https://store.advize.in/store/{slug}` (path-based, not subdomain)

## Key Env Secrets
- `FIREBASE_PRIVATE_KEY`, `VITE_FIREBASE_*` — Firebase config
- `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — Email OTP sending

## Key Commands
- `pnpm --filter @workspace/shop run dev` — frontend dev server
- `pnpm --filter @workspace/api-server run dev` — API server
- `pnpm run typecheck` — full typecheck across all packages
