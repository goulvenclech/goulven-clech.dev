# Agents Guide

Principles for how automated agents and contributors generate code and docs here. Favor clarity, small testable units, and the project’s existing conventions.

## Core Engineering Values

- Clarity over cleverness: write idiomatic, expressive, statically typed code.
- Leverage TypeScript's strict mode and its type system. Avoid `any` at all costs.
- Prefer small, focused components and explicit types over "magic".
- Use immutability by default; prefer `const`, readonly properties, and pure functions.

## Stack

- **Astro** for static site generation and content collections.
- **TypeScript** with strict mode (`astro/tsconfigs/strict`).
- **Tailwind CSS v4** for styling.
- **MDX** for rich content authoring.
- Path aliases: `$components/*`, `$layouts/*`, `$assets/*`.

## Testing

- Unit-test pure functions and isolated modules.
- Assert observable behavior (inputs/outputs, effects), not internal details.
- Keep tests deterministic and independent of global state.
- Before submitting changes, run `pnpm check` and `pnpm test:run` to ensure CI will pass.

## Errors

- Use typed error handling with discriminated unions or custom error types.
- Keep error messages concise and in English; add context at the boundary (API routes, pages) rather than deep in utilities.
- Avoid silent failures; prefer explicit error states in components.
- Use `Result`-like patterns or nullable types with proper narrowing instead of throwing exceptions in utilities.

## Documentation

- Self-documenting code first: expressive names and straightforward logic.
- Comments explain why (intent, invariants, trade‑offs), not how.
- All code, comments, documentation, commit messages, and user-facing output must be in English.
- Do NOT create a documentation file to explain the implementation.

## Repository Conventions

- Before generating new code or docs, parse repository to inherit existing conventions and avoid duplication.
- Match the current project structure, naming, and style; do not create parallel patterns.
- Use explicit named imports; avoid default exports when possible.
- Astro components in `.astro` files, client-side interactive components in `.ts` files.

## Changes & Dependencies

- Do not alter CI/CD configuration unless explicitly instructed.
- Avoid introducing external dependencies; add only with strong justification and prior discussion. Prefer native APIs and existing utilities.
