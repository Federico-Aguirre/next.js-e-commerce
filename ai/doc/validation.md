# Validation Checkpoints

This file records concrete checks against the current working tree. A checkpoint is reusable only when the files/configuration/tests in its scope have not changed since it passed.

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
