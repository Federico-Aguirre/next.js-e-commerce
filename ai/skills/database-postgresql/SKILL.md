# PostgreSQL and Prisma

Use this skill when changing the PostgreSQL schema, Prisma models, migrations, seeds, queries, connection handling, or persistence behavior.

## Project-specific layout

- Schema: `prisma/schema.prisma`.
- Migration history: `prisma/migrations/`.
- Seed: `prisma/seed.ts`.
- Prisma configuration: `prisma.config.ts`.
- Shared client / PostgreSQL adapter: `src/lib/prisma.ts`.
- Retry and transient database behavior: `src/lib/prisma-retry.ts`.
- Environment validation: `src/lib/Env.ts`.

This project uses Prisma 7 with PostgreSQL through `@prisma/adapter-pg` and the `pg` driver. Do not assume a legacy Prisma setup, a Prisma-managed connection URL in the schema, or an alternative schema directory without checking the installed version and current config.

## Workflow

1. Read `ai/doc/security.md` when authorization, personal data, secrets, or untrusted input are involved.
2. Inspect the relevant models and all callers before changing the schema or persistence contract.
3. Treat applied migrations as immutable history; create a new migration for a schema change.
4. Keep database access out of UI components; place it in server-side modules or route/action boundaries.
5. Preserve indexes, unique constraints, foreign keys, nullability, relation behavior, and transaction boundaries.
6. Avoid logging database credentials or personal/payment data.
7. Update generated Prisma artifacts only through the project's documented package scripts.
8. Run the smallest relevant tests and type-check after schema or query changes. Use broader validation only when the change warrants it.

## Rules

- Do not commit connection strings or credential values.
- Validate inputs before persistence and authorize record ownership on the server.
- Do not rely on client-supplied prices, stock, customer IDs, order status, or payment status.
- Keep database migrations and the schema consistent; do not edit generated client code by hand.
