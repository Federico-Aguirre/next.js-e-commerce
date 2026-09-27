# Security Guidelines and Protocol

Apply these guidelines whenever modifying authentication, authorization, validation, secrets, database access, external inputs, file uploads, or other security-sensitive behavior.

## 1. Vulnerability Reporting

- Do not disclose unreleased vulnerabilities in public GitHub issues or public communication channels.
- Report vulnerabilities directly through designated private channels.

## 2. Input Validation and Trust Boundaries

- Treat all external input, external services, and client applications as untrusted boundaries.
- Validate and normalize untrusted input at application boundaries using project schema validation libraries such as Zod.
- Never trust client-side validation as the sole protection for server operations.
- Use parameterized queries or safe ORM APIs; never concatenate untrusted values into SQL queries.
- Do not place database access or queries directly inside UI components.

## 3. Authentication, Authorization, and Session Ownership

- Enforce authorization checks on the server side for every protected operation.
- Never rely on hidden UI controls or component visibility as an authorization mechanism.
- Verify customer session ownership at the server boundary before reading or mutating user-specific carts, addresses, checkout sessions, or orders.
- Preserve CSRF, authentication, session, cookie, and security-header protections provided by Next.js, proxy middleware, and NextAuth.

## 4. Secrets and Credentials Management

- Never commit secrets, credentials, private keys, or real production environment values to version control.
- Keep server-only secrets out of client bundles and public environment variables.
- Centralize environment variable validation in src/lib/Env.ts; do not access process.env directly in application code.
- Only expose browser-safe variables using NEXT_PUBLIC_* or EXPO_PUBLIC_* prefixes intentionally.

## 5. Logging, Error Handling, and Data Leakage

- Avoid logging tokens, passwords, payment data, or sensitive personal information in client or server logs.
- Prevent sensitive data leakage in error messages and error handling handlers.
- Maintain strict CORS header controls on API routes for authorized origins.

## 6. Review Workflow and Testing

- Identify trust boundaries and attacker-controlled inputs before writing or modifying security logic.
- Verify authorization server-side; never rely on UI controls or route visibility.
- Add regression tests for security-sensitive behavior and boundary validation.
- Execute type checks (`npm run check:types`) and relevant test suites after making security modifications.
