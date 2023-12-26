// 1. Import utilities from `astro:content`
import { z, defineCollection } from "astro:content"
// 2. Define your collection(s)
const blogCollection = defineCollection({
  type: "content",
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.date(),
      tags: z.array(z.string()),
      abstract: z.string(),
      image: image(),
      image_alt: z.string(),
      image_caption: z.string(),
      image_source: z.string().optional(),
      icon: z.string().default("📝"),
      draft: z.boolean().default(false),
    }),
})
const changelogCollection = defineCollection({
  type: "content",
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
// 3. Export a single `collections` object to register your collection(s)
//    This key should match your collection directory name in "src/content"
export const collections = {
  blog: blogCollection,
  changelog: changelogCollection,
}
