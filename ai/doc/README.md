# Project Documentation

This directory contains durable project guidance. Keep documents focused on project conventions and stable architecture; put task-specific procedures in `ai/skills/`.

## Core documents

- `rules.md` — concise rules that apply to every task.
- `architecture.md` — repository boundaries and cross-layer design.
- `ecommerce.md` — commerce invariants and project-specific workflow.
- `typescript.md` — strict typing and TypeScript conventions.
- `security.md` — input validation, secrets, authorization, and secure web behavior.
- `testing.md` — choosing test levels and keeping validation proportional.
- `validation.md` — persistent validation checkpoints; invalidate them when relevant code or config changes.
- `git.md` — commit conventions.

## Situational skills

The canonical task router is `ai/agents.md`. Read only the matching skill in `ai/skills/` for Next.js, React, database work, localization, UI styling, commerce, payments, shipping, mobile, or platform services.

Do not create duplicate reference documents for a dependency unless it has a recurring, non-obvious integration contract that agents must follow.
