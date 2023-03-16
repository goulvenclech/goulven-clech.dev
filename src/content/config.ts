// 1. Import utilities from `astro:content`
import { image, z, defineCollection } from "astro:content"
// 2. Define your collection(s)
const blogCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.date(),
    tags: z.array(z.string()),
    abstract: z.string(),
    image: image(),
    image_alt: z.string(),
    draft: z.boolean().default(false),
  }),
})
// 3. Export a single `collections` object to register your collection(s)
//    This key should match your collection directory name in "src/content"
export const collections = {
  blog: blogCollection,
}
