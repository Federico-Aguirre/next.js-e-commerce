# Contributing

## Development

Use the project's existing npm scripts and keep changes focused.

Before opening a pull request:

1. Run the smallest relevant validation.
2. Expand validation when the change affects broader behavior.
3. Review the final diff for regressions and unrelated changes.
4. Update documentation when a durable project convention changes.

## Commits

Use Conventional Commits:

`type: summary`

Allowed types include `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, and `revert`.

Keep the summary short, specific, and imperative.

## Documentation

Keep `AGENTS.md` concise. Put detailed, reusable technical guidance in `doc/` and read it only when relevant.

Project-specific decisions should be documented in project-specific documentation rather than added to the base template.
