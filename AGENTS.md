# AI Agent Instructions

This repository contains a Next.js web app and an Expo/React Native mobile app.

## Entry point

Read `ai/agents.md` before analyzing, editing, or generating code. It is the canonical project-wide AI guide.

Then read only the task-relevant documentation or skill referenced there. Do not scan all AI docs, `node_modules/`, `.next/`, `.venv/`, or `.kilo/worktrees/` unless the task explicitly requires them.

## Efficient workflow

1. Inspect the relevant files and existing code paths before editing.
2. Prefer targeted content/file search before reading large files.
3. Make the smallest coherent change; do not reformat unrelated files.
4. After security-sensitive changes, recheck the trust boundary and run the smallest relevant validation.
5. Reuse the latest valid validation checkpoint in `ai/doc/validation.md`; rerun checks only when the checkpoint is invalidated by the change.
6. Never expose secrets, passwords, tokens, or real environment values in responses, logs, tests, or documentation.

## Platform boundaries

- Web application: `src/`
- Mobile application: `ecommerce-mobile/`
- Shared backend/API/domain changes are allowed only when required by mobile synchronization or shared behavior.
- Web authentication uses NextAuth as the single web session system.
- Mobile authentication may use the dedicated mobile endpoints under `src/app/api/auth/`; these endpoints must remain compatible with NextAuth tokens.

## Code rules

Follow `ai/doc/rules.md` and the task-specific documentation/skill selected from `ai/agents.md`.
Chat with the user in Spanish. Code, comments, and project documentation must be in English.
