# Tailwind CSS and Styling Guidelines

Use the styling system already established by the project. For templates using Tailwind CSS, prefer utilities and shared components over one-off styling.

## General rules

- Keep styling consistent with the existing design system before introducing new patterns.
- Prefer Tailwind utilities for component-level styling.
- Reuse shared UI primitives and variants instead of duplicating large class lists.
- Keep responsive behavior mobile-first unless the project has an explicit different convention.
- Prefer semantic HTML and accessible states before styling them.
- Avoid arbitrary values when an existing design token or utility expresses the same intent.
- Do not introduce a second styling system without a concrete project requirement.

## Components

- Extract repeated or complex visual patterns into reusable components or variants.
- Keep visual variants explicit and typed when possible.
- Preserve existing dark-mode, theme, motion, and accessibility conventions when modifying shared components.
