---
name: i18n
description: Localized route, next-intl, message dictionary, metadata, and formatting guidelines for the web app.
---

# Internationalization

Use this skill when adding/changing user-visible copy, localized routes, metadata, navigation labels, form errors, number/date/currency formatting, or translation keys.

## Current setup

- Supported web locales: English (`en`) and Spanish (`es`), configured in `src/utils/AppConfig.ts`.
- Locale prefix mode: `as-needed`; English is the default locale, so its route commonly has no `/en` prefix while Spanish uses `/es`.
- Dictionaries: `src/locales/en.json` and `src/locales/es.json`.
- Routing helpers: `src/lib/I18nRouting.ts`; request messages: `src/i18n/request.ts`.
- Localized pages live under `src/app/[locale]/`, but a few cart/product/checkout/history paths have special proxy handling. Inspect `src/proxy.ts` before changing route behavior.

## Workflow

1. Inspect the closest route/component and its namespace in both locale dictionaries.
2. Add user-visible copy to every supported locale in the same logical change; avoid hard-coded text in JSX, error states, placeholders, accessibility labels and metadata.
3. Use `getTranslations` for server-rendered content and `useTranslations` for client components, following the nearest existing convention.
4. Use the project's routing helpers where they are already established. Do not assume a plain Next.js Link is interchangeable with the locale-aware helper on every route.
5. Keep keys semantic and reusable instead of tying them only to a particular layout.
6. Verify default and Spanish paths, including authentication/proxy exceptions when relevant.
7. Run `npm run check:i18n` only when its script/config is applicable; inspect its behavior first if it fails because the repository uses a custom script/plugin setup.

## Rules

- Never silently add a new locale or assume English is the only locale.
- Do not leave a key missing from one supported dictionary.
- Preserve locale prefixing, canonicalization and language-switch behavior.
- Format dates, numbers and amounts according to the user's locale when the existing screen requires localized formatting.
