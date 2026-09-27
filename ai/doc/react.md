# React Guidelines

## Components

- Prefer small, focused components with a clear responsibility.
- Keep components server-side by default when the framework supports Server Components.
- Add client-side boundaries only when state, effects, browser APIs, or event handlers require them.
- Prefer composition and reusable primitives over duplicated markup.
- Keep business logic out of presentational components when it can be isolated cleanly.

## State and effects

- Keep state as local as possible.
- Use global state only for genuinely shared client state.
- Avoid effects for values that can be derived during rendering.
- Do not add memoization solely as a habit; use it when profiling or a clear referential-stability requirement justifies it.
- Keep asynchronous server state separate from local UI state when the project uses a dedicated data-fetching solution.

## Accessibility

- Use semantic HTML elements.
- Prefer native controls before custom interactive elements.
- Preserve keyboard navigation, focus behavior, labels, and accessible names when modifying UI.
