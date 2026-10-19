# UI Styling

Use this skill when creating or modifying web UI, responsive layouts, shared components, Tailwind classes, accessibility, or visual states.

## Workflow

1. Read `ai/skills/reactjs-feature/SKILL.md` for non-trivial component/state work.
2. Inspect existing components under `src/components/ui/` before creating a new primitive.
3. Inspect the project's existing CSS tokens and Tailwind setup before adding styles.
4. Keep presentation concerns in components and avoid unnecessary client components.
5. Build responsive behavior deliberately rather than patching isolated breakpoints.
6. Cover relevant loading, empty, error, disabled, focus, and interaction states.
7. Verify keyboard navigation and accessible names for interactive elements.
8. Keep user-visible strings in next-intl dictionaries.

## Rules

- Prefer Tailwind CSS v4 utilities and the existing Radix/shared UI primitives.
- Do not copy native-app styling assumptions into the web app; the Expo app has a separate NativeWind/Tailwind setup.
- Avoid new visual dependencies when existing utilities/components can solve the problem.
- Preserve light/dark theme behavior, responsive layout, focus visibility, and reduced-motion preferences when applicable.
