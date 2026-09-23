# Mobile API & CORS Compatibility

Use this skill when modifying API routes (`src/app/api/`), middleware / proxy (`src/proxy.ts`), authentication endpoints, or data models consumed by `ecommerce-mobile/`.

## Workflow

1. Search for any endpoint usages in `ecommerce-mobile/src/` before changing existing API contracts or routes.
2. Ensure `src/proxy.ts` preserves CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`) for mobile development origins (e.g. `http://localhost:8081`).
3. Keep authentication endpoints backward compatible for both web (cookies / NextAuth sessions) and mobile (bearer tokens / mobile login endpoints).
4. When altering shared types (e.g., product or cart schemas), verify that both web stores and `ecommerce-mobile` stores remain in sync.
5. Validate endpoints with local tests or curl requests.

## Rules

- Never break `/api/graphql`, `/api/orders`, `/api/checkout`, or `/api/auth/*` without updating `ecommerce-mobile/` accordingly.
- Keep `/api/` paths outside localized `next-intl` rewrites.
