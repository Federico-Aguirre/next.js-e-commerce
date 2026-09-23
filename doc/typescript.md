# TypeScript Guidelines

Use TypeScript as the default language for application and configuration code.

## Type safety

- Keep `strict` mode enabled unless a documented compatibility constraint requires otherwise.
- Prefer inferred types when the compiler already expresses the intended contract clearly.
- Add explicit types at public boundaries, exported APIs, complex callbacks, and places where inference becomes unclear.
- Avoid `any`. Prefer `unknown` and narrow it safely when the value is not known.
- Prefer type narrowing and discriminated unions over assertions and unchecked casts.
- Keep domain types close to the domain they describe; avoid duplicating the same shape across unrelated files.

## Imports and exports

- Prefer named exports for reusable modules.
- Use default exports only when required by the framework or an established project convention.
- Use the project's configured path aliases for cross-directory imports.
- Use `import type` for type-only dependencies when the project tooling supports it.

## Functions and objects

- Prefer options objects when a function has several optional, boolean, or ambiguous parameters.
- Keep functions focused on one responsibility.
- Let return types be inferred unless an explicit annotation documents an important architectural contract.
- Do not weaken types merely to make a compiler error disappear; fix the underlying boundary or model.
