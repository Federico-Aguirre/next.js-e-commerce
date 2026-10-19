---
title: "AI Agents"
description: "Canonical instructions for AI coding assistants"
---

## Required reading

Read `ai/doc/rules.md` first.

Read only the documentation and skill that matches the task. Do not read unrelated AI docs merely because they exist. Treat `package.json`, the relevant source code, and the currently installed versions as the source of truth; do not assume a dependency is configured just because it is installed.

## Task routing

- Architecture, new modules, or cross-layer changes: `ai/doc/architecture.md` plus the relevant task-specific skill.
- TypeScript, strict typing, exports, or import boundaries: `ai/doc/typescript.md`.
- Tests and validation: `ai/doc/testing.md` and `ai/doc/validation.md`.
- Authentication, authorization, secrets, personal data, external input, or database trust boundaries: `ai/doc/security.md`.
- Git history, commits, or repository workflow: `ai/doc/git.md`.
- Sign-in/sign-up, NextAuth callbacks, social/credentials providers, user roles, account profile or saved addresses: `ai/skills/customer-auth-account/SKILL.md`; add `ai/doc/security.md` for protected data or permissions.
- Catalog/product detail, variants, SKU inventory, local cart/wishlist, stock alerts or admin dashboard metrics: `ai/skills/catalog-inventory-dashboard/SKILL.md`; add `ai/skills/ecommerce-domain/SKILL.md` for cart/pricing/checkout or `ai/doc/security.md` for admin access.
- Order history, order number, customer cancellation, payment-independent fulfillment status, delivery snapshot, purchase-confirmation email or admin order transitions: `ai/skills/orders-lifecycle/SKILL.md` and `ai/skills/ecommerce-domain/SKILL.md`; add `ai/skills/platform-integrations/SKILL.md` for email delivery and payment integration guidance when provider/refund behavior changes.
- Commerce domain, pricing, promotions, cart, checkout, inventory or orders: `ai/doc/ecommerce.md` and `ai/skills/ecommerce-domain/SKILL.md`.
- Payment providers, card fields/tokenization, seller onboarding/OAuth, platform commission/split payments, refunds, payment status, or payment webhooks: `ai/skills/payment-integrations/SKILL.md`, `ai/skills/ecommerce-domain/SKILL.md`, and `ai/doc/security.md`.
- Shipping quotes, fulfillment, labels, carrier selection, delivery estimates, or tracking (Zipnova, Shippo, pickup, local flat rate): `ai/skills/shipping-integrations/SKILL.md`, `ai/skills/orders-lifecycle/SKILL.md`, and `ai/doc/security.md`.
- Next.js App Router, route handlers, layouts, metadata, Server Actions, rendering or caching: `ai/skills/nextjs-feature/SKILL.md`.
- React component design, effects, state, component boundaries or accessibility: `ai/skills/reactjs-feature/SKILL.md`.
- Web UI, Tailwind CSS v4, Radix primitives, shared UI components, animation or responsive behavior: `ai/skills/ui-styling/SKILL.md` and, for Tailwind-specific work, `ai/skills/ui-styling/tailwind/SKILL.md`.
- User-visible copy, localized routes, translation dictionaries or locale handling: `ai/skills/i18n/SKILL.md`.
- Forms, React Hook Form, Zod schemas, field/server errors, or Server Action submissions: `ai/skills/forms-validation/SKILL.md`; also read the i18n/security guidance when relevant.
- PostgreSQL, Prisma models, migrations, seeds, database queries or connection pooling: `ai/skills/database-postgresql/SKILL.md`.
- Expo/React Native screens, Expo Router, NativeWind, native storage, mobile auth or native dependencies: `ai/skills/mobile-app/SKILL.md`. If changing an API, auth endpoint, shared contract or CORS behavior consumed by mobile, also read `ai/skills/mobile-api-sync/SKILL.md`.
- Contact email / Brevo, PostHog analytics, Logtail monitoring, GraphQL Yoga, Telegram notifications, cron jobs or the Cloudflare Worker: `ai/skills/platform-integrations/SKILL.md`; also read the matching Next.js, database or security guidance where relevant.
- Environment variables or environment validation: `src/lib/Env.ts` and `ai/doc/security.md`.
- Unit / integration tests: Vitest. Browser flow tests: Playwright. Read `ai/doc/testing.md` before selecting a test level.

