# Validation Checkpoints

This file persists successful validation so an interrupted AI session does not require rerunning unchanged checks just to recover context.

## Latest checkpoint

- Timestamp: 2026-09-17T17:55:02+00:00
- Scope: current working tree after the connection interruption and final Checkly/Playwright configuration fixes
- `npm run check:types`: PASS
- `npm run lint`: PASS
- `npm run test`: PASS — 2 files, 4 tests
- `npm run check:deps`: PASS
- `npm run check:i18n`: PASS
- `npm run test:e2e`: PASS — 3 tests passed; unchanged since the previous checkpoint
- Visual regression baseline: PASS — `tests/e2e/Visual.e2e.ts`
- Build: not part of the fast verification loop; validate separately when publishing/deploying.

## Invalidation rule

A checkpoint is valid until code, configuration, dependencies, environment handling, or tests within its scope change. After such a change, rerun the affected checks and update this file immediately.
