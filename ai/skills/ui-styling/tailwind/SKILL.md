---
name: tailwind
description: Project rules for Tailwind CSS, shared UI primitives, responsive design, and accessibility.
---

# Tailwind CSS and Web Styling

Use the existing web design system. Prefer Tailwind utilities, semantic theme tokens and shared UI components over one-off styles or custom styling systems.

## General rules

- Preserve the established visual language before adding new patterns.
- Reuse components from `src/components/ui/` before creating new primitives or duplicating complex class combinations.
- Keep layouts mobile-first and add responsive modifiers for larger screens.
- Use semantic HTML and accessible interaction patterns before adding visual polish.
- Prefer existing semantic tokens such as `bg-background`, `text-foreground`, `text-muted-foreground` and `bg-primary` over arbitrary colors when they express the intended design.
- Do not introduce a second styling system without an explicit technical requirement.

## Components and variants

- Extract repeated or complex visual patterns into cohesive shared components or typed variants when there is real reuse.
- Preserve dark-mode behavior, focus visibility, keyboard interaction and reduced-motion preferences.
- Use explicit focus states and accessible names for icon-only or otherwise ambiguous controls.
- Do not use visual styling or client-side visibility as a substitute for authorization or status correctness.

## Workflow

1. Inspect existing primitives under `src/components/ui/` and nearby screens before editing.
2. Inspect the active CSS tokens in `src/app/globals.css`, `src/styles/global.css` and Tailwind configuration only as needed.
3. Keep web styling on the installed Tailwind CSS v4 setup.
4. For Expo/React Native screens, use `ai/skills/mobile-app/SKILL.md`; NativeWind uses the separate mobile dependency setup and must not inherit web-only assumptions.
