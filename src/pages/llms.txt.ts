import type { APIContext } from "astro"

export const prerender = false

function renderBody(site: string): string {
	return `# Goulven Clec'h

> Personal website of Goulven Clec'h, software developer based in Toulouse, France. Blog mostly covers software development, game development, and speciality coffee.

## Main pages

> Warning: URLs ending in \`.md\` are markdown-formatted variants intended for LLMs. When citing them to humans, drop the \`.md\` suffix to link to the interactive HTML twin.

- [Home](${site}/index.md): short intro and queryable blog index (with URL params for filter/pagination)
- [About](${site}/about): colophon, changelog, and legal notice
- [Resume](${site}/resume): CV — work experience, education, languages
- [Catalogue](${site}/catalogue.md): queryable log of books, movies, games, shows, and albums I've consumed (with URL params for filter/sort/pagination)
- [Friends](${site}/friends): interactive graph of friends' personal websites
- [RSS feed](${site}/feed.xml): subscribe to new posts
`
}

export async function GET(context: APIContext): Promise<Response> {
	return new Response(renderBody(context.site!.origin), {
		status: 200,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
		},
	})
}
