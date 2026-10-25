# Validation Checkpoints

This file records concrete checks against the current working tree. A checkpoint is reusable only when the files/configuration/tests in its scope have not changed since it passed.

## Credential and session security

- Date: 2026-10-21
- Scope: server-only database credential handling, NextAuth production secret validation, JWT session lifetime and refreshed authorization claims, repeatable security regression tests.
- `npm test -- --reporter=dot`: PASS (19 test files, 78 tests).
- `npx tsc --noEmit --pretty false`: PASS.
- ESLint on `src/lib/auth-options.ts`, `src/lib/auth/session-security.ts`, its test, `src/lib/prisma.ts`, and `src/lib/Env.ts`: PASS, no warnings.
- Oxfmt checks and `git diff --check`: PASS.
- Local `GET /api/auth/session`: HTTP 200 with valid JSON.
- Local `.next` scan: no exact match for current `DATABASE_URL` values in 71 generated files. The current public Vercel alias homepage and its 16 same-origin JavaScript bundles were also scanned without finding an exact match. Exact current local database URL values were not found in the 89 Git commits scanned; source maps, previews, and historical deployments were not audited.
- Historical config review: older commits did include `env: { DATABASE_URL: process.env.DATABASE_URL }`; current `next.config.ts` does not. Whether historical Vercel deployments published bundles built with that setting is NOT verified; review deployments and rotate the Aiven database credential if exposure cannot be ruled out.
- Production build, remote Vercel environment settings, historical deployment bundles, and a production login flow: NOT checked.

## Administrative endpoint and CORS security

- Date: 2026-10-21
- Scope: removal of the destructive seed HTTP route, owner-only Aiven read/wake operations, generic upstream errors, allowlisted credentialed CORS, anonymous auto-wake removal, and repeatable regression tests.
- `npm test -- --reporter=dot`: PASS (21 test files, 92 tests).
- `npx tsc --noEmit --pretty false`: PASS.
- ESLint on the scoped changed files: PASS with no warnings.
- Oxfmt checks and `git diff --check`: PASS.
- Aiven route tests mock the provider: no real Aiven status request or wake command was made.
- Production deployment and production CORS verification: NOT performed. If another web origin calls the API in production, explicitly configure its exact origin in `CORS_ALLOWED_ORIGINS`.
- Local HTTP smoke check: GET and POST /api/seed both return 404; GET /api/aiven-status without a session returns 401; untrusted Origin and preflight return 403 without CORS headers; allowlisted localhost Origin returns 401/204 with an exact ACAO value and credentials header. No authenticated wake request was sent.

## Cache Components migration, cookies, and storefront performance

- Date: 2026-10-21
- Scope: migration from `unstable_cache` to Next.js 16 Cache Components/`use cache`, request-safe partial prerendering, public catalog/review data cache, live inventory, invalidation, product-image headers, theme cookie, payment availability cache, and private no-store responses.
- `npm test -- --reporter=dot`: PASS (25 test files, 101 tests).
- `npx tsc --noEmit --pretty false`: PASS.
- Scoped ESLint for migration-related source/test/config files: PASS, zero errors and 14 existing `no-explicit-any` warnings (12 in the GraphQL resolver and 2 in checkout); no warnings in the new request-scope/theme/catalog cache code or its tests.
- Oxfmt check on 15 migration-related source/test/config files and `git diff --check`: PASS.
- `NODE_OPTIONS='--dns-result-order=ipv4first' npx next build`: PASS on Next.js 16.2.9 with Cache Components enabled; all 85 pages generated. The route report shows partial prerendering for pages (`◐`) and request-time rendering for API endpoints (`ƒ`).
- `src/lib/catalog/public-catalog.ts` now uses `'use cache'`, `cacheLife`, and `cacheTag`: public product metadata has 300s stale/revalidate with a 1h expiry; public review aggregates have 60s stale/revalidate with a 1h expiry. Dashboard catalog updates invalidate the product tag; successful reviews invalidate the review tag. SKU stock is still queried live and never cached.
- `cacheComponents: true` replaces legacy route-segment `dynamic`/`revalidate` declarations. Request-country tax/currency setup is inside `RequestScopedApp`, behind a root `Suspense` boundary; the homepage login banner awaits `searchParams` inside its own boundary; the footer and request-specific GET handlers use `connection()` as needed. The root theme is applied pre-paint from the `nova_theme` cookie via a `beforeInteractive` script, without reading request cookies in the root layout.
- Local HTTP smoke check from the preceding caching checkpoint: a product WebP returned HTTP 200 with `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`; anonymous `GET /api/account` returned HTTP 401 with `Cache-Control: private, no-store, max-age=0`.
- Other cache policy remains: inventory live; payment availability shared-cacheable for 30s; exchange/tax provider fetches cached for 24h; personal/account/order/catalog price/GraphQL/review API responses remain private and non-cacheable. Cart, wishlist, and analytics consent remain browser-local.
- Cache Components prerenders static shells and streams request-dependent content through suspense boundaries; request-specific currency/tax and user data are not placed in the shared catalog cache. No browser performance benchmark or production CDN measurement was run.
- Production build: PASS locally. Production deployment: NOT performed.

