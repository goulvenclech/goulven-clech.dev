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
- Astro components in `.astro` files, client-side interactive components in `.ts` files.
- The project historically had no tests. All new features must include unit tests on observable behavior, and pre-existing features should be progressively covered when touched.

## Agent Guardrails

- All code, comments, documentation, commit messages, and user-facing output must be in English.
- Do not create documentation files to explain implementation.
- Do not add external dependencies without justification. Prefer native APIs and existing utilities.
