---
name: forms-validation
description: Form state, validation schemas, accessible errors, and server-side validation using React Hook Form, resolvers and Zod.
---

# Forms and Validation

Use this skill when adding or changing user-facing forms, form schemas, validation messages, or form submissions through Server Actions and API routes.

## Relevant code

- Shared schemas: `src/lib/schemas/`.
- Account schema: `src/lib/account/accountSchema.ts`.
- Checkout schema: `src/lib/checkout/checkoutSchema.ts`.
- Contact schema and Server Action: `src/lib/schemas/contactSchema.ts`, `src/actions/contactAction.ts`.
- Existing form primitives: `src/components/ui/form.tsx`, `input.tsx`, `label.tsx`, `textarea.tsx`, and nearby components.
- Localized dictionaries: `src/locales/en.json` and `src/locales/es.json`.

Inspect the actual existing files before relying on these examples; the repository may evolve.

## Rules

1. Use the existing React Hook Form + `@hookform/resolvers/zod` + Zod pattern when it fits the form. Do not add a second form library for a routine feature.
2. Keep schemas reusable and near the domain/form boundary; infer TypeScript form types from schemas when the project already does so.
3. Client-side validation improves feedback but never replaces server-side validation. Parse submitted data again in the Server Action or Route Handler before sending email, saving data, or mutating orders/accounts.
4. Do not trust hidden fields, honeypots, timestamps, customer IDs or client-supplied amounts. Treat them as untrusted input and validate each security control on the server.
5. Keep loading, success, field-level errors and server errors distinct. Prevent accidental duplicate submissions while a request is pending.
6. Use semantic labels, `aria-invalid`, `aria-describedby`, live regions for status messages and keyboard-accessible controls where appropriate.
7. All user-visible labels and errors must use next-intl and be added consistently to each supported locale dictionary.
8. Preserve server-side rate limiting, anti-spam checks, authorization and privacy constraints when changing an existing form.
9. Add focused tests for meaningful schema rules and submission behavior; use the smallest relevant validation from `ai/doc/testing.md`.
