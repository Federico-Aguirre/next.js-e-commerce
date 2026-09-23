# Security Review

Use this skill when changing authentication, authorization, validation, secrets, database access, external input, uploads, or other security-sensitive behavior.

## Workflow

1. Read `doc/security.md`.
2. Identify the trust boundary and attacker-controlled inputs.
3. Validate and normalize inputs at the boundary.
4. Verify authorization server-side; never rely on UI visibility.
5. Avoid exposing secrets or sensitive data to client code.
6. Check error handling, logging, and data leakage.
7. Add regression tests for security-sensitive behavior.
8. Run relevant type checks and tests.
