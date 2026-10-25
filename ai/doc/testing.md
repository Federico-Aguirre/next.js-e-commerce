# Testing Guidelines

Tests should protect important behavior rather than maximize raw coverage. Keep test files focused on one area and split them when they become difficult to navigate; do not impose an arbitrary fixed number of tests per file.

## Where tests live and how to rerun them

- Vitest unit/integration tests live alongside the source in `src/`, named `*.test.ts` or `*.test.tsx`. `vitest.config.ts` discovers them with `src/**/*.test.{ts,tsx}`. Look beside the module being tested first (for example, `src/lib/catalog/public-catalog.test.ts`).
- Playwright end-to-end browser tests live in `tests/**/*.spec.ts`, as configured in `playwright.config.ts`. Page objects are under `tests/page-objects/`.
- Run the unit/integration suite with `npm test -- --reporter=dot` (or `npm run test:unit`). Run all browser tests with `npm run test:e2e`. Run just the accessibility audit with `npx playwright test tests/accessibility.spec.ts --reporter=line`.
- Playwright output and traces/screenshots go under `test-results/`; the HTML report is written under `playwright-report/`. These are generated artifacts, not source test files.

## Default test strategy

- For source changes, run `npm run test:related -- <exact-source-paths>`. Vitest automatically selects dependent tests; pass only source paths changed in the current task, not every dirty file.
- For changed test files, run those files directly with `npx vitest run <test-path> --reporter=dot --silent=passed-only`.
- Passing-test logs are suppressed. Inspect verbose output only when diagnosing a failure.
- Skip tests for purely cosmetic changes without behavioral or accessibility impact. Run the full suite only for broad/cross-cutting changes, shared test/config changes, ambiguous impact, or integration/release checks. Use Playwright only when browser behavior needs validation.
- If no tests are selected, verify that relevant coverage is not being missed. For security, authentication, payments, checkout totals, shipping, inventory/order state, database and email idempotency, ensure the selected tests cover the affected invariants.
- Baseline (2026-10-23): full suite = 54 files / 222 tests, 23.92 seconds elapsed. This is a reference, not a reason to run everything for every change.

## Choose the smallest useful level

- Unit tests: deterministic domain rules, pricing, normalization, validation and state transitions. Commerce-domain unit tests live beside their modules in `src/commerce/`.
- Integration tests: behavior that depends on multiple application modules, database boundaries or provider adapters.
- Playwright E2E: critical user journeys and browser-specific behavior, such as localized navigation, login, cart/checkout UI and order history.
- Do not add E2E coverage for logic that can be tested faster and more reliably at a lower level.
- Avoid live payment charges/refunds, real shipping labels, paid services and production accounts in routine tests. Prefer deterministic fixtures, mocks and provider sandboxes.
- For saved-card changes, test authentication, ownership/account scope, provider-side attach/detach, masked display data, the default-checked save-card preference and its opt-out path, and reuse of an existing provider PaymentMethod. Never put full PAN or CVC/CVV in test fixtures, application logs, or the application database; stub payment-provider network calls in routine tests.
- PayPal Vault tests must cover the default-checked save-card preference and the opt-out path that sends no Vault instructions, provider eligibility/API rejection, local-user ownership of the vault customer/token, stale or asynchronous token-list responses, safe deletion, amount/reference checks, and idempotent handling when the provider has already completed a capture. The provider-country/account eligibility itself needs a separate sandbox/manual verification; mocked tests cannot prove it.
- Purchase-confirmation email tests must mock the shared Brevo sender and assert the paid-order gate, duplicate suppression and failure handling; never deliver real email during routine tests.

## Test quality

- Prefer repeatable tests stored in the repository and run by its installed Vitest/Playwright scripts, so the same regression suite can be rerun during future maintenance. One-off shell/Python assertions, manual browser checks, and ad-hoc scripts are supplementary diagnostics only; they do not replace an appropriate automated regression test.
- Never add another test framework or dependency when the installed runner can cover the behavior. Before creating a test file or case, search for existing tests that cover the same behavior across `src/`, `tests/`, and the relevant mobile app. Extend or reuse a suitable test when possible; only add a new one after confirming there is no existing test to adapt. Avoid duplicate test files for the same module/behavior.
- Run the relevant installed test command after editing tests or behavior; update `ai/doc/validation.md` with a dated, scoped checkpoint only after the reported checks actually finish successfully. Mark checks not run as NOT run rather than implying they passed.
- Assert observable behavior rather than implementation details.
- Use specific names, deterministic data and isolated state.
- Avoid brittle selectors, arbitrary sleeps and unnecessary mocks.
- For bug fixes, add a small regression test when practical.
- Consider both success and failure paths for authorization, validation, idempotency and external service errors.

## Validation workflow

After a change, run the smallest relevant validation first and broaden it only when the change affects wider behavior.

Common root scripts from `package.json`:

- `npm run check:types` — regenerates Prisma Client and runs TypeScript checking.
- `npm run lint` — ESLint.
- `npm run format:check` — Oxfmt check.
- `npm run test` / `npm run test:unit` — Vitest.
- `npm run test:e2e` — Playwright, if the relevant E2E infrastructure is available.
- `npm run build` — Prisma generation plus Next.js production build.

The mobile app is separate; consult `ecommerce-mobile/package.json` before choosing native lint/type/build commands. Do not start E2E infrastructure when browser tests are not relevant. If a check fails, diagnose whether the failure was caused by the change before expanding the test run.

Before finishing, inspect the diff for regressions, missing requirements, stale documentation and unrelated changes.

## Buy Now checkout

- `src/store/useCartStore.test.ts` covers replacing the active checkout selection with one selected product, preserving the previous cart, restoring it after cancellation or successful checkout, stock-limiting the requested quantity, and keeping standard checkout clearing behavior.
- Manual/browser payment-provider round trips should remain sandbox-only; unit tests and production builds do not prove a real provider transaction.

## PayPal saved-card switch to a new card

- `src/components/checkout/paypal/usePayPalCardPayment.test.tsx` verifies that selecting `Agregar nueva tarjeta` after saved cards load enables the deferred Card Fields mount.
- `src/components/checkout/paypal/PayPalCardForm.test.tsx` verifies the form-loading button state while the new fields initialize and that payment is re-enabled after readiness.
- Stripe and Mercado Pago regression tests continue to verify that selecting `Agregar nueva tarjeta` reveals the new-card fields.
