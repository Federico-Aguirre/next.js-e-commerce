# PostgreSQL / Drizzle

Use this skill when changing the database, schema, migrations, models, queries, or PostgreSQL-specific behavior.

## Workflow

1. Read `doc/security.md` when the change touches authorization, sensitive data, or untrusted input.
2. Inspect the existing schema and related models before changing them.
3. Keep schema definitions in `src/database/schema.ts` and persistence helpers in `src/database/`.
4. Use Drizzle ORM rather than handwritten SQL unless PostgreSQL-specific SQL is genuinely required.
5. Treat migrations as immutable history: create a new migration instead of rewriting an applied migration.
6. Review generated SQL before applying a migration.
7. Keep local PGlite behavior compatible with production PostgreSQL where practical.
8. Add or update tests for important constraints, queries, and persistence behavior.
9. Run type checking and the relevant tests after the change.

## Rules

- Do not put database access directly in UI components.
- Validate data at application boundaries before persistence.
- Do not commit credentials or production connection strings.
- Be explicit about indexes, unique constraints, foreign keys, nullability, and transaction boundaries.
