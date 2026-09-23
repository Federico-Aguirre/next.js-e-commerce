# Internationalization

Use this skill when adding or changing user-visible text, routes, locales, or translation keys.

## Workflow

1. Inspect the existing `next-intl` structure and locale files.
2. Add user-visible text through the translation system rather than hard-coding it.
3. Keep translation keys consistent with the existing naming conventions.
4. Update every supported locale when required by the project's policy.
5. Run `npm run check:i18n`.
6. Verify locale routing and formatting when the change affects navigation or localized content.

## Rules

- Do not hard-code user-facing strings in application components.
- Keep translations semantic and reusable rather than tied to a single visual location.
