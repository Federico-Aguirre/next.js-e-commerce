# UI Styling

Use this skill when creating or modifying UI, responsive layouts, Tailwind classes, shared components, accessibility, or visual states.

## Workflow

1. Read `doc/tailwindStyles.md` and `doc/react.md` when the change is non-trivial.
2. Reuse existing UI primitives before creating new components.
3. Keep presentation concerns in components and avoid unnecessary client components.
4. Build responsive behavior deliberately rather than patching individual breakpoints.
5. Cover loading, empty, error, disabled, focus, and interaction states when applicable.
6. Verify keyboard navigation and accessible names for interactive elements.
7. Keep user-visible strings in the i18n system.

## Rules

- Prefer Tailwind utilities and existing design-system primitives.
- Avoid arbitrary values when an existing design token or utility is appropriate.
- Do not duplicate styles that belong in a shared component.
- Avoid adding a dependency for a visual problem that can be solved with the existing stack.
