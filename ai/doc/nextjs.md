# Next.js Guidelines

These rules apply when the project uses Next.js App Router. Follow the project's installed Next.js version rather than assuming APIs from another version.

## App Router

- Keep server rendering as the default.
- Add `use client` only when browser-only APIs, interactive state, effects, or event handlers require it.
- Keep route handlers focused on HTTP concerns and move reusable domain logic into appropriate modules.
- Follow the project's established conventions for pages, layouts, loading states, errors, metadata, and route organization.
- Avoid duplicating server-side data fetching across components when a shared boundary can provide the data cleanly.

## Boundaries

- Do not expose secrets, server-only modules, or privileged operations to client components.
- Validate untrusted input at server boundaries such as route handlers, server actions, and external integrations.
- Keep environment access centralized according to the project's configuration strategy.

## Performance

- Prefer server-side work when it avoids unnecessary client JavaScript.
- Optimize images and fonts using the framework's supported mechanisms when appropriate.
- Do not add caching, memoization, or dynamic rendering configuration without understanding the behavior it changes.
