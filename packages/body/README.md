# Body

Personal workout tracker at [body.goulven-clech.dev](https://body.goulven-clech.dev). Made with Astro, Netlify Functions & Turso, same stack as the main site's catalogue. The rationale is explained on [/health#physical_activity](https://goulven-clech.dev/health#physical_activity).

Still WIP: per-session exercise plans, next-target automation, stagnation detection, ascending sets and plate math.

> [!WARNING]
> Not deployed yet, so nothing here can conflict with production for now.

## Local development

```sh
pnpm install          # from the repository root
pnpm dev              # from packages/body
pnpm typecheck        # astro check + tsc
pnpm test             # vitest
```

Create `packages/body/.env` with:

```sh
TURSO_URL=libsql://…
TURSO_TOKEN=…
BODY_PASSWORD=…
```

The database schema lives in [db/schema.sql](./db/schema.sql):

```sh
turso db create body
turso db shell body < db/schema.sql
```

## Deployment

Its own Netlify site, from the same repository: set the site's **Base directory** to `packages/body` (the [netlify.toml](./netlify.toml) there takes over), attach the `body.goulven-clech.dev` domain, and define the three environment variables above in the site settings.