## Accessibility audit and fixes

- Date: 2026-10-21
- Scope: keyboard skip link and main-content targets; document language for Spanish/English routes; removal of nested main landmarks; visible focus outlines; reduced-motion preference; theme/locale-aware control names and pressed states; form live feedback; accessible product variant/size/rating controls; light-theme text and payment-link contrast; and automated axe coverage.
- `npm test -- --reporter=dot`: PASS (25 test files, 101 tests).
- `npx tsc --noEmit --pretty false`: PASS after the accessibility source and test changes.
- `npx playwright test tests/accessibility.spec.ts --reporter=line`: PASS (12 browser routes, zero axe violations reported for WCAG 2.0/2.1/2.2 A/AA and axe best-practice tags). The test also checks document language, a single skip target, and a visible h1. This automated sample is not a complete legal/conformance certification and does not replace manual keyboard, screen-reader, zoom/reflow, or payment-iframe testing.
- ESLint on the audited TS/TSX files: PASS with zero errors and 4 warnings in existing code paths (native `<img>` in cart; unused `cartTotal` and the state update in the checkout effect; unused `taxProfile` in Stripe checkout). The new accessibility component and spec introduce no lint errors.
- Oxfmt and `git diff --check`: PASS for the accessibility-related source/test/config/localization files.
- `axe-core` is a dev dependency and runs inside the existing Playwright/Chromium setup; no second browser-test framework was introduced. Repeat the scan with `npx playwright test tests/accessibility.spec.ts --reporter=line`.
- Deployment: NOT performed.

## Operational order lifecycle, shipping, and backup tooling

- Date: 2026-10-21
- Scope: checkout reservation expiry and payment reconciliation, atomic stock restoration, payment confirmation concurrency, email retries, shipment creation/tracking refresh and stale-creation monitoring, PostgreSQL backup/restore tooling, and repeatable regression tests.
- `npm test -- --reporter=dot`: PASS (18 test files, 72 tests). Rerun the suite with the same command.
- `npx tsc --noEmit --pretty false`: PASS.
- ESLint on the changed TypeScript/TSX sources and new tests: PASS, zero errors; 12 warnings remain for `no-explicit-any` in existing checkout/shipping provider payload paths.
- `npx oxfmt --check ...`: PASS for the scoped changed source/test files and `package.json`.
- `git diff --check` and `bash -n scripts/db-backup.sh scripts/db-restore.sh scripts/lib/postgres-connection.sh`: PASS.
- Repeatable backup/restore tests in Vitest: PASS, including fake `pg_dump`/`pg_restore`, checksum mismatch rejection, and explicit target-database confirmation. Script flow simulation is not a backup or restore against Aiven or another real database.
- Unauthenticated local request to `GET /api/cron/order-alerts`: HTTP 401, as expected.
- Production build, browser E2E tests, live provider APIs, real email delivery, and a real database restore: NOT run.
- The Cloudflare Worker is configured for `*/5 * * * *`; `/api/cron/order-alerts` is capped at 60 seconds. The schedule applies only after the Worker is deployed.
- Operational deployment still requires setting a strong matching `CRON_SECRET` in the app environment and Cloudflare Worker secrets, configuring `ALERTS_ENDPOINT_URL`, and separately enabling/verifying managed and off-site database backups.

## Latest targeted checkpoint

- Date: 2026-10-17
- Scope: support/help-center routes and their direct navigation/contact-page integration; AI documentation was separately checked for valid internal Markdown paths.
- ESLint for `src/app/[locale]/support/page.tsx`, `src/app/[locale]/contact/page.tsx`, `src/components/Header.tsx` and `src/components/Footer.tsx`: PASS.
- Local HTTP checks for `/support`, `/es/support` and `/contact`: HTTP 200.
- `git diff --check`: PASS.
- AI-document links and referenced source paths: PASS after the documentation audit.
- Full type-check, full unit test suite, E2E suite and production build: NOT run for this targeted change.

