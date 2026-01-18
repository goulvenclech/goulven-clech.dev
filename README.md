# 👋👋👋

My personnal website, made with [Astro](https://docs.astro.build), [TypeScript](https://www.typescriptlang.org/) & [Tailwind CSS](https://tailwindcss.com/). Live at [goulven-clech.dev](https://goulven-clech.dev), hosted by [Netlify](https://www.netlify.com/).

The source code is provided under the [0BSD license](https://spdx.org/licenses/0BSD.html), attribution is appreciated but not required. The textual content is provided under the [CC BY 4.0 Deed](https://spdx.org/licenses/CC-BY-4.0.html), attribution is required. But for both, you are free to use, copy, modify, and/or distribute for any purpose, commercial or personal.

Some entries may cite text, images or resources from external sources: their original licenses apply, and I indicate the authors if known.

## Notable features

At its heart, this project looks like any Astro project, you can start by reading my entry ["Launching a blog with Astro"](https://goulven-clech.dev/2023/launching-blog-astro). But, little by little, I added some original features that might interest you, here are the main ones:

- [Search bar](https://github.com/goulvenclech/goulven-clech.dev/blob/master/src/components/Search.astro): made with Astro and Web Components only, filter blog entries based on user's input.

- [Catalogue](https://goulven-clech.dev/catalogue): personal media log with full-text search, multi-criteria filters (source, emotions, rating) and paginated loading. Powered by Astro API routes deployed as Netlify Functions, with data persisted in a Turso (SQLite) edge database.

- [Table of contents](https://github.com/goulvenclech/goulven-clech.dev/blob/master/src/components/TableOfContent.astro): using Astro and MDX, generate a table of contents based on the headings. With nested lists.

- [Open Library](https://github.com/goulvenclech/goulven-clech.dev/blob/master/src/components/blocks/BookBlock.astro) & [Google Maps](https://github.com/goulvenclech/goulven-clech.dev/blob/master/src/components/blocks/MapsBlock.astro) blocks: nicely displays API results in blog entries.

- [Dark mode](https://github.com/goulvenclech/goulven-clech.dev/blob/master/src/components/controls/DarkMode.astro): toggle between light, dark, and system color schemes. Use local storage to persist the user's choice.

- [Custom image service](https://github.com/goulvenclech/goulven-clech.dev/blob/master/src/imageService.ts): retrieved from [Erika's blog](https://erika.florist/), gain performance and display a placeholder during image loading.

## Project Structure

```
/
├── src/
│   ├── content/ -> Sub repository
│   ├── assets/
│   │   └── base.css
│   ├── components/
│   │   └── Component.astro
│   ├── layouts/
│   │   └── Layout.astro
│   ├── pages/
│   │   └── index.astro
│   ├── env.d.ts
│   └── [...utils].ts
├── public/
│   └── Iosevka-Regular.woff2
├── [... config files]
├── README.md
└── package.json
```

`pages/` contains every page of this blog as `.astro` files.

`layouts/` and `components/` contains every web component as `.astro`` files.

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
