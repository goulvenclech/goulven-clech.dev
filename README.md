# 👋👋👋

My personnal blog, made with [Astro](https://docs.astro.build), [TypeScript](https://www.typescriptlang.org/) & [Tailwind CSS](https://tailwindcss.com/). Live at [goulven-clech.dev](https://goulven-clech.dev), hosted by [Vercel](https://vercel.com/).

The source code is provided under the [0BSD license](https://spdx.org/licenses/0BSD.html), attribution is appreciated but not required. The blog textual content is provided under the [CC BY 4.0 Deed](https://spdx.org/licenses/CC-BY-4.0.html), attribution is required. But for both, you are free to use, copy, modify, and/or distribute for any purpose, commercial or personal.

Some articles may cite text, images or resources from external sources: their original licenses apply, and I indicate the authors if known.

## Notable features

At its heart, this project looks like any blog made with Astro, you can start by reading my article ["Launching a blog with Astro"](https://goulven-clech.dev/2023/launching-blog-astro). But, little by little, I added some original features that might interest you:

- [Search bar](https://github.com/goulvenclech/goulven-clech.dev/blob/master/src/components/Search.astro): made with Astro and Web Components only, filter blog entries based on user's input.

- [Open Library](https://github.com/goulvenclech/goulven-clech.dev/blob/master/src/components/blocks/BookBlock.astro) & [Google Maps](https://github.com/goulvenclech/goulven-clech.dev/blob/master/src/components/blocks/MapsBlock.astro) blocks: nicely displays API results in blog entries.

- [Custom image service](https://github.com/goulvenclech/goulven-clech.dev/blob/master/src/imageService.ts): retrieved from [Erika's blog](https://erika.florist/), gain performance and display a placeholder during image loading.

## Project Structure

```
/
├── public/
│   └── fonts.ttf
│
├── src/
│   ├── components/
│   │   └── Card.astro
│   │
│   ├── content/
│   │   ├── blog/
│   │   │   └── year/
│   │   │       └── an entries_slug/
│   │   │           ├── index.mdx
│   │   │           └── static.img
│   │   │
│   │   └── orgs/
│   │       └── organization.mdx/
│   │
│   ├── layouts/
│   │   └── Layout.astro
│   │
│   └── pages/
│       └── index.astro
│
└── package.json
```

`pages/` contains every page of this blog as `.astro` files.

`content/` contains every blog entry (and their images), as `.mdx` files.

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
