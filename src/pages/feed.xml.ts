import rss from "@astrojs/rss"
import { getCollection } from "astro:content"
import { isEntryPublished } from "src/utils"
/**
 * Generate an RSS feed of all published blog posts.
 * @param context Astro context object
 * @returns an XML file containing the RSS feed
 */
export async function GET(context: any) {
  // get all blogEntries published
  const blogEntriesRaw = await getCollection("blog", ({ data }) => {
    return isEntryPublished(data.published, true)
  })
  return rss({
    title: "Goulven CLEC'H - Blog",
    description: "I'm a software developer based in Toulouse, France. Welcome to my personal blog!",
    site: context.site,
    items: blogEntriesRaw.map(({ id, data }) => ({
      title: data.title,
      description: data.abstract,
      pubDate: data.date,
      link: context.site + id,
      // No full content in the RSS feed cause I don't know
      // how to parse MDX in RSS yet 😥
    })),
  })
}
