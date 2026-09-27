# Next.js Feature

Use this skill when implementing a new page, route, feature, Server Action, or cross-cutting application behavior.

## Workflow

1. Read `doc/nextjs.md` and any other documentation relevant to the feature.
2. Identify the correct App Router boundary before writing code.
3. Prefer Server Components and server-side data access.
4. Introduce `"use client"` only for behavior that actually requires the browser.
5. Validate external input with the existing validation approach.
6. Reuse existing components, actions, models, and utilities before adding abstractions.
7. Add tests at the smallest useful level.
8. Run the smallest relevant validation and expand it when the change affects broader behavior.
