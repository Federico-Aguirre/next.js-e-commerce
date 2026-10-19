---
name: catalog-inventory-dashboard
description: Product catalog, variants and SKU inventory, stock alerts, store administration, and dashboard metrics.
---

# Catalog, Inventory, and Dashboard

Use this skill when changing product listings/details, product/variant/SKU relationships, stock availability, catalog controls, stock alerts, admin dashboard metrics, or store analytics displayed in the dashboard.

## Relevant code

- Product pages: `src/app/[locale]/products/`, `src/app/[locale]/products/[slug]/`, and `src/components/ProductCatalog.tsx`.
- Product seed/data and catalog domain: `src/data/products.ts`, `src/commerce/catalog.ts`, `src/commerce/catalog-domain.ts`, `src/commerce/nova-adapter.ts`, and `src/commerce/contracts.ts`.
- Prisma product models: `Product`, `ProductVariant`, `VariantImage`, and `ProductSku` in `prisma/schema.prisma`.
- Cart and favorites: `src/store/useCartStore.ts`, `src/store/useWishlistStore.ts`, plus the existing synchronizers in `src/components/`.
- Inventory/checkout reservation logic: `src/lib/checkout/inventory.ts` and `src/app/api/checkout/route.ts`.
- Dashboard access/data/actions: `src/app/[locale]/dashboard/page.tsx`, `data.ts`, `actions.ts`, and nearby client/row components.
- Visit/device analytics: `src/app/api/analytics/visit/route.ts`, `src/providers/PostHogProvider.tsx`, and `AnalyticsVisit` in the Prisma schema.
- Stock notification logic: `src/lib/order-alerts.ts` and the alert settings/SKU alert fields in Prisma.

## Data model and identity rules

1. Do not assume product, variant, and SKU IDs are interchangeable. Inspect each flow and the Prisma relation before changing identifiers. The database currently has integer product IDs, string variant IDs, and unique integer `ProductSku.articleId` values.
2. Inventory belongs to SKU/article-level records, including size and variant relationships. A product-level card count does not prove that a specific size/SKU has stock.
3. Local cart/wishlist state improves the UI but is not the inventory or pricing authority. Revalidate stock and authoritative product data on the server before reserving an order.
4. Avoid changing the persisted cart item's identifier shape or localStorage keys without checking the synchronizers and checkout payload consumers.
5. The Prisma product model and the richer provider-neutral catalog types are not identical schemas. Trace the adapter and actual route instead of assuming every field in `catalog-domain.ts` is persisted in Prisma.

## Admin and dashboard rules

1. Protected dashboard reads/actions must enforce authorization server-side using the existing helpers in `src/app/[locale]/dashboard/data.ts`. A hidden dashboard link is not access control.
2. Platform payment connections have a separate platform-owner permission. For payment connection changes, also read `ai/skills/payment-integrations/SKILL.md`.
3. Keep catalog saves, stock settings, and stock alerts consistent. Existing SKU alert flags prevent repeated alerts until stock recovers above the configured threshold; inspect their reset/send flow before changing it.
4. Metrics are computed from particular database queries and definitions in `dashboard/data.ts`. Read those definitions before changing labels, calculations, date windows, conversion rate or top-product ranking; do not assume the dashboard metrics are automatically sourced from PostHog.
5. Do not expose customer delivery/contact data, provider credentials, or internal metadata to non-admin clients.
6. Preserve pagination and bounded database queries when expanding catalog or dashboard lists.

## Workflow

1. Trace one product/SKU from catalog read through detail page, cart, checkout reservation and dashboard update.
2. Inspect existing model relations and callers before changing data shape.
3. Keep pure catalog/pricing behavior in the existing domain utilities where appropriate; keep database access server-side.
4. For stock changes, check reservation, cancellation/restoration, alert re-arming and concurrent updates.
5. Add a focused regression test for pagination, normalization, stock, or metric calculations as appropriate. Use the smallest relevant tests and check `ai/doc/security.md` for protected/admin operations.
