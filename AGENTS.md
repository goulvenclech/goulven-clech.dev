# Agents Guide

Personal website built with Astro, TypeScript (strict mode) & Tailwind CSS v4. Live at [goulven-clech.dev](https://goulven-clech.dev).

## Useful Commands

```sh
pnpm check          # format (prettier) + type-check (astro check + tsc)
pnpm test:run       # run all tests (vitest)
pnpm dev            # dev server with type-checking
```

## Keep in mind

- The main [README](./README.md) describes notable features and project philosophy, the submodule [README](./src/content/README) describes content-specific conventions.
- The project historically had no tests. All new features must include unit tests on observable behavior, and pre-existing features should be progressively covered when touched.

## Quality Guidelines

- Write idiomatic, easy-to-maintain TypeScript/Astro. Avoid duplication, prefer clarity over cleverness, and small focused functions over dark magic.
- Prefer self-documenting code first. Expressive names over cryptic abbreviations, straightforward logic over hidden state or surprising side effects. Comments explain _why_ (intent, invariants, trade-offs), not _how_, and should never be decorative.
- Tests assert observable behavior (inputs/outputs, effects), not implementation details. Keep them deterministic and isolated from global state.
- Absence is a value, not a failure: return `T | null` from lookups, `undefined` for optional inputs, and consume it with `?.`/`??`. Reserve `throw` and `!` for what should never happen (missing env/config, input that must not pass silently).
- Validate input where it enters: Zod for content frontmatter ([`src/content.config.ts`](./src/content.config.ts)), manual checks for URL params and request bodies. Surface failures at the boundary (SSR handler → 500, client script → fallback UI), not deep in utilities.
- Use named imports and path aliases (`$src/`, `$components/`, `$layouts/`, `$assets/`), not long relative chains.

## Agent Guardrails

- All code, comments, documentation, commit messages, and user-facing output must be in English.
- Do not create documentation files to explain implementation.
- Do not add external dependencies without justification. Prefer native APIs and existing utilities.
