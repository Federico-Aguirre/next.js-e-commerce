# E-commerce Template Extension Guide

## Purpose

This repository is a reusable Next.js e-commerce starting point. It provides the application shell, internationalization, authentication, database tooling, testing, and replaceable commerce boundaries without assuming a specific store, catalog provider, payment processor, shipping service, or CMS.

## Replaceable configuration

`src/utils/StoreConfig.ts` is the small provider-neutral configuration surface for storefront identity and monetary presentation defaults.

Adapt `StoreConfig.name`, `StoreConfig.currency`, `StoreConfig.locale`, and `StoreConfig.currencyDisplay` for each project.

`formatStorePrice()` is presentation-only. It does not calculate taxes, discounts, shipping, payment totals, or inventory.

## Recommended boundaries

### Domain and persistence

Keep catalog, variants, inventory, cart, checkout, orders, and addresses in typed domain modules. Database schemas and repositories own persistence concerns; UI components consume domain contracts rather than database tables directly.

### Storefront

Pages and components own layout, interaction, accessibility, and localized presentation. They should not contain payment-provider SDK calls or database credentials.

### Commerce integrations

Payment, shipping, tax, search, analytics, CMS, and external catalog systems belong behind narrow provider-neutral interfaces. A deterministic fake adapter is preferred for development and tests.

### Authentication and authorization

Server-side commerce operations must authorize ownership for carts, addresses, and orders before reading or mutating user-specific records.

### Configuration and secrets

Environment variables belong in `src/lib/Env.ts`. Public configuration may use `NEXT_PUBLIC_*` only when intentionally browser-safe. Provider secrets remain server-only.

## Commerce integration ports

`src/commerce/contracts.ts` is the provider-neutral integration boundary for the commerce domain. It defines replaceable ports for catalog/cart/order persistence, checkout sessions, customer sessions, payments, shipping, tax, search, caching, and idempotency. Concrete providers must implement these contracts rather than being imported by pages or components.

`src/commerce/session.ts` is the server-only session boundary for the existing authenticated customer cookie. Ownership checks belong at the server/domain boundary, before customer-specific carts, addresses, checkout sessions, or orders are read or mutated.

`src/commerce/pricing.ts` contains pure server-side monetary calculations. Client state must not be treated as authoritative for prices, taxes, discounts, shipping, or order totals.

Checkout integrations should use an idempotency key for every order/payment attempt. The key is part of the normalized payment request and order contract so a concrete provider can implement safe retries without leaking provider-specific semantics into the storefront.

## Payment boundary

The base template exposes a provider-neutral payment contract: create a payment request from an immutable order total, return normalized status and provider reference, and keep provider-specific payloads inside the adapter.

Stripe, Mercado Pago, PayPal, or another provider must never become a prerequisite of the base template.

## Benchmark integration findings

The current official benchmark set converges on a server-first commerce architecture: Vercel Commerce uses Server Components, Server Actions, Suspense and optimistic UI while isolating provider code; Saleor Paper uses a server-first cart/checkout, BFF session boundary, explicit cache invalidation and an extensible payment registry; Vendure's Next.js starter covers accounts, addresses, orders, search facets, promotions, checkout and multi-currency; Medusa's DTC starter covers multi-region commerce, promotion codes, checkout, accounts, addresses and order management.

The reusable improvements implemented here are the provider-neutral equivalents of those boundaries rather than copies of any benchmark implementation: typed commerce repository ports, payment/shipping/tax/search/session/checkout/cache ports, explicit idempotency state, server-side ownership checks, and pure server-side money calculations. This keeps the existing Drizzle/PGlite direction and avoids adding a live commerce SDK or provider credentials.

## Database portability

Development and tests may use the existing local PGlite/Drizzle setup. Production can use PostgreSQL through the same domain and repository boundaries. Avoid unnecessary database-specific assumptions.

## Internationalization

User-visible text belongs in `src/locales/en.json` and `src/locales/es.json` (or additional configured locales). Commerce components should use the existing `next-intl` infrastructure instead of hard-coded storefront copy.

## Testing contract

Keep unit tests for pure domain helpers and validation, integration/component tests for catalog/cart/checkout behavior, and Playwright E2E tests for the critical buyer journey.

External providers should be mocked or replaced by deterministic local adapters. Tests should not require paid accounts, external API tokens, or live payment transactions.

## Adaptation checklist

When creating a real project from the template, replace generic store configuration, add project-specific catalog data, choose shipping/tax/payment adapters, configure production environment variables, and retain provider-neutral boundaries.

Do not copy provider SDK calls into pages or components. Keep integration-specific concerns behind the smallest possible adapter so providers can be substituted without redesigning the storefront.
