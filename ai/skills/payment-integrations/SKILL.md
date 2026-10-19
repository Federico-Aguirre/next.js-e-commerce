---
name: payment-integrations
description: Project-specific payment flows for Mercado Pago, Stripe, PayPal, onboarding, split commissions, refunds, and payment webhooks.
---

# Payment Integrations

Use this skill before changing any payment provider, checkout payment method, seller connection, platform commission, refund, payment-state transition, or payment webhook.

## Relevant code

- Checkout/order reservation: `src/app/api/checkout/route.ts`.
- Mercado Pago card tokenization: `src/lib/checkout/processCardPayment.ts`, `src/components/checkout/mercado-pago/MercadoPagoCardForm.tsx`.
- Server payment creation / split: `src/app/api/process-payment/route.ts`.
- Mercado Pago verification and webhook: `src/app/api/orders/verifyPayment/route.ts`, `src/app/api/webhooks/mercadopago/route.ts`, and related order-confirmation routes.
- Stripe: `src/app/checkout/stripe/page.tsx`, `src/components/checkout/stripe/StripePaymentForm.tsx`, `src/app/api/stripe/confirm/route.ts`.
- PayPal: inspect the current `src/app/api/paypal/` routes and `src/app/api/platform/payments/paypal/` connection routes.
- Platform/seller configuration and fees: `src/lib/payments/platform-config.ts`, `src/lib/payments/store-connections.ts`, `src/lib/payments/secret-store.ts`, `src/lib/payments/refund-order.ts`, and onboarding helpers.
- Validated environment: `src/lib/Env.ts`; persistence: `prisma/schema.prisma`.

Inspect the current call path and exact provider before editing. The code currently imports `@mercadopago/sdk-js` for browser card tokenization and `mercadopago` for server requests. The presence of `@mercadopago/sdk-react` in `package.json` does not mean the Card Payment Brick is wired into the current checkout. Do not switch payment libraries as an incidental refactor.

## Non-negotiable invariants

1. Never trust client-supplied prices, totals, stock, commission, order status, seller identity, or payment result. Derive authoritative values from the server-side order and database.
2. Preserve the current order reservation, idempotency key, stock recovery, and payment-state transitions. Read the checkout and order code before touching these paths.
3. For split payments, inspect the exact provider's seller connection, account/collector identity, OAuth ownership, required capabilities/scopes, and commission parameter. Do not assume Mercado Pago, Stripe Connect, and PayPal multiparty flows share the same API contract.
4. Keep seller tokens, client secrets, refresh tokens, and server credentials server-only. Use the established connection/secret storage. Never include credentials in a page, client bundle, logs, examples, or user-facing errors.
5. Do not log full card numbers, security codes, payment tokens, access tokens, or full provider request payloads. Keep diagnostic logs to the minimum non-sensitive fields needed to investigate a failure.
6. Verify payment outcomes server-side through the provider response, verification endpoint, or authenticated webhook. A browser redirect or client-provided success state is not proof of payment.
7. Refund and cancellation operations must remain idempotent and authorized against the owning user/order. Do not report a successful refund when the provider result is pending or failed.
8. Preserve the current provider/mode unless the requested task explicitly requires changing it. Avoid broad changes to working providers while fixing a single provider.
9. Prefer sandbox credentials and existing test seams. Never initiate a real charge/refund or make a new purchase merely as routine validation without an explicit need.

## Diagnostic workflow

1. Reproduce or inspect the smallest failing provider-specific path.
2. Capture the provider request ID, HTTP status, safe error code and sanitized response causes. Redact user identity and token/card data.
3. Compare the outbound request with the provider's current requirements and the current seller connection metadata.
4. Distinguish configuration/onboarding failures from tokenization, authorization, payment creation, webhook, inventory and order-persistence failures.
5. Run focused type/lint/tests for changed files. Update regression coverage where feasible; do not run a live payment just to confirm a code edit.