## When to create and reuse tests

- Before creating a test, actively search existing test files and cases in the relevant app areas (`src/`, `tests/`, and `ecommerce-mobile/` when relevant). If a suitable test already covers the behavior, extend or reuse it rather than creating a duplicate. Only create a new test after confirming there is no appropriate existing test.
- Inspect `package.json`, the test config, and nearby tests. Reuse the project's current stack (Vitest for unit/integration tests and Playwright for browser flows); do not add Jest or another dependency when the existing tools cover the need.
- Add a small, deterministic regression test for a reproducible bug or an important behavior that could regress, especially validation, permissions, pricing, state transitions, storage, and user interactions. A reusable regression test is preferable to repeating the same manual check in later sessions.
- For UI bugs, favor Testing Library with the configured jsdom environment and assert observable behavior. When a missing style utility caused the bug, assert that the affected control includes the required class; test important click behavior separately when relevant.
- Keep tests isolated from real accounts, production data, live payments, paid services, and nondeterministic network calls. Use existing mocks or fixtures; never add an external dependency just to test a small behavior if the installed stack can do it.
- Skip tests when a change is purely cosmetic and too trivial to regress, or when a test would only duplicate an existing reliable check. Do not force coverage for its own sake.
- Run the narrowest relevant test first, for example `npm run test -- src/components/Example.test.tsx`; run broader suites only when the scope or risk warrants them. Reuse a valid validation checkpoint documented in `ai/doc/validation.md` rather than rerunning expensive checks without a reason.

## Purchase-confirmation email requirement

- For commerce/order work, verify that a server-side purchase-confirmation email is sent to the customer after the payment provider has authoritatively confirmed the order as `PAID`. If the service is missing, implement or extend the existing Brevo integration rather than adding a competing email provider.
- Never send a purchase confirmation from client-supplied payment state or before provider verification. Keep email delivery separate from the payment/order result: a mail failure must not undo an approved payment or falsely report the payment as failed.
- Make delivery idempotent across repeated confirmation requests/webhooks, record its state so failed or stale attempts can be retried, and include the stable order number plus the saved order summary. Keep API keys and sender settings server-side; configure a verified `BREVO_FROM_EMAIL` for production.
- Search for an existing confirmation-email service and tests before creating new files. Test delivery with mocks and never send a real customer email during routine validation.

## Token-efficient workflow

1. Search for the relevant symbol or path before reading broad files.
2. Read only the smallest contiguous ranges needed to understand the change.
3. Exclude `node_modules/`, `.next/`, `.venv/`, `.kilo/worktrees/`, generated files and caches from searches unless the task explicitly targets them.
4. Prefer one focused edit per logical change.
5. Reuse a valid checkpoint from `ai/doc/validation.md`; rerun only checks invalidated by the current change.
6. After edits, inspect the diff before running broad tooling. Run the smallest relevant check first.
7. Do not perform real payment transactions or introduce paid services just to validate routine code changes. Prefer existing sandbox/test paths and deterministic tests.

## Project conventions

- Keep changes minimal and consistent with existing code; do not refactor unrelated working flows.
- TypeScript strict; avoid `any` and unchecked assertions.
- Server Components by default; use client components only when required.
- Use `@/` imports across directories.
- Use next-intl for user-visible web strings and keep all supported locale dictionaries in sync.
- Use Zod at external input boundaries.
- Follow existing repository patterns before introducing another state, data-fetching, UI, or integration library.
- Keep secrets server-only and validated through the project environment-validation strategy. Never print tokens, secrets, full payment-card data, personal data, or real environment values.
- Server-side authorization is mandatory for protected operations. UI visibility is not authorization.
- Web authentication uses NextAuth as the single browser session system.
- Chat with the user in Spanish; code, comments, and project documentation stay in English.

## Platform boundaries

- Web application: `src/`.
- Mobile application: `ecommerce-mobile/`, with its own `package.json` and dependency versions. Do not apply web-only CSS, routing or component assumptions to native screens.
- Shared backend/API/domain changes are allowed only when required by mobile synchronization or shared behavior.
- Mobile auth endpoints under `src/app/api/auth/` must remain compatible with the current native token flow; do not replace the web session model.