## Previous checkpoints

Older broad checks from before 2026-10-17 are historical only and must not be treated as proof that the current working tree passes. Re-run only the checks invalidated by the current task, but do not skip them by relying on a stale checkpoint.

## Invalidation rule

Invalidate a checkpoint when code, configuration, dependencies, environment handling or tests within its scope change. Update this file only with checks that actually completed successfully; distinguish targeted checks from full-suite validation.

## Brevo email integration checkpoint

- Date: 2026-10-17
- Scope: shared server-side Brevo sender, purchase-confirmation email, contact form, consumer withdrawal-request notifications, environment schema/example, and privacy-provider label.
- Vitest for `src/lib/email/brevo.test.ts` and `src/lib/orders/order-confirmation-email.test.ts`: PASS (2 files, 10 tests).
- TypeScript `npx tsc --noEmit --pretty false`: PASS.
- ESLint for all eight changed TypeScript/TSX source and test files: PASS.
- `git diff --check`: PASS.
- Outbound email sending uses Brevo only. The `resend` dependency and `RESEND_API_KEY` example are retained for inbound/receiving functionality; no Resend outbound sender remains in the modified code.
- Live Brevo delivery: NOT tested; no Brevo credentials were supplied. Tests mock network delivery.

## Local Brevo environment startup follow-up

- Date: 2026-10-17
- Root cause: duplicate empty `BREVO_API_KEY` and `BREVO_FROM_EMAIL` definitions at the end of the local `.env` overrode the configured earlier values. Removed only that trailing placeholder block; preserved the existing configured credentials and sender.
- Next.js environment schema import/validation after loading local env: PASS.
- Local `/api/auth/session`: HTTP 200, `application/json`, body parses as JSON.
- Local `/es`: HTTP 200.
- Live email delivery was not triggered during this environment-validation fix.

## Mercado Pago saved cards (sandbox)

- Date: 2026-10-22.
- Scope: web checkout carousel for saved cards / new card, explicit save opt-in, authenticated API routes for listing/saving/removing cards, and saved-card use in Orders and split Payments flows.
- `npm test -- --reporter=dot`: PASS (35 test files, 148 tests).
- `npm run check:types`: PASS after Prisma Client generation and web TypeScript check.
- Scoped ESLint on the eight saved-card/payment source and test files: PASS with no warnings after updating the save-card ref and CVV field effect.
- `npm run build`: PASS on Next.js 16.2.9 with Cache Components enabled; TypeScript finished and all 86 static pages generated. The new `/api/payment-methods/mercadopago` route appears in the build manifest.
- `cd ecommerce-mobile && npx tsc --noEmit`: PASS; `git diff --check`: PASS.
- `npx prisma migrate deploy`: PASS. Additive migration `20261022080000_saved_payment_methods` was applied to the database configured in the development environment.
- Tests use deterministic provider mocks. A real Mercado Pago saved-card round trip and payment have NOT been verified; do not interpret the automated tests as confirmation of provider-side transaction success. No live charges were attempted and no Vercel deployment was made.

## Stripe saved cards (sandbox)

- Date: 2026-10-22.
- Scope: checkout web card carousel, optional card saving, reuse of a saved Stripe PaymentMethod, card removal, user/account ownership checks, and synchronization after a verified successful PaymentIntent.
- `npm test -- --reporter=dot`: PASS (**39 test files, 162 tests**), including tests for Stripe card list/delete, opt-in to save, saved-card preparation, payment confirmation sync, and the checkout UI states.
- `npm run check:types`: PASS after Prisma Client generation. Scoped ESLint for the Stripe saved-card helper, routes, component, and tests: PASS. `npx oxfmt --write` completed on the 9 changed TS/TSX files; final `git diff --check` is recorded below.
- `NODE_OPTIONS='--dns-result-order=ipv4first' npm run build`: PASS on Next.js 16.2.9 with Cache Components; TypeScript and all 88 generated pages completed. The route manifest includes `/api/payment-methods/stripe` and `/api/stripe/prepare`.
- Prisma's read-only `SELECT 1` connection check passed after an initial transient Aiven connection timeout during a build attempt. No schema changes or new migration were needed; the generic saved-card tables from migration `20261022080000_saved_payment_methods` are reused.
- The integration is restricted to an active Stripe Connect **sandbox** configuration with a `sk_test_` secret. Tests mock Stripe provider responses. A real Stripe sandbox saved-card/payment round trip, browser E2E, live charges, and Vercel deployment were NOT performed.

