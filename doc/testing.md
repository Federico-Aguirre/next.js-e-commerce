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

- Run the checks relevant to the files changed.
- After a passing validation command, record durable checkpoints when the project uses `doc/validation.md`.
- When a relevant implementation, dependency, configuration, or test changes, invalidate the affected checkpoint and rerun it.
