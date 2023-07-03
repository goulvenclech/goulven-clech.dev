# 👋👋👋

My personnal blog, made with [Astro](https://docs.astro.build), [TypeScript](https://www.typescriptlang.org/) & [Tailwind CSS](https://tailwindcss.com/).

Live at [goulven-clech.dev](https://goulven-clech.dev), hosted by [Vercel](https://vercel.com/).

## Project Structure

```
/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   └── Card.astro
│   ├── content/
│   │   └── blog/
│   │       └── year/
│   │           └── an entries_slug/
│   │               └── index.mdx
│   │               └── static.img
│   │   └── orgs/
│   │       └── organization.mdx/
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
└── package.json
```

`pages/` contains every page of this blog as `.astro` files.

`content/` contains every blog entries (and their images), as `.mdx` files.

`layouts/` and `components/` contains every web component as `.astro`` files.

Any static assets, like images, can be placed in the `public/` directory.

## Commands

| Command                 | Action                                           |
| :---------------------- | :----------------------------------------------- |
| `pnpm install`          | Installs dependencies                            |
| `pnpm run dev`          | Starts local dev server at `localhost:3000`      |
| `pnpm run build`        | Build your production site to `./dist/`          |
| `pnpm run preview`      | Preview your build locally, before deploying     |
| `pnpm run astro ...`    | Run CLI commands like `astro add`, `astro check` |
| `pnpm run astro --help` | Get help using the Astro CLI                     |

All commands should be run from the root of the project, from a terminal. Instead of PNPM, you can also use NPM or Yarn.
