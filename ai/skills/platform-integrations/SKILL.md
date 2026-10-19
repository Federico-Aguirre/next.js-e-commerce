---
name: platform-integrations
description: Non-payment external services, analytics, email, GraphQL, monitoring, and scheduled notifications.
---

# Platform Integrations

Use this skill for external services other than payment and shipping providers, including contact email, analytics, operational monitoring, GraphQL, notifications, and scheduled jobs.

## Relevant code

- Environment validation: `src/lib/Env.ts`.
- Contact form action and validation: `src/actions/contactAction.ts`, `src/lib/schemas/contactSchema.ts`.
- PostHog client and visit tracking: `src/providers/PostHogProvider.tsx`, `src/app/api/analytics/visit/route.ts`.
- Logtail / web vitals: `src/components/ProductionMonitoring.tsx`.
- GraphQL Yoga: `src/app/api/graphql/route.ts`.
- Telegram alert logic: `src/lib/order-alerts.ts`, `src/app/api/cron/order-alerts/route.ts`.
- Cloudflare scheduled worker: `cloudflare/order-alert-cron/src/index.ts` and its adjacent Wrangler configuration.

## Service-specific rules

- Brevo: use the shared server-only transactional email sender. Preserve contact-form Zod validation, honeypot and rate-limit behavior. Keep API keys and recipient addresses server-only; use a registered sender and authenticate the sending domain for reliable production delivery.
- Purchase confirmation: use `src/lib/orders/order-confirmation-email.ts`; send only after the order is authoritatively `PAID`, protect against duplicate callbacks, persist delivery status for retries, and use the verified `BREVO_FROM_EMAIL` in production. Check for existing tests before adding more and mock the Brevo sender.
- PostHog: preserve consent/privacy assumptions and avoid sending unnecessary personal or payment information. Use only public client configuration in browser code. Keep server/database analytics writes separately validated.
- Logtail/monitoring: never include tokens, passwords, card data, full provider payloads or sensitive personal details in logs. Make errors useful but sanitized.
- GraphQL Yoga: inspect schema/resolvers and mobile consumers before altering field names or response contracts. Apply validation and server-side authorization to sensitive operations, not just UI checks.
- Telegram/cron/Cloudflare: authenticate scheduled triggers, validate inputs, make repeated runs safe, and avoid sending unnecessary customer/address/payment data in messages.
- Environment: add and validate variables through the established project configuration and keep credentials out of logs, tests and client bundles.

## Dependency-use caution

A source scan found no direct imports for `@arcjet/next`, `@sentry/nextjs`, or `@tanstack/react-query`, and no current checkout import of `@mercadopago/sdk-react`. This is not proof that a package is completely unused (it may be loaded indirectly), so verify its configuration and usage before assuming it is active or wiring a new feature around it. Do not add duplicate rate-limit, monitoring, data-fetching, or card-form implementations simply because a package is installed.