## PayPal saved cards / Vault (sandbox)

- Date: 2026-10-22.
- Scope: web checkout saved-card carousel, explicit save opt-in, sandbox Vault customer/token storage and reconciliation, server-side card ownership checks, token removal, and safe handling of already-completed provider orders.
- `npm test -- --reporter=dot`: PASS (**43 test files, 188 tests**), including targeted tests for Vault request construction, account scope, masked metadata, listing/removal, checkout UI choices, captured-card persistence, user ownership and no duplicate capture for an already completed PayPal order.
- `npm run check:types`: PASS after Prisma Client generation. Scoped ESLint across PayPal helper/routes/checkout/UI/test files: PASS with no errors. `npx oxfmt --check` on the 12 scoped files and `git diff --check`: PASS.
- `NODE_OPTIONS='--dns-result-order=ipv4first' npm run build`: PASS on Next.js 16.2.9 with Cache Components; TypeScript finished and all 89 pages were generated. Manifest contains `/api/payment-methods/paypal` along with `/api/paypal/capture-order` and the existing PayPal checkout route.
- A read-only Prisma `SELECT 1` test passed after an earlier build attempt lost its Aiven connection while prerendering the home catalogue; the retry completed successfully. No schema migration was required; the existing saved-method tables are reused.
- The feature stays sandbox-only. The PayPal provider calls are mocked in automated tests; real Vault/card storage eligibility, an end-to-end sandbox purchase, live transactions, and a Vercel deployment were NOT tested. PayPal's published eligibility list for this saved-card integration does not include Argentina, so confirm the connected sandbox merchant and app actually have Vault/Advanced Checkout enabled before judging the feature by a card-saving attempt.

## Buy Now product checkout checkpoint

- Date: 2026-10-23.
- Scope: product-detail `Comprar ahora` / `Buy now` action, isolated checkout item state, provider selector route `/checkout/select`, and restoration of the ordinary cart on cancellation or successful payment.
- `npm test -- --reporter=dot`: PASS (**44 test files, 193 tests**), including five new store tests for the direct-buy state lifecycle.
- `npm run check:types`: PASS after Prisma Client generation.
- Scoped ESLint: PASS with zero errors; `src/app/cart/page.tsx` retains one existing `@next/next/no-img-element` warning for its current `<img>` element.
- `npx oxfmt --check` on the changed source, test, and translation files: PASS. `git diff --check`: PASS.
- `NODE_OPTIONS='--dns-result-order=ipv4first' npm run build`: PASS on Next.js 16.2.9 with Cache Components; the build generated 90 pages and includes `/checkout/select`.
- A real browser purchase/provider round-trip, live charges, and Vercel deployment: NOT run. No schema change or migration was required.

## PayPal add-new-card form mount fix

- Date: 2026-10-23.
- Root cause: when PayPal saved cards existed, `cardFieldsMounted` remained false; choosing `new` changed the selected payment method but never mounted PayPal's card iframes.
- Fix: selecting a new PayPal card now enables the deferred Card Fields mount. The pay button displays `Cargando formulario...` and stays disabled while fields are not ready, unless a provider/form error has been reported.
- Added a hook regression test for the actual state transition and a component test for the loading/ready button state. Existing Stripe and Mercado Pago tests also cover rendering their new-card forms.
- `npm test -- --reporter=dot`: PASS (**45 test files, 194 tests**).
- `npm run check:types`: PASS. Scoped ESLint: PASS. `npx oxfmt --check` on 10 provider files and tests: PASS. `git diff --check`: PASS.
- No payment-provider calls, live charges, or deployment were performed. The UI/form behavior is unit-tested; actual PayPal sandbox iframe rendering still needs browser verification.

## Saved-card checkbox default

