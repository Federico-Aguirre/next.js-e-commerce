# Security Guidelines

Treat all external input and external services as untrusted boundaries.

## Input and data

- Validate and normalize untrusted input at application boundaries.
- Use the project's established schema-validation library consistently.
- Never trust client-side validation as the only protection for server operations.
- Use parameterized queries or the ORM/query builder's safe APIs; never concatenate untrusted values into SQL.

## Secrets

- Never commit secrets, credentials, private keys, or real production environment values.
- Keep server-only secrets out of client bundles and public environment variables.
- Centralize environment validation according to the project's configuration conventions.

## Web application behavior

- Enforce authorization on the server for every protected operation.
- Do not rely on hidden UI controls as an authorization mechanism.
- Preserve CSRF, authentication, session, cookie, and security-header protections already provided by the framework or project.
- Avoid logging tokens, passwords, payment data, or other sensitive values.
