# Validation Checkpoints

This file records the latest successful checks so an interrupted AI session does not rerun unchanged validation.

## Latest checkpoint

- Date: 2026-10-03
- Scope: current working tree after web authentication unification
- `npm run check:types`: PASS
- `npm run lint`: PASS (0 errors; existing warnings remain)
- `npm run build`: PASS
- `git diff --check`: PASS
- Authentication regression: admin account verified in PostgreSQL; `jk@gmail.com` is the sole `isAdmin=true` account.
- E2E/unit tests: not rerun after the authentication cleanup.

## Invalidation rule

Invalidate this checkpoint when code, configuration, dependencies, environment handling, or tests within its scope change. Rerun only the affected checks.
