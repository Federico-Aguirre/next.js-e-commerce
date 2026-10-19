# E-Commerce Domain Rules

## Purpose

This repository runs a localized web storefront with customer accounts, catalog/variants/SKU inventory, carts, order history, admin fulfillment controls and payment/shipping integrations. It also contains an Expo mobile client. Use this file for cross-cutting commerce invariants; consult the relevant skill for implementation details.

## Identity and catalog

- Inspect `prisma/schema.prisma` and the relevant adapter before changing product IDs, variant IDs, SKU/article IDs, cart lines or order items. These identifiers are not interchangeable.
- Inventory is SKU/article-specific (including variant/size); a product-level UI count does not prove that a particular SKU can be purchased.
- Keep catalog query normalization/pagination in the existing domain helpers where appropriate. Bound list queries and inspect actual data sources before assuming the richer provider-neutral catalog types match Prisma records.

## Cart, pricing and checkout

- Client cart/wishlist stores improve the user experience. Their contents, prices, quantities and stock information are untrusted at every server boundary.
- Recalculate prices, discount, stock, shipping and final order totals on the server. Use explicit currency and consistent rounding.
- Preserve stock reservation, release/restoration and checkout idempotency when changing checkout, cancellation or retries.
- Do not introduce a second cart state/persistence solution without checking the existing Zustand stores, synchronizers and checkout payload consumers.
- Do not infer a successful payment from a redirect or client-side flag; verify on the trusted server/provider path.

## Orders and delivery

- Treat payment state and fulfillment state as separate dimensions. A paid order can still await preparation; shipping/delivery transitions do not prove payment.
- After an order's payment is authoritatively confirmed as `PAID`, send the customer a purchase-confirmation email using the shared server-side Brevo service. The email must use the persisted order summary and stable `orderNumber`; delivery must be idempotent and retryable. Do not trigger it from client-supplied payment state, and do not roll back an approved order if email delivery fails.
- Customer reads and mutations must verify order ownership server-side. A route parameter or request body order ID is not authorization.
- Keep the human-facing stable order number separate from the internal order UUID.
- Delivery details saved onto an order are a snapshot; editing a customer's profile later must not silently rewrite an existing shipment destination.
- Keep order item title/price/quantity/size/image snapshots stable even if the live catalog changes.
- Cancellation, stock restoration, provider void/refund and order-state transitions must be safe against retries and partial failures.

## Authentication and administration

- NextAuth is the browser session system. The database is authoritative for current `isAdmin` and `isPlatformOwner` permissions.
- Admin access and platform-owner payment-connection access are separate. Protected reads/actions must check authorization on the server, not just hide navigation.
- Native authentication may use the dedicated API endpoints; keep those contracts compatible with the Expo app.

## Environment and integrations

- Environment variables must follow the validated configuration pattern in `src/lib/Env.ts`; inspect the existing code when a legacy integration still reads `process.env` directly.
- Payment providers and shipping providers use separate contracts, credentials, response shapes and failure semantics. Consult their specific skills before editing.
- Never expose credentials, personal data, payment tokens or full card data in logs, browser bundles, error responses or AI documentation.

## Internationalization and testing

- User-visible web copy belongs in all supported next-intl dictionaries and routes must preserve the configured locale behavior.
- Prefer focused unit tests for deterministic domain rules and Playwright for critical browser flows. Do not require a real payment or a paid external service for routine validation.
