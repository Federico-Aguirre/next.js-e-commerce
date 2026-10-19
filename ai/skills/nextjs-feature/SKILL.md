---
name: nextjs
description: Project guidance for Next.js App Router, rendering boundaries, route handlers, Server Actions, and performance.
---

# Next.js App Router

Use this skill when adding or changing pages, layouts, route handlers, Server Actions, metadata, server data access, rendering or caching.

## App Router

- Follow the installed Next.js version in `package.json`; check version-specific APIs rather than assuming behavior from another release.
- Prefer Server Components. Add `"use client"` only when browser APIs, local interaction state, effects or event handlers require it.
- Keep Route Handlers focused on HTTP/authentication boundaries and move reusable business logic into server-side domain or service modules.
- Follow the established conventions for localized routes, layouts, loading/error states, metadata and navigation.
- Avoid duplicate server data queries when a shared boundary can provide the data cleanly.

## Security and runtime boundaries

- Keep secrets, server-only modules, privileged credentials and database access out of Client Components.
- Validate untrusted input at Route Handler, Server Action and external integration boundaries using the project's existing schemas (usually Zod).
- Enforce access checks on the server; do not treat hidden UI controls as authorization.
- Follow `ai/doc/security.md` and the environment-validation strategy in `src/lib/Env.ts` when changing secrets or external calls.

## Performance and caching

- Prefer server-side work when it avoids unnecessary browser JavaScript.
- Use the framework-supported image/font handling and existing project patterns.
- Do not introduce caching, revalidation, memoization or forced dynamic rendering without understanding the behavior being changed and its effect on order/account freshness.

## Workflow

1. Read `ai/agents.md` and only the relevant task-specific references under `ai/doc/` or `ai/skills/`.
2. Inspect the closest existing route/component and trace its callers before introducing another pattern.
3. Identify the server/client and authentication boundary before editing.
4. Reuse existing components, Server Actions, schemas and service functions where appropriate.
5. Add the smallest useful regression test and run proportional validation.
