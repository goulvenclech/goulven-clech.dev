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
			abstract_clean: z.string().optional(),
			image: image().optional(),
			imageDark: image().optional(),
			imageAlt: z.string().default("Cover image"),
			cardImageFocusY: z.number().int().min(0).max(100).optional(),
			published: z.string().default("never"),
			timeMachine: z.string().optional(),
		}),
})
const changelogCollection = defineCollection({
	loader: glob({ pattern: "**/[^_]*.mdx", base: "./src/content/changelog" }),
	schema: () =>
		z.object({
			type: z.string().optional(),
			date: z.date(),
			url: z.string().optional(),
			url_caption: z.string().default("Read more"),
			name: z.string(),
			description: z.string(),
			is_deprecated: z.boolean().default(false),
		}),
})
const experiencesCollection = defineCollection({
	loader: glob({ pattern: "**/[^_]*.mdx", base: "./src/content/experiences" }),
	schema: () =>
		z.object({
			company: z.string(),
			start_date: z.date(),
			end_date: z.date().optional(),
			is_education: z.boolean().default(false),
			is_draft: z.boolean().default(false),
		}),
})
// 3. Export a single `collections` object to register your collection(s)
//    This key should match your collection directory name in "src/content"
export const collections = {
	blog: blogCollection,
	changelog: changelogCollection,
	experiences: experiencesCollection,
}
