---
name: customer-auth-account
description: Web and native authentication, account profiles, user roles, and protected customer data.
---

# Customer Authentication and Account

Use this skill when changing sign-in/sign-up, NextAuth configuration, user/session claims, Google/Facebook/Credentials login, mobile auth endpoints, account profiles, address data, or role-protected operations.

## Relevant code

- NextAuth configuration: `src/lib/auth-options.ts`.
- Web auth UI and route group: `src/app/[locale]/(auth)/`.
- Auth actions: `src/actions/auth.ts`.
- NextAuth handler and native-compatible auth endpoints: `src/app/api/auth/`.
- Account screen: `src/app/[locale]/account/page.tsx`.
- Account API and schema: `src/app/api/account/route.ts`, `src/lib/account/accountSchema.ts`.
- Role/identity fields: `User` in `prisma/schema.prisma`; dashboard authorization helpers: `src/app/[locale]/dashboard/data.ts`.
- Session type augmentation: `src/types/next-auth.d.ts`.

## Non-negotiable boundaries

1. NextAuth is the browser session system. Do not add parallel browser session cookies, a second login/logout mechanism, or a custom web session token without a specific architecture decision.
2. The database is authoritative for privileged roles. Re-check `isAdmin` or `isPlatformOwner` on the server for protected operations; never rely only on a session claim or hidden navigation item.
3. `isAdmin` and `isPlatformOwner` represent different capabilities. A store administrator must not automatically gain platform-owner payment-connection privileges.
4. Customer data must be scoped to the authenticated session identity. Ignore or reject client-supplied user IDs when determining which account to read or update.
5. Keep account validation in the shared Zod schema and validate again on the server endpoint. Client-side validation and redirects are for user experience, not security.
6. Do not return password hashes, provider tokens, secret fields, or unrelated personal data from session/account endpoints.
7. Keep native mobile authentication compatible with the existing endpoints and token expectations. Do not change web authentication merely to simplify the mobile client.
8. Account profile updates must not silently rewrite delivery data already snapshotted on an existing order. Order address changes follow the specific order/fulfillment flow.
9. Preserve provider-specific sign-in behavior and callbacks when editing `authOptions`; test credentials and OAuth paths relevant to the change.

## Workflow

1. Trace the client entry point into the exact API/action and inspect its current session checks.
2. Determine whether the task is web session auth, native bearer/token auth, account profile, admin authorization, or platform-owner authorization.
3. Preserve response compatibility for existing callers.
4. Read `ai/doc/security.md` and `ai/skills/mobile-api-sync/SKILL.md` when changing shared/mobile auth routes.
5. Add focused tests for identity ownership and privilege boundaries where practical; run proportional validation.
