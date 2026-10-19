# Testing Guidelines

Tests should protect important behavior rather than maximize raw coverage. Keep test files focused on one area and split them when they become difficult to navigate; do not impose an arbitrary fixed number of tests per file.

## Choose the smallest useful level

- Unit tests: deterministic domain rules, pricing, normalization, validation and state transitions. Commerce-domain unit tests live beside their modules in `src/commerce/`.
- Integration tests: behavior that depends on multiple application modules, database boundaries or provider adapters.
- Playwright E2E: critical user journeys and browser-specific behavior, such as localized navigation, login, cart/checkout UI and order history.
- Do not add E2E coverage for logic that can be tested faster and more reliably at a lower level.
- Avoid live payment charges/refunds, real shipping labels, paid services and production accounts in routine tests. Prefer deterministic fixtures, mocks and provider sandboxes.
- Purchase-confirmation email tests must mock the shared Brevo sender and assert the paid-order gate, duplicate suppression and failure handling; never deliver real email during routine tests.

## Test quality

- Before creating a test file or case, search for existing tests that cover the same behavior across `src/`, `tests/`, and the relevant mobile app. Extend or reuse a suitable test when possible; only add a new one after confirming there is no existing test to adapt. Avoid duplicate test files for the same module/behavior.
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
