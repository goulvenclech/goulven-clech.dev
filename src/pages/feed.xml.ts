import rss from "@astrojs/rss"
import { getCollection } from "astro:content"
/**
 * Generate an RSS feed of all published blog posts.
 * @param context Astro context object
 * @returns an XML file containing the RSS feed
 */
export async function GET(context: any) {
  // get all blogEntries
  const blogEntriesRaw = await getCollection("blog", ({ data }) => {
    // filter out draft articles
    return data.draft !== true
    // else return every articles
    return true
  })
  return rss({
    title: "Goulven CLEC'H - Blog",
    description: "I'm a software developer based in Toulouse, France. Welcome to my personal blog!",
    site: context.site,
    items: blogEntriesRaw.map(({ slug, data }) => ({
      title: data.title,
      description: data.abstract,
      pubDate: data.date,
      link: context.site + slug,
      // No full content in the RSS feed cause I don't know
      // how to parse MDX in RSS yet 😥
    })),
  })
}
