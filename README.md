🌐 **Language:** **English** | [Spanish Version](README.es.md)

🛒 Nova Store - High-Performance E-Commerce

[![View Live Project](https://img.shields.io/badge/🚀_View_Live_Project-007ACC?style=for-the-badge&logo=vercel&logoColor=white)](https://next-js-e-commerce-999.vercel.app)

Welcome to Nova Store! A modern, fast, and scalable e-commerce web application built with cutting-edge architecture using Next.js. The project simulates an exclusive clothing store integrating complex authentication flows, cloud data persistence, payment gateway integration, and automated testing.

🚀 Tech Stack & Architecture
This project was built following production-grade standards, prioritizing component decoupling and performance optimization:

Frontend: Next.js 15+ (App Router) leveraging React Server Components (RSC) for instant asynchronous rendering and optimized SEO.

Styling: Tailwind CSS featuring a minimalist, responsive design with smooth animations (ease-out).

Cloud Database: Aiven (PostgreSQL) ensuring robust data persistence for order history and user profiles.

API Layer: Local GraphQL using native fetch requests, optimizing data transfer and avoiding over-fetching.

Global State Management: Zustand for in-memory shopping cart management, achieving real-time updates without unnecessary re-renders.

Authentication: NextAuth.js securely integrated with Google OAuth and database-backed session storage.

Payment Gateway: Mercado Pago checkout and webhook/order-status paths are implemented for sandbox testing. Live production payments and marketplace commission splitting remain blocked until seller OAuth and the end-to-end payment flow are validated.

✨ Key Features
URL-Synchronized Search: Instant catalog filtering via Query Params (?search=...). Allows sharing pre-filtered search results organically.

Premium Skeleton Loaders: Animated loading states (animate-pulse) wrapped in <Suspense/> boundaries to enhance user-perceived speed and UX.

Wishlist: Independent, reactive persistence of user favorite products.

Dynamic Order History: An exclusive "My Orders" section protected by NextAuth that securely fetches and maps processed orders from Aiven.

## Service offering, current capabilities, and launch readiness

Mercado Pago is a **launch-critical service**, not an optional integration for the Argentine market. The repository contains Mercado Pago checkout, payment-status/webhook handling, and marketplace-fee calculation paths. **The current configuration deliberately blocks live production mode and live commission splitting until the full seller OAuth and payment flow is validated end to end**; treat this as sandbox implemented, production launch still blocked. Stripe Connect and PayPal Partner payment flows are also configured for sandbox testing, not advertised here as live-ready.

### What the application currently provides

| Area | Verified implementation | Important limit / status |
|---|---|---|
| Payments | Mercado Pago is the priority integration; checkout and webhook/order-status paths exist. Stripe and PayPal Connect flows also exist. | Payment-provider connections are shown as SANDBOX. Live marketplace payment splitting must be completed and validated before launch. |
| Catalog and inventory | Product catalog, variants, sizes/SKUs, stock management, catalog administration, configurable low-stock threshold and Telegram alert path. | This is one store's catalog, not separate catalogs for independently registered tenant stores. |
| Orders and customer accounts | Checkout, customer sign-in, Google OAuth configuration, saved delivery addresses, order history, cancellation workflow, order tracking and estimated delivery. | No self-service tenant/store creation or per-tenant team roles. |
| Shipping | Zipnova for Argentina, Shippo for international destinations, configurable pickup/local-rate options, and automatic selection of the cheapest home-delivery quote (with a faster option where available). | Real availability depends on credentials, carrier coverage and environment configuration; sandbox restrictions remain in place. |
| Transactional email | Brevo-based purchase confirmation, fulfillment/in-transit notices and delivery-estimate updates, with idempotency safeguards. | A verified sender and production Brevo credentials are required. |
| Operations and analytics | Admin dashboard, orders, inventory controls, low-stock alerts, visits/device metrics, conversion rate, average ticket, top products and completed-order revenue. | These are store-level metrics, not a multi-tenant SaaS analytics console. |
| Customer retention and trust | Persistent cart/wishlist, product reviews restricted to verified delivered purchases, bilingual Spanish/English interface, tax/currency handling and legal consumer-request workflow. | No built-in visual page builder or no-code store customization panel. |
| Rentals | Inventory reservations used in checkout. | **Not a complete rental product:** there is no rental calendar, start/end date availability, duration-based pricing or rental-contract workflow. |
| SaaS / hosting model | Configurable platform commission and payment-connection foundations exist. The dashboard can report a commission on completed orders. | **Not yet a complete multi-tenant SaaS:** no tenant isolation, merchant self-registration, custom domain per store, per-store feature quotas or automated subscription billing. The configured 10% is not proof that live commission collection is active. |
| Support | Contact, support/FAQ and legal-request pages. | No published service-level agreement (SLA) or dedicated ticketing/support plan. |

### Competitor benchmark (indicative public-price snapshot)

Prices below were reviewed on 2026-10-23 and are reference points, not guaranteed quotes. Promotions, taxes, annual billing, currency conversion and payment-processing charges can change the effective total. Check each provider's current pricing before using these figures commercially.

| Competitor | Public model / reference price | What it means when compared with this project |
|---|---|---|
| [Tiendanube](https://www.tiendanube.com/planes-y-precios) | Free entry plan; paid references around ARS 27,999 / 79,999 / 244,999 per month. Some plans add 2% / 1% / 0.7% platform fees for external payment methods. | Established local alternative with plan-gated features. This project brings together inventory, shipping workflows and transactional emails, but does not yet provide a live multi-tenant SaaS. |
| Empretienda | Around ARS 10,490 per month; no platform sales commission advertised. | Low fixed cost is a strong competitor. Team permissions are not equivalent to individual role-based accounts. |
| EmpreLink | Around ARS 9,500 / 17,999 / 29,999 per month. | Tier limits include administrators and product-media capabilities. |
| Protienda | Around ARS 16,900 / 35,900 / 62,900 per month. | Product-count limits vary by plan; a fixed fee can become cheaper than a percentage as sales grow. |
| Wendo | Around ARS 24,900 / 49,900 / 89,900 per month for published tiers. | Some plans limit monthly completed sales (for example, 100 / 300 / 800) and gate advanced marketing/analytics features. |
| [Jumpseller](https://jumpseller.com/pricing/) | Entry reference around ARS 10,800 per month equivalent with annual billing; higher tiers cost more. | No platform transaction fee is advertised, while advanced features are tiered. |
| [Shopify](https://www.shopify.com/pricing) | International reference around US$29 / US$79 / US$299 per month equivalent with annual billing. | Broad ecosystem and plan-based staff/features; external payment methods can add platform transaction fees. Regional pricing may differ. |
| [WooCommerce](https://woocommerce.com/pricing/) | Core software is free; hosting, paid extensions, implementation and maintenance are additional. | More control and ownership, but the merchant must budget for technical setup and ongoing operations. |
| [Booqable](https://booqable.com/pricing/) and rental-focused tools such as Alugable | Rental SaaS references start around US$29 per month; higher plans add capabilities. | Direct benchmarks for rental workflows, but this repository does not yet match their rental calendar and duration-pricing functionality. |
| Freelance / custom development | Public quote examples range roughly from US$500–900 for basic store setup to US$1,200–3,500+ for custom development and integrations. | One-time setup is not directly comparable to SaaS; hosting, maintenance, payment/shipping fees and future changes may cost extra. Scope varies widely. |

### What the 10% commission means in practice

A 10% fee with no monthly subscription is easy to explain and can be attractive to a new store with low sales, especially if it includes useful integrations and operational automation. It becomes expensive relative to fixed-price competitors as the store grows:

| Monthly store sales | 10% platform fee |
|---:|---:|
| ARS 100,000 | ARS 10,000 |
| ARS 300,000 | ARS 30,000 |
| ARS 500,000 | ARS 50,000 |
| ARS 1,000,000 | ARS 100,000 |

At ARS 100,000 in monthly sales, the fee is already similar to several entry-level monthly plans. At ARS 300,000, it exceeds many basic and mid-tier subscriptions; at ARS 500,000, it reaches ARS 50,000 before payment-processing fees. These are not like-for-like prices: a fixed subscription may charge payment fees separately, while a commission model may bundle software and operations.

**Commercial conclusion:** the 10% model is most defensible when there is no fixed monthly fee and the service delivers measurable value (Mercado Pago, reliable shipping selection/tracking, transactional email, inventory controls and operational support). It is not justified by the current code alone as a production-ready SaaS because live marketplace payments, tenant isolation, per-store domains, automated subscription billing and full rental workflows are still gaps. Before selling it as a hosted multi-store service, finish and validate those launch blockers. Consider a lower/decreasing commission, a monthly plan, or a commission cap for higher-volume stores.

🧪 QA & Automated Testing (Playwright)
The repository includes a robust, end-to-end (E2E) test suite designed using the Page Object Model (POM) pattern.

Testing Approach:
Maintainability: Strict separation of selectors and logical flows into independent classes (CatalogPage).

Environment-Agnostic: Dynamic configuration enabling test execution both locally on localhost and against hosted production domains (TEST_BASE_URL).

Route Interception: Workflow simulation via API response mocking (page.route) to isolate and test empty states or server errors.

To run the interactive test suite with a UI:

Bash
npx playwright test --ui
🛠️ Local Installation & Setup
To replicate this development environment locally, follow these steps:

Clone the repository:

Bash
git clone https://github.com/your-username/nova-store.git
cd nova-store
Install Node.js dependencies:

Bash
npm install
Configure environment variables:
Create a .env.local file in the root directory and add your credentials:

Fragmento de código
NEXT_PUBLIC_SITE_URL="http://localhost:3001"

# NextAuth Config

NEXTAUTH_SECRET="your_super_secure_production_secret"
NEXTAUTH_URL="http://localhost:3001"
GOOGLE_CLIENT_ID="your_google_console_client_id"
GOOGLE_CLIENT_SECRET="your_google_console_client_secret"

# Mercado Pago Sandbox

MERCADOPAGO_ACCESS_TOKEN="TEST-your-test-access-token"

# Aiven Database URL

DATABASE_URL="postgresql://user:password@aiven-host:port/dbname"
Start the development server:

Bash
npm run dev
