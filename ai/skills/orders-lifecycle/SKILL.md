---
name: orders-lifecycle
description: Order history, customer cancellation, payment-independent fulfillment states, delivery snapshots, and order identifiers.
---

# Order Lifecycle

Use this skill when modifying order creation outside provider-specific payment behavior, order history, order details, customer cancellation, order-number display, delivery snapshots, administrative status updates, or state transitions.

## Relevant code

- Customer history: `src/app/[locale]/historial/page.tsx`.
- Orders API: `src/app/api/orders/route.ts`, `src/app/api/orders/[orderId]/`, and `src/app/api/orders/confirm/route.ts`.
- Cancellation route: `src/app/api/orders/[orderId]/cancel/route.ts`.
- Checkout reservation and initial order creation: `src/app/api/checkout/route.ts`.
- Dashboard lifecycle actions and display: `src/app/[locale]/dashboard/actions.ts`, `OrderRow.tsx`, `data.ts`, and `types.ts`.
- Formatter: `src/lib/orders/format.ts`.
- Persistence and delivery snapshot fields: `Order` and `OrderItem` in `prisma/schema.prisma`.
- Stock reservation/restoration helpers: `src/lib/checkout/inventory.ts`.

## Invariants

1. Keep the payment lifecycle (`Order.status`) separate from fulfillment (`Order.fulfillmentStatus`). A paid order can still be pending preparation; a shipped order must not be inferred from payment status alone.
2. Preserve valid state transitions and terminal states. Inspect the current transition map and actual cancellation flow before changing it; do not invent a transition based only on the displayed label.
3. Customer reads/mutations must prove ownership of the order using the authenticated user on the server. A client-provided order ID is a selector, not authorization.
4. Cancellation must be idempotent, restore inventory at most once, and coordinate with the provider payment/refund flow when the order has been paid. Do not mark an order cancelled or a refund successful before the required operations have succeeded.
5. `orderNumber` is the stable human-facing number; the order UUID `id` is a separate internal/provider reference. Preserve both and inspect which identifier an endpoint or payment provider expects.
6. Delivery contact/address fields saved on the order are a snapshot. Do not silently replace them with the user's current profile when rendering or dispatching an already-created order; use the existing fallback only where the current code explicitly requires it.
7. Preserve `OrderItem` snapshots (title, price, quantity, size and image) when catalog data changes later.
8. Do not expose another customer's identity, delivery details, order contents, provider IDs or refund metadata in customer-facing history/API responses.
9. Keep payment-provider-specific reconciliation, refund semantics and webhook validation in the payment integration layer; read `ai/skills/payment-integrations/SKILL.md` if any of those boundaries change.
10. After an authoritative payment confirmation changes an order to `PAID`, send the customer a purchase-confirmation email using `src/lib/orders/order-confirmation-email.ts`. Do not send based only on client input. Preserve idempotency/retry behavior and never turn an approved payment into a failed response because email delivery failed; search existing tests first and mock the Brevo sender.

## Workflow

1. Trace the exact lifecycle path from creation to history/dashboard update and cancellation or delivery.
2. Inspect the current persisted statuses, transition guard, ownership check, idempotency key and inventory effect before editing.
3. Check both the customer flow and dashboard/admin flow when changing status contracts.
4. For changes to API shapes used by `ecommerce-mobile/`, read `ai/skills/mobile-api-sync/SKILL.md` and inspect mobile callers.
5. Add focused tests for allowed/denied transitions, ownership, repeat cancellation, or stock restoration where practical. Run only the relevant validation.
