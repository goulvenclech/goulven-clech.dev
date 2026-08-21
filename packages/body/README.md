# Body

Personal workout tracker at [body.goulven-clech.dev](https://body.goulven-clech.dev). A fully static Astro site: the training programme is JSON baked in at build time, and the only runtime state is an append-only log in the browser's IndexedDB. The rationale is explained on [/health#physical_activity](https://goulven-clech.dev/health#physical_activity).

## How it works

- `data/` holds the programme: the exercise catalogue, one JSON template per session, and the weekly plan. [src/program.ts](./src/program.ts) parses it all against the Zod schemas in [src/schemas.ts](./src/schemas.ts) at build time — an invalid file breaks CI, never a session at the gym. The field-level semantics live in the schemas' comments.
- The only runtime state is an append-only log in IndexedDB ([src/logStore.ts](./src/logStore.ts)), exportable and importable as JSON from the History screen. Entries reference exercises by slug, never sessions, so history survives programme redesigns.
- Nothing else is stored: [src/engine.ts](./src/engine.ts) recomputes today's targets from the log — double progression with automatic deloads, and a display-only Epley 1RM.
- Cross-device sync is optional plumbing over the main site's `/api/body/*` routes ([src/client/sync.ts](./src/client/sync.ts)): reads are public, writes trade the shared catalogue password — typed once per browser, on the History screen — for a token in localStorage. IndexedDB stays the source of truth: the outbox pushes in the background, pulls union entries by id, and being offline is a normal state.

## Local development

```sh
pnpm install          # from the repository root
pnpm dev              # from packages/body
pnpm typecheck        # astro check + tsc
pnpm test             # vitest
```

## Deployment

Its own Netlify site, from the same repository: set the site's **Base directory** to `packages/body` (the [netlify.toml](./netlify.toml) there takes over) and attach the `body.goulven-clech.dev` domain. No environment variables, no database on this site — the sync backend lives on the main site, which needs a `BODY_SYNC_SECRET` (random 32 bytes) next to the existing `CATALOGUE_PASSWORD` in its Netlify environment.
