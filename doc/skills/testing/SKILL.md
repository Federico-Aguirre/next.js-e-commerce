# Testing

Use this skill when adding or modifying tests or when validating a substantial change.

## Workflow

1. Read `doc/testing.md`.
2. Choose the smallest test level that proves the behavior.
3. Prefer unit/component tests for isolated logic and UI behavior.
4. Use integration tests for boundaries between application components.
5. Use Playwright E2E only when browser-level behavior or critical flows require it.
6. Keep tests deterministic and independent.
7. Run the targeted test first, then broader checks when justified.
