# AGENTS

## Rules

- Keep changes minimal and consistent with the existing code.
- TypeScript strict; avoid `any` and unnecessary type assertions.
- Prefer named exports; Next.js pages/layouts may use default exports.
- Use `@/` absolute imports unless importing from the same directory.
- Follow existing ESLint/Oxlint rules; do not reformat unrelated code.
- Use Tailwind CSS v4 and shared Shadcn/Radix UI components.
- Server Components by default; use `"use client"` only when required.
- Use TanStack React Query for async/server state and Zustand for client global state.
- Never hard-code user-visible strings; use next-intl.
- Validate inputs with Zod.
- All environment variables must be defined and validated in `src/lib/Env.ts`; do not access `process.env` directly in app code.
- Page default exports should end with `Page`.
- Use the existing test conventions and add tests when relevant.
- Proceed autonomously with the installations, commands, edits, and validations needed for a requested task; do not ask for routine permission or confirmation.

## Documentation

Do not load the entire `doc/` directory by default. Read only the document relevant to the current task.

- `doc/typescript.md` — TypeScript, imports, types, functions.
- `doc/react.md` — React components, state, effects, composition.
- `doc/nextjs.md` — Next.js App Router, server/client boundaries, performance.
- `doc/tailwindStyles.md` — Tailwind, responsive UI, accessibility.
- `doc/testing.md` — testing strategy and validation.
- `doc/security.md` — validation, secrets, authorization, security.
- `doc/validation.md` — persistent validation checkpoints.

If a task spans multiple areas, read only the documents needed for those areas. Do not read documentation merely because it exists.

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

## Git

Use Conventional Commits:
`type: summary`

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Repository Guides

- `ARCHITECTURE.md` — high-level boundaries and architectural principles.
- `CONTRIBUTING.md` — development, validation, commits, and contribution workflow.
- `SECURITY.md` — vulnerability-reporting placeholder and security-documentation entry point.
- `skills/README.md` — index of task-specific agent procedures.

Read repository guides and skills only when the task requires them.

## Template Scope

This is a general-purpose template. Keep these rules generic and reusable. Project-specific architecture, business rules, and infrastructure belong in project-specific documentation.
