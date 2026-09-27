- Limit test files to a maximum of 8-10 tests (`it`/`test` blocks) for unit/integration tests, and 3-5 scenarios for E2E tests. Split larger suites into separate files.

# Testing Guidelines

Tests should protect behavior that matters rather than maximize raw coverage.

## Test selection

- Prefer the smallest test level that verifies the behavior: unit, integration, or end-to-end.
- Add tests for important business rules, validation, data transformations, and regression-prone behavior.
- Use integration tests when correctness depends on several modules working together.
- Use E2E tests for critical user flows and browser-specific behavior.
- Do not add E2E coverage for logic that can be verified faster and more reliably at a lower level.

## Test quality

- Test observable behavior rather than implementation details.
- Keep test names specific about the expected behavior.
- Avoid brittle selectors, arbitrary waits, and unnecessary mocks.
- Keep test data deterministic and isolated.
- When fixing a bug, add a regression test when practical.

## Validation

After changing code, run the smallest relevant validation first. Expand validation when the change affects broader behavior.

Typical commands:

- `npm run check:types`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run build`

When a relevant check fails, fix the cause and rerun it. Do not start E2E infrastructure when E2E/integration tests are not relevant.

Before finishing, inspect the changed code for regressions, missing requirements, and unnecessary changes.
