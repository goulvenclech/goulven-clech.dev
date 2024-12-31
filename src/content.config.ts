// 1. Import utilities from `astro:content`
import { z, defineCollection } from "astro:content"
import { glob } from "astro/loaders"
// 2. Define your collection(s)
const blogCollection = defineCollection({
  loader: glob({ pattern: "**/[^_]*.mdx", base: "./src/content/blog" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.date(),
      tags: z.array(z.string()).default([]),
      abstract: z.string(),
      display_abstract: z.boolean().default(false),
      display_cover: z.boolean().default(false),
      display_toc: z.boolean().default(false),
      image: image().optional(),
      image_alt: z.string().default("Cover image"),
      image_caption: z.string().default(""),
      image_source: z.string().optional(),
      published: z.string().default("never"),
    }),
})
const changelogCollection = defineCollection({
  loader: glob({ pattern: "**/[^_]*.mdx", base: "./src/content/changelog" }),
  schema: () =>
    z.object({
      type: z.string(),
      date: z.date(),
      url: z.string().optional(),
      url_caption: z.string().default("Read more"),
      name: z.string(),
      description: z.string(),
    }),
})
const experiencesCollection = defineCollection({
  loader: glob({ pattern: "**/[^_]*.mdx", base: "./src/content/experiences" }),
  schema: () =>
    z.object({
      company: z.string(),
      start_date: z.date(),
      end_date: z.date().optional(),
    }),
})
// 3. Export a single `collections` object to register your collection(s)
//    This key should match your collection directory name in "src/content"
export const collections = {
  blog: blogCollection,
  changelog: changelogCollection,
  experiences: experiencesCollection,
}
