# Exercise D — MCP: setup log

**Honest status:** the code below is written and reviewed, but not yet *run* — this
session has no working Node.js/npm in its execution sandbox (confirmed: `node`/`npm`
are not on `PATH` and not found anywhere searchable on this machine's usual install
locations from here), so `npm install`, launching the server, and calling its tools
through a live Claude Code session all need to happen on your machine. See
[client-transcript.md](client-transcript.md) for exact commands and what to expect.

## Part 1 — pre-built servers

- **Filesystem MCP** — registered in [`.mcp.json`](../../.mcp.json) as `"filesystem"`,
  via `npx -y @modelcontextprotocol/server-filesystem .` (repo root). No new dependency
  in any `package.json` — `npx -y` fetches it on demand.
- **GitHub MCP** — **not registered.** The repo does have a GitHub remote
  (`origin git@github.com:AbdullahBM/book-shelf-claude.git`), so this is available if
  wanted, but it needs its own auth (a GitHub token or `gh` CLI login) that only you can
  provide, and the brief lists it as the less load-bearing of the two pre-built servers.
  Skipped to keep the exercise focused on Part 2, which the mentor notes call "the
  highest-value exercise on Day 3." Add it later with:
  ```json
  "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] }
  ```

## Part 2 — custom BookShelf MCP server

New workspace: [`apps/mcp-server`](../../apps/mcp-server) — `package.json`, `tsconfig.json`,
`src/data.ts`, `src/index.ts`. Three tools:

| Tool | Reads | Returns |
|---|---|---|
| `query_books` | `data/books.json` | Books matching title/author (substring) and/or genre (exact), all case-insensitive |
| `get_book_stats` | `data/books.json` | `{ total, byGenre, mostRecent }` |
| `get_shelf_contents` | `data/shelves.json` + `data/books.json` | Shelves (optionally filtered by id/user), with book ids resolved to titles |

**Deliberate deviation from `CLAUDE.md`'s own Architecture note**, which (before this
session) said the MCP server exists "so logic left in a route handler would have to be
copy-pasted... that is why it lives in `services/`" — implying it should import
`apps/api/src/services/*`. It doesn't. Reasons, and now reflected in the updated
`CLAUDE.md`:
- No workspace in this repo imports another app's `src/` — the one cross-workspace
  boundary that exists (`packages/shared`) is deliberately restricted to its root export.
  Making `apps/mcp-server` depend on `apps/api` internals would be a new architectural
  pattern introduced solely for a tool the brief says to "keep simple."
- The logic actually needed (substring filter, a genre `reduce`, a sort) is ~15 lines —
  not enough complexity to justify that coupling.
- What *is* reused: the `Book`/`Shelf` **types** from `@bookshelf/shared` — this repo's
  one established cross-boundary mechanism, used exactly as intended.

**New dependency, flagged and explicitly approved before adding:**
`@modelcontextprotocol/sdk` — this conflicts with `CLAUDE.md`'s own "don't add npm
dependencies without asking" rule. Approved for this specific, one-time exception
because the whole exercise is impossible without it. `zod` is also a dependency of the
new workspace, but it's already a dependency everywhere else in the monorepo, so it's
not a *new* dependency to the tree overall.

**No test file** for `apps/mcp-server` — consistent with the brief's "keep it simple,
this is a development tool, not production code." The standard manual check is the MCP
Inspector (see [client-transcript.md](client-transcript.md)).
