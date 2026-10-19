---
name: mobile-app
description: Expo and React Native implementation guidance for the separate ecommerce-mobile application.
---

# Mobile Application

Use this skill for native screens, Expo Router navigation, React Native components, NativeWind styling, native storage, mobile authentication UX, or mobile-only dependencies.

## Separate application boundary

- Application root: `ecommerce-mobile/`.
- Routes/screens: `ecommerce-mobile/src/app/`.
- Components: `ecommerce-mobile/src/components/`.
- Services: `ecommerce-mobile/src/services/`.
- State: `ecommerce-mobile/src/store/`.
- The app has its own `package.json`; check installed versions there rather than assuming root web dependencies apply.

The current mobile stack includes Expo SDK 57, Expo Router, React Native 0.86, React 19, NativeWind 4 with Tailwind CSS 3, Zustand, AsyncStorage, Expo AuthSession, Google Sign-In and React Native Reanimated. Keep this stack distinct from the web app's Next.js/Tailwind CSS 4 stack.

## Workflow

1. Inspect the relevant screen, service, store and current navigation pattern before adding abstractions.
2. Use React Native primitives and the mobile design conventions; do not import DOM elements, Next.js navigation or web-only UI components into native screens.
3. Use Expo Router for navigation and follow existing service boundaries for server requests.
4. Keep secrets out of the app bundle. Client-side app configuration and public keys are not substitutes for server authorization.
5. Use the current Zustand/AsyncStorage patterns for persisted client state; do not introduce a second global store without a demonstrated need.
6. Read `ai/skills/mobile-api-sync/SKILL.md` before changing any consumed API response, authentication endpoint, CORS, shared schema, or commerce contract.
7. Keep mobile authentication separate from the web browser session UI. Follow existing native login/token endpoints and preserve their compatibility with the backend.
8. Verify both Android/iOS platform assumptions when touching native configuration or platform-specific libraries; don't assume an installed native package works on web.
9. Run the smallest relevant mobile lint/type/build check available from `ecommerce-mobile/package.json`. Do not install dependencies or regenerate native projects without a task-specific reason.
