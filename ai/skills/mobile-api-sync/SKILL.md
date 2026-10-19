---
name: mobile-api-sync
description: API, authentication, CORS, and shared data-contract compatibility between the web backend and ecommerce-mobile.
---

# Mobile API and Contract Compatibility

Use this skill when modifying API routes, proxy/CORS behavior, mobile auth endpoints, shared commerce contracts, or request/response shapes consumed by `ecommerce-mobile/`.

## Workflow

1. Search `ecommerce-mobile/src/services/` and its call sites before changing an endpoint, field name, HTTP method or status code.
2. Inspect both the backend route and the native caller. Keep mobile compatibility deliberate rather than assuming the apps use the same auth/session mechanism.
3. Keep `/api/` routes outside localized next-intl rewrites and inspect `src/proxy.ts` for existing route exceptions.
4. For CORS changes, inspect both `src/proxy.ts` and `next.config.ts`. The current proxy derives `Access-Control-Allow-Origin` from the request's `Origin` and enables credentials; that is reflection, not an allowlist. Do not expand this policy by copying the current pattern. Define/verify explicit allowed origins and test preflight behavior when changing CORS.
5. Preserve the existing mobile token flow while keeping NextAuth as the web browser session system.
6. Validate endpoints with focused tests or `curl`; avoid real transactions and paid services during routine API checks.

## Boundaries

- Changes to `/api/graphql`, `/api/orders`, `/api/checkout`, `/api/account` or `/api/auth/*` require checking the relevant mobile callers before changing the contract.
- Keep web UI/components and localized page routes untouched during mobile-only work unless the task explicitly requires shared behavior there.
- Do not place credentials in the mobile bundle; public client configuration is not server authorization.
- Use server-side validation and ownership checks for orders, addresses, carts and account operations regardless of the caller platform.
- Preserve CORS, auth, response-shape and ID assumptions only after confirming how the app currently uses them; do not treat a comment or a type declaration as proof of runtime behavior.
