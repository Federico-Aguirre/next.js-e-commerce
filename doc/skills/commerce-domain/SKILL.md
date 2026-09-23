# Commerce Domain & Integrations

Use this skill when modifying or extending catalog, pricing, cart, promotions, checkout, orders, or external commerce integrations.

## Workflow

1. Read `docs/ECOMMERCE-TEMPLATE.md` and `doc/security.md` when changes involve customer ownership, orders, or monetary values.
2. Maintain the separation between pure domain logic (`src/commerce/`) and persistence/UI layers.
3. Keep monetary calculations strictly pure in `src/commerce/pricing.ts`. Never trust client-provided totals, prices, or taxes.
4. When adding or modifying commerce integrations (payments, shipping, tax, search), define or adhere to provider-neutral interfaces in `src/commerce/contracts.ts`.
5. Require an idempotency key for all checkout, order creation, and payment mutations.
6. Verify customer session ownership in `src/commerce/session.ts` before mutating user-specific carts, addresses, or orders.
7. Co-locate unit tests (`*.test.ts`) with domain helpers and validation schemas.
8. Run targeted tests with `npx vitest run src/commerce` before validating broader application behavior.

## Rules

- Do not import concrete payment, shipping, or CMS SDKs directly into UI components or pages.
- Client state is presentation-only; server state is authoritative for inventory, prices, and discounts.
- All monetary values must include explicit currency codes. Never mix currencies in a single transaction.
- Keep catalog queries bounded with explicit page sizes (maximum 100 items per request).
