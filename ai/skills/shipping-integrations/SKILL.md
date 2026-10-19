---
name: shipping-integrations
description: Project-specific shipping providers, quote selection, fulfilment, labels, and tracking.
---

# Shipping Integrations

Use this skill when changing shipping quotes, provider selection, package dimensions, shipment creation, labels, carrier tracking, delivery estimates, or fulfillment status.

## Relevant code

- Provider types and normalized contracts: `src/lib/shipping/types.ts`.
- Provider implementation: `src/lib/shipping/order-shipping.ts`.
- Admin order/shipping workflows: inspect the relevant `src/app/[locale]/dashboard/` components/actions.
- Order and delivery snapshots: `prisma/schema.prisma` and related migrations.
- Shipping environment validation: `src/lib/Env.ts`.

## Current provider selection

- Argentina destination (`AR`): Zipnova.
- Non-Argentina destination: Shippo.
- Optional local methods: store pickup and local flat rate, controlled by validated environment settings.
- Provider results are normalized to `ShippingQuote` and `ShippingProvider` types; preserve that boundary when adapting an external API.

Always inspect the current implementation rather than duplicating these rules in another module.

## Non-negotiable invariants

1. Only a server-verified, paid order can be dispatched; follow the existing order status check.
2. Build the shipping destination from the saved order delivery snapshot, not a customer's later-edited account profile. A change to the profile must not silently change an existing order.
3. Use SKU-level package weight/dimensions where available and the established validated fallback configuration otherwise.
4. Keep Zipnova/Shippo credentials and API calls server-side. Never log tokens or full recipient addresses.
5. Preserve provider selection, quote currency, rate, external shipment ID, label URL, tracking URL, tracking code, ETA and normalized fulfillment status. Do not assume both providers return the same response shape or status vocabulary.
6. Keep sandbox/production selection explicit. Do not create a real label or paid shipment as routine testing.
7. Treat repeated shipment creation and tracking refreshes carefully: inspect external IDs and existing order state before adding retries or mutating shipment data.
8. Report provider errors accurately; do not mark a shipment created when its provider request failed.

## Workflow

1. Trace the call path from dashboard/action or route into `order-shipping.ts`.
2. Check address validation, country normalization, origin settings and SKU dimension fallbacks.
3. Preserve or update normalized provider types and persisted order fields together.
4. Use mocked or sandbox provider responses for focused tests, then run the smallest relevant validation.
