# E-commerce Domain Benchmark

## Scope

Reviewed the current template against these official repositories on 2026-09-20:

- Vercel Commerce: https://github.com/vercel/commerce
- Saleor Storefront / Paper: https://github.com/saleor/storefront
- Vendure Next.js Starter: https://github.com/vendurehq/nextjs-starter-vendure
- Medusa DTC Starter: https://github.com/medusajs/dtc-starter

The review compares reusable domain capabilities and module boundaries. It does
not rank the benchmarks or copy their implementation.

## Common domain capabilities observed

The benchmark set consistently treats product variants, collections/categories,
cart and order flows, customer addresses, and commerce-specific pricing as
first-class domain concerns. Saleor, Vendure and Medusa also expose market or
channel/region concepts, while Vendure and Saleor explicitly expose faceted
catalog browsing with pagination/sorting.

## Current template gap analysis

Before this task, the template already had provider-neutral commerce ports for
products, carts, orders, checkout, payments, shipping, tax and search. The
contracts were intentionally small, but the domain did not yet model:

- product media, options, inventory quantities, categories and collections;
- explicit market/currency capability rather than presentation currency;
- customer profile/address semantics beyond a session user;
- reusable promotion representation and deterministic discount evaluation;
- a normalized catalog query that carries filters, facets, sorting and page info.

Persistence remains deliberately separate. No commerce tables or provider SDKs
were added in this task, so the existing Drizzle/PGlite direction stays intact.

## Implemented improvements

| Area              | Benefit                                                                                  | Added complexity              | Dependencies | Provider-neutral | Affected files                               |
| ----------------- | ---------------------------------------------------------------------------------------- | ----------------------------- | ------------ | ---------------- | -------------------------------------------- |
| Catalog aggregate | Typed representation for variants, media, options, inventory, categories and collections | Small type-only domain layer  | None         | Yes              | src/commerce/catalog-domain.ts               |
| Catalog browsing  | Shared filter/facet/sort/pagination vocabulary with bounded normalization                | Small pure helper             | None         | Yes              | src/commerce/catalog.ts, catalog.test.ts     |
| Markets/currency  | Makes market-enabled currencies explicit and validates selections                        | Small value object + lookup   | None         | Yes              | src/commerce/market.ts, market.test.ts       |
| Customer/address  | Gives account-oriented commerce modules a stable address boundary                        | Small domain types/repository | None         | Yes              | src/commerce/customer.ts                     |
| Promotions        | Normalizes promotion intent and provides deterministic discount calculation              | Small pure evaluator          | None         | Yes              | src/commerce/promotion.ts, promotion.test.ts |
| Pricing           | Rejects mixed cart currencies and requires an explicit currency for empty tax totals     | Small validation              | None         | Yes              | src/commerce/pricing.ts, pricing.test.ts     |

## Design decisions

The CatalogDomainRepository is separated from persistence details, while market,
customer and promotion persistence are represented by narrow repositories.
These interfaces are mechanisms-only: integrations can implement them without
moving commerce policy into a provider SDK.

The catalog helper accepts legacy limit/offset callers but normalizes new code
toward explicit page/pageSize pagination. Page size is capped at 100 to avoid an
unbounded provider query becoming an accidental resource request.

## Benchmark-derived boundaries retained

- Vercel Commerce isolates concrete commerce-provider types behind a provider
  layer, so the reusable template keeps provider contracts outside domain types.
- Saleor Paper emphasizes variants, image galleries, channel-aware pricing,
  category/collection listings, facets, pagination and server-first cart state.
- Vendure separates route wiring from feature-oriented commerce modules and
  explicitly supports full-text search, facets, pagination, sorting, variants,
  collections and promotions.
- Medusa organizes storefront commerce around modules and includes regions,
  variants, promotion codes, customer addresses and order management.

These observations justify the domain additions above, but they do not justify
copying benchmark-specific APIs, generated types, or provider assumptions.

## Intentionally deferred

- Database schema/migrations for commerce entities.
- Concrete search engine or full-text provider.
- Payment, shipping or tax integrations.
- CMS/provider SDKs.
- UI pages for catalog/cart/checkout.

Those areas cross into the server-side integration or storefront tasks assigned
to the other Bots. Keeping them out of this change avoids overlapping ownership.

## Validation target

Run the focused commerce tests and TypeScript checking after the domain files
are reconciled with the concurrent commerce contract changes.
