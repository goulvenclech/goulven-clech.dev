# catalogue-mcp

A local, read-only [MCP](https://modelcontextprotocol.io) server that lets Claude (or any MCP client) browse my [goulven-clech.dev](https://goulven-clech.dev) catalogue and to-do lists.

It runs on my machine over stdio (no listener, no auth, nothing hosted) and reads everything from the site's public JSON API, so it holds no secrets and can only read.

## Tools

- `search_reviews` — filter reviews by `type`, `rating`, `emotion`, date (`year`/`after`/`before`), or free-text `query`; sort and limit.
- `list_emotions` — the emotion names `search_reviews` accepts.
- `list_todo_lists` — my curated lists, with completion progress.
- `get_todo_list` — one list's entries, with their done/to-do status.

## Build

```sh
pnpm install
pnpm --filter @goulven-clech/catalogue-mcp build
```

## Use it

Claude Code:

```sh
claude mcp add catalogue -- node /ABSOLUTE/PATH/goulven-clech.dev/packages/catalogue-mcp/dist/index.js
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
	"mcpServers": {
		"catalogue": {
			"command": "node",
			"args": [
				"/ABSOLUTE/PATH/goulven-clech.dev/packages/catalogue-mcp/dist/index.js"
			]
		}
	}
}
```

It reads from `https://goulven-clech.dev` by default; set `CATALOGUE_BASE_URL` to point at a local dev build.

## Develop

```sh
pnpm --filter @goulven-clech/catalogue-mcp dev    # tsc --watch
pnpm --filter @goulven-clech/catalogue-mcp test
```
