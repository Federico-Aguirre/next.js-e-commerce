# E-commerce Template Extension Guide

## Purpose

This repository is a reusable Next.js e-commerce starting point with a web storefront, an Expo mobile app, internationalization, authentication, PostgreSQL/Prisma persistence, testing, and replaceable commerce boundaries.

## Authentication

The web application uses NextAuth as the single browser authentication and session system. Do not create parallel browser cookies, custom JWT session helpers, or a second web login/logout flow.

The database `User.isAdmin` field is the source of truth for current administrative authorization. Protected server routes must validate the authenticated identity and authorization server-side.

The Expo app may use the dedicated mobile authentication endpoints under `src/app/api/auth/`. These exist for native-client interoperability and are separate from the browser UI flow.

## Replaceable boundaries

Keep catalog, variants, inventory, cart, checkout, orders, addresses, pricing, promotions, and payments behind typed domain or service boundaries. UI components should not own provider SDK calls or database credentials.

## Pricing and checkout

Server-side totals are authoritative. Client state is untrusted for prices, discounts, tax, shipping, stock, and final order totals. Payment/order attempts should use idempotency where supported.

## Configuration and secrets

Environment variables must be validated centrally through `src/lib/Env.ts`. Secrets remain server-only. Never commit or document real credentials.

## Internationalization

User-visible web strings belong in `src/locales/en.json`, `src/locales/es.json`, and any additional configured locale files. Use next-intl rather than hard-coded storefront copy.

## Testing

Prefer the smallest test level that proves the behavior. Use unit/integration tests for deterministic business logic and Playwright for critical browser flows. Do not require paid services or live payment transactions for normal tests.

## Template adaptation

When turning this into a concrete store, replace generic storefront configuration, add project catalog data, choose provider adapters, configure production environment variables, and preserve the provider-neutral boundaries.
