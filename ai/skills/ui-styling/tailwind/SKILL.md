### Skill: tailwind-skill

This skill is triggered when a task requires creating, modifying, or styling UI components with Tailwind CSS.

#### Workflow

1. Review existing UI components in src/components/ui/ (Shadcn/Radix) before creating new ones.
2. Inspect src/styles/global.css for custom CSS variables and tokens.
3. Apply project design system conventions.

#### Styling Rules

- Mobile-first: Maintain mobile-first responsive behavior.
- System tokens: Prefer Tailwind utilities and semantic variants over arbitrary values (e.g., use bg-primary instead of bg-[#123456]).
- Accessible states: Ensure hover, focus-visible, active, and dark mode states are accounted for.
- Reusability: Extract complex patterns to Class Variance Authority (cva) variants or reusable src/components/ui/ primitives.
- Ensure animated elements include explicit transition durations where applicable.
- Incorporate accessibility attributes (aria-labels, focus rings) when necessary.