- Date: 2026-10-23.
- Scope: the “Guardar esta tarjeta para futuras compras” checkbox now starts checked when a new card form is shown for Mercado Pago, Stripe, and PayPal. Choosing an already-saved card disables the save preference; opening a new-card form enables it again. Customers can still uncheck the box before paying. Removing the last selected saved card also restores the default for the new-card form.
- Targeted provider UI/hook tests: PASS (4 files, 13 tests).
- `npm test -- --reporter=dot`: PASS (45 test files, 194 tests).
- `npm run check:types`: PASS.
- Scoped ESLint: PASS. `npx oxfmt --check` on the 7 changed TS/TSX files: PASS. Scoped `git diff --check`: PASS.
- No real payment-provider calls, card vault operation, browser E2E, live charge, or deployment was performed. Before enabling this default for real customers, confirm the card-storage consent wording and default behavior against applicable requirements and each provider's terms.

## Checkout final total, shipping quotes, and provider amount

- Date: 2026-10-23.
- Scope: quote shipping before payment using the configured carrier/local options; customer selection in web and mobile checkout; server-signed 15-minute quote tokens bound to the authenticated buyer, cart and shipping address; server-side checks against tampering/stale prices; add shipping to the stored order total and provider payment total for Mercado Pago, Stripe and PayPal; separate subtotal, tax, products-with-tax, shipping and final total in checkout/history/purchase-confirmation email.
- `npm test -- --reporter=dot`: PASS (**47 test files, 199 tests**), including quote-signature/cart/address validation and checkout shipping summary tests.
- `npm run check:types`: PASS for web TypeScript after the final checkout UI update. `cd ecommerce-mobile && npx tsc --noEmit`: PASS after mobile checkout/cart changes.
- `npx oxfmt --check` for 26 changed web/mobile TypeScript/TSX files: PASS. `git diff --check`: PASS.
- Scoped ESLint command: PASS with zero errors. The repository ESLint config ignores the 4 mobile files, so the mobile app was type-checked/formatted separately. Remaining warnings were existing `no-explicit-any` warnings in the shipping carrier API parsing code.
- `NODE_OPTIONS='--dns-result-order=ipv4first' npm run build`: PASS on Next.js 16.2.9; all 91 static pages generated and `/api/checkout/shipping-quote` included.
- Additive migration `20261023090000_checkout_shipping_pricing` was applied to the configured development Aiven database via `npx prisma migrate deploy`; `npx prisma migrate status`: PASS, database schema up to date. It adds shipping amount/quote fields with defaults/nullability and does not rewrite existing order totals.
- The old hardcoded mobile shipping estimate was removed. Both mobile cart/checkout now use the shared signed quote and display/confirm the breakdown before redirecting to Mercado Pago. Their TypeScript check passed; native device/browser UI verification was not performed.
- Important scope limitations: no live or sandbox purchase was initiated; no payment provider charge/capture/refund was attempted; no real Zipnova/Shippo rate or shipment was requested in this validation; and no deployment was made. A checkout with no configured real carrier quote or local shipping option fails closed instead of inventing a shipping price. Provider processing fees remain merchant-side costs, not mislabeled as IVA or automatically added to the buyer total.

## Automatic cheapest delivery service selection

- Date: 2026-10-23.
- Scope: the checkout shipping quote endpoint now returns only the lowest delivery-to-address cost, compared after normalization to the store currency. Store pickup is excluded because it is not delivery to the customer's address. The signed quote token is issued only for this result; the signature version was incremented so earlier multi-option quote tokens are rejected and must be refreshed.
- Customer-facing web and mobile cart/checkout no longer render carrier radio buttons or selectable lists. They show one informational card identifying the automatically chosen carrier/service, shipping cost, and unchanged itemized final total; customers may refresh the quote but cannot choose a different carrier.
- `selectCheapestDeliveryQuote` unit tests: PASS (3 tests), covering mixed quote currencies normalized to store currency, free pickup exclusion, and empty availability. `CheckoutShippingSummary` UI tests verify the selected cheapest carrier is shown without a radio selector.
- `npm test -- --reporter=dot`: PASS (**48 test files, 202 tests**).
- `npm run check:types`: PASS. `cd ecommerce-mobile && npx tsc --noEmit`: PASS.
- Scoped ESLint: PASS with 0 errors; warnings are limited to the existing synchronous `setState` lint warning in the checkout HTTPS-origin guard and `no-explicit-any` warnings in carrier API parsing. The ESLint configuration ignores the mobile files; those were independently type-checked/formatted.
- `npx oxfmt --check` for changed web/mobile files: PASS. `git diff --check`: PASS. `NODE_OPTIONS='--dns-result-order=ipv4first' npm run build`: PASS; all 91 pages generated.
- No shipping quote API was called against a real carrier, no shipping label was purchased, no sandbox/live payment was attempted, and no deployment was performed.
